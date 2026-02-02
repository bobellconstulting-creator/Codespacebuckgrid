import dynamic from 'next/dynamic'

const BuckGridProPage = dynamic(() => import('@/components/buckgrid/BuckGridProPage'), {
  ssr: false,
})

export default function BuckGridPage() {
  return <BuckGridProPage />
}
