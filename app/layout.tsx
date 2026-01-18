import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { cookies } from 'next/headers'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { defaultLocale, locales, type Locale } from '@/i18n/config'
import "./globals.css";

// Space Grotesk - 主要字体，用于标题和正文
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// JetBrains Mono - 科技感数字和代码字体
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const siteUrl = "https://www.polnation.com";

export const metadata: Metadata = {
  // 基础 SEO
  title: {
    default: "Polnation - Crypto Soft Staking Platform | Earn USDC Rewards",
    template: "%s | Polnation",
  },
  description: "Polnation is a revolutionary crypto soft staking platform on Polygon. Earn daily USDC rewards without locking your tokens. Join our global community and grow your crypto portfolio with referral commissions.",
  keywords: [
    "Polnation",
    "crypto staking",
    "soft staking",
    "USDC rewards",
    "Polygon",
    "cryptocurrency",
    "passive income",
    "crypto earnings",
    "referral program",
    "DeFi",
    "Web3",
    "staking rewards",
    "crypto community",
  ],
  authors: [{ name: "Polnation Team" }],
  creator: "Polnation",
  publisher: "Polnation",
  
  // Canonical URL
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
    languages: {
      "en": "/",
      "fr": "/",
      "id": "/",
      "vi": "/",
    },
  },
  
  // Open Graph (Facebook, LinkedIn, etc.)
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Polnation",
    title: "Polnation - Crypto Soft Staking Platform | Earn USDC Rewards",
    description: "Earn daily USDC rewards through soft staking on Polygon. No token locking required. Join the Polnation community today!",
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Polnation - Crypto Soft Staking Platform",
      },
    ],
  },
  
  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: "Polnation - Crypto Soft Staking Platform",
    description: "Earn daily USDC rewards through soft staking on Polygon. No token locking required.",
    images: [`${siteUrl}/og-image.png`],
    creator: "@polnation",
  },
  
  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  
  // Verification (添加你的验证码)
  verification: {
    google: "", // 添加 Google Search Console 验证码
  },
  
  // 其他
  category: "cryptocurrency",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get locale from cookie
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('locale')?.value as Locale | undefined
  const locale = localeCookie && locales.includes(localeCookie) ? localeCookie : defaultLocale
  
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
