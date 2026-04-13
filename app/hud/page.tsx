'use client'

import dynamic from 'next/dynamic'

// SSR-safe: Canvas must only render on client
const HudScene = dynamic(
  () => import('@/components/hud/HudScene').then((m) => m.HudScene),
  { ssr: false, loading: () => <div style={{ width: '100vw', height: '100vh', background: '#000' }} /> }
)

export default function HudPage() {
  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>
      <HudScene />
    </main>
  )
}
