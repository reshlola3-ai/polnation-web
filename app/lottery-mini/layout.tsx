import Script from 'next/script'

export const metadata = {
  title: 'Polnation Lottery',
  description: 'Spin the wheel to win USDC and bonus rewards',
}

/**
 * Minimal layout for the Telegram Mini App surface. Lives at the top level
 * (not inside (dashboard) group) so it does NOT inherit Navbar / BottomNav /
 * Web3Provider — TG provides its own header and we authenticate via initData
 * instead of wallet.
 *
 * Phase 1 reminder: this route is the target of t.me/PolnationBot/lottery
 * inline button rendered by /api/telegram/webhook on /start.
 */
export default function LotteryMiniLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <div className="min-h-screen bg-[#07060d] text-white">{children}</div>
    </>
  )
}
