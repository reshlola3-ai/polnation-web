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
  
  // 新增：已绑定钱包信息（从数据库读取）
  const [boundWalletInfo, setBoundWalletInfo] = useState<BoundWalletInfo | null>(null)
  const [isLoadingBoundWallet, setIsLoadingBoundWallet] = useState(true)

  // 要显示的钱包地址（优先使用已绑定的，否则用当前连接的）
  const displayAddress = boundWalletInfo?.address || address

  // 获取 USDC 余额（使用要显示的地址）
  const { data: usdcBalanceRaw, isLoading: isBalanceLoading } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: displayAddress ? [displayAddress as `0x${string}`] : undefined,
    chainId: polygon.id,
  })

  const usdcBalance = usdcBalanceRaw ? formatUnits(usdcBalanceRaw, 6) : '0'

  // 页面加载时检查是否已有绑定的钱包
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

  // 检查钱包绑定状态（当用户连接新钱包时）
  useEffect(() => {
    async function checkWalletBinding() {
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

        // 检查当前用户已绑定的钱包
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('id', user.id)
          .single()

        if (currentProfile?.wallet_address) {
          setYourBoundWallet(currentProfile.wallet_address)
          
          if (currentProfile.wallet_address.toLowerCase() === address.toLowerCase()) {
            // 当前钱包已绑定到当前用户
            setWalletStatus('bound_to_you')
            return
          } else {
            // 当前用户已绑定其他钱包，不能再绑定新的
            setWalletStatus('bound_to_other')
            setBoundUser('your account (different wallet)')
            return
          }
        }

        // 检查这个钱包是否被其他用户绑定
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
          setWalletStatus('available')
        }
      } catch (err) {
        console.error('Error checking wallet binding:', err)
        setWalletStatus('available')
      }
    }

    checkWalletBinding()
  }, [address])

  // 加载中状态
  if (isLoadingBoundWallet) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
        <div className="animate-pulse">
          <div className="h-6 bg-zinc-200 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-zinc-100 rounded"></div>
        </div>
      </div>
    )
  }

  // 情况1：用户已有绑定的钱包，无需再连接
  if (boundWalletInfo && !isConnected) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-zinc-900">Wallet Bound</h3>
          <div className="flex items-center gap-1 text-green-500">
            <Link2 className="w-4 h-4" />
            <span className="text-xs">Linked</span>
          </div>
        </div>

        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <p className="text-sm font-medium text-green-700">Wallet Permanently Bound</p>
          </div>
          <p className="text-xs text-green-600 mt-1">
            Your account is linked to this wallet. No need to reconnect.
          </p>
        </div>

        {/* 地址 */}
        <div className="mb-4">
          <p className="text-xs text-zinc-500 mb-1">Bound Address</p>
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono text-zinc-700 bg-zinc-50 px-2 py-1 rounded">
              {boundWalletInfo.address.slice(0, 6)}...{boundWalletInfo.address.slice(-4)}
            </code>
            <a
              href={`https://polygonscan.com/address/${boundWalletInfo.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-emerald-600 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* 绑定时间 */}
        {boundWalletInfo.boundAt && (
          <div className="mb-4">
            <p className="text-xs text-zinc-500 mb-1">Bound At</p>
            <p className="text-sm text-zinc-700">
              {new Date(boundWalletInfo.boundAt).toLocaleString()}
            </p>
          </div>
        )}

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

  // 情况2：未绑定钱包，显示连接按钮
  if (!isConnected && !boundWalletInfo) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
        <h3 className="font-semibold text-zinc-900 mb-4">Connect Your Wallet</h3>
        <p className="text-sm text-zinc-500 mb-4">
          Connect and bind your wallet to start staking. Once bound, the wallet is permanently linked to your account.
        </p>
        <Button onClick={() => open()} className="gap-2 w-full">
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </Button>
      </div>
    )
  }

  // 情况3：钱包已连接，显示详细信息
  const isWrongNetwork = chain?.id !== polygon.id

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-zinc-900">Wallet Connected</h3>
        {!boundWalletInfo && (
          <button
            onClick={() => disconnect()}
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
            title="Disconnect"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 钱包绑定状态警告 */}
      {walletStatus === 'bound_to_other' && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">Wallet Already Bound</p>
              <p className="text-xs text-red-600 mt-1">
                {yourBoundWallet ? (
                  <>Your account is already bound to wallet <code className="bg-red-100 px-1 rounded">{yourBoundWallet.slice(0, 6)}...{yourBoundWallet.slice(-4)}</code>. Please reconnect with that wallet.</>
                ) : (
                  <>This wallet is already bound to {boundUser}. Each wallet can only be linked to one account.</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {walletStatus === 'bound_to_you' && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <p className="text-sm font-medium text-green-700">Wallet Verified & Bound</p>
          </div>
        </div>
      )}

      {walletStatus === 'available' && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-500" />
            <p className="text-sm font-medium text-blue-700">Ready to Bind</p>
          </div>
          <p className="text-xs text-blue-600 mt-1">Sign authorization to permanently bind this wallet to your account.</p>
        </div>
      )}

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
