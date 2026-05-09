import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase-server'
import { Navbar } from '@/components/layout/Navbar'
import { LazyFeaturesSection } from '@/components/home/LazyFeaturesSection'
import { LazyChainStats } from '@/components/home/LazyChainStats'
import { ViewportVideo } from '@/components/home/ViewportVideo'
import { HeroCtaButtons } from '@/components/home/HeroCtaButtons'
import { Sparkles } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { defaultLocale, locales, type Locale } from '@/i18n/config'

// JSON-LD 结构化数据
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Polnation',
  alternateName: ['Polnation Staking', 'Polnation Crypto'],
  url: 'https://www.polnation.com',
  description: 'Polnation is an AI-driven agentic earning platform on Polygon. Our proprietary Merkle Tree quantitative model and intelligent arbitrage bots generate real on-chain yield distributed daily to USDC holders.',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://www.polnation.com/search?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Polnation',
    logo: {
      '@type': 'ImageObject',
      url: 'https://www.polnation.com/logo.svg',
    },
  },
  sameAs: [
    'https://twitter.com/polnation',
    'https://t.me/polnation',
  ],
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Polnation',
  url: 'https://www.polnation.com',
  logo: 'https://www.polnation.com/logo.svg',
  description: 'Non-custodial community dividend platform on Polygon blockchain',
  foundingDate: '2024',
  sameAs: [
    'https://twitter.com/polnation',
    'https://t.me/polnation',
  ],
}

const PARTNER_LOGOS = [
  { src: '/partners/trust wallet.webp', alt: 'Trust Wallet' },
  { src: '/partners/Binance.png', alt: 'Binance' },
  { src: '/partners/bitget.png', alt: 'Bitget' },
  { src: '/partners/safepal.svg', alt: 'SafePal' },
  { src: '/partners/polygon lab.webp', alt: 'Polygon Labs' },
  { src: '/partners/usdc.webp', alt: 'USDC' },
]

