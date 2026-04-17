// /api/stripe/verify — called client-side after Stripe redirects back to /upgrade?success=1
//
// Looks up the latest checkout session for the given email, confirms the
// subscription is active, and sets the bg_sub_email cookie so middleware
// grants access.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { upsertSubscriber, isSubscribed } from '../../../../lib/subscriptions'
import { SUB_COOKIE } from '../../../../lib/sub-cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2026-03-25.dahlia' })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as { email?: string; sessionId?: string }

    // Path A: we have a session_id from the success URL (Stripe returns it if you add {CHECKOUT_SESSION_ID})
    if (body.sessionId) {
      const stripe = getStripe()
      const session = await stripe.checkout.sessions.retrieve(body.sessionId, {
        expand: ['subscription'],
      })

      const email =
        session.customer_email ??
        (session.customer_details?.email ?? null)

      if (!email) {
        return NextResponse.json({ ok: false, error: 'No email on session' }, { status: 400 })
      }

      const sub = session.subscription as Stripe.Subscription | null
      const subStatus = sub?.status

      if (subStatus === 'active' || subStatus === 'trialing') {
        upsertSubscriber({
          email,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: sub?.id ?? '',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        return buildSuccessResponse(email)
      }

      return NextResponse.json({ ok: false, error: 'Subscription not active' }, { status: 402 })
    }

    // Path B: webhook already wrote the record — just check by email
    if (body.email) {
      const email = body.email.toLowerCase()
      if (isSubscribed(email)) {
        return buildSuccessResponse(email)
      }
      return NextResponse.json({ ok: false, error: 'No active subscription found for that email' }, { status: 402 })
    }

    return NextResponse.json({ ok: false, error: 'Provide sessionId or email' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[stripe/verify] error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

function buildSuccessResponse(email: string): NextResponse {
  const cookieValue = Buffer.from(email).toString('base64')
  const res = NextResponse.json({ ok: true, email })
  res.cookies.set(SUB_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
  return res
}
