'use client'

import dynamic from 'next/dynamic'

const ChainStats = dynamic(
  () => import('@/components/home/ChainStats').then(m => m.ChainStats),
  {
    ssr: false,
    loading: () => (
      <div className="h-32 rounded-2xl bg-white/5 animate-pulse mx-4 sm:mx-6 lg:mx-8" />
    ),
  }
)

export function LazyChainStats() {
  return <ChainStats />
}
