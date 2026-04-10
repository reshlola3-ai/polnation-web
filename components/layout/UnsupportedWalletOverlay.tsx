'use client'

import { useEffect } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { XCircle } from 'lucide-react'

const BLOCKED_WALLETS = ['metamask', 'tokenpocket', 'token pocket', 'binance', 'bnb']

function isBlockedWallet(name: string | undefined): boolean {
  if (!name) return false
  const lower = name.toLowerCase()
  return BLOCKED_WALLETS.some(b => lower.includes(b))
}

export function UnsupportedWalletOverlay() {
  const { isConnected, connector } = useAccount()
  const { disconnect } = useDisconnect()

  const blocked = isConnected && isBlockedWallet(connector?.name)

  useEffect(() => {
    if (blocked) disconnect()
  }, [blocked, disconnect])

  if (!blocked) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1A1333] border border-red-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Wallet Not Supported</h3>
            <p className="text-xs text-zinc-500">{connector?.name}</p>
          </div>
        </div>

        <p className="text-sm text-zinc-400 mb-5 leading-relaxed">
          <strong className="text-white">{connector?.name}</strong> is not compatible with Polnation.
          Please use <strong className="text-purple-300">Trust Wallet</strong>, <strong className="text-purple-300">Bitget Wallet</strong>, or <strong className="text-purple-300">SafePal</strong>.
        </p>

        <div className="flex items-center justify-center gap-4 p-3 bg-white/5 rounded-xl">
          {[
            { name: 'Trust', src: 'https://registry.walletconnect.com/api/v1/logo/md/4622a2b2d6af1c9844944291e5e7351a630af19c' },
            { name: 'Bitget', src: 'https://registry.walletconnect.com/api/v1/logo/md/38f5d18bd8522c244bdd70cb4a68e0e718865155' },
            { name: 'SafePal', src: '/icons/safepal.svg' },
          ].map((w) => (
            <div key={w.name} className="flex flex-col items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={w.src} alt={w.name} className="w-10 h-10 rounded-xl" />
              <span className="text-[10px] text-zinc-500">{w.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
