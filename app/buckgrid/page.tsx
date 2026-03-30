'use client'

import dynamic from 'next/dynamic'

const BuckGridProPage = dynamic(
  () => import('@/components/buckgrid/BuckGridProPage'),
  { ssr: false, loading: () => (
    <div className="h-screen w-screen bg-[#0A0E17] flex items-center justify-center">
      <div className="text-[#FF3E3E] text-sm font-semibold animate-pulse">Loading BuckGrid Pro...</div>
    </div>
  )}
)

export default function BuckGridPage() {
  return <BuckGridProPage />
}
