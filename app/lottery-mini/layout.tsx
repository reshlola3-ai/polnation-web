import Script from 'next/script'
import type { CSSProperties } from 'react'

export const metadata = {
  title: 'Polnation Lottery',
  description: 'Spin the wheel to win USDC and bonus rewards',
}

// Server-rendered boot skeleton. Visible the moment the HTML arrives, so
// users in slow networks or with cold JS bundles still see a logo + spinner
// instead of a blank screen. Plain inline styles (no Tailwind) so it paints
// even before the CSS bundle finishes loading. page.tsx removes this node
// once the client tree hydrates.
function BootSkeleton() {
  const cardStyle: CSSProperties = {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    padding: 14,
  }

  return (
    <div
      id="lottery-mini-boot"
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#07060d',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 448,
          minHeight: '100vh',
          margin: '0 auto',
          padding: '14px 16px 28px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Logo via plain <img> so we don't depend on next/image runtime */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Polnation" width={22} height={22} />
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
              Polnation
            </span>
          </div>
          <div style={{ width: 78, height: 24, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)' }} />
        </div>

        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <div style={{ color: '#888a91', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Polnation Lottery
          </div>
          <div style={{ color: '#fff', fontSize: 26, fontWeight: 600, marginTop: 8 }}>
            Spin to Win
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 }}>
            Loading prizes...
          </div>
        </div>

        <div
          data-boot-wheel
          style={{
            position: 'relative',
            width: 300,
            height: 300,
            marginTop: 2,
            borderRadius: '50%',
            border: '10px solid #1e1b4b',
            background:
              'conic-gradient(#7c3aed 0 30deg,#1e1b4b 30deg 60deg,#059669 60deg 90deg,#1e1b4b 90deg 120deg,#7c3aed 120deg 150deg,#1e1b4b 150deg 180deg,#0891b2 180deg 210deg,#1e1b4b 210deg 240deg,#7c3aed 240deg 270deg,#1e1b4b 270deg 300deg,#d97706 300deg 330deg,#1e1b4b 330deg 360deg)',
            boxShadow: '0 0 34px rgba(124,58,237,0.22)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ position: 'absolute', left: '50%', top: 6, transform: 'translateX(-50%)', color: '#22c55e', fontSize: 16 }}>
            ▼
          </div>
          <div
            style={{
              position: 'absolute',
              inset: '37%',
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.10)',
              background: '#0d0d14',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
            }}
          >
            SPIN
          </div>
        </div>

        <div style={{ width: '100%', ...cardStyle }}>
          <div style={{ height: 10, width: 92, background: 'rgba(255,255,255,0.16)' }} />
          <div style={{ height: 30, width: 150, background: 'rgba(255,255,255,0.10)', marginTop: 12 }} />
        </div>
        <style
          dangerouslySetInnerHTML={{
            __html: `@media (max-width: 360px) { #lottery-mini-boot [data-boot-wheel] { transform: scale(.9); } }`,
          }}
        />
      </div>
    </div>
  )
}

export default function LotteryMiniLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Required by Telegram Mini Apps: this script creates window.Telegram.WebApp
          from the launch params. Keep it beforeInteractive so page.tsx never
          boots into the "not in Telegram" error path before the bridge exists. */}
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <div className="min-h-screen bg-[#07060d] text-white relative">
        <BootSkeleton />
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: '#07060d' }}>
          {children}
        </div>
      </div>
    </>
  )
}
