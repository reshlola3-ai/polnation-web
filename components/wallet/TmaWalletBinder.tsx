'use client'

import { useState, useEffect, useRef } from 'react'
import { useAccount, useConnect, useDisconnect, useConnectors } from 'wagmi'
import type { Connector } from 'wagmi'
import Image from 'next/image'
import { Loader2, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react'

interface WalletDef {
  id: 'trust' | 'bitget' | 'safepal'
  name: string
  logo: string
  rdns: string[]
  nameMatch: string[]
  wcUniversalLink: (uri: string) => string
  androidManualOpen?: boolean
  installUrl: string
}

interface PendingMobileLink {
  wallet: WalletDef
  href: string
  wcUri: string
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
    androidManualOpen: true,
    installUrl: 'https://trustwallet.com/download',
  },
  {
    id: 'bitget',
    name: 'Bitget Wallet',
    logo: '/wallet-logos/bitget.webp',
    rdns: ['com.bitget.web3', 'com.bitkeep'],
    nameMatch: ['bitget', 'bitkeep'],
    wcUniversalLink: (uri) => `https://bkcode.vip/wc?uri=${encodeURIComponent(uri)}`,
    androidManualOpen: true,
    installUrl: 'https://web3.bitget.com/en/wallet-download',
  },
  {
    id: 'safepal',
    name: 'SafePal',
    logo: '/wallet-logos/safepal.svg',
    rdns: ['io.safepal.app', 'io.safepal'],
    nameMatch: ['safepal'],
    wcUniversalLink: (uri) => `https://link.safepal.io/wc?uri=${encodeURIComponent(uri)}`,
    installUrl: 'https://www.safepal.com/download',
  },
]

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

// In TMA, window.open / <a target=_blank> loads the URL in TG's webview without
// triggering OS universal-link routing. Telegram.WebApp.openLink hands it to TG
// which opens it via the system browser so universal links resolve correctly.
function openExternal(href: string, log?: (m: string) => void) {
  if (typeof window === 'undefined') return
  const tg = (window as unknown as { Telegram?: { WebApp?: { openLink?: (url: string) => void } } }).Telegram?.WebApp
  if (tg?.openLink) {
    log?.(`openExternal via tg.openLink len=${href.length}`)
    tg.openLink(href); return
  }
  log?.(`openExternal via window.open len=${href.length}`)
  try { window.open(href, '_blank', 'noopener,noreferrer') } catch { /* popup blocked */ }
}

function buildMobileLink(wallet: WalletDef, wcUri: string): PendingMobileLink {
  return {
    wallet,
    href: wallet.wcUniversalLink(wcUri),
    wcUri,
    // On Android, don't auto-open — require a manual tap so the user lands in
    // the wallet deliberately and the approval dialog has a chance to appear.
    manualOpen: !!(isAndroid() && wallet.androidManualOpen),
  }
}

interface Props {
  onBound: (address: string) => void
  onCancel?: () => void
}

