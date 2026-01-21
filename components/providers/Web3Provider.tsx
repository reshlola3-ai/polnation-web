'use client'

import { createWeb3Modal } from '@web3modal/wagmi/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, useAccount, type State } from 'wagmi'
import { wagmiConfig, projectId } from '@/lib/web3-config'
import { useState, useEffect, useMemo } from 'react'
import { WalletProvider } from '@/contexts/WalletContext'

const queryClient = new QueryClient()

const ALLOWED_WALLETS = ['bitget', 'bitget wallet', 'trust', 'trust wallet', 'trustwallet']

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
    featuredWalletIds: [
      '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
      '0b415a746fb9ee99cce155c2ceca0c6f6061b1dbca2d722b3ba16381d0562150', // SafePal
      '38f5d18bd8522c244bdd70cb4a68e0e718865155811c043f052fb9f1c51de662', // Bitget Wallet
    ],
    includeWalletIds: [
      '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
      '0b415a746fb9ee99cce155c2ceca0c6f6061b1dbca2d722b3ba16381d0562150', // SafePal
      '38f5d18bd8522c244bdd70cb4a68e0e718865155811c043f052fb9f1c51de662', // Bitget Wallet
      '20459438007b75f4f4acb98bf29aa3b800550b8f4e1fccd0bc84d8c7dc200fe10', // TokenPocket
    ],
  })
}

interface Web3ProviderProps {
  children: React.ReactNode
  initialState?: State
}

function WalletDetector({ children }: { children: React.ReactNode }) {
  const { isConnected, connector } = useAccount()

  const { isWalletSupported, unsupportedWalletName } = useMemo(() => {
    if (!isConnected || !connector) {
      return { isWalletSupported: true, unsupportedWalletName: null }
    }
    const name = connector.name.toLowerCase()
    const isSupported = ALLOWED_WALLETS.some(w => name.includes(w))
    return {
      isWalletSupported: isSupported,
      unsupportedWalletName: isSupported ? null : connector.name
    }
  }, [isConnected, connector])

  return (
    <WalletProvider isWalletSupported={isWalletSupported} unsupportedWalletName={unsupportedWalletName}>
      {children}
    </WalletProvider>
  )
}

export function Web3Provider({ children, initialState }: Web3ProviderProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <WalletDetector>
          {children}
        </WalletDetector>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
