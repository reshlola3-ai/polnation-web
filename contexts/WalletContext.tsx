'use client'

import { createContext, useContext, ReactNode } from 'react'

interface WalletContextType {
  isWalletSupported: boolean
  unsupportedWalletName: string | null
}

const WalletContext = createContext<WalletContextType>({
  isWalletSupported: true,
  unsupportedWalletName: null,
})

export function useWallet() {
  return useContext(WalletContext)
}

interface WalletProviderProps {
  children: ReactNode
  isWalletSupported: boolean
  unsupportedWalletName: string | null
}

export function WalletProvider({ children, isWalletSupported, unsupportedWalletName }: WalletProviderProps) {
  return (
    <WalletContext.Provider value={{ isWalletSupported, unsupportedWalletName }}>
      {children}
    </WalletContext.Provider>
  )
}
