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

const ALLOWED_WALLETS = [
  'bitget', 'bitget wallet',
  'trust', 'trust wallet', 'trustwallet',
]

function isAllowedWallet(connectorName: string | undefined): boolean {
  if (!connectorName) return false
  const name = connectorName.toLowerCase()
  return ALLOWED_WALLETS.some(allowed => name.includes(allowed))
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

  const handleOpenWallet = () => open()

  useEffect(() => {
    if (isConnected && connector) {
      const isSupported = isAllowedWallet(connector.name)
      if (!isSupported) {
        setWalletStatus('unsupported_wallet')
        setUnsupportedWalletName(connector.name)
      }
    }
  }, [isConnected, connector])

  useEffect(() => {
    async function loadBoundWallet() {
      setIsLoadingBoundWallet(true)
      try {
        const supabase = createClient()
        if (!supabase) { setIsLoadingBoundWallet(false); return }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setIsLoadingBoundWallet(false); return }

        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_address, wallet_bound_at')
          .eq('id', user.id)
          .single()

        if (profile?.wallet_address) {
          setBoundWalletInfo({ address: profile.wallet_address, boundAt: profile.wallet_bound_at })
        }
      } catch (err) {
        console.error('Error:', err)
      } finally {
        setIsLoadingBoundWallet(false)
      }
    }
    loadBoundWallet()
  }, [])

  useEffect(() => {
    async function checkWalletStatus() {
      if (!address) { setWalletStatus('available'); return }

      if (connector && !isAllowedWallet(connector.name)) {
        setWalletStatus('unsupported_wallet')
        setUnsupportedWalletName(connector.name)
        return
      }

      try {
        const supabase = createClient()
        const { data: boundData } = await supabase
          .from('wallets')
          .select('user_id, bound_at, users!inner(email)')
          .eq('address', address.toLowerCase())
          .single()

        if (boundData) {
          const { data: currentUser } = await supabase.from('profiles').select('id').eq('id', (await supabase.auth.getUser()).data.user?.id).single()
          
          if (currentUser && boundData.user_id === currentUser.id) {
            setWalletStatus('bound_to_you')
            setBoundWalletInfo({ address: address, boundAt: boundData.bound_at })
          } else {
            const { data: boundUserData } = await supabase.from('profiles').select('email').eq('id', boundData.user_id).single()
            setWalletStatus('bound_to_other')
            setBoundUser(boundUserData?.email || 'Unknown')
          }
        } else {
          setWalletStatus('available')
        }
      } catch (error) {
        setWalletStatus('available')
      }
    }
    checkWalletStatus()
  }, [address, connector])

  const { data: usdcBalanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    chainId: polygon.id,
  })

  const usdcBalance = usdcBalanceRaw ? Number(formatUnits(usdcBalanceRaw, 6)) : 0
  const isWrongNetwork = chain?.id !== polygon.id
  const isBalanceLoading = usdcBalanceRaw === undefined

  // Loading state
  if (isLoadingBoundWallet) {
    return (
      <div className="glass-card-solid p-4 md:p-6">
        <div className="animate-pulse">
          <div className="h-5 md:h-6 bg-white/10 rounded w-1/3 mb-3 md:mb-4" />
          <div className="h-16 md:h-20 bg-white/5 rounded" />
        </div>
      </div>
    )
  }

  // Bound wallet, not connected
  if (boundWalletInfo && !isConnected) {
    return (
      <div className="glass-card-solid p-4 md:p-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="font-semibold text-white text-sm md:text-base">Wallet Bound</h3>
          <div className="flex items-center gap-1 text-green-400"><Link2 className="w-3.5 h-3.5 md:w-4 md:h-4" /><span className="text-xs">Verified</span></div>
        </div>
        <div className="mb-3 md:mb-4 p-2.5 md:p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
          <p className="text-xs text-green-300">This wallet is bound to your account</p>
        </div>
        <Button onClick={handleOpenWallet} className="w-full">Connect Wallet</Button>
      </div>
    )
  }

  // Unsupported wallet
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
              <p className="text-xs md:text-sm font-medium text-red-300">{unsupportedWalletName || 'This wallet'} is not supported</p>
              <p className="text-[10px] md:text-xs text-red-400/70 mt-1.5 md:mt-2">Please use Bitget or Trust Wallet</p>
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

  // Not bound, not connected
  if (!isConnected && !boundWalletInfo) {
    return (
      <div className="glass-card-solid p-4 md:p-6">
        <h3 className="font-semibold text-white mb-3 md:mb-4 text-sm md:text-base">Connect Your Wallet</h3>
        <p className="text-xs md:text-sm text-zinc-400 mb-3 md:mb-4">Connect and bind your wallet to start staking.</p>
        <div className="mb-3 md:mb-4 p-2.5 md:p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <p className="text-[10px] md:text-xs text-purple-300 font-medium mb-1.5 md:mb-2">Supported Wallets:</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] md:text-xs bg-purple-500/20 px-1.5 md:px-2 py-0.5 rounded text-purple-300">Bitget</span>
            <span className="text-[10px] md:text-xs bg-purple-500/20 px-1.5 md:px-2 py-0.5 rounded text-purple-300">Trust</span>
          </div>
        </div>
        <Button onClick={handleOpenWallet} className="gap-2 w-full text-sm md:text-base py-2.5 md:py-3"><Wallet className="w-4 h-4" />Connect Wallet</Button>
      </div>
    )
  }

  // Connected state
  return (
    <div className="glass-card-solid p-4 md:p-6">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="font-semibold text-white text-sm md:text-base">Wallet Connected</h3>
        {!boundWalletInfo && <button onClick={() => disconnect()} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1" title="Disconnect"><LogOut className="w-4 h-4" /></button>}
      </div>

      {walletStatus === 'bound_to_other' && (
        <div className="mb-3 md:mb-4 p-2.5 md:p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs md:text-sm font-medium text-red-300">Wallet Already Bound</p>
              <p className="text-[10px] md:text-xs text-red-400/70 mt-1">Bound to {boundUser}</p>
            </div>
          </div>
        </div>
      )}

      {walletStatus === 'bound_to_you' && (
        <div className="mb-3 md:mb-4 p-2.5 md:p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
          <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-400" /><p className="text-xs md:text-sm font-medium text-green-300">Wallet Verified & Bound</p></div>
        </div>
      )}

      <div className="mb-3 md:mb-4">
        <p className="text-[10px] md:text-xs text-zinc-500 mb-1">Address</p>
        <div className="flex items-center gap-2">
          <code className="text-xs md:text-sm font-mono text-zinc-300 bg-white/5 px-2 py-1 rounded">{address?.slice(0, 6)}...{address?.slice(-4)}</code>
          <a href={`https://polygonscan.com/address/${address}`} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-purple-400 transition-colors"><ExternalLink className="w-3 h-3" /></a>
        </div>
      </div>

      <div className="mb-3 md:mb-4">
        <p className="text-[10px] md:text-xs text-zinc-500 mb-1">Network</p>
        {isWrongNetwork ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-xs md:text-sm text-red-400">Wrong Network</span>
            <Button size="sm" variant="outline" onClick={() => open({ view: 'Networks' })} className="text-xs">Switch</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full" /><span className="text-xs md:text-sm text-zinc-300">Polygon</span></div>
        )}
      </div>

      <div className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-xl p-3 md:p-4 border border-purple-500/20">
        <p className="text-[10px] md:text-xs text-zinc-500 mb-1">USDC Balance</p>
        {isBalanceLoading ? (
          <div className="animate-pulse h-7 md:h-8 bg-white/10 rounded w-24" />
        ) : (
          <p className="text-xl md:text-2xl font-bold text-white currency">${Number(usdcBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        )}
      </div>
    </div>
  )
}
