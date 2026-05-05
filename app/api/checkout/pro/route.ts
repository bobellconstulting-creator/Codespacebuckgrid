import { NextRequest, NextResponse } from 'next/server'
import { stripe, SITE_URL } from '../../../../lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined

    const priceId = process.env.STRIPE_PRICE_PRO
    if (!priceId) {
      return NextResponse.json({ error: 'pro_price_not_configured' }, { status: 500 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      metadata: { type: 'pro_annual' },
      success_url: `${SITE_URL}/buckgrid?pro=activated&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/#pricing`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { type: 'pro_annual' },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[checkout/pro]', e)
    return NextResponse.json({ error: 'checkout_failed' }, { status: 500 })
  }
}
