'use client'

import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount, useDisconnect, useReadContract } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { Button } from '@/components/ui/Button'
import { Wallet, LogOut, ExternalLink } from 'lucide-react'
import { USDC_ADDRESS, USDC_ABI } from '@/lib/web3-config'
import { formatUnits } from 'viem'

export function ConnectWallet() {
  const { open } = useWeb3Modal()
  const { address, isConnected, chain } = useAccount()
  const { disconnect } = useDisconnect()
  
  // 获取 USDC 余额
  const { data: usdcBalanceRaw, isLoading: isBalanceLoading } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: polygon.id,
  })

  const usdcBalance = usdcBalanceRaw ? formatUnits(usdcBalanceRaw, 6) : '0'

  if (!isConnected) {
    return (
      <Button onClick={() => open()} className="gap-2">
        <Wallet className="w-4 h-4" />
        Connect Wallet
      </Button>
    )
  }

  const isWrongNetwork = chain?.id !== polygon.id

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-zinc-900">Wallet Connected</h3>
        <button
          onClick={() => disconnect()}
          className="text-zinc-400 hover:text-zinc-600 transition-colors"
          title="Disconnect"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* 地址 */}
      <div className="mb-4">
        <p className="text-xs text-zinc-500 mb-1">Address</p>
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono text-zinc-700 bg-zinc-50 px-2 py-1 rounded">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </code>
          <a
            href={`https://polygonscan.com/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-emerald-600 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* 网络 */}
      <div className="mb-4">
        <p className="text-xs text-zinc-500 mb-1">Network</p>
        {isWrongNetwork ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-sm text-red-600">Wrong Network</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => open({ view: 'Networks' })}
            >
              Switch to Polygon
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm text-zinc-700">Polygon</span>
          </div>
        )}
      </div>

      {/* USDC 余额 */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4">
        <p className="text-xs text-zinc-500 mb-1">USDC Balance</p>
        {isBalanceLoading ? (
          <div className="animate-pulse h-8 bg-zinc-200 rounded w-24" />
        ) : (
          <p className="text-2xl font-bold text-emerald-600">
            ${Number(usdcBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}
      </div>
    </div>
  )
}
