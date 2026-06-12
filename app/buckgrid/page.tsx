import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

export const metadata: Metadata = {
  title: 'BuckGrid Pro — Draw Your Land, Talk to Tony',
  description: 'Tell Tony what you\'re seeing on your property. Get a tactical habitat game plan — stand priorities, zone strategy, seasonal timing.',
  robots: { index: false, follow: false },
}

const BuckGridProPage = dynamic(
  () => import('@/components/buckgrid/BuckGridProPage'),
  {
    ssr: false,
    loading: () => (
      <div style={{ position: 'fixed', inset: 0, background: '#1E2122', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <img src="/buckgrid-logo.png" alt="BuckGrid Pro" style={{ height: '120px', width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', letterSpacing: '0.3em', color: '#6B7A57', textTransform: 'uppercase', animation: 'pulse 1.5s infinite' }}>
            Loading BuckGrid Pro
          </span>
        </div>
      </div>
    ),
  }
)

export default function BuckGridPage() {
  return <BuckGridProPage />
}
