'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount, useDisconnect } from 'wagmi'

// Supported wallet detection via window.ethereum flags
function detectSupportedWallet(): { isSupported: boolean; walletName: string | null } {
  if (typeof window === 'undefined') {
    return { isSupported: true, walletName: null }
  }

  const eth = (window as { ethereum?: {
    isTrust?: boolean
    isBitget?: boolean
    isMetaMask?: boolean
    isCoinbaseWallet?: boolean
    isSafePal?: boolean
    isTokenPocket?: boolean
    providers?: Array<{ isTrust?: boolean; isBitget?: boolean }>
  } }).ethereum

  if (!eth) {
    // No injected wallet - might be WalletConnect, allow it
    return { isSupported: true, walletName: null }
  }

  // Check for supported wallets (only Trust and Bitget)
  if (eth.isTrust) return { isSupported: true, walletName: 'Trust Wallet' }
  if (eth.isBitget) return { isSupported: true, walletName: 'Bitget Wallet' }

  // Check providers array (multiple wallets installed)
  if (eth.providers) {
    for (const provider of eth.providers) {
      if (provider.isTrust) return { isSupported: true, walletName: 'Trust Wallet' }
      if (provider.isBitget) return { isSupported: true, walletName: 'Bitget Wallet' }
    }
  }

  // Unsupported injected wallet detected
  let walletName = 'Unknown Wallet'
  if (eth.isMetaMask) walletName = 'MetaMask'
  if (eth.isCoinbaseWallet) walletName = 'Coinbase Wallet'
  if (eth.isSafePal) walletName = 'SafePal'
  if (eth.isTokenPocket) walletName = 'TokenPocket'

  return { isSupported: false, walletName }
}

export function UnsupportedWalletOverlay() {
  const t = useTranslations('wallet.unsupportedWallet')
  const { isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  
  const [showOverlay, setShowOverlay] = useState(false)
  const [detectedWallet, setDetectedWallet] = useState<string | null>(null)

  useEffect(() => {
    if (!isConnected) {
      setShowOverlay(false)
      return
    }

    // Small delay to ensure wallet is fully connected
    const timer = setTimeout(() => {
      const { isSupported, walletName } = detectSupportedWallet()
      if (!isSupported) {
        setShowOverlay(true)
        setDetectedWallet(walletName)
      } else {
        setShowOverlay(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [isConnected])

  if (!showOverlay) return null

  const handleDisconnect = () => {
    disconnect()
    setShowOverlay(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4 p-8 bg-zinc-900 border border-zinc-700 rounded-2xl text-center">
        <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h2 className="text-xl font-bold text-white mb-4">
          {t('title')}
        </h2>
        
        {detectedWallet && (
          <p className="text-amber-400 text-sm mb-2">
            Detected: {detectedWallet}
          </p>
        )}
        
        <p className="text-zinc-400 mb-6">
          {t('description')}
        </p>
        
        <div className="space-y-3">
          <button
            onClick={handleDisconnect}
            className="w-full py-3 px-4 bg-amber-500/20 border border-amber-500/50 text-amber-400 rounded-xl hover:bg-amber-500/30 transition-colors font-medium"
          >
            {t('disconnect')}
          </button>
        </div>
        
        <p className="text-xs text-zinc-500 mt-4">
          Supported: Trust Wallet, Bitget Wallet
        </p>
      </div>
    </div>
  )
}