export function TmaWalletBinder({ onBound, onCancel }: Props) {
  const connectors = useConnectors()
  const { connect } = useConnect()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()

  const [status, setStatus] = useState<'idle' | 'connecting' | 'saving' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null)
  const [pendingMobileLink, setPendingMobileLink] = useState<PendingMobileLink | null>(null)
  const handledRef = useRef<string | null>(null)
  const wcCleanupRef = useRef<(() => void) | null>(null)
  const statusRef = useRef(status)

  // ── debug log (shown on-screen since TMA has no console) ────────────────
  const [debugLog, setDebugLog] = useState<string[]>([])
  const log = (msg: string) => {
    const t = new Date().toLocaleTimeString('en-GB', { hour12: false }) +
      '.' + String(Date.now() % 1000).padStart(3, '0')
    setDebugLog((prev) => [...prev.slice(-14), `${t} ${msg}`])
  }

  useEffect(() => { statusRef.current = status }, [status])

  // Visibility logging only — auto-retry was kicking the user out of TMA
  // before they could read the panel. Manual flow now: user taps Open Wallet
  // (or copies the WC URI) and we wait for the relay to deliver the approval.
  useEffect(() => {
    const onVisibilityChange = () => {
      log(`visibility=${document.visibilityState} status=${statusRef.current}`)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

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
    log(`click ${wallet.id} android=${isAndroid()} mobile=${isMobileBrowser()} dapp=${isInDAppBrowser()}`)
    setActiveWalletId(wallet.id)
    setError('')

    const injected = findConnector(wallet)
    if (injected) {
      log(`injected connector found -> direct connect`)
      setStatus('connecting')
      connect({ connector: injected })
      return
    }

    if (isMobileBrowser() && !isInDAppBrowser()) {
      const wcConnector = connectors.find((c) => c.id === 'walletConnect' || c.type === 'walletConnect')
      if (wcConnector) {
        // Clear any leftover listener + stale pending link from a previous attempt
        // so we never route a new display_uri through the old wallet's universal link.
        wcCleanupRef.current?.()
        wcCleanupRef.current = null
        setPendingMobileLink(null)

        setStatus('connecting')
        const provider = await wcConnector.getProvider() as {
          on?: (e: string, fn: (...args: unknown[]) => void) => void
          off?: (e: string, fn: (...args: unknown[]) => void) => void
          removeListener?: (e: string, fn: (...args: unknown[]) => void) => void
        }
        log(`WC connector found, registering display_uri listener`)
        const onUri = (...args: unknown[]) => {
          const uri = args[0] as string
          log(`[1st] display_uri fired uriPrefix=${typeof uri === 'string' ? uri.slice(0, 12) : 'NOT_STRING'}`)
          if (typeof uri === 'string' && uri.startsWith('wc:')) {
            const link = buildMobileLink(wallet, uri)
            setPendingMobileLink(link)
            if (!link.manualOpen) {
              log(`[1st] openExternal auto -> ${wallet.id}`)
              openExternal(link.href, log)
            } else {
              log(`[1st] manualOpen=true, waiting for user tap`)
            }
          }
        }
        provider.on?.('display_uri', onUri)
        const cleanup = () => {
          provider.off?.('display_uri', onUri)
          provider.removeListener?.('display_uri', onUri)
        }
        wcCleanupRef.current = cleanup
        log(`[1st] calling connect()`)
        connect({ connector: wcConnector })
        // 60s safety net in case nothing else clears the listener
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
    handledRef.current = null
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      log(`copied ${label} (${text.length} chars)`)
    } catch (err) {
      log(`copy ${label} failed: ${err instanceof Error ? err.message : 'unknown'}`)
    }
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
          onClick={() => { log(`manual tap -> ${pendingMobileLink.wallet.id}`); openExternal(pendingMobileLink.href, log) }}
          className="flex items-center justify-center gap-2 w-full p-3 bg-[var(--poly-purple)] text-white text-sm font-semibold shadow-cta-purple"
        >
          Open {w.name}
        </button>

        {/* Manual fallback: paste URI in wallet's WalletConnect screen */}
        <div className="p-3 bg-white/[0.04] border border-white/[0.08] space-y-2">
          <p className="text-white/70 text-xs font-medium">
            Or connect manually:
          </p>
          <ol className="text-white/50 text-[11px] space-y-0.5 pl-4 list-decimal">
            <li>Tap &quot;Copy WC URI&quot;</li>
            <li>Open {w.name} → WalletConnect → paste</li>
          </ol>
          <button
            type="button"
            onClick={() => copyToClipboard(pendingMobileLink.wcUri, 'wcUri')}
            className="w-full p-2 bg-white/[0.06] border border-white/[0.12] text-white text-xs font-medium hover:bg-white/[0.10]"
          >
            Copy WC URI
          </button>
        </div>

        <p className="text-center text-xs text-white/40">
          Don&apos;t close this tab — connection completes here.
        </p>
        <button type="button" onClick={handleReset}
          className="w-full text-center text-xs text-white/40 hover:text-white/70 underline">
          Cancel
        </button>
        {debugLog.length > 0 && (
          <div className="space-y-1">
            <div className="p-2 bg-black/60 border border-yellow-500/40 text-[10px] font-mono text-yellow-200 max-h-48 overflow-y-auto whitespace-pre-wrap break-all leading-tight">
              {debugLog.map((l, i) => <div key={i}>{l}</div>)}
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(debugLog.join('\n'), 'logs')}
              className="w-full p-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-[10px] font-medium hover:bg-yellow-500/20"
            >
              Copy logs
            </button>
          </div>
        )}
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
      {debugLog.length > 0 && (
        <div className="space-y-1">
          <div className="p-2 bg-black/60 border border-yellow-500/40 text-[10px] font-mono text-yellow-200 max-h-48 overflow-y-auto whitespace-pre-wrap break-all leading-tight">
            {debugLog.map((l, i) => <div key={i}>{l}</div>)}
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(debugLog.join('\n'), 'logs')}
            className="w-full p-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-[10px] font-medium hover:bg-yellow-500/20"
          >
            Copy logs
          </button>
        </div>
      )}
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
          <button
            key={wallet.id}
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
