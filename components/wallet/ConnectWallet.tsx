'use client'

import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount, useDisconnect, useReadContract } from 'wagmi'
import { useRouter } from 'next/navigation'
import { polygon } from 'wagmi/chains'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Wallet, ExternalLink, AlertTriangle, CheckCircle, Link2, XCircle } from 'lucide-react'
import { USDC_ADDRESS, USDC_ABI } from '@/lib/web3-config'
import { formatUnits } from 'viem'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'

// Wallets blocked from connecting
const BLOCKED_WALLETS = ['metamask', 'tokenpocket', 'token pocket', 'binance', 'bnb']

function isBlockedWallet(connectorName: string | undefined): boolean {
  if (!connectorName) return false
  const lower = connectorName.toLowerCase()
  return BLOCKED_WALLETS.some(b => lower.includes(b))
}

const SUPPORTED_WALLETS = [
  {
    name: 'Trust Wallet',
    logo: 'https://registry.walletconnect.com/api/v1/logo/md/4622a2b2d6af1c9844944291e5e7351a630af19c',
  },
  {
    name: 'Bitget Wallet',
    logo: 'https://registry.walletconnect.com/api/v1/logo/md/38f5d18bd8522c244bdd70cb4a68e0e718865155',
  },
  {
    name: 'SafePal',
    logo: '/icons/safepal.svg',
  },
]

interface BoundWalletInfo {
  address: string
  boundAt: string
}

export function ConnectWallet() {
  const { open } = useWeb3Modal()
  const { address, isConnected, chain, connector } = useAccount()
  const { disconnect } = useDisconnect()
  const router = useRouter()
  const [isRebinding, setIsRebinding] = useState(false)
  const [walletStatus, setWalletStatus] = useState<'checking' | 'available' | 'bound_to_you' | 'bound_to_other'>('checking')
  const [blockedName, setBlockedName] = useState<string | null>(null)

  const [boundWalletInfo, setBoundWalletInfo] = useState<BoundWalletInfo | null>(null)
  const [isLoadingBoundWallet, setIsLoadingBoundWallet] = useState(true)

  const handleOpenWallet = () => open()

  const handleRebind = async () => {
    if (!address) return
    setIsRebinding(true)
    try {
      const res = await fetch('/api/wallet/rebind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: address }),
      })
      if (!res.ok) throw new Error('Rebind failed')
      setWalletStatus('bound_to_you')
      setBoundWalletInfo({ address: address.toLowerCase(), boundAt: new Date().toISOString() })
      router.refresh()
    } catch {
      // keep error state
    } finally {
      setIsRebinding(false)
    }
  }

  // Auto-disconnect blocked wallets
  useEffect(() => {
    if (isConnected && connector && isBlockedWallet(connector.name)) {
      setBlockedName(connector.name)
      disconnect()
    } else if (!isConnected) {
      setBlockedName(null)
    }
  }, [isConnected, connector, disconnect])

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
    async function checkAndBindWallet() {
      if (!address) { setWalletStatus('available'); return }
      // Don't bind if wallet is blocked
      if (connector && isBlockedWallet(connector.name)) return

      const normalizedAddress = address.toLowerCase()

      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setWalletStatus('available'); return }

        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, email, wallet_bound_at')
          .eq('wallet_address', normalizedAddress)
          .single()

        if (existingProfile) {
          if (existingProfile.id === user.id) {
            setWalletStatus('bound_to_you')
            setBoundWalletInfo({ address: normalizedAddress, boundAt: existingProfile.wallet_bound_at || new Date().toISOString() })
          } else {
            setWalletStatus('bound_to_other')
          }
          return
        }

        const { data: myProfile } = await supabase
          .from('profiles')
          .select('wallet_address, wallet_bound_at')
          .eq('id', user.id)
          .single()

        if (myProfile?.wallet_address && myProfile.wallet_address !== normalizedAddress) {
          setWalletStatus('bound_to_you')
          setBoundWalletInfo({ address: myProfile.wallet_address, boundAt: myProfile.wallet_bound_at || new Date().toISOString() })
          return
        }

        if (myProfile?.wallet_address === normalizedAddress) {
          setWalletStatus('bound_to_you')
          setBoundWalletInfo({ address: normalizedAddress, boundAt: myProfile.wallet_bound_at || new Date().toISOString() })
          return
        }

        const now = new Date().toISOString()
        const { error: bindError } = await supabase
          .from('profiles')
          .update({ wallet_address: normalizedAddress, wallet_bound_at: now })
          .eq('id', user.id)

        if (!bindError) {
          setWalletStatus('bound_to_you')
          setBoundWalletInfo({ address: normalizedAddress, boundAt: now })
        } else {
          setWalletStatus('available')
        }
      } catch {
        setWalletStatus('available')
      }
    }
    checkAndBindWallet()
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

  // Blocked wallet notice
  if (blockedName) {
    return (
      <div className="glass-card-solid p-4 md:p-6">
        <div className="flex items-start gap-3 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-300">Wallet Not Supported</p>
            <p className="text-xs text-red-400/70 mt-0.5">
              <strong>{blockedName}</strong> is not supported. Please use one of the wallets below.
            </p>
          </div>
        </div>
        <SupportedWalletList onConnect={handleOpenWallet} />
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

  // Not connected, not bound
  if (!isConnected && !boundWalletInfo) {
    return (
      <div className="glass-card-solid p-4 md:p-6">
        <h3 className="font-semibold text-white mb-3 md:mb-4 text-sm md:text-base">Connect Your Wallet</h3>
        <p className="text-xs md:text-sm text-zinc-400 mb-4">Connect and bind your wallet to start earning.</p>
        <SupportedWalletList onConnect={handleOpenWallet} />
      </div>
    )
  }

  // Connected state
  return (
    <div className="glass-card-solid p-4 md:p-6">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="font-semibold text-white text-sm md:text-base">Wallet Connected</h3>
      </div>

      {walletStatus === 'bound_to_other' && (
        <div className="mb-3 md:mb-4 p-2.5 md:p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs md:text-sm font-medium text-amber-300">Wallet Linked to Another Account</p>
              <p className="text-[10px] md:text-xs text-amber-400/70 mt-1">Want to rebind it to this account?</p>
            </div>
          </div>
          <Button size="sm" onClick={handleRebind} isLoading={isRebinding} className="w-full mt-1 bg-amber-500 hover:bg-amber-400 text-black text-xs">
            Rebind to This Account
          </Button>
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

function SupportedWalletList({ onConnect }: { onConnect: () => void }) {
  return (
    <>
      <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
        <p className="text-xs text-purple-300 font-medium mb-3">Supported wallets only:</p>
        <div className="flex items-center gap-3">
          {SUPPORTED_WALLETS.map((w) => (
            <div key={w.name} className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                <Image src={w.logo} alt={w.name} width={32} height={32} className="rounded-lg" unoptimized />
              </div>
              <span className="text-[10px] text-zinc-400">{w.name.split(' ')[0]}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-zinc-600 mt-3">MetaMask, TokenPocket and Binance Web3 are not supported.</p>
      </div>
      <Button onClick={onConnect} className="gap-2 w-full text-sm md:text-base py-2.5 md:py-3">
        <Wallet className="w-4 h-4" />Connect Wallet
      </Button>
    </>
  )
}
