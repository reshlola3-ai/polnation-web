'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  androidWcLink?: (uri: string) => string
  installUrl: string
}

interface PendingMobileLink {
  wallet: WalletDef
  href: string
  fallbackHref?: string
  manualOpen: boolean
}

interface DebugEntry {
  time: string
  message: string
  data?: string
}

const WALLETS: WalletDef[] = [
  {
    id: 'trust',
    name: 'Trust Wallet',
    logo: '/wallet-logos/trust.webp',
    rdns: ['com.trustwallet.app'],
    nameMatch: ['trust'],
    wcUniversalLink: (uri) => `https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}`,
    androidWcLink: (uri) => `trust://wc?uri=${encodeURIComponent(uri)}`,
    installUrl: 'https://trustwallet.com/download',
  },
  {
    id: 'bitget',
    name: 'Bitget Wallet',
    logo: '/wallet-logos/bitget.webp',
    rdns: ['com.bitget.web3', 'com.bitkeep'],
    nameMatch: ['bitget', 'bitkeep'],
    wcUniversalLink: (uri) => `https://bkcode.vip/wc?uri=${encodeURIComponent(uri)}`,
    androidWcLink: (uri) => `bitkeep://wc?uri=${encodeURIComponent(uri)}`,
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

// In TMA, window.open / <a target=_blank> often loads the URL in TG's webview
// without triggering OS universal-link routing — wallet apps either don't open
// or open without the wc URI. Telegram.WebApp.openLink hands the URL to TG,
// which opens it via the system browser so universal links resolve correctly.
function openExternal(href: string) {
  if (typeof window === 'undefined') return
  if (!/^https?:\/\//i.test(href)) {
    window.location.href = href
    return
  }
  const tg = (window as unknown as { Telegram?: { WebApp?: { openLink?: (url: string) => void } } }).Telegram?.WebApp
  if (tg?.openLink) {
    tg.openLink(href)
    return
  }
  try { window.open(href, '_blank', 'noopener,noreferrer') } catch { /* popup blocked */ }
}

function buildMobileLink(wallet: WalletDef, wcUri: string): PendingMobileLink {
  const universalHref = wallet.wcUniversalLink(wcUri)
  if (isAndroid() && wallet.androidWcLink) {
    return {
      wallet,
      href: wallet.androidWcLink(wcUri),
      fallbackHref: universalHref,
      manualOpen: true,
    }
  }

  return {
    wallet,
    href: universalHref,
    manualOpen: false,
  }
}

function maskAddress(addr: string | null | undefined) {
  if (!addr) return null
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function connectorDebugInfo(connector: Connector) {
  return {
    id: connector.id,
    name: connector.name,
    type: connector.type,
    rdns: (connector as unknown as { rdns?: string }).rdns ?? null,
  }
}

function redactDebugText(value: string) {
  let text = value
  try {
    text = decodeURIComponent(text)
  } catch {
    // Keep the original if the browser gives us a partially encoded string.
  }
  return text
    .replace(/symKey=([^&\s"']+)/gi, 'symKey=<redacted>')
    .replace(/(wc:[^@]{8})[^@]*(@\d)/gi, '$1...$2')
}

function stringifyDebugData(data: unknown) {
  if (typeof data === 'string') return redactDebugText(data)
  try {
    return redactDebugText(JSON.stringify(data, null, 2))
  } catch {
    return '[unserializable]'
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
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([])
  const handledRef = useRef<string | null>(null)
  const wcCleanupRef = useRef<(() => void) | null>(null)
  const connectorsDebugSignatureRef = useRef('')

  const addDebug = useCallback((message: string, data?: unknown) => {
    const entry: DebugEntry = {
      time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      message,
      data: data === undefined ? undefined : stringifyDebugData(data),
    }
    setDebugEntries((prev) => [...prev.slice(-29), entry])
  }, [])

  useEffect(() => {
    addDebug('binder mounted', {
      mobile: isMobileBrowser(),
      android: isAndroid(),
      dappBrowser: isInDAppBrowser(),
      userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    })
  }, [addDebug])

  useEffect(() => {
    const connectorInfo = connectors.map(connectorDebugInfo)
    const signature = stringifyDebugData(connectorInfo)
    if (connectorsDebugSignatureRef.current === signature) return
    connectorsDebugSignatureRef.current = signature
    addDebug('connectors updated', connectorInfo)
  }, [addDebug, connectors])

  useEffect(() => {
    if (!isConnected || !address) return
    if (handledRef.current === address) return
    handledRef.current = address
    addDebug('wagmi account connected', { address: maskAddress(address) })
    saveWallet(address)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address])

  const saveWallet = async (addr: string) => {
    setStatus('saving')
    setError('')
    addDebug('saving wallet', { address: maskAddress(addr) })
    try {
      const res = await fetch('/api/profile/bind-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      })
      const data = await res.json()
      addDebug('bind-wallet response', {
        ok: res.ok,
        status: res.status,
        error: data?.error ?? null,
      })
      if (!res.ok) {
        if (res.status === 409 || data.error === 'wallet_taken') {
          throw new Error('wallet_taken')
        }
        throw new Error(data.error || 'save_failed')
      }
      setStatus('success')
      addDebug('wallet saved', { address: maskAddress(addr) })
      setTimeout(() => onBound(addr), 800)
    } catch (err) {
      handledRef.current = null
      setStatus('error')
      setError(err instanceof Error ? err.message : 'save_failed')
      addDebug('wallet save failed', {
        error: err instanceof Error ? err.message : 'save_failed',
      })
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
    addDebug('wallet clicked', {
      wallet: wallet.id,
      mobile: isMobileBrowser(),
      android: isAndroid(),
      dappBrowser: isInDAppBrowser(),
    })

    const injected = findConnector(wallet)
    if (injected) {
      setStatus('connecting')
      addDebug('using injected connector', connectorDebugInfo(injected))
      connect({ connector: injected })
      return
    }

    if (isMobileBrowser() && !isInDAppBrowser()) {
      const wcConnector = connectors.find((c) => c.id === 'walletConnect' || c.type === 'walletConnect')
      if (wcConnector) {
        addDebug('using WalletConnect connector', connectorDebugInfo(wcConnector))
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
        addDebug('WalletConnect provider ready')
        const onUri = (...args: unknown[]) => {
          const uri = args[0] as string
          if (typeof uri === 'string' && uri.startsWith('wc:')) {
            const link = buildMobileLink(wallet, uri)
            setPendingMobileLink(link)
            addDebug('display_uri received', {
              wallet: wallet.id,
              linkMode: link.manualOpen ? 'android-native-manual' : 'universal-auto',
              href: link.href,
              fallbackHref: link.fallbackHref ?? null,
            })
            if (!link.manualOpen) {
              addDebug('auto opening wallet link', { href: link.href })
              openExternal(link.href)
            }
          }
        }
        provider.on?.('display_uri', onUri)
        const cleanup = () => {
          provider.off?.('display_uri', onUri)
          provider.removeListener?.('display_uri', onUri)
        }
        wcCleanupRef.current = cleanup
        connect({ connector: wcConnector })
        addDebug('connect invoked', { connector: connectorDebugInfo(wcConnector) })
        // 60s safety net in case nothing else clears it
        setTimeout(() => {
          if (wcCleanupRef.current === cleanup) {
            cleanup()
            wcCleanupRef.current = null
            addDebug('WalletConnect display_uri listener cleaned up')
          }
        }, 60_000)
        return
      }
      addDebug('WalletConnect connector missing')
    }

    addDebug('opening install url', { href: wallet.installUrl })
    openExternal(wallet.installUrl)
  }

  const handleReset = () => {
    addDebug('reset tapped')
    wcCleanupRef.current?.()
    wcCleanupRef.current = null
    disconnect()
    setStatus('idle')
    setError('')
    setActiveWalletId(null)
    setPendingMobileLink(null)
    handledRef.current = null
  }

  const renderDebugPanel = () => {
    const snapshot = {
      state: {
        status,
        activeWalletId,
        pendingWallet: pendingMobileLink?.wallet.id ?? null,
        pendingManualOpen: pendingMobileLink?.manualOpen ?? null,
        pendingHref: pendingMobileLink?.href ? redactDebugText(pendingMobileLink.href) : null,
        fallbackHref: pendingMobileLink?.fallbackHref ? redactDebugText(pendingMobileLink.fallbackHref) : null,
      },
      platform: {
        mobile: isMobileBrowser(),
        android: isAndroid(),
        dappBrowser: isInDAppBrowser(),
        userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
      },
      wagmi: {
        isConnected,
        address: maskAddress(address),
        connectors: connectors.map(connectorDebugInfo),
      },
    }

    return (
      <details className="mt-3 border border-amber-400/25 bg-amber-400/[0.06] p-3 text-left">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-amber-200">
          Wallet debug
        </summary>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed text-amber-100/80">
          {stringifyDebugData(snapshot)}
        </pre>
        <div className="mt-2 max-h-44 overflow-auto space-y-1 border-t border-amber-400/15 pt-2">
          {debugEntries.length === 0 ? (
            <p className="text-[10px] text-amber-100/50">No events yet.</p>
          ) : (
            debugEntries.map((entry, index) => (
              <div key={`${entry.time}-${index}`} className="text-[10px] leading-relaxed text-amber-100/75">
                <span className="text-amber-200/90">{entry.time}</span>
                <span className="mx-1 text-amber-100/35">|</span>
                <span>{entry.message}</span>
                {entry.data && (
                  <pre className="mt-0.5 whitespace-pre-wrap break-all text-amber-100/55">{entry.data}</pre>
                )}
              </div>
            ))
          )}
        </div>
      </details>
    )
  }

  if (status === 'success') {
    return (
      <>
        <div className="p-4 bg-white/[0.04] border border-[var(--poly-emerald)]/30 flex items-center gap-3">
          <CheckCircle className="w-5 h-5" style={{ color: 'var(--poly-emerald)' }} />
          <p className="text-white text-sm font-medium">Wallet connected</p>
        </div>
        {renderDebugPanel()}
      </>
    )
  }

  if (status === 'saving' || (isConnected && status !== 'error')) {
    return (
      <>
        <div className="p-4 bg-white/[0.04] border border-[var(--poly-purple)]/30 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[var(--poly-purple)] animate-spin" />
          <p className="text-white text-sm">Saving wallet…</p>
        </div>
        {renderDebugPanel()}
      </>
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
              {pendingMobileLink.manualOpen ? 'Tap the button below to continue' : 'Waiting for connection...'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            addDebug('open wallet button tapped', { href: pendingMobileLink.href })
            openExternal(pendingMobileLink.href)
          }}
          className="flex items-center justify-center gap-2 w-full p-3 bg-[var(--poly-purple)] text-white text-sm font-semibold shadow-cta-purple"
        >
          Open {w.name}
        </button>
        {pendingMobileLink.fallbackHref && (
          <button
            type="button"
            onClick={() => {
              addDebug('fallback web link tapped', { href: pendingMobileLink.fallbackHref })
              openExternal(pendingMobileLink.fallbackHref!)
            }}
            className="w-full text-center text-xs text-white/45 hover:text-white/75 underline"
          >
            Try web link
          </button>
        )}
        <p className="text-center text-xs text-white/40">
          Don&apos;t close this tab — connection completes here.
        </p>
        <button type="button" onClick={handleReset}
          className="w-full text-center text-xs text-white/40 hover:text-white/70 underline">
          Cancel
        </button>
        {renderDebugPanel()}
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
      {renderDebugPanel()}
    </div>
  )
}
