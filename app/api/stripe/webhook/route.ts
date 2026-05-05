import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '../../../../lib/stripe'
import { grantPro, revokePro } from '../../../../lib/entitlements'
import Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Stripe requires raw body for signature verification
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (e) {
    console.error('[webhook] signature verification failed:', e)
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      // One-time payment completed ($97 Field Report)
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const email = session.customer_details?.email ?? session.customer_email ?? ''
        const type = session.metadata?.type

        if (type === 'field_report' && email) {
          console.log(`[webhook] Field Report purchased: ${email} — property: ${session.metadata?.property_name || 'unknown'}`)
          // Send to bo@neuradexai.com for manual fulfillment
          await notifyFieldReport(email, session.metadata?.property_name || '', session.id)
        }

        if (type === 'pro_annual' && email) {
          const subId = typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription as Stripe.Subscription)?.id ?? ''
          const custId = typeof session.customer === 'string'
            ? session.customer
            : (session.customer as Stripe.Customer)?.id ?? ''
          await grantPro(email, custId, subId)
          console.log(`[webhook] Pro granted: ${email}`)
        }
        break
      }

      // Annual subscription renewed
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const email = invoice.customer_email ?? ''
        const subRaw = (invoice as unknown as Record<string, unknown>).subscription
        const subId = typeof subRaw === 'string' ? subRaw : (subRaw as { id?: string })?.id ?? ''
        const custId = typeof invoice.customer === 'string'
          ? invoice.customer
          : (invoice.customer as Stripe.Customer)?.id ?? ''
        if (email && subId) {
          await grantPro(email, custId, subId)
          console.log(`[webhook] Pro renewed: ${email}`)
        }
        break
      }

      // Subscription cancelled or payment failed
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const obj = event.data.object as Stripe.Subscription | Stripe.Invoice
        let email = ''
        const objAny = obj as unknown as Record<string, unknown>
        if (typeof objAny.customer_email === 'string') email = objAny.customer_email
        if (!email && 'customer' in obj) {
          const custId = typeof obj.customer === 'string' ? obj.customer : (obj.customer as Stripe.Customer)?.id ?? ''
          if (custId) {
            const customer = await stripe.customers.retrieve(custId)
            if (!customer.deleted) email = (customer as Stripe.Customer).email ?? ''
          }
        }
        if (email) {
          await revokePro(email)
          console.log(`[webhook] Pro revoked: ${email} (${event.type})`)
        }
        break
      }
    }
  } catch (e) {
    console.error('[webhook] handler error:', e)
    // Return 200 to prevent Stripe retries on non-critical errors
  }

  return NextResponse.json({ received: true })
}

async function notifyFieldReport(email: string, propertyName: string, sessionId: string) {
  // Email bo@neuradexai.com so he knows a Field Report was purchased
  // Using Resend if configured, otherwise just log
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.log(`[webhook] FIELD REPORT ORDER — customer: ${email}, property: ${propertyName}, session: ${sessionId}`)
    return
  }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'BuckGrid Pro <noreply@neuradexai.com>',
        to: ['bo@neuradexai.com'],
        subject: `Field Report Order — ${email}`,
        text: `New $97 Field Report order.\n\nCustomer: ${email}\nProperty: ${propertyName || 'not provided'}\nStripe session: ${sessionId}\n\nDeliver within 48 hours.`,
      }),
    })
  } catch (e) {
    console.error('[webhook] notify email failed:', e)
  }
}
