import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import BuckGridMark from '../../components/BuckGridMark'

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
        <BuckGridMark size={44} color="#B8923A" accent="#6B7A57" fill="#1E2122" />
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
