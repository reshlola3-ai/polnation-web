'use client'

import { Suspense, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'

function buildTrustLinks(wcUri: string) {
  const universalHref = `https://link.trustwallet.com/wc?uri=${encodeURIComponent(wcUri)}`
  const intentHref =
    `intent://wc?uri=${encodeURIComponent(wcUri)}` +
    `#Intent;scheme=trust;package=com.wallet.crypto.trustapp;` +
    `S.browser_fallback_url=${encodeURIComponent(universalHref)};end`

  return { intentHref, universalHref }
}

function WalletOpenContent() {
  const searchParams = useSearchParams()

  const state = useMemo(() => {
    const wallet = searchParams.get('wallet')
    const wcUri = searchParams.get('uri')

    if (wallet !== 'trust') {
      return {
        wcUri: null,
        intentHref: null,
        universalHref: null,
        error: 'Unsupported wallet.',
      }
    }

    if (!wcUri || !wcUri.startsWith('wc:')) {
      return {
        wcUri: null,
        intentHref: null,
        universalHref: null,
        error: 'Missing WalletConnect URI.',
      }
    }

    return {
      wcUri,
      ...buildTrustLinks(wcUri),
      error: null,
    }
  }, [searchParams])

  useEffect(() => {
    if (!state.intentHref) return
    const timer = window.setTimeout(() => {
      window.location.href = state.intentHref!
    }, 250)

    return () => window.clearTimeout(timer)
  }, [state.intentHref])

  const shortUri = useMemo(() => {
    if (!state.wcUri) return null
    const versionIndex = state.wcUri.indexOf('@')
    if (versionIndex < 0) return `${state.wcUri.slice(0, 18)}...`
    return `${state.wcUri.slice(0, 18)}...${state.wcUri.slice(versionIndex, versionIndex + 3)}`
  }, [state.wcUri])

  return (
    <main className="min-h-screen bg-[#07060d] text-white flex items-center justify-center px-5">
      <div className="w-full max-w-sm border border-white/[0.10] bg-white/[0.04] p-5 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-white/[0.12] bg-white/[0.06]">
          <span className="text-2xl">T</span>
        </div>

        <h1 className="text-lg font-semibold">Opening Trust Wallet</h1>
        <p className="mt-2 text-sm text-white/55 leading-relaxed">
          Keep this browser tab open until Trust Wallet shows the WalletConnect approval.
        </p>

        {state.error ? (
          <div className="mt-4 border border-rose-400/25 bg-rose-400/[0.08] p-3 text-sm text-rose-100">
            {state.error}
          </div>
        ) : (
          <>
            <div className="mt-4 border border-amber-400/20 bg-amber-400/[0.06] p-3 text-left">
              <p className="text-[10px] uppercase tracking-wider text-amber-200">WalletConnect</p>
              <p className="mt-1 break-all text-xs text-amber-100/70">{shortUri || 'Preparing...'}</p>
            </div>

            <button
              type="button"
              disabled={!state.intentHref}
              onClick={() => {
                if (state.intentHref) window.location.href = state.intentHref
              }}
              className="mt-4 w-full bg-[var(--poly-purple)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              Open Trust Wallet
            </button>

            <button
              type="button"
              disabled={!state.universalHref}
              onClick={() => {
                if (state.universalHref) window.location.href = state.universalHref
              }}
              className="mt-3 w-full text-xs text-white/45 underline hover:text-white/75 disabled:opacity-40"
            >
              Try Trust web link
            </button>
          </>
        )}
      </div>
    </main>
  )
}

export default function WalletOpenPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#07060d] text-white flex items-center justify-center px-5">
          <p className="text-sm text-white/60">Preparing wallet link...</p>
        </main>
      }
    >
      <WalletOpenContent />
    </Suspense>
  )
}
