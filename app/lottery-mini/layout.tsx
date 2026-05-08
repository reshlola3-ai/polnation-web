import Script from 'next/script'

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
  return (
    <div
      id="lottery-mini-boot"
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#07060d',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* Logo via plain <img> so we don't depend on next/image runtime */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="Polnation" width={48} height={48} />
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '2px solid rgba(124, 58, 237, 1)',
          borderTopColor: 'transparent',
          animation: 'lotmini-spin 0.9s linear infinite',
        }}
      />
      <style
        // Standalone keyframes — duplicates Tailwind's animate-spin so we
        // don't depend on the CSS bundle being loaded yet.
        dangerouslySetInnerHTML={{
          __html: `@keyframes lotmini-spin { to { transform: rotate(360deg); } }`,
        }}
      />
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
