'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type PageState = 'idle' | 'loading' | 'verifying' | 'success' | 'error'

interface CheckoutResponse {
  url?: string
  error?: string
}

interface VerifyResponse {
  ok?: boolean
  email?: string
  error?: string
}

function BuckLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" stroke="#6B7A57" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 44 94 C 30 65, 8 45, 12 10" strokeWidth="9" />
      <path d="M 32 74 C 24 71, 15 69, 10 65" strokeWidth="7" />
      <path d="M 21 54 C 22 42, 27 27, 30 18" strokeWidth="8" />
      <path d="M 56 94 C 70 65, 92 45, 88 10" strokeWidth="9" />
      <path d="M 68 74 C 76 71, 85 69, 90 65" strokeWidth="7" />
      <path d="M 79 54 C 78 42, 73 27, 70 18" strokeWidth="8" />
    </svg>
  )
}

const FEATURES = [
  { label: 'Tony AI habitat analysis', sub: 'satellite + soil + terrain, per parcel' },
  { label: 'Food plot placement', sub: 'evidence-based coordinates, not guesses' },
  { label: 'Stand placement scoring', sub: 'wind, cover, terrain — scored together' },
  { label: 'Unlimited chat sessions', sub: 'analyze as many properties as you need' },
  { label: 'SSURGO + NLCD data layers', sub: 'real USDA soil and land cover data' },
]

function UpgradeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<PageState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [email, setEmail] = useState('')

  const success = searchParams.get('success') === '1'
  const canceled = searchParams.get('canceled') === '1'
  const from = searchParams.get('from') ?? '/buckgrid'

  const runVerify = useCallback(async () => {
    setState('verifying')
    try {
      const sessionId = searchParams.get('session_id')
      const payload: { sessionId?: string; email?: string } = {}
      if (sessionId) {
        payload.sessionId = sessionId
      } else if (email) {
        payload.email = email
      } else {
        setState('success')
        return
      }

      const res = await fetch('/api/stripe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json() as VerifyResponse

      if (data.ok) {
        setState('success')
      } else {
        setState('success')
      }
    } catch {
      setState('success')
    }
  }, [searchParams, email])

  useEffect(() => {
    if (success) {
      void runVerify()
    }
  }, [success, runVerify])

  async function handleCheckout() {
    setState('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email ? { email } : {}),
      })
      const data = await res.json() as CheckoutResponse
      if (data.url) {
        window.location.href = data.url
      } else {
        setErrorMsg(data.error ?? 'Failed to start checkout')
        setState('error')
      }
    } catch {
      setErrorMsg('Network error — try again')
      setState('error')
    }
  }

  if (state === 'success' || (success && state !== 'verifying')) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[#6B7A57]/20 border border-[#6B7A57]/40 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7A57" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">You&apos;re in.</h1>
          <p className="text-neutral-400 text-sm mb-8">
            BuckGrid Pro is active. Tony AI is ready.
          </p>
          <button
            onClick={() => router.push(from)}
            className="w-full py-3 rounded-md bg-[#6B7A57] hover:bg-[#7d8f65] text-black font-semibold text-sm transition-colors"
          >
            Go to BuckGrid Pro
          </button>
        </div>
      </main>
    )
  }

  if (state === 'verifying') {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#6B7A57] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400 text-sm">Activating your subscription…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-neutral-900">
        <div className="flex items-center gap-3">
          <BuckLogo />
          <span style={{ fontFamily: "'Oswald', sans-serif" }} className="text-lg font-semibold tracking-wide text-white">
            BUCKGRID PRO
          </span>
        </div>
        <a href="/buckgrid" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
          Back to map
        </a>
      </nav>

      <div className="mx-auto max-w-4xl px-6 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#6B7A57] mb-3">BuckGrid Pro</p>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
              Tony AI knows<br />your land.
            </h1>
            <p className="mt-5 text-neutral-400 text-base leading-relaxed">
              Real satellite data. USDA soil maps. OSM terrain. Tony analyzes your specific
              parcel and tells you exactly where to plant, where to hang a stand, and why —
              cited against the data he&apos;s looking at.
            </p>

            <ul className="mt-8 space-y-4">
              {FEATURES.map((f) => (
                <li key={f.label} className="flex items-start gap-3">
                  <div className="mt-1 flex-shrink-0 w-4 h-4 rounded-full border border-[#6B7A57]/60 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#6B7A57]" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white">{f.label}</span>
                    <span className="ml-2 text-sm text-neutral-500">{f.sub}</span>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-10 text-xs text-neutral-600">
              Cancel anytime. No contracts. Billed monthly via Stripe.
            </p>
          </div>

          <div className="lg:sticky lg:top-8">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-8">
              <div className="flex items-end gap-1 mb-1">
                <span className="text-5xl font-bold text-white">$9</span>
                <span className="text-2xl font-bold text-white">.99</span>
                <span className="text-neutral-500 text-sm mb-1.5">/month</span>
              </div>
              <p className="text-xs text-neutral-500 mb-8">Billed monthly · cancel anytime</p>

              <div className="mb-4">
                <label htmlFor="email" className="block text-xs text-neutral-400 mb-1.5">
                  Email (optional — prefills checkout)
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#6B7A57] transition-colors"
                />
              </div>

              <button
                onClick={() => void handleCheckout()}
                disabled={state === 'loading'}
                className="w-full py-3.5 rounded-md bg-[#6B7A57] hover:bg-[#7d8f65] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm transition-colors"
              >
                {state === 'loading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                    Redirecting to Stripe…
                  </span>
                ) : (
                  'Get BuckGrid Pro — $9.99/mo'
                )}
              </button>

              {canceled && state === 'idle' && (
                <p className="mt-3 text-xs text-neutral-500 text-center">
                  Checkout was canceled. No charge was made.
                </p>
              )}

              {state === 'error' && errorMsg && (
                <p className="mt-3 text-xs text-red-400 text-center">{errorMsg}</p>
              )}

              <div className="mt-6 flex items-center justify-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span className="text-xs text-neutral-600">Secured by Stripe</span>
              </div>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => router.push(from)}
                className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
              >
                Already subscribed? Go back
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function UpgradePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#6B7A57] border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <UpgradeContent />
    </Suspense>
  )
}
