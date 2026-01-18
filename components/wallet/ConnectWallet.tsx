'use client'

import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount, useDisconnect, useReadContract } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Wallet, LogOut, ExternalLink, AlertTriangle, CheckCircle, Link2 } from 'lucide-react'
import { USDC_ADDRESS, USDC_ABI } from '@/lib/web3-config'
import { formatUnits } from 'viem'
import { createClient } from '@/lib/supabase'

interface BoundWalletInfo {
  address: string
  boundAt: string
}

export function ConnectWallet() {
  const { open } = useWeb3Modal()
  const { address, isConnected, chain } = useAccount()
  const { disconnect } = useDisconnect()
  const [walletStatus, setWalletStatus] = useState<'checking' | 'available' | 'bound_to_you' | 'bound_to_other'>('checking')
  const [boundUser, setBoundUser] = useState<string | null>(null)
  const [yourBoundWallet, setYourBoundWallet] = useState<string | null>(null)
  
  const [boundWalletInfo, setBoundWalletInfo] = useState<BoundWalletInfo | null>(null)
  const [isLoadingBoundWallet, setIsLoadingBoundWallet] = useState(true)

  const displayAddress = boundWalletInfo?.address || address

  const { data: usdcBalanceRaw, isLoading: isBalanceLoading } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: displayAddress ? [displayAddress as `0x${string}`] : undefined,
    chainId: polygon.id,
  })

  const usdcBalance = usdcBalanceRaw ? formatUnits(usdcBalanceRaw, 6) : '0'

  useEffect(() => {
    async function loadBoundWallet() {
      setIsLoadingBoundWallet(true)
      try {
        const supabase = createClient()
        if (!supabase) {
          setIsLoadingBoundWallet(false)
          return
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsLoadingBoundWallet(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_address, wallet_bound_at')
          .eq('id', user.id)
          .single()

        if (profile?.wallet_address) {
          setBoundWalletInfo({
            address: profile.wallet_address,
            boundAt: profile.wallet_bound_at,
          })
        }
      } catch (err) {
        console.error('Error loading bound wallet:', err)
      } finally {
        setIsLoadingBoundWallet(false)
      }
    }

    loadBoundWallet()
  }, [])

  useEffect(() => {
    async function checkAndBindWallet() {
      if (!address) {
        setWalletStatus('checking')
        return
      }

      try {
        const supabase = createClient()
        if (!supabase) {
          setWalletStatus('available')
          return
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setWalletStatus('available')
          return
        }

        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('id', user.id)
          .single()

        if (currentProfile?.wallet_address) {
          setYourBoundWallet(currentProfile.wallet_address)
          
          if (currentProfile.wallet_address.toLowerCase() === address.toLowerCase()) {
            setWalletStatus('bound_to_you')
            setBoundWalletInfo({
              address: currentProfile.wallet_address,
              boundAt: '',
            })
            return
          } else {
            setWalletStatus('bound_to_other')
            setBoundUser('your account (different wallet)')
            return
          }
        }

        const { data: existingBinding } = await supabase
          .from('profiles')
          .select('id, username, email')
          .eq('wallet_address', address.toLowerCase())
          .neq('id', user.id)
          .single()

        if (existingBinding) {
          setWalletStatus('bound_to_other')
          setBoundUser(existingBinding.email || existingBinding.username || 'another user')
        } else {
          const now = new Date().toISOString()
          const { error } = await supabase
            .from('profiles')
            .update({
              wallet_address: address.toLowerCase(),
              wallet_bound_at: now,
            })
            .eq('id', user.id)

          if (!error) {
            setWalletStatus('bound_to_you')
            setBoundWalletInfo({
              address: address.toLowerCase(),
              boundAt: now,
            })
            console.log('Wallet automatically bound to account')
          } else {
            console.error('Failed to bind wallet:', error)
            setWalletStatus('available')
          }
        }
      } catch (err) {
        console.error('Error checking wallet binding:', err)
        setWalletStatus('available')
      }
    }

    checkAndBindWallet()
  }, [address])

  if (isLoadingBoundWallet) {
    return (
      <div className="glass-card-solid p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-white/5 rounded"></div>
        </div>
      </div>
    )
  }

  // 已绑定钱包，未连接状态
  if (boundWalletInfo && !isConnected) {
    return (
      <div className="glass-card-solid p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Wallet Bound</h3>
          <div className="flex items-center gap-1 text-green-400">
            <Link2 className="w-4 h-4" />
            <span className="text-xs">Linked</span>
          </div>
        </div>

        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p className="text-sm font-medium text-green-300">Wallet Permanently Bound</p>
          </div>
          <p className="text-xs text-green-400/70 mt-1">
            Your account is linked to this wallet. No need to reconnect.
          </p>
        </div>

        <div className="mb-4">
          <p className="text-xs text-zinc-500 mb-1">Bound Address</p>
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono text-zinc-300 bg-white/5 px-2 py-1 rounded">
              {boundWalletInfo.address.slice(0, 6)}...{boundWalletInfo.address.slice(-4)}
            </code>
            <a
              href={`https://polygonscan.com/address/${boundWalletInfo.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-purple-400 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {boundWalletInfo.boundAt && (
          <div className="mb-4">
            <p className="text-xs text-zinc-500 mb-1">Bound At</p>
            <p className="text-sm text-zinc-400">
              {new Date(boundWalletInfo.boundAt).toLocaleString()}
            </p>
          </div>
        )}

        <div className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-xl p-4 border border-purple-500/20">
          <p className="text-xs text-zinc-500 mb-1">USDC Balance</p>
          {isBalanceLoading ? (
            <div className="animate-pulse h-8 bg-white/10 rounded w-24" />
          ) : (
            <p className="text-2xl font-bold text-white">
              ${Number(usdcBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </div>
      </div>
    )
  }

  // 未绑定，未连接
  if (!isConnected && !boundWalletInfo) {
    return (
      <div className="glass-card-solid p-6">
        <h3 className="font-semibold text-white mb-4">Connect Your Wallet</h3>
        <p className="text-sm text-zinc-400 mb-4">
          Connect and bind your wallet to start staking. Once bound, the wallet is permanently linked to your account.
        </p>
        <Button onClick={() => open()} className="gap-2 w-full">
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </Button>
      </div>
    )
  }

  // 已连接状态
  const isWrongNetwork = chain?.id !== polygon.id

  return (
    <div className="glass-card-solid p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Wallet Connected</h3>
        {!boundWalletInfo && (
          <button
            onClick={() => disconnect()}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Disconnect"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {walletStatus === 'bound_to_other' && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-300">Wallet Already Bound</p>
              <p className="text-xs text-red-400/70 mt-1">
                {yourBoundWallet ? (
                  <>Your account is already bound to wallet <code className="bg-red-500/20 px-1 rounded">{yourBoundWallet.slice(0, 6)}...{yourBoundWallet.slice(-4)}</code>.</>
                ) : (
                  <>This wallet is already bound to {boundUser}.</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {walletStatus === 'bound_to_you' && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p className="text-sm font-medium text-green-300">Wallet Verified & Bound</p>
          </div>
        </div>
      )}

      {walletStatus === 'available' && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-400" />
            <p className="text-sm font-medium text-blue-300">Binding Wallet...</p>
          </div>
        </div>
      )}

      <div className="mb-4">
        <p className="text-xs text-zinc-500 mb-1">Address</p>
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono text-zinc-300 bg-white/5 px-2 py-1 rounded">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </code>
          <a
            href={`https://polygonscan.com/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-purple-400 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs text-zinc-500 mb-1">Network</p>
        {isWrongNetwork ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-sm text-red-400">Wrong Network</span>
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
            <span className="text-sm text-zinc-300">Polygon</span>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-xl p-4 border border-purple-500/20">
        <p className="text-xs text-zinc-500 mb-1">USDC Balance</p>
        {isBalanceLoading ? (
          <div className="animate-pulse h-8 bg-white/10 rounded w-24" />
        ) : (
          <p className="text-2xl font-bold text-white">
            ${Number(usdcBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}
      </div>
    </div>
  )
}