export default async function HomePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get locale
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('locale')?.value as Locale | undefined
  const locale = localeCookie && locales.includes(localeCookie) ? localeCookie : defaultLocale
  
  const t = await getTranslations('home')
  const tNav = await getTranslations('nav')
  const tFooter = await getTranslations('footer')

  return (
    <>
      {/* JSON-LD 结构化数据 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      
      <div className="min-h-screen bg-[#0D0B21] relative overflow-hidden">
        {/* Static Background Effects */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[360px] h-[360px] md:w-[600px] md:h-[600px] bg-purple-600/15 rounded-full blur-[80px] md:blur-[150px]" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-cyan-500/10 rounded-full blur-[64px] md:blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] md:w-[400px] md:h-[400px] bg-purple-500/10 rounded-full blur-[48px] md:blur-[100px] hidden sm:block" />
        </div>
      
      <div className="relative z-10">
        <Navbar user={user} locale={locale} />

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-20 pb-16 md:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: Text Content */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6 md:mb-8">
              <Sparkles className="w-4 h-4 text-purple-400 animate-sparkle-wiggle" />
              <span className="text-sm text-purple-300">{t('tagline')}</span>
            </div>
            
            <h1 className="brand-title text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight">
              <span className="brand-shimmer inline-block bg-[linear-gradient(110deg,#c084fc_0%,#ffffff_18%,#22d3ee_38%,#a855f7_58%,#ffffff_78%,#c084fc_100%)] bg-[length:200%_100%] bg-clip-text text-transparent">
                Polnation
              </span>
            </h1>
            <p className="mt-4 md:mt-6 text-base sm:text-lg md:text-xl text-zinc-400 max-w-xl mx-auto lg:mx-0">
              {t('subtitle')}
            </p>
            <p className="mt-3 text-xs sm:text-sm text-zinc-500 max-w-xl mx-auto lg:mx-0">
              {t('promoNote')}
            </p>
            <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <HeroCtaButtons
                isLoggedIn={Boolean(user)}
                goToDashboardLabel={t('goToDashboard')}
                getStartedLabel={tNav('getStarted')}
                signInLabel={tNav('signIn')}
              />
            </div>
          </div>

          {/* Right: Crystal Image with animations */}
          <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
            <div className="relative w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] md:w-[400px] md:h-[400px]">
              {/* Glow effect behind image */}
              <div className="absolute inset-0 bg-purple-500/30 rounded-full blur-[60px] animate-pulse" />
              
              {/* Main image with float animation */}
              <div className="relative animate-float">
                <Image
                  src="/hero-crystal.webp"
                  alt="Polnation Crystal"
                  width={400}
                  height={400}
                  className="w-full h-full object-contain drop-shadow-2xl"
                  priority
                />
              </div>
              
              {/* Sparkle effects */}
              <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-white rounded-full animate-ping opacity-75" />
              <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-purple-300 rounded-full animate-ping opacity-60 animation-delay-500" />
              <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-cyan-300 rounded-full animate-ping opacity-50 animation-delay-1000" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <Suspense
        fallback={
          <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-44 rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          </section>
        }
      >
        <LazyFeaturesSection
          translations={{
            safe: {
              title: t('features.safe.title'),
              description: t('features.safe.description'),
            },
            stable: {
              title: t('features.stable.title'),
              description: t('features.stable.description'),
            },
            easy: {
              title: t('features.easy.title'),
              description: t('features.easy.description'),
            },
            verified: {
              title: t('features.verified.title'),
              description: t('features.verified.description'),
            },
          }}
        />
      </Suspense>

      {/* Polygon Validator Video Section */}
      <section className="relative z-10 py-16 md:py-24 [content-visibility:auto] [contain-intrinsic-size:1px_700px]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-8 md:mb-12">
            Proprietary Merkle Tree Earning Engine
            <span className="block text-lg sm:text-xl md:text-2xl font-normal text-zinc-400 mt-2">
              Quant-driven arbitrage strategies generating real yield, distributed on-chain
            </span>
          </h2>
          
          {/* Video Container */}
          <div className="relative mx-auto max-w-2xl">
            <div className="absolute inset-0 bg-purple-500/20 rounded-2xl blur-[40px]" />
            <ViewportVideo
              src="/video/home-polygon.webm"
              poster="/hero-crystal.webp"
              preload="none"
              className="relative w-full rounded-2xl border border-purple-500/20 shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Partners Section */}
      <section className="relative z-10 py-16 overflow-hidden [content-visibility:auto] [contain-intrinsic-size:1px_420px]">
        <div className="text-center mb-10">
          <p className="text-sm uppercase tracking-widest text-zinc-500">Supported By</p>
        </div>
        
        {/* Marquee Container */}
        <div className="relative group">
          {/* Gradient masks for fade effect */}
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#0D0B21] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#0D0B21] to-transparent z-10 pointer-events-none" />
          
          {/* Scrolling track - pauses on hover/touch */}
          <div className="flex animate-marquee group-hover:[animation-play-state:paused] group-active:[animation-play-state:paused]">
            {/* First set of logos */}
            {PARTNER_LOGOS.map((partner, i) => (
              <div
                key={`first-${i}`}
                className="flex-shrink-0 mx-8 md:mx-12"
              >
                <Image
                  src={partner.src}
                  alt={partner.alt}
                  width={140}
                  height={56}
                  sizes="(max-width: 768px) 96px, 140px"
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  className="h-12 md:h-14 w-auto object-contain"
                />
              </div>
            ))}
            {/* Duplicate for seamless loop */}
            {PARTNER_LOGOS.map((partner, i) => (
              <div
                key={`second-${i}`}
                className="flex-shrink-0 mx-8 md:mx-12"
              >
                <Image
                  src={partner.src}
                  alt={partner.alt}
                  width={140}
                  height={56}
                  sizes="(max-width: 768px) 96px, 140px"
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  className="h-12 md:h-14 w-auto object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* On-Chain Vault Video Section */}
      <section className="relative z-10 py-16 md:py-24 [content-visibility:auto] [contain-intrinsic-size:1px_700px]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-8 md:mb-12">
            Agentic Vault — Fully On-Chain & Verifiable
            <span className="block text-lg sm:text-xl md:text-2xl font-normal text-zinc-400 mt-2">
              Merkle Tree distribution, balance-tier rewards, 100% transparent on Polygon
            </span>
          </h2>
          
          {/* Video Container */}
          <div className="relative mx-auto max-w-2xl">
            <div className="absolute inset-0 bg-cyan-500/20 rounded-2xl blur-[40px]" />
            <ViewportVideo
              src="/video/home loop.webm"
              poster="/hero-crystal.webp"
              preload="none"
              className="relative w-full rounded-2xl border border-cyan-500/20 shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Stats Section - Live Chain Data */}
      <Suspense fallback={<div className="h-32 rounded-2xl bg-white/5 animate-pulse mx-4 sm:mx-6 lg:mx-8" />}>
        <LazyChainStats />
      </Suspense>

      {/* Footer */}
      <footer className="relative border-t border-purple-500/20 bg-[#0D0B21]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/logo.svg"
                alt="Polnation"
                width={36}
                height={36}
                className="rounded-xl glow-purple-sm"
              />
              <span className="font-display text-xl text-white">Polnation</span>
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-sm text-zinc-500 hover:text-purple-400 transition-colors">
                {tFooter('privacy')}
              </Link>
              <Link href="/terms" className="text-sm text-zinc-500 hover:text-purple-400 transition-colors">
                {tFooter('terms')}
              </Link>
              <Link href="/disclaimer" className="text-sm text-zinc-500 hover:text-purple-400 transition-colors">
                Disclaimer
              </Link>
              <a
                href="mailto:Support@polnation.com"
                className="text-sm text-zinc-500 hover:text-purple-400 transition-colors"
              >
                Support@polnation.com
              </a>
            </div>
            <p className="text-sm text-zinc-500">
              {tFooter('rights')}
            </p>
          </div>
        </div>
      </footer>
      </div>
    </div>
    </>
  )
}
