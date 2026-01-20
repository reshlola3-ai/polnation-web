'use client'

import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount, useDisconnect, useReadContract } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Wallet, LogOut, ExternalLink, AlertTriangle, CheckCircle, Link2, XCircle } from 'lucide-react'
import { USDC_ADDRESS, USDC_ABI } from '@/lib/web3-config'
import { formatUnits } from 'viem'
import { createClient } from '@/lib/supabase'

// 只允许 Bitget 和 Trust Wallet
const ALLOWED_WALLETS = [
  'bitget', 'bitget wallet',
  'trust', 'trust wallet', 'trustwallet',
]

function isAllowedWallet(connectorName: string | undefined): boolean {
  if (!connectorName) return false
  const name = connectorName.toLowerCase()
  return ALLOWED_WALLETS.some(allowed => name.includes(allowed))
}

// 检测当前注入的钱包类型
function detectInjectedWallet(): 'bitget' | 'trust' | 'other' | 'none' {
  if (!window.ethereum) return 'none'
  
  // 检查 providers 数组
  const providers = window.ethereum.providers || [window.ethereum]
  
  for (const provider of providers) {
    if (provider?.isBitget) return 'bitget'
    if (provider?.isTrust || provider?.isTrustWallet) return 'trust'
  }
  
  return 'other'
}

// 获取不支持钱包的名称
function getWalletProviderName(): string | null {
  const ethereum = window.ethereum
  if (!ethereum) return null
  
  if (ethereum.isMetaMask) return 'MetaMask'
  if (ethereum.isCoinbaseWallet) return 'Coinbase Wallet'
  if (ethereum.isBraveWallet) return 'Brave Wallet'
  if (ethereum.isRabby) return 'Rabby'
  if (ethereum.isPhantom) return 'Phantom'
  if (ethereum.isOkxWallet || ethereum.isOKXWallet) return 'OKX Wallet'
  if (ethereum.isOneInch) return '1inch Wallet'
  if (ethereum.isTokenary) return 'Tokenary'
  
  return 'Unknown Wallet'
}

interface BoundWalletInfo {
  address: string
  boundAt: string
}

