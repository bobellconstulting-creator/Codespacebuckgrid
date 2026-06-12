import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

export const metadata: Metadata = {
  title: 'BuckGrid Pro — Live Demo',
  description: 'Watch Tony analyze a real 150-acre parcel: stands, bedding, food plots, and access — terrain-backed and boundary-guaranteed.',
  robots: { index: false, follow: false },
}

const DemoPage = dynamic(() => import('@/components/buckgrid/DemoPage'), {
  ssr: false,
  loading: () => (
    <div style={{ position: 'fixed', inset: 0, background: '#1E2122', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src="/buckgrid-logo.png" alt="BuckGrid Pro" style={{ height: 120, width: 'auto', objectFit: 'contain' }} />
    </div>
  ),
})

export default function Demo() {
  return <DemoPage />
}
