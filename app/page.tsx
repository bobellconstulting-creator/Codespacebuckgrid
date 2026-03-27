import dynamic from 'next/dynamic'

// Leaflet requires browser APIs — must be client-only
const BuckGridProPage = dynamic(
  () => import('@/components/buckgrid/BuckGridProPage'),
  { ssr: false }
)

export default function Page() {
  return <BuckGridProPage />
}