export function ConnectWallet() {
  const { open } = useWeb3Modal()
  const { address, isConnected, chain, connector } = useAccount()
  const { disconnect } = useDisconnect()
  const [walletStatus, setWalletStatus] = useState<'checking' | 'available' | 'bound_to_you' | 'bound_to_other' | 'unsupported_wallet'>('checking')
  const [boundUser, setBoundUser] = useState<string | null>(null)
  const [yourBoundWallet, setYourBoundWallet] = useState<string | null>(null)
  const [unsupportedWalletName, setUnsupportedWalletName] = useState<string | null>(null)
  const [showUnsupportedModal, setShowUnsupportedModal] = useState(false)
  
  const [boundWalletInfo, setBoundWalletInfo] = useState<BoundWalletInfo | null>(null)
  const [isLoadingBoundWallet, setIsLoadingBoundWallet] = useState(true)

  const displayAddress = boundWalletInfo?.address || address

  // 打开钱包选择器前检测
  const handleOpenWallet = async () => {
    // 检测当前注入的钱包
    const detectedWallet = detectInjectedWallet()
    
    if (detectedWallet === 'none') {
      // 没有检测到钱包，弹出选择器（用户可能需要先安装）
      open()
    } else if (detectedWallet === 'other') {
      // 检测到不支持的钱包，阻止连接
      const walletName = getWalletProviderName()
      setUnsupportedWalletName(walletName)
      setShowUnsupportedModal(true)
    } else {
      // 检测到支持的钱包，正常打开
      open()
    }
  }

  // 如果已经连接但钱包不被允许，自动断开（防止通过 WalletConnect 连接）
  useEffect(() => {
    if (isConnected && connector) {
      const connectorName = connector.name
      if (!isAllowedWallet(connectorName)) {
        console.log(`Unsupported wallet detected: ${connectorName}. Disconnecting...`)
        setUnsupportedWalletName(connectorName)
        setShowUnsupportedModal(true)
        // 延迟断开
        setTimeout(() => {
          disconnect()
        }, 100)
      }
    }
  }, [isConnected, connector, disconnect])

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
      <div className="glass-card-solid p-4 md:p-6">
        <div className="animate-pulse">
          <div className="h-5 md:h-6 bg-white/10 rounded w-1/3 mb-3 md:mb-4"></div>
          <div className="h-16 md:h-20 bg-white/5 rounded"></div>
        </div>
      </div>
    )
  }

  // 已绑定钱包，未连接状态
  if (boundWalletInfo && !isConnected) {
    return (
      <div className="glass-card-solid p-4 md:p-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="font-semibold text-white text-sm md:text-base">Wallet Bound</h3>
          <div className="flex items-center gap-1 text-green-400">
            <Link2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="text-xs">Linked</span>
          </div>
        </div>

        <div className="mb-3 md:mb-4 p-2.5 md:p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-400 shrink-0" />
            <p className="text-xs md:text-sm font-medium text-green-300">Wallet Permanently Bound</p>
          </div>
          <p className="text-[10px] md:text-xs text-green-400/70 mt-1 ml-6 md:ml-7">
            Your account is linked to this wallet.
          </p>
        </div>

        <div className="mb-3 md:mb-4">
          <p className="text-[10px] md:text-xs text-zinc-500 mb-1">Bound Address</p>
          <div className="flex items-center gap-2">
            <code className="text-xs md:text-sm font-mono text-zinc-300 bg-white/5 px-2 py-1 rounded truncate">
              {boundWalletInfo.address.slice(0, 6)}...{boundWalletInfo.address.slice(-4)}
            </code>
            <a
              href={`https://polygonscan.com/address/${boundWalletInfo.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-purple-400 transition-colors shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-xl p-3 md:p-4 border border-purple-500/20">
          <p className="text-[10px] md:text-xs text-zinc-500 mb-1">USDC Balance</p>
          {isBalanceLoading ? (
            <div className="animate-pulse h-7 md:h-8 bg-white/10 rounded w-24" />
          ) : (
          <p className="text-xl md:text-2xl font-bold text-white currency">
            ${Number(usdcBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          )}
        </div>
      </div>
    )
  }

  // 不支持的钱包 - 显示错误并自动断开
  if (walletStatus === 'unsupported_wallet') {
    return (
      <div className="glass-card-solid p-4 md:p-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="font-semibold text-white text-sm md:text-base">Unsupported Wallet</h3>
          <XCircle className="w-4 h-4 md:w-5 md:h-5 text-red-400" />
        </div>
        
        <div className="mb-3 md:mb-4 p-3 md:p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-start gap-2 md:gap-3">
            <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-xs md:text-sm font-medium text-red-300">
                {unsupportedWalletName || 'This wallet'} is not supported
              </p>
              <p className="text-[10px] md:text-xs text-red-400/70 mt-1.5 md:mt-2">
                Please use one of the supported mobile wallets.
              </p>
              <p className="text-[10px] md:text-xs text-red-400/50 mt-1.5 md:mt-2">
                Disconnecting automatically...
              </p>
            </div>
          </div>
        </div>

        <div className="p-2.5 md:p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <p className="text-[10px] md:text-xs text-purple-300 font-medium mb-1.5 md:mb-2">Supported Wallets:</p>
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            <span className="text-[10px] md:text-xs bg-purple-500/20 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-purple-300">Bitget</span>
            <span className="text-[10px] md:text-xs bg-purple-500/20 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-purple-300">Trust</span>
          </div>
        </div>
      </div>
    )
  }

  // 未绑定，未连接
  if (!isConnected && !boundWalletInfo) {
    return (
      <div className="glass-card-solid p-4 md:p-6">
        <h3 className="font-semibold text-white mb-3 md:mb-4 text-sm md:text-base">Connect Your Wallet</h3>
        <p className="text-xs md:text-sm text-zinc-400 mb-3 md:mb-4">
          Connect and bind your wallet to start staking.
        </p>
        
        <div className="mb-3 md:mb-4 p-2.5 md:p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <p className="text-[10px] md:text-xs text-purple-300 font-medium mb-1.5 md:mb-2">Supported Wallets:</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] md:text-xs bg-purple-500/20 px-1.5 md:px-2 py-0.5 rounded text-purple-300">Bitget</span>
            <span className="text-[10px] md:text-xs bg-purple-500/20 px-1.5 md:px-2 py-0.5 rounded text-purple-300">Trust</span>
          </div>
        </div>
        
        <Button onClick={handleOpenWallet} className="gap-2 w-full text-sm md:text-base py-2.5 md:py-3">
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </Button>
      </div>
    )
  }

  // 已连接状态
  const isWrongNetwork = chain?.id !== polygon.id

  return (
    <div className="glass-card-solid p-4 md:p-6">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="font-semibold text-white text-sm md:text-base">Wallet Connected</h3>
        {!boundWalletInfo && (
          <button
            onClick={() => disconnect()}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
            title="Disconnect"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {walletStatus === 'bound_to_other' && (
        <div className="mb-3 md:mb-4 p-2.5 md:p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs md:text-sm font-medium text-red-300">Wallet Already Bound</p>
              <p className="text-[10px] md:text-xs text-red-400/70 mt-1">
                {yourBoundWallet ? (
                  <>Already bound to <code className="bg-red-500/20 px-1 rounded">{yourBoundWallet.slice(0, 6)}...{yourBoundWallet.slice(-4)}</code></>
                ) : (
                  <>Bound to {boundUser}</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {walletStatus === 'bound_to_you' && (
        <div className="mb-3 md:mb-4 p-2.5 md:p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
            <p className="text-xs md:text-sm font-medium text-green-300">Wallet Verified & Bound</p>
          </div>
        </div>
      )}

      {walletStatus === 'available' && (
        <div className="mb-3 md:mb-4 p-2.5 md:p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
            <p className="text-xs md:text-sm font-medium text-blue-300">Binding Wallet...</p>
          </div>
        </div>
      )}

      <div className="mb-3 md:mb-4">
        <p className="text-[10px] md:text-xs text-zinc-500 mb-1">Address</p>
        <div className="flex items-center gap-2">
          <code className="text-xs md:text-sm font-mono text-zinc-300 bg-white/5 px-2 py-1 rounded">
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

      <div className="mb-3 md:mb-4">
        <p className="text-[10px] md:text-xs text-zinc-500 mb-1">Network</p>
        {isWrongNetwork ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-xs md:text-sm text-red-400">Wrong Network</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => open({ view: 'Networks' })}
              className="text-xs"
            >
              Switch
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-xs md:text-sm text-zinc-300">Polygon</span>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-xl p-3 md:p-4 border border-purple-500/20">
        <p className="text-[10px] md:text-xs text-zinc-500 mb-1">USDC Balance</p>
        {isBalanceLoading ? (
          <div className="animate-pulse h-7 md:h-8 bg-white/10 rounded w-24" />
        ) : (
          <p className="text-xl md:text-2xl font-bold text-white currency">
            ${Number(usdcBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}
      </div>
    </div>

    {/* Unsupported Wallet Modal */}
    {showUnsupportedModal && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full">
          <h2 className="text-xl font-bold text-white mb-2">Wallet Not Supported</h2>
          <p className="text-zinc-400 mb-6">
            {unsupportedWalletName} is not supported. Please use one of the supported wallets below:
          </p>
          
          {/* Bitget Wallet */}
          <a 
            href="https://web3.bitget.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl mb-3 transition-colors group"
          >
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              B
            </div>
            <div className="flex-1">
              <p className="text-white font-medium group-hover:text-blue-400">Bitget Wallet</p>
              <p className="text-zinc-500 text-sm">Most popular choice</p>
            </div>
            <ExternalLink className="w-5 h-5 text-zinc-500" />
          </a>
          
          {/* Trust Wallet */}
          <a 
            href="https://trustwallet.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors group"
          >
            <div className="w-12 h-12 bg-cyan-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              T
            </div>
            <div className="flex-1">
              <p className="text-white font-medium group-hover:text-cyan-400">Trust Wallet</p>
              <p className="text-zinc-500 text-sm">Simple and secure</p>
            </div>
            <ExternalLink className="w-5 h-5 text-zinc-500" />
          </a>
          
          <button 
            onClick={() => setShowUnsupportedModal(false)}
            className="w-full mt-6 py-3 text-zinc-400 hover:text-white transition-colors border border-zinc-700 rounded-xl"
          >
            I don't have these wallets
          </button>
        </div>
      </div>
    )}
  )
}
