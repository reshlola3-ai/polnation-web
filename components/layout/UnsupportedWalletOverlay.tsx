'use client'

import { useTranslations } from 'next-intl'
import { useWallet } from '@/contexts/WalletContext'
import { useDisconnect } from 'wagmi'
import { useRouter } from 'next/navigation'

export function UnsupportedWalletOverlay() {
  const t = useTranslations('wallet.unsupportedWallet')
  const { isWalletSupported, unsupportedWalletName } = useWallet()
  const { disconnect } = useDisconnect()
  const router = useRouter()

  if (isWalletSupported) return null

  const handleDisconnect = () => {
    disconnect()
    router.push('/dashboard')
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
          
          <button
            onClick={handleDisconnect}
            className="w-full py-3 px-4 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors"
          >
            {t('goToDashboard')}
          </button>
        </div>
      </div>
    </div>
  )
}
