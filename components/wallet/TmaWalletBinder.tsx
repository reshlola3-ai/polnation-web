'use client'

import { useState, useEffect, useRef } from 'react'
import { useAccount, useConnect, useDisconnect, useConnectors } from 'wagmi'
import type { Connector } from 'wagmi'
import Image from 'next/image'
import { Loader2, AlertCircle, CheckCircle, ExternalLink, Download } from 'lucide-react'

export interface WalletBinderT {
  walletTrustNotInTg: string
  walletTrustStep1: string
  walletTrustStep2: string
  walletTrustStep3: string
  walletTrustAlt: string
  walletOpenInBrowser: string
  walletInstall: string
  walletBackBtn: string
}

interface WalletDef {
  id: 'trust' | 'bitget' | 'safepal'
  name: string
  logo: string
  rdns: string[]
  nameMatch: string[]
  wcUniversalLink: (uri: string) => string
  /** Show a Chrome-only guide on Android TMA (universal link → app handoff is broken there). */
  androidGuideOnly?: boolean
  /** Google Play package id for the Install link. */
  androidPackage: string
  /** Generic install URL (used on iOS/desktop fallback). */
  installUrl: string
}

interface PendingMobileLink {
  wallet: WalletDef
  href: string
  manualOpen: boolean
}

const WALLETS: WalletDef[] = [
  {
    id: 'trust',
    name: 'Trust Wallet',
    logo: '/wallet-logos/trust.webp',
    rdns: ['com.trustwallet.app'],
    nameMatch: ['trust'],
    wcUniversalLink: (uri) => `https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}`,
    androidGuideOnly: true,
    androidPackage: 'com.wallet.crypto.trustapp',
    installUrl: 'https://trustwallet.com/download',
  },
  {
    id: 'bitget',
    name: 'Bitget Wallet',
    logo: '/wallet-logos/bitget.webp',
    rdns: ['com.bitget.web3', 'com.bitkeep'],
    nameMatch: ['bitget', 'bitkeep'],
    wcUniversalLink: (uri) => `https://bkcode.vip/wc?uri=${encodeURIComponent(uri)}`,
    androidPackage: 'com.bitkeep.wallet',
    installUrl: 'https://web3.bitget.com/en/wallet-download',
  },
  {
    id: 'safepal',
    name: 'SafePal',
    logo: '/wallet-logos/safepal.svg',
    rdns: ['io.safepal.app', 'io.safepal'],
    nameMatch: ['safepal'],
    wcUniversalLink: (uri) => `https://link.safepal.io/wc?uri=${encodeURIComponent(uri)}`,
    androidPackage: 'io.safepal.wallet',
    installUrl: 'https://www.safepal.com/download',
  },
]

const DASHBOARD_URL = 'https://www.polnation.com/profile'

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
  return !!(window as unknown as { ethereum?: unknown }).ethereum
}

function playStoreUrl(pkg: string): string {
  return `https://play.google.com/store/apps/details?id=${pkg}`
}

// In TMA, window.open / <a target=_blank> loads the URL in TG's webview without
// triggering OS universal-link routing. Telegram.WebApp.openLink hands it to TG
// which opens it via the system browser so universal links resolve correctly.
function openExternal(href: string) {
  if (typeof window === 'undefined') return
  const tg = (window as unknown as { Telegram?: { WebApp?: { openLink?: (url: string) => void } } }).Telegram?.WebApp
  if (tg?.openLink) { tg.openLink(href); return }
  try { window.open(href, '_blank', 'noopener,noreferrer') } catch { /* popup blocked */ }
}

function buildMobileLink(wallet: WalletDef, wcUri: string): PendingMobileLink {
  return {
    wallet,
    href: wallet.wcUniversalLink(wcUri),
    // On Android, don't auto-open — require a manual tap so the user lands in
    // the wallet deliberately and the approval dialog has a chance to appear.
    manualOpen: !!(isAndroid() && !wallet.androidGuideOnly),
  }
}

interface Props {
  t: WalletBinderT
  onBound: (address: string) => void
  onCancel?: () => void
}

