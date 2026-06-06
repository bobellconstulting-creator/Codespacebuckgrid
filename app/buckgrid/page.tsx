import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

export const metadata: Metadata = {
  title: 'BuckGrid Pro — Draw Your Land, Talk to Tony',
  description: 'Tell Tony what you\'re seeing on your property. Get a tactical habitat game plan — stand priorities, zone strategy, seasonal timing.',
  robots: { index: false, follow: false },
}

const WildLogicApp = dynamic(
  () => import('@/components/wildlogic/WildLogicAppV2'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-ink-800 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg
            viewBox="0 0 40 40"
            className="w-11 h-11 text-moss-500"
            fill="none"
            aria-label="WildLogic"
          >
            <path
              d="M20 36 L20 20 M20 20 L11 9 M20 20 L29 9 M11 9 L9 5 M11 9 L15 7 M29 9 L31 5 M29 9 L25 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="20" cy="36" r="2" fill="currentColor" opacity="0.5" />
          </svg>
          <span className="font-mono text-xs tracking-[0.3em] text-moss-600 uppercase animate-pulse">
            Loading BuckGrid Pro
          </span>
        </div>
      </div>
    ),
  }
)

export default function WildLogicPage() {
  return <WildLogicApp />
}
