// tonyJson.ts — hardened extraction of Tony's JSON from raw LLM output.
//
// LLMs wrap JSON in markdown fences, add prose around it, emit raw newlines
// inside strings, leave trailing commas, and truncate mid-token when they hit
// the output limit. This module recovers a usable object from all of those,
// and parseTonyV2 reports whether parsing succeeded so the caller can decide
// to fall back to the deterministic placement engine.

// ─── Shared Tony response types ───────────────────────────────────────────────

export type RelativePosition = 'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest' | 'center'
export type ZoneType = 'food_plot' | 'kill_plot' | 'access_route' | 'bedding' | 'stand_site' | 'water' | 'staging_area' | 'sanctuary'
export type RelativeSize = 'tiny' | 'small' | 'medium' | 'large'
export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type SeasonLabel = 'all' | 'spring' | 'summer' | 'fall' | 'winter'

export interface TonyZone {
  id: string
  name: string
  type: ZoneType
  relative_position: RelativePosition
  relative_size: RelativeSize
  description: string
  confidence: ConfidenceLevel
  season: SeasonLabel
  /** Grounded mode: id of the engine candidate this zone references */
  candidate_id?: string
  /** Grounded mode: real geometry computed by the placement engine */
  geometry?: { type: string; coordinates: any }
  acres?: number
  grounded?: boolean
}

export interface StandSite {
  id: string
  name: string
  relative_position: RelativePosition
  wind_direction: string
  rating: number
  description: string
  candidate_id?: string
  geometry?: { type: string; coordinates: any }
  grounded?: boolean
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

const VALID_POSITIONS: RelativePosition[] = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'center']

export function normalizePosition(val: unknown): RelativePosition {
  if (typeof val === 'string') {
    const v = val.toLowerCase().replace(/[\s_-]/g, '')
    if (VALID_POSITIONS.includes(v as RelativePosition)) return v as RelativePosition
  }
  return 'center'
}

export function normalizeConfidence(val: unknown): ConfidenceLevel {
  if (val === 'high' || val === 'medium' || val === 'low') return val
  if (typeof val === 'number') {
    if (val >= 75) return 'high'
    if (val >= 50) return 'medium'
    return 'low'
  }
  return 'medium'
}

export function normalizeSeason(val: unknown): SeasonLabel {
  const valid: SeasonLabel[] = ['all', 'spring', 'summer', 'fall', 'winter']
  if (typeof val === 'string' && valid.includes(val as SeasonLabel)) return val as SeasonLabel
  return 'all'
}

export function normalizeZoneType(val: unknown): ZoneType {
  const valid: ZoneType[] = ['food_plot', 'kill_plot', 'access_route', 'bedding', 'stand_site', 'water', 'staging_area', 'sanctuary']
  if (typeof val === 'string' && valid.includes(val as ZoneType)) return val as ZoneType
  return 'food_plot'
}

export function normalizeSize(val: unknown): RelativeSize {
  const valid: RelativeSize[] = ['tiny', 'small', 'medium', 'large']
  if (typeof val === 'string' && valid.includes(val as RelativeSize)) return val as RelativeSize
  return 'small'
}

// ─── Robust JSON extraction ───────────────────────────────────────────────────

const MAX_SCAN_CHARS = 200_000

interface ScanResult {
  /** Input with raw control chars inside strings escaped */
  sanitized: string
  /** Positions (index into sanitized, inclusive) where a value just completed, with the closers needed at that point */
  safePoints: Array<{ end: number; suffix: string }>
  /** Closers needed at end-of-input (open string already closed) */
  tailSuffix: string
  /** True if the scan reached depth 0 (a complete top-level value exists) */
  complete: boolean
  /** Index one past the end of the complete top-level value, if complete */
  completeEnd: number
}

