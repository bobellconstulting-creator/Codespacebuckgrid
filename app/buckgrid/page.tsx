import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

export const metadata: Metadata = {
  title: 'Analyze My Land — BuckGrid Pro',
  description: 'Draw your habitat features and let Tony AI give you expert recommendations for food plots, stand placement, and land management.',
  robots: { index: false, follow: false },
}

const BuckGridProPage = dynamic(
  () => import('@/components/buckgrid/BuckGridProPage'),
  { ssr: false, loading: () => (
    <div className="w-screen flex items-center justify-center" style={{ background: '#1E2122', height: '100dvh', minHeight: '100vh' }}>
      <div className="flex flex-col items-center gap-4">
        {/* Rack mark — matches BuckLogo stroke paths */}
        <svg width="44" height="44" viewBox="0 0 100 100" fill="none" stroke="#6B7A57" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 44 94 C 30 65, 8 45, 12 10" strokeWidth="9" />
          <path d="M 32 74 C 24 71, 15 69, 10 65" strokeWidth="7" />
          <path d="M 21 54 C 22 42, 27 27, 30 18" strokeWidth="8" />
          <path d="M 56 94 C 70 65, 92 45, 88 10" strokeWidth="9" />
          <path d="M 68 74 C 76 71, 85 69, 90 65" strokeWidth="7" />
          <path d="M 79 54 C 78 42, 73 27, 70 18" strokeWidth="8" />
        </svg>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", color: '#6B7A57', fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', animation: 'pulse 1.5s ease-in-out infinite' }}>
          Loading BuckGrid Pro
        </div>
      </div>
    </div>
  )}
)

export default function BuckGridPage() {
  return <BuckGridProPage />
}
