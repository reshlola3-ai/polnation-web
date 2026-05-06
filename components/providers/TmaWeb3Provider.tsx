'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { tmaWagmiConfig } from '@/lib/tma-web3-config'

const queryClient = new QueryClient()

export function TmaWeb3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={tmaWagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
