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
    <div className="h-screen w-screen flex items-center justify-center" style={{ background: '#090C08' }}>
      <div className="flex flex-col items-center gap-3">
        <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="5" stroke="#C8963C" strokeWidth="1.2" />
          <circle cx="8" cy="8" r="1.5" fill="#C8963C" />
          <line x1="8" y1="1" x2="8" y2="4.5" stroke="#C8963C" strokeWidth="1.2" />
          <line x1="8" y1="11.5" x2="8" y2="15" stroke="#C8963C" strokeWidth="1.2" />
          <line x1="1" y1="8" x2="4.5" y2="8" stroke="#C8963C" strokeWidth="1.2" />
          <line x1="11.5" y1="8" x2="15" y2="8" stroke="#C8963C" strokeWidth="1.2" />
        </svg>
        <div className="text-[#C8963C] text-sm font-semibold animate-pulse tracking-widest uppercase">Loading BuckGrid Pro</div>
      </div>
    </div>
  )}
)

export default function BuckGridPage() {
  return <BuckGridProPage />
}
