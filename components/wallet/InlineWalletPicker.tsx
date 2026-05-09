'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useConnect, useDisconnect, useConnectors } from 'wagmi'
import type { Connector } from 'wagmi'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'
import { Loader2, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react'

interface WalletDef {
  id: 'trust' | 'bitget' | 'safepal'
  name: string
  logo: string
  /** EIP-6963 rdns identifiers (any match wins). */
  rdns: string[]
  /** Lowercase substring fallback against connector.name. */
  nameMatch: string[]
  /** Universal link wrapping a WalletConnect URI (more reliable than DApp-browser deeplinks). */
  wcUniversalLink: (wcUri: string) => string
  /** Install / download URL for desktop without extension. */
  installUrl: string
}

function isMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent)
}

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}

function isInDAppBrowser(): boolean {
  if (typeof window === 'undefined') return false
  // Has injected ethereum provider = inside a wallet's DApp browser
  return !!(window as unknown as { ethereum?: unknown }).ethereum
}

// On Android the OS-level universal-link routing (App Links + Digital Asset
// Links) is unreliable for many wallet vendors — the link just opens the
// wallet's website page in the browser instead of waking the app. Custom
// schemes (trust://, bitkeep://, safepal://) hit the OS intent resolver
// directly and reliably wake an installed wallet. iOS keeps universal links
// (more robust there + can route to App Store when the app is not installed).
const WALLETS: WalletDef[] = [
  {
    id: 'trust',
    name: 'Trust Wallet',
    logo: '/wallet-logos/trust.webp',
    rdns: ['com.trustwallet.app'],
    nameMatch: ['trust'],
    wcUniversalLink: (uri) => isAndroid()
      ? `trust://wc?uri=${encodeURIComponent(uri)}`
      : `https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}`,
    installUrl: 'https://trustwallet.com/download',
  },
  {
    id: 'bitget',
    name: 'Bitget Wallet',
    logo: '/wallet-logos/bitget.webp',
    rdns: ['com.bitget.web3', 'com.bitkeep'],
    nameMatch: ['bitget', 'bitkeep'],
    wcUniversalLink: (uri) => isAndroid()
      ? `bitkeep://wc?uri=${encodeURIComponent(uri)}`
      : `https://bkcode.vip/wc?uri=${encodeURIComponent(uri)}`,
    installUrl: 'https://web3.bitget.com/en/wallet-download',
  },
  {
    id: 'safepal',
    name: 'SafePal',
    logo: '/wallet-logos/safepal.svg',
    rdns: ['io.safepal.app', 'io.safepal'],
    nameMatch: ['safepal'],
    wcUniversalLink: (uri) => isAndroid()
      ? `safepal://wc?uri=${encodeURIComponent(uri)}`
      : `https://link.safepal.io/wc?uri=${encodeURIComponent(uri)}`,
    installUrl: 'https://www.safepal.com/download',
  },
]

interface Props {
  redirect?: string
  referrerId?: string | null
  autoRegister?: boolean
}

