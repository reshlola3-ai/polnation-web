'use client'

import { useEffect } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { XCircle, ExternalLink } from 'lucide-react'
import { isBlockedWallet, SUPPORTED_WALLET_INFO } from '@/lib/wallet-utils'

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
          Please use <strong className="text-purple-300">Trust Wallet</strong> or <strong className="text-purple-300">Bitget Wallet</strong>.
        </p>

        <div className="space-y-2">
          {SUPPORTED_WALLET_INFO.map((w) => (
            <a
              key={w.name}
              href={w.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-purple-500/30 transition-colors group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={w.logo} alt={w.name} className="w-9 h-9 rounded-xl" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{w.name}</p>
                <p className="text-xs text-zinc-500">Download →</p>
              </div>
              <ExternalLink className="w-4 h-4 text-zinc-600 group-hover:text-purple-400 transition-colors" />
            </a>
          ))}
        </div>

        <p className="text-[10px] text-zinc-600 text-center mt-4">
          Open polnation.com inside the wallet&apos;s DApp browser after installing
        </p>
      </div>
    </div>
  )
}
