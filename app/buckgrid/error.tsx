'use client'

import { useEffect } from 'react'

export default function BuckGridError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[BuckGrid Error]', error)
  }, [error])

  return (
    <div style={{ background: '#1E2122', height: '100dvh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Teko', 'Oswald', sans-serif" }}>
      <div style={{ textAlign: 'center', maxWidth: '420px', padding: '0 24px' }}>
        <svg width="48" height="48" viewBox="0 0 100 100" fill="none" stroke="#6B7A57" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '20px', opacity: 0.6 }}>
          <path d="M 44 94 C 30 65, 8 45, 12 10" strokeWidth="9" />
          <path d="M 32 74 C 24 71, 15 69, 10 65" strokeWidth="7" />
          <path d="M 21 54 C 22 42, 27 27, 30 18" strokeWidth="8" />
          <path d="M 56 94 C 70 65, 92 45, 88 10" strokeWidth="9" />
          <path d="M 68 74 C 76 71, 85 69, 90 65" strokeWidth="7" />
          <path d="M 79 54 C 78 42, 73 27, 70 18" strokeWidth="8" />
        </svg>
        <div style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '0.14em', color: '#D8D3C5', textTransform: 'uppercase', marginBottom: '10px' }}>
          Something went wrong
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: '#6E6A5C', letterSpacing: '0.1em', marginBottom: '28px', lineHeight: 1.7 }}>
          BuckGrid Pro hit an unexpected error.<br />Your map data is safe in your browser.
        </div>
        <button
          onClick={reset}
          style={{ background: 'linear-gradient(135deg, #6B7A57, #6B7A57)', color: '#1E2122', fontFamily: "'Teko', 'Oswald', sans-serif", fontWeight: 800, fontSize: '13px', letterSpacing: '0.16em', textTransform: 'uppercase', padding: '12px 28px', borderRadius: '3px', border: 'none', cursor: 'pointer' }}
        >
          ▶ Reload Map
        </button>
      </div>
    </div>
  )
}
