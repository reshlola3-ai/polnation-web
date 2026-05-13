'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount, useDisconnect } from 'wagmi'
import Image from 'next/image'
import { Wallet, Loader2, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { isInMobileDAppBrowser } from '@/lib/wallet-utils'

interface Props {
  redirect?: string
  referrerId?: string | null
  autoRegister?: boolean
}

const WALLET_LOGOS = [
  { src: '/wallet-logos/trust.webp', alt: 'Trust' },
  { src: '/wallet-logos/bitget.webp', alt: 'Bitget' },
  { src: '/wallet-logos/safepal.svg', alt: 'SafePal' },
]

export function WalletAuthFlow({
  redirect = '/dashboard',
  referrerId = null,
  autoRegister = true,
}: Props) {
  const router = useRouter()
  const { open } = useWeb3Modal()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const supabase = createClient()

  const [status, setStatus] = useState<'idle' | 'logging_in' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  // Mobile DApp browser block — resolved on mount so SSR markup matches.
  const [blockedDApp, setBlockedDApp] = useState(false)
  // Guard against the auto-login effect firing twice for the same address
  // (StrictMode double-mount, address echo on re-render).
  const handledRef = useRef<string | null>(null)

  useEffect(() => {
    setBlockedDApp(isInMobileDAppBrowser())
  }, [])

  useEffect(() => {
    if (!isConnected || !address) return
    if (handledRef.current === address) return
    handledRef.current = address
    handleWalletLogin(address)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address])

  async function handleWalletLogin(walletAddress: string) {
    setStatus('logging_in')
    setError('')
    try {
      const response = await fetch('/api/auth/wallet-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          autoRegister,
          referrerId: referrerId || null,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        setStatus('error')
        setError(data.error || 'Login failed')
        return
      }

      if (!data.magicLink) {
        setStatus('error')
        setError('Login response missing session link')
        return
      }

      const url = new URL(data.magicLink)
      const token = url.searchParams.get('token')
      const type = url.searchParams.get('type') || 'magiclink'

      if (token) {
        const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type as 'magiclink',
        })
        if (verifyError || !sessionData?.session) {
          // Fallback: route through /auth/callback so the cookie is stored
          const callbackUrl = `/auth/callback?redirect=${encodeURIComponent(redirect)}`
          window.location.href = data.magicLink.replace(
            /redirect_to=[^&]*/,
            `redirect_to=${encodeURIComponent(window.location.origin + callbackUrl)}`,
          )
          return
        }
        setStatus('success')
        setTimeout(() => {
          router.push(redirect)
          router.refresh()
        }, 400)
        return
      }

      // No token in the link — defer to callback handler
      const callbackUrl = `/auth/callback?redirect=${encodeURIComponent(redirect)}`
      window.location.href = data.magicLink.replace(
        /redirect_to=[^&]*/,
        `redirect_to=${encodeURIComponent(window.location.origin + callbackUrl)}`,
      )
    } catch {
      setStatus('error')
      setError('Network error. Please try again.')
    }
  }

  const handleReset = () => {
    disconnect()
    setStatus('idle')
    setError('')
    handledRef.current = null
  }

  if (status === 'success') {
    return (
      <div className="p-3 bg-white/[0.04] border border-[#00e28a]/30 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-[#00e28a]" />
        <p className="text-white text-sm">Signed in — redirecting…</p>
      </div>
    )
  }

  if (status === 'logging_in' || (isConnected && status === 'idle')) {
    return (
      <div className="p-3 bg-white/[0.04] border border-purple-500/30 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-purple-300 animate-spin" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">Signing in…</p>
          {address && (
            <p className="text-white/45 text-xs tabular-nums">
              {address.slice(0, 6)}…{address.slice(-4)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-white/45 hover:text-white underline"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (blockedDApp) {
    return (
      <div className="space-y-2">
        <div className="p-4 rounded-xl bg-amber-500/[0.08] border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-amber-200 text-sm font-semibold">
              Please switch to Chrome to continue
            </p>
            <p className="text-amber-200/75 text-xs mt-1 leading-relaxed">
              Signing isn&apos;t supported inside in-app wallet browsers.
              Open{' '}
              <span className="font-mono text-amber-100">polnation.com</span>{' '}
              in Chrome (or another regular mobile browser) and connect your wallet from there.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="w-full flex items-center justify-center gap-2 p-3.5 bg-white/[0.04] border border-white/[0.06] text-white/30 text-sm font-semibold rounded-xl cursor-not-allowed"
        >
          <Wallet className="w-4 h-4" />
          Continue with Wallet
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="p-3 bg-rose-500/[0.08] border border-rose-500/30 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
          <p className="text-rose-300 text-sm">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => open()}
        className="w-full flex items-center justify-center gap-2 p-3.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors rounded-xl"
      >
        <Wallet className="w-4 h-4" />
        Continue with Wallet
      </button>

      <div className="flex items-center justify-center gap-2 pt-1">
        <span className="text-[10px] text-white/40">Supports</span>
        {WALLET_LOGOS.map((w) => (
          <Image
            key={w.alt}
            src={w.src}
            alt={w.alt}
            width={16}
            height={16}
            className="w-4 h-4 object-contain rounded-sm"
            unoptimized
          />
        ))}
      </div>
    </div>
  )
}
