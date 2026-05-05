import { NextRequest, NextResponse } from 'next/server'
import { stripe, SITE_URL } from '../../../../lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined
    const property = typeof body.property === 'string' ? body.property.trim().slice(0, 200) : ''

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: 9700, // $97.00
          product_data: {
            name: 'Tony AI Field Report',
            description: 'Full AI habitat analysis of your hunting property — stand placements, food plots, bedding areas. Delivered within 48 hours.',
            images: [`${SITE_URL}/buckgrid-logo.png`],
          },
        },
        quantity: 1,
      }],
      customer_email: email,
      metadata: {
        type: 'field_report',
        property_name: property,
      },
      success_url: `${SITE_URL}/buckgrid?report=ordered&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/#pricing`,
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[checkout/report]', e)
    return NextResponse.json({ error: 'checkout_failed' }, { status: 500 })
  }
}
