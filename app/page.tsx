'use client'

import dynamic from 'next/dynamic'

const BuckGridProPage = dynamic(() => import('../src/components/buckgrid/BuckGridProPage'), { ssr: false })

export default function Page() {
  return <BuckGridProPage />
}
