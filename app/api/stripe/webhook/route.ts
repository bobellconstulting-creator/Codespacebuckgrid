// /api/stripe/webhook — handles Stripe events.
//
// Events handled:
//   checkout.session.completed → activate subscription
//   customer.subscription.updated → sync status
//   customer.subscription.deleted → mark canceled
//
// Verifies the Stripe-Signature header using STRIPE_WEBHOOK_SECRET.
// IMPORTANT: must read the raw body — do NOT parse as JSON first.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { upsertSubscriber } from '../../../../lib/subscriptions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2026-03-25.dahlia' })
}

async function resolveCustomerEmail(stripe: Stripe, customerId: string | null): Promise<string | null> {
  if (!customerId) return null
  try {
    const customer = await stripe.customers.retrieve(customerId)
    if (customer.deleted) return null
    return (customer as Stripe.Customer).email ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const rawBody = await req.text()
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature verification failed'
    console.error('[stripe/webhook] signature error:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const stripe = getStripe()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const email =
          session.customer_email ??
          (await resolveCustomerEmail(stripe, session.customer as string | null))

        if (!email) {
          console.warn('[stripe/webhook] checkout.session.completed: no email found for session', session.id)
          break
        }

        upsertSubscriber({
          email,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        console.log('[stripe/webhook] activated subscription for', email)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const email = await resolveCustomerEmail(stripe, sub.customer as string | null)
        if (!email) break

        const status = sub.status === 'active' ? 'active'
          : sub.status === 'past_due' ? 'past_due'
          : 'canceled'

        upsertSubscriber({
          email,
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        console.log('[stripe/webhook] subscription updated for', email, '→', status)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const email = await resolveCustomerEmail(stripe, sub.customer as string | null)
        if (!email) break

        upsertSubscriber({
          email,
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          status: 'canceled',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        console.log('[stripe/webhook] subscription canceled for', email)
        break
      }

      default:
        // Unhandled event type — ignore
        break
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Handler error'
    console.error('[stripe/webhook] handler error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