// Forward scan from an opening brace: escape raw control characters inside
// strings, track the bracket stack, and record every position where a value
// just closed (so a truncated tail can be cut back to the last good point).
function scanJson(text: string, start: number): ScanResult {
  const out: string[] = []
  const safePoints: ScanResult['safePoints'] = []
  let stack = ''
  let inString = false
  let escaped = false
  let complete = false
  let completeEnd = -1

  for (let i = start; i < text.length && i < start + MAX_SCAN_CHARS; i++) {
    const ch = text[i]

    if (inString) {
      if (escaped) {
        escaped = false
        out.push(ch)
      } else if (ch === '\\') {
        escaped = true
        out.push(ch)
      } else if (ch === '"') {
        inString = false
        out.push(ch)
        // Closing quote of a string — candidate safe point (key-strings will
        // simply fail the parse retry and we move to an earlier point)
        safePoints.push({ end: out.length - 1, suffix: closersFor(stack) })
      } else if (ch === '\n') {
        out.push('\\n')
      } else if (ch === '\r') {
        out.push('\\r')
      } else if (ch === '\t') {
        out.push('\\t')
      } else if (ch.charCodeAt(0) < 0x20) {
        out.push(' ')
      } else {
        out.push(ch)
      }
      continue
    }

    if (ch === '"') {
      inString = true
      out.push(ch)
    } else if (ch === '{' || ch === '[') {
      stack += ch
      out.push(ch)
    } else if (ch === '}' || ch === ']') {
      const opener = ch === '}' ? '{' : '['
      if (stack.endsWith(opener)) stack = stack.slice(0, -1)
      out.push(ch)
      safePoints.push({ end: out.length - 1, suffix: closersFor(stack) })
      if (stack.length === 0) {
        complete = true
        completeEnd = out.length
        break
      }
    } else {
      out.push(ch)
    }
  }

  // End of input mid-string: close the string
  if (inString) {
    if (escaped) out.pop() // drop a dangling backslash
    out.push('"')
  }

  return {
    sanitized: out.join(''),
    safePoints,
    tailSuffix: closersFor(stack),
    complete,
    completeEnd,
  }
}

function closersFor(stack: string): string {
  let s = ''
  for (let i = stack.length - 1; i >= 0; i--) s += stack[i] === '{' ? '}' : ']'
  return s
}

// Strip trailing commas before } or ] — the most common LLM JSON defect
function stripTrailingCommas(json: string): string {
  return json.replace(/,(\s*[}\]])/g, '$1')
}

function tryParse(candidate: string): any | null {
  try {
    const v = JSON.parse(candidate)
    return v && typeof v === 'object' ? v : null
  } catch {
    return null
  }
}

function tryParseWithRepairs(candidate: string): any | null {
  return tryParse(candidate) ?? tryParse(stripTrailingCommas(candidate))
}

// Cut a truncated body back to its last structurally-complete point and close
// the open brackets. Tries the most recent safe points first.
function parseTruncated(scan: ScanResult): any | null {
  const { sanitized, safePoints, tailSuffix } = scan

  // Whole sanitized body + closers (handles "truncated mid-string" cleanly)
  let body = sanitized.replace(/[\s,]+$/, '')
  if (body.endsWith(':')) body += ' null'
  const whole = tryParseWithRepairs(body + tailSuffix)
  if (whole) return whole

  const MAX_ATTEMPTS = 50
  for (let i = safePoints.length - 1, n = 0; i >= 0 && n < MAX_ATTEMPTS; i--, n++) {
    const sp = safePoints[i]
    let cut = sanitized.slice(0, sp.end + 1)
    cut = cut.replace(/,\s*$/, '')
    const parsed = tryParseWithRepairs(cut + sp.suffix)
    if (parsed) return parsed
  }
  return null
}

/**
 * Extract and parse a JSON object from raw LLM output. Handles markdown
 * fences, surrounding prose, raw newlines/tabs inside strings, trailing
 * commas, and truncated output. Returns the parsed object, or null if no
 * object can be recovered.
 */
export function extractTonyJson(text: string): any | null {
  if (!text || typeof text !== 'string') return null

  // 1. Markdown-fenced block (complete or unterminated fence)
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/)
  const sources = fence ? [fence[1], text] : [text]

  for (const src of sources) {
    const start = src.indexOf('{')
    if (start < 0) continue

    const scan = scanJson(src, start)

    if (scan.complete) {
      const candidate = scan.sanitized.slice(0, scan.completeEnd)
      const parsed = tryParseWithRepairs(candidate)
      if (parsed) return parsed
    }

    const repaired = parseTruncated(scan)
    if (repaired) return repaired
  }

  return null
}

