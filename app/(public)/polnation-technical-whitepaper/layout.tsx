import type { ReactNode } from 'react'
import { Source_Serif_4 } from 'next/font/google'

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

export default function PolnationTechnicalWhitepaperLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <div
      className={`${sourceSerif.variable} min-h-screen bg-white text-zinc-900 antialiased`}
      style={{ fontFamily: 'var(--poly-font-sans)' }}
    >
      {children}
    </div>
  )
}
