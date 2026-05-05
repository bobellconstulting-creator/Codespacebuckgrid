// social-hooks.ts — event emitter for BuckGrid Pro social promotion.
//
// Whenever Tony AI finishes a notable analysis, a user hits a milestone, or a
// parcel scores exceptionally well, we POST to the Linda webhook at
// http://localhost:18795/buckgrid-social. Linda drafts a platform-specific
// post and queues it in her pending/ dir for Bo's 1-week review.
//
// This file is the PUBLISHER side. Linda's listener is separate.
//
// Nothing here is customer-facing. All posts pass through a grounding lint
// before they hit any social account.

export type SocialEventType =
  | 'tony_analysis_complete'
  | 'parcel_top_rated'
  | 'new_signup'
  | 'first_paid_user'
  | 'agri_pilot_request'
  | 'milestone'

export interface SocialEvent {
  type: SocialEventType
  /** Short human-readable headline, 60 chars max */
  headline: string
  /** Grounded facts the post MUST stay within */
  facts: Record<string, string | number>
  /** Optional anonymized image/screenshot URL */
  imageUrl?: string
  /** Where the event originated in the codebase */
  source: string
  /** Unix ms */
  ts: number
}

const LINDA_WEBHOOK = process.env.LINDA_SOCIAL_WEBHOOK ?? 'http://127.0.0.1:18795/buckgrid-social'
const ENABLED = process.env.BUCKGRID_SOCIAL_HOOKS === 'true'

function stripPII(facts: Record<string, string | number>): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(facts)) {
    if (/email|phone|name|user_id|ip/i.test(k)) continue
    out[k] = v
  }
  return out
}

export async function emitSocialEvent(event: Omit<SocialEvent, 'ts'>): Promise<void> {
  if (!ENABLED) return

  const payload: SocialEvent = {
    ...event,
    facts: stripPII(event.facts),
    ts: Date.now(),
  }

  try {
    await fetch(LINDA_WEBHOOK, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      // Fire-and-forget: short timeout so we never block a user-facing request
      signal: AbortSignal.timeout(2000),
    })
  } catch {
    // Silently swallow. Social promotion is best-effort. Never break the
    // customer flow because Linda's webhook is down.
  }
}

/**
 * Convenience wrapper for the Tony analyze-map route. Call after a successful
 * analysis with the aggregated facts the LLM should stay within.
 */
export async function emitTonyAnalysisComplete(args: {
  acres: number
  cropPercent?: number
  forestPercent?: number
  topRecommendation: string
  source: string
}): Promise<void> {
  await emitSocialEvent({
    type: 'tony_analysis_complete',
    headline: `Tony just analyzed a ${Math.round(args.acres)}-acre property`,
    facts: {
      acres: Math.round(args.acres),
      ...(args.cropPercent !== undefined ? { crop_percent: args.cropPercent } : {}),
      ...(args.forestPercent !== undefined ? { forest_percent: args.forestPercent } : {}),
      top_recommendation: args.topRecommendation,
    },
    source: args.source,
  })
}
