'use client'

import { createWeb3Modal } from '@web3modal/wagmi/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, type State } from 'wagmi'
import { wagmiConfig, projectId } from '@/lib/web3-config'

const queryClient = new QueryClient()

if (typeof window !== 'undefined') {
  createWeb3Modal({
    wagmiConfig,
    projectId,
    enableAnalytics: false,
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#8b5cf6',
      '--w3m-border-radius-master': '12px',
    },
    // Whitelist: only these three wallets render in the Reown modal.
    // Everything else (MetaMask, OKX, Coinbase, etc.) is hidden — we currently
    // route Trust/Bitget to the EOA spender and SafePal to the Merkle contract;
    // other wallets aren't on the sign allow list (see lib/wallet-utils.ts).
    includeWalletIds: [
      '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
      '38f5d18bd8522c244bdd70cb4a68e0e718865155811c043f052fb9f1c51de662', // Bitget Wallet
      '0b415a746fb9ee99cce155c2ceca0c6f6061b1dbca2d722b3ba16381d0562150', // SafePal
    ],
  })
}

interface Web3ProviderProps {
  children: React.ReactNode
  initialState?: State
}

export function Web3Provider({ children, initialState }: Web3ProviderProps) {
  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