export function InlineWalletPicker({
  redirect = '/dashboard',
  referrerId,
  autoRegister = true,
}: Props) {
  const router = useRouter()
  const connectors = useConnectors()
  const { connect, isPending: isConnecting } = useConnect()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const supabase = createClient()

  const [status, setStatus] = useState<'idle' | 'connecting' | 'logging_in' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null)
  const [pendingMobileLink, setPendingMobileLink] = useState<{ wallet: WalletDef; href: string } | null>(null)
  const handledAddressRef = useRef<string | null>(null)

  // Auto-login once a wallet connects (mirrors WalletLogin.tsx behavior).
  useEffect(() => {
    if (!isConnected || !address) return
    if (handledAddressRef.current === address) return
    handledAddressRef.current = address
    handleWalletLogin(address)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address])

  const handleWalletLogin = async (walletAddress: string) => {
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

      if (data.magicLink) {
        const url = new URL(data.magicLink)
        const token = url.searchParams.get('token')
        const type = url.searchParams.get('type') || 'magiclink'

        if (token) {
          const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as 'magiclink',
          })

          if (verifyError || !sessionData?.session) {
            // Fallback: route through /auth/callback
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
          }, 500)
        } else {
          const callbackUrl = `/auth/callback?redirect=${encodeURIComponent(redirect)}`
          window.location.href = data.magicLink.replace(
            /redirect_to=[^&]*/,
            `redirect_to=${encodeURIComponent(window.location.origin + callbackUrl)}`,
          )
        }
      }
    } catch {
      setStatus('error')
      setError('Network error. Please try again.')
    }
  }

  const findConnectorForWallet = (wallet: WalletDef): Connector | undefined => {
    // Match EIP-6963 rdns first (most reliable)
    for (const c of connectors) {
      const rdns = (c as unknown as { rdns?: string }).rdns
      if (rdns && wallet.rdns.includes(rdns)) return c
      if (wallet.rdns.includes(c.id)) return c
    }
    // Fallback: substring match on connector display name
    return connectors.find((c) =>
      wallet.nameMatch.some((n) => c.name?.toLowerCase().includes(n)),
    )
  }

  const handleWalletClick = async (wallet: WalletDef) => {
    if (status === 'connecting' || status === 'logging_in') return
    setActiveWalletId(wallet.id)
    setError('')

    // 1. Wallet detected via EIP-6963 / injected → connect directly (DApp browser, desktop extension)
    const injectedHit = findConnectorForWallet(wallet)
    if (injectedHit) {
      try {
        setStatus('connecting')
        connect({ connector: injectedHit })
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Failed to connect')
      }
      return
    }

    // 2. Mobile non-DApp browser → use WalletConnect protocol + wallet universal link
    if (isMobileBrowser() && !isInDAppBrowser()) {
      const wcConnector = connectors.find(
        (c) => c.id === 'walletConnect' || c.type === 'walletConnect',
      )
      if (wcConnector) {
        try {
          setStatus('connecting')
          // Subscribe to display_uri BEFORE connect; the WC connector emits the wc: URI
          // shortly after connect() is invoked. CRITICAL: we must NOT replace the polnation
          // tab's URL — once polnation unloads, its WC websocket closes and the wallet's
          // approval message has nowhere to land. Instead we open the wallet's universal
          // link in a new tab AND render a fallback <a> link the user can tap (covers
          // popup-blocker case on iOS Safari).
          const provider = await wcConnector.getProvider() as { on?: (e: string, fn: (...args: unknown[]) => void) => void; off?: (e: string, fn: (...args: unknown[]) => void) => void; removeListener?: (e: string, fn: (...args: unknown[]) => void) => void }
          const onUri = (...args: unknown[]) => {
            const uri = args[0] as string
            if (typeof uri === 'string' && uri.startsWith('wc:')) {
              const href = wallet.wcUniversalLink(uri)
              setPendingMobileLink({ wallet, href })
              // Try to auto-open in new tab (preserves polnation tab's WC websocket).
              // If popup is blocked, the rendered fallback <a> link is the user's path.
              try {
                window.open(href, '_blank', 'noopener,noreferrer')
              } catch { /* popup blocked — UI fallback handles it */ }
            }
          }
          provider.on?.('display_uri', onUri)
          connect({ connector: wcConnector })
          setTimeout(() => {
            provider.off?.('display_uri', onUri)
            provider.removeListener?.('display_uri', onUri)
          }, 60_000)
          return
        } catch (err) {
          setStatus('error')
          setError(err instanceof Error ? err.message : 'Failed to start WalletConnect')
          return
        }
      }
      // No WC connector available for some reason — fall through to install page
    }

    // 3. Desktop without extension — open install page
    window.open(wallet.installUrl, '_blank', 'noopener,noreferrer')
  }

  const handleReset = () => {
    disconnect()
    setStatus('idle')
    setError('')
    setActiveWalletId(null)
    setPendingMobileLink(null)
    handledAddressRef.current = null
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (status === 'success') {
    return (
      <div className="p-4 bg-white/[0.04] border border-[var(--poly-emerald)]/30 flex items-center gap-3">
        <CheckCircle className="w-5 h-5" style={{ color: 'var(--poly-emerald)' }} />
        <div>
          <p className="text-white text-sm font-medium">Login successful</p>
          <p className="text-white/45 text-xs mt-0.5">Redirecting to dashboard…</p>
        </div>
      </div>
    )
  }

  if (status === 'logging_in' || (isConnected && status !== 'error')) {
    return (
      <div className="p-4 bg-white/[0.04] border border-[var(--poly-purple)]/30 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-[var(--poly-purple)] animate-spin" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">Logging in…</p>
          {address && (
            <p className="text-white/45 text-xs mt-0.5">
              {address.slice(0, 6)}…{address.slice(-4)}
            </p>
          )}
        </div>
        <button
          onClick={handleReset}
          className="text-xs text-white/45 hover:text-white/80 underline"
          type="button"
        >
          Cancel
        </button>
      </div>
    )
  }

  // Mobile non-DApp: WC URI ready, wallet should be opening. Show a tap-to-open
  // anchor as a fallback (Safari may have blocked window.open popup).
  if (pendingMobileLink && status === 'connecting') {
    const w = pendingMobileLink.wallet
    return (
      <div className="space-y-3">
        <div className="p-4 bg-white/[0.04] border border-[var(--poly-purple)]/30 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[var(--poly-purple)] animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium">Approve in {w.name}</p>
            <p className="text-white/45 text-xs mt-0.5">Waiting for connection…</p>
          </div>
        </div>
        <a
          href={pendingMobileLink.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full p-3 bg-[var(--poly-purple)] hover:bg-[var(--poly-purple-hover)] text-white text-sm font-semibold transition-colors shadow-cta-purple"
        >
          Open {w.name}
        </a>
        <p className="text-center text-xs text-white/45">
          If {w.name} didn&apos;t open automatically, tap the button above.
          <br />Don&apos;t close this tab — connection completes here.
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="w-full text-center text-xs text-white/45 hover:text-white/80 underline"
        >
          Cancel
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

      {WALLETS.map((wallet) => {
        const installed = !!findConnectorForWallet(wallet)
        const isActive = activeWalletId === wallet.id && status === 'connecting'
        const subLabel = isActive
          ? 'Connecting…'
          : installed
          ? 'Tap to connect'
          : isMobileBrowser()
          ? 'Tap to open'
          : 'Tap to download'

        return (
          <button
            key={wallet.id}
            type="button"
            onClick={() => handleWalletClick(wallet)}
            disabled={status === 'connecting'}
            className="w-full flex items-center gap-3 p-3 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/20 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            <div className="w-10 h-10 flex items-center justify-center shrink-0 bg-white/[0.04] border border-white/[0.06]">
              <Image
                src={wallet.logo}
                alt={wallet.name}
                width={32}
                height={32}
                className="w-8 h-8 object-contain"
                unoptimized
              />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-white text-sm font-medium">{wallet.name}</p>
              <p className="text-white/45 text-xs mt-0.5">{subLabel}</p>
            </div>
            {isActive ? (
              <Loader2 className="w-4 h-4 text-white/60 animate-spin" />
            ) : !installed && !isMobileBrowser() ? (
              <ExternalLink className="w-4 h-4 text-white/30" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
