import Script from 'next/script'

export const metadata = {
  title: 'Polnation Lottery',
  description: 'Spin the wheel to win USDC and bonus rewards',
}

// Server-rendered boot skeleton. Visible the moment the HTML arrives, so
// users in slow networks or with cold JS bundles still see a logo + spinner
// instead of a blank screen. Plain inline styles (no Tailwind) so it paints
// even before the CSS bundle finishes loading. Once the client React tree
// hydrates and the page component renders its own loading UI, this skeleton
// is naturally overlaid by the same-position children.
function BootSkeleton() {
  return (
    <div
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
      {/* Telegram client injects window.Telegram.WebApp before our scripts run,
          so this external file is a fallback for non-mini-app testing. Loaded
          lazily so it never blocks first paint or hydration. */}
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="lazyOnload"
      />
      <div className="min-h-screen bg-[#07060d] text-white relative">
        <BootSkeleton />
        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      </div>
    </>
  )
}
