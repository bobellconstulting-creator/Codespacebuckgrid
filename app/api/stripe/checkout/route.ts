// /api/stripe/checkout — creates a Stripe Checkout Session for $9.99/mo BuckGrid Pro subscription.
// Returns { url } — client redirects to it.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2026-03-25.dahlia' })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const priceId = process.env.STRIPE_PRICE_ID
    if (!priceId) {
      return NextResponse.json({ error: 'STRIPE_PRICE_ID is not configured' }, { status: 500 })
    }

    const stripe = getStripe()

    const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://buckgridpro.com'

    // Optional: read email from request body to prefill checkout
    let customerEmail: string | undefined
    try {
      const body = await req.json() as { email?: string }
      if (typeof body.email === 'string' && body.email.includes('@')) {
        customerEmail = body.email
      }
    } catch {
      // body is optional
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      success_url: `${origin}/upgrade?success=1`,
      cancel_url: `${origin}/upgrade?canceled=1`,
      subscription_data: {
        metadata: {
          source: 'buckgrid-pro-paywall',
        },
      },
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[stripe/checkout] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
