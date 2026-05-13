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
    // Whitelist: only these wallets render in the Reown modal.
    // ─── Primary 3 (original, battle-tested) ───
    //   Trust + Bitget → EOA spender, SafePal → Merkle contract.
    // ─── Experiment 6 (opened 2026-05-13) ───
    //   OKX / TokenPocket / imToken / Binance Web3 / Coinbase / MathWallet
    //   all route to EOA spender. Coinbase appears twice (legacy ID + Base
    //   rebrand). Sign allow-list also extended; see lib/wallet-utils.ts.
    //   Rollback marker: git tag `pre-multi-wallet`.
    includeWalletIds: [
      '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
      '38f5d18bd8522c244bdd70cb4a68e0e718865155811c043f052fb9f1c51de662', // Bitget Wallet
      '0b415a746fb9ee99cce155c2ceca0c6f6061b1dbca2d722b3ba16381d0562150', // SafePal
      '971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709', // OKX Wallet
      '20459438007b75f4f4acb98bf29aa3b800550309646d375da5fd4aac6c2a2c66', // TokenPocket
      'ef333840daf915aafdc4a004525502d6d49d77bd9c65e0642dbaefb3c2893bef', // imToken
      '8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb99d4', // Binance Web3 Wallet
      'd0ca99ff52b99abc48743dad0f7fc891e041be73574f7fac4afe5d4bb83845c8', // Coinbase Wallet
      'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Base (Coinbase Wallet rebrand)
      '7674bb4e353bf52886768a3ddc2a4562ce2f4191c80831291218ebd90f5f5e26', // MathWallet
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
