import Script from 'next/script'

export const metadata = {
  title: 'Polnation Lottery',
  description: 'Spin the wheel to win USDC and bonus rewards',
}

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