export function TmaWalletBinder({ t, onBound, onCancel }: Props) {
  const connectors = useConnectors()
  const { connect } = useConnect()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()

  const [status, setStatus] = useState<'idle' | 'connecting' | 'saving' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null)
  const [pendingMobileLink, setPendingMobileLink] = useState<PendingMobileLink | null>(null)
  const [showTrustGuide, setShowTrustGuide] = useState(false)
  const handledRef = useRef<string | null>(null)
  const wcCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!isConnected || !address) return
    if (handledRef.current === address) return
    handledRef.current = address
    saveWallet(address)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address])

  const saveWallet = async (addr: string) => {
    setStatus('saving')
    setError('')
    try {
      const res = await fetch('/api/profile/bind-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 || data.error === 'wallet_taken') {
          throw new Error('wallet_taken')
        }
        throw new Error(data.error || 'save_failed')
      }
      setStatus('success')
      setTimeout(() => onBound(addr), 800)
    } catch (err) {
      handledRef.current = null
      setStatus('error')
      setError(err instanceof Error ? err.message : 'save_failed')
    }
  }

  const findConnector = (wallet: WalletDef): Connector | undefined => {
    for (const c of connectors) {
      const rdns = (c as unknown as { rdns?: string }).rdns
      if (rdns && wallet.rdns.includes(rdns)) return c
      if (wallet.rdns.includes(c.id)) return c
    }
    return connectors.find((c) => wallet.nameMatch.some((n) => c.name?.toLowerCase().includes(n)))
  }

  const handleClick = async (wallet: WalletDef) => {
    if (status === 'connecting' || status === 'saving') return
    setActiveWalletId(wallet.id)
    setError('')

    const injected = findConnector(wallet)
    if (injected) {
      setStatus('connecting')
      connect({ connector: injected })
      return
    }

    // Trust on Android TMA: universal link → app handoff drops the WC URI in
    // Chrome Custom Tabs. Show a "use Chrome" guide instead.
    if (wallet.androidGuideOnly && isAndroid() && !isInDAppBrowser()) {
      setShowTrustGuide(true)
      return
    }

    if (isMobileBrowser() && !isInDAppBrowser()) {
      const wcConnector = connectors.find((c) => c.id === 'walletConnect' || c.type === 'walletConnect')
      if (wcConnector) {
        wcCleanupRef.current?.()
        wcCleanupRef.current = null
        setPendingMobileLink(null)

        setStatus('connecting')
        const provider = await wcConnector.getProvider() as {
          on?: (e: string, fn: (...args: unknown[]) => void) => void
          off?: (e: string, fn: (...args: unknown[]) => void) => void
          removeListener?: (e: string, fn: (...args: unknown[]) => void) => void
        }
        const onUri = (...args: unknown[]) => {
          const uri = args[0] as string
          if (typeof uri === 'string' && uri.startsWith('wc:')) {
            const link = buildMobileLink(wallet, uri)
            setPendingMobileLink(link)
            if (!link.manualOpen) openExternal(link.href)
          }
        }
        provider.on?.('display_uri', onUri)
        const cleanup = () => {
          provider.off?.('display_uri', onUri)
          provider.removeListener?.('display_uri', onUri)
        }
        wcCleanupRef.current = cleanup
        connect({ connector: wcConnector })
        setTimeout(() => {
          if (wcCleanupRef.current === cleanup) {
            cleanup()
            wcCleanupRef.current = null
          }
        }, 60_000)
        return
      }
    }

    openExternal(wallet.installUrl)
  }

  const handleReset = () => {
    wcCleanupRef.current?.()
    wcCleanupRef.current = null
    disconnect()
    setStatus('idle')
    setError('')
    setActiveWalletId(null)
    setPendingMobileLink(null)
    setShowTrustGuide(false)
    handledRef.current = null
  }

  if (status === 'success') {
    return (
      <div className="p-4 bg-white/[0.04] border border-[var(--poly-emerald)]/30 flex items-center gap-3">
        <CheckCircle className="w-5 h-5" style={{ color: 'var(--poly-emerald)' }} />
        <p className="text-white text-sm font-medium">Wallet connected</p>
      </div>
    )
  }

  if (status === 'saving' || (isConnected && status !== 'error')) {
    return (
      <div className="p-4 bg-white/[0.04] border border-[var(--poly-purple)]/30 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-[var(--poly-purple)] animate-spin" />
        <p className="text-white text-sm">Saving wallet…</p>
      </div>
    )
  }

  if (showTrustGuide) {
    return (
      <div className="space-y-3">
        <div className="p-4 bg-white/[0.04] border border-amber-400/30 space-y-3">
          <p className="text-white text-sm font-semibold">{t.walletTrustNotInTg}</p>
          <ol className="space-y-2 text-white/75 text-sm pl-4 list-decimal marker:text-white/40">
            <li>{t.walletTrustStep1}</li>
            <li>{t.walletTrustStep2}</li>
            <li>{t.walletTrustStep3}</li>
          </ol>
          <p className="text-white/55 text-xs pt-1 border-t border-white/[0.08]">
            {t.walletTrustAlt}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openExternal(DASHBOARD_URL)}
          className="flex items-center justify-center gap-2 w-full p-3 bg-[var(--poly-purple)] text-white text-sm font-semibold shadow-cta-purple"
        >
          <ExternalLink className="w-4 h-4" />
          {t.walletOpenInBrowser}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="w-full text-center text-xs text-white/40 hover:text-white/70 underline"
        >
          {t.walletBackBtn}
        </button>
      </div>
    )
  }

  if (pendingMobileLink && status === 'connecting') {
    const w = pendingMobileLink.wallet
    return (
      <div className="space-y-3">
        <div className="p-4 bg-white/[0.04] border border-[var(--poly-purple)]/30 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[var(--poly-purple)] animate-spin shrink-0" />
          <div>
            <p className="text-white text-sm font-medium">
              {pendingMobileLink.manualOpen ? `Open ${w.name}` : `Approve in ${w.name}`}
            </p>
            <p className="text-white/45 text-xs">
              {pendingMobileLink.manualOpen ? 'Tap the button below to open' : 'Waiting for connection…'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openExternal(pendingMobileLink.href)}
          className="flex items-center justify-center gap-2 w-full p-3 bg-[var(--poly-purple)] text-white text-sm font-semibold shadow-cta-purple"
        >
          Open {w.name}
        </button>
        <p className="text-center text-xs text-white/40">
          Don&apos;t close this tab — connection completes here.
        </p>
        <button type="button" onClick={handleReset}
          className="w-full text-center text-xs text-white/40 hover:text-white/70 underline">
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
          <div className="flex-1">
            <p className="text-rose-300 text-sm">
              {error === 'wallet_taken'
                ? 'This wallet is already bound to another account. Please connect a different wallet.'
                : 'Failed to save wallet. Please try again.'}
            </p>
            {error === 'wallet_taken' && (
              <button
                type="button"
                onClick={handleReset}
                className="mt-2 text-xs text-rose-300 underline underline-offset-2 hover:text-rose-200"
              >
                Try a different wallet
              </button>
            )}
          </div>
        </div>
      )}
      <p className="text-white/50 text-[11px] mb-2">
        Connect a wallet to receive USDC withdrawals.
      </p>
      {WALLETS.map((wallet) => {
        const installed = !!findConnector(wallet)
        const isActive = activeWalletId === wallet.id && status === 'connecting'
        const subLabel = isActive
          ? 'Connecting…'
          : installed
          ? 'Tap to connect'
          : isMobileBrowser()
          ? 'Tap to open'
          : 'Tap to download'

        return (
          <div key={wallet.id} className="space-y-1">
            <button
              type="button"
              onClick={() => handleClick(wallet)}
              disabled={['connecting', 'saving'].includes(status)}
              className="w-full flex items-center gap-3 p-3 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              <div className="w-10 h-10 flex items-center justify-center bg-white/[0.04] border border-white/[0.06]">
                <Image src={wallet.logo} alt={wallet.name} width={32} height={32}
                  className="w-8 h-8 object-contain" unoptimized />
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
            {!installed && isAndroid() && (
              <button
                type="button"
                onClick={() => openExternal(playStoreUrl(wallet.androidPackage))}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1 text-[11px] text-white/55 hover:text-white/85 underline-offset-2 hover:underline"
              >
                <Download className="w-3 h-3" />
                {t.walletInstall} {wallet.name} (Google Play)
              </button>
            )}
          </div>
        )
      })}
      {onCancel && (
        <button type="button" onClick={onCancel}
          className="w-full text-center text-xs text-white/40 hover:text-white/70 underline pt-1">
          Cancel
        </button>
      )}
    </div>
  )
}
