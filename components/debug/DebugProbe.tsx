'use client'

// Diagnostic overlay — shows only when URL has ?_debug=1.
// Dumps every signal we use (and could use) to detect SafePal so we can
// see exactly what an actual SafePal in-app browser exposes. Remove the
// import in app/layout.tsx once we've nailed detection.

import { useEffect, useState } from 'react'

interface ProbeData {
  pathname: string
  ua: string
  isMobileUA: boolean
  windowIsSafePal: boolean
  windowSafePalProvider: boolean
  windowSafepal: boolean
  windowEthereumPresent: boolean
  ethIsSafePal: boolean
  ethIsSafepal: boolean
  ethIsTrust: boolean
  ethIsBitget: boolean
  ethIsMetaMask: boolean
  ethIsKeys: string[]
  detectedSafePalDApp: boolean
}

export function DebugProbe() {
  const [data, setData] = useState<ProbeData | null>(null)
  const [hidden, setHidden] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('_debug') !== '1') return

    const w = window as unknown as Record<string, unknown>
    const eth = (w.ethereum ?? null) as Record<string, unknown> | null

    const ua = navigator.userAgent
    const isMobile = /android|iphone|ipad|ipod/i.test(ua)
    const uaHit = /safepal/i.test(ua)
    const winHit = Boolean(w.isSafePal)
    const ethHit = isMobile && Boolean(eth?.isSafePal || eth?.isSafepal)

    // Legitimate post-mount derivation from client-only globals (window/navigator).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData({
      pathname: window.location.pathname,
      ua,
      isMobileUA: isMobile,
      windowIsSafePal: Boolean(w.isSafePal),
      windowSafePalProvider: Boolean(w.SafePalProvider),
      windowSafepal: Boolean(w.safepal),
      windowEthereumPresent: Boolean(eth),
      ethIsSafePal: Boolean(eth?.isSafePal),
      ethIsSafepal: Boolean(eth?.isSafepal),
      ethIsTrust: Boolean(eth?.isTrust),
      ethIsBitget: Boolean(eth?.isBitget),
      ethIsMetaMask: Boolean(eth?.isMetaMask),
      ethIsKeys: eth
        ? Object.keys(eth)
            .filter((k) => k.startsWith('is'))
            .slice(0, 30)
        : [],
      detectedSafePalDApp: uaHit || winHit || ethHit,
    })
  }, [])

  if (!data || hidden) return null

  const json = JSON.stringify(data, null, 2)
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* noop */
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647,
        padding: '8px 12px',
        background: '#000',
        color: '#7ef58a',
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 11,
        lineHeight: 1.5,
        overflow: 'auto',
        maxHeight: '50vh',
        borderBottom: '1px solid #7ef58a',
        boxShadow: '0 2px 16px rgba(0,0,0,0.6)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          marginBottom: 6,
          flexWrap: 'wrap',
        }}
      >
        <strong style={{ color: '#fff' }}>DebugProbe</strong>
        <span style={{ color: '#999' }}>·</span>
        <span style={{ color: '#999' }}>{data.pathname}</span>
        <span style={{ color: '#999' }}>·</span>
        <span
          style={{
            color: data.detectedSafePalDApp ? '#fbbf24' : '#7ef58a',
            fontWeight: 600,
          }}
        >
          SafePal: {String(data.detectedSafePalDApp)}
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={copyAll}
          style={{
            background: copied ? '#7ef58a' : '#222',
            color: copied ? '#000' : '#7ef58a',
            border: '1px solid #7ef58a',
            padding: '2px 8px',
            fontSize: 10,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          {copied ? 'Copied' : 'Copy JSON'}
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          style={{
            background: '#222',
            color: '#fff',
            border: '1px solid #555',
            padding: '2px 8px',
            fontSize: 10,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          color: 'inherit',
        }}
      >
        {json}
      </pre>
    </div>
  )
}
