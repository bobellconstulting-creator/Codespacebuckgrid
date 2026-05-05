import Stripe from 'stripe'

// Deferred — key is checked at request time, not build time
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key, { apiVersion: '2026-04-22.dahlia', typescript: true })
}

export { getStripe as stripe }

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://codespacebuckgrid.vercel.app'