// Salvage the "message" field from JSON debris so the user never sees a raw
// JSON dump in chat. Handles an unterminated final string.
export function salvageMessageField(text: string): string | null {
  const m = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/)
  if (!m || !m[1]) return null
  try {
    return JSON.parse(`"${m[1]}"`)
  } catch {
    return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
  }
}

// ─── Tony v2 response parsing ─────────────────────────────────────────────────

export interface ParsedTonyResponse {
  message: string
  zones: TonyZone[]
  stand_sites: StandSite[]
  /** False when no JSON could be recovered at all */
  parsed: boolean
}

/**
 * Parse and sanitize a Tony v2 response into typed zones + stand sites.
 * Never throws. When `parsed` is false the caller should treat zones as
 * unavailable and fall back to the deterministic engine.
 */
export function parseTonyV2(rawText: string): ParsedTonyResponse {
  let message = ''
  let zones: TonyZone[] = []
  let stand_sites: StandSite[] = []

  const parsedObj = extractTonyJson(rawText)

  if (parsedObj) {
    message = typeof parsedObj.message === 'string' ? parsedObj.message
      : typeof parsedObj.reply === 'string' ? parsedObj.reply : ''

    if (Array.isArray(parsedObj.zones)) {
      zones = parsedObj.zones
        .filter((z: any) => z && typeof z === 'object')
        .map((z: any, i: number): TonyZone => ({
          id: typeof z.id === 'string' ? z.id : `z${i + 1}`,
          name: typeof z.name === 'string' ? z.name.slice(0, 100) : `Zone ${i + 1}`,
          type: normalizeZoneType(z.type),
          relative_position: normalizePosition(z.relative_position),
          relative_size: normalizeSize(z.relative_size),
          description: typeof z.description === 'string' ? z.description.slice(0, 300) : '',
          confidence: normalizeConfidence(z.confidence),
          season: normalizeSeason(z.season),
          candidate_id: typeof z.candidate_id === 'string' ? z.candidate_id : undefined,
        }))
        .slice(0, 12)
    }

    if (Array.isArray(parsedObj.stand_sites)) {
      stand_sites = parsedObj.stand_sites
        .filter((s: any) => s && typeof s === 'object')
        .map((s: any, i: number): StandSite => ({
          id: typeof s.id === 'string' ? s.id : `s${i + 1}`,
          name: typeof s.name === 'string' ? s.name.slice(0, 100) : `Stand ${i + 1}`,
          relative_position: normalizePosition(s.relative_position),
          wind_direction: typeof s.wind_direction === 'string' ? s.wind_direction.slice(0, 50) : '',
          rating: typeof s.rating === 'number' ? Math.max(1, Math.min(10, Math.round(s.rating))) : 7,
          description: typeof s.description === 'string' ? s.description.slice(0, 300) : '',
          candidate_id: typeof s.candidate_id === 'string' ? s.candidate_id : undefined,
        }))
        .slice(0, 6)
    }

    // Old v1 format fallbacks
    if (!message && typeof parsedObj.reply === 'string') message = parsedObj.reply
    if (!message && Array.isArray(parsedObj.features) && parsedObj.features.length > 0) {
      message = `Identified ${parsedObj.features.length} habitat features on the map.`
    }

    return { message: message || 'Analysis complete.', zones, stand_sites, parsed: true }
  }

  // No JSON recovered. If the text reads like prose, show it; if it's JSON
  // debris, salvage the message field rather than dumping brackets in chat.
  const trimmed = rawText.trim()
  const looksLikeJsonDebris = /^[`{[]/.test(trimmed) || /"(zones|stand_sites|message)"\s*:/.test(trimmed)
  if (looksLikeJsonDebris) {
    message = salvageMessageField(trimmed)
      ?? 'I hit a formatting glitch on that one. The zones on your map come straight from the terrain engine — ask again for the full strategic breakdown.'
  } else {
    message = trimmed || 'No response from Tony.'
  }

  return { message, zones: [], stand_sites: [], parsed: false }
}
