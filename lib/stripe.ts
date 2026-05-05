import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
})

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://codespacebuckgrid.vercel.app'
