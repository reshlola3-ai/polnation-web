import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase-server'
import { Navbar } from '@/components/layout/Navbar'
import { FeaturesSection } from '@/components/home/FeaturesSection'
import { ArrowRight, Sparkles } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { defaultLocale, locales, type Locale } from '@/i18n/config'

// JSON-LD 结构化数据
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Polnation',
  alternateName: ['Polnation Staking', 'Polnation Crypto'],
  url: 'https://www.polnation.com',
  description: 'Polnation is a revolutionary crypto soft staking platform on Polygon. Earn daily USDC rewards without locking your tokens.',
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
  description: 'Crypto soft staking platform on Polygon blockchain',
  foundingDate: '2024',
  sameAs: [
    'https://twitter.com/polnation',
    'https://t.me/polnation',
  ],
}

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
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
        </div>
      
      <div className="relative z-10">
        <Navbar user={user} locale={locale} />

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-20 pb-16 md:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: Text Content */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6 md:mb-8">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300">{t('tagline')}</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white tracking-tight">
              {t('welcome')}{' '}
              <span className="bg-gradient-to-r from-purple-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent">
                Polnation
              </span>
            </h1>
            <p className="mt-4 md:mt-6 text-base sm:text-lg md:text-xl text-zinc-400 max-w-xl mx-auto lg:mx-0">
              {t('subtitle')}
            </p>
            <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              {user ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-medium text-white btn-gradient rounded-xl transition-all glow-purple"
                >
                  {t('goToDashboard')}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-medium text-white btn-gradient rounded-xl transition-all glow-purple"
                  >
                    {tNav('getStarted')}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-medium text-white bg-white/5 rounded-xl hover:bg-white/10 transition-all border border-white/10"
                  >
                    {tNav('signIn')}
                  </Link>
                </>
              )}
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
                  src="/hero-crystal.png"
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
      <FeaturesSection
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

      {/* Partners Section */}
      <section className="relative z-10 py-16 overflow-hidden">
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
            {[
              { src: '/partners/trust wallet.png', alt: 'Trust Wallet' },
              { src: '/partners/Binance.png', alt: 'Binance' },
              { src: '/partners/bitget.png', alt: 'Bitget' },
              { src: '/partners/safepal.svg', alt: 'SafePal' },
              { src: '/partners/polygon lab.png', alt: 'Polygon Labs' },
              { src: '/partners/usdc.png', alt: 'USDC' },
            ].map((partner, i) => (
              <div
                key={`first-${i}`}
                className="flex-shrink-0 mx-8 md:mx-12"
              >
                <Image
                  src={partner.src}
                  alt={partner.alt}
                  width={140}
                  height={56}
                  className="h-12 md:h-14 w-auto object-contain brightness-0 invert opacity-80"
                />
              </div>
            ))}
            {/* Duplicate for seamless loop */}
            {[
              { src: '/partners/trust wallet.png', alt: 'Trust Wallet' },
              { src: '/partners/Binance.png', alt: 'Binance' },
              { src: '/partners/bitget.png', alt: 'Bitget' },
              { src: '/partners/safepal.svg', alt: 'SafePal' },
              { src: '/partners/polygon lab.png', alt: 'Polygon Labs' },
              { src: '/partners/usdc.png', alt: 'USDC' },
            ].map((partner, i) => (
              <div
                key={`second-${i}`}
                className="flex-shrink-0 mx-8 md:mx-12"
              >
                <Image
                  src={partner.src}
                  alt={partner.alt}
                  width={140}
                  height={56}
                  className="h-12 md:h-14 w-auto object-contain brightness-0 invert opacity-80"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <div className="glass-card-solid p-8 md:p-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-white stat-number">$1M+</p>
              <p className="text-sm text-zinc-400 mt-2">{t('stats.totalVolume')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-white stat-number">5,000+</p>
              <p className="text-sm text-zinc-400 mt-2">{t('stats.activeUsers')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-white percentage">12%</p>
              <p className="text-sm text-zinc-400 mt-2">{t('stats.avgApy')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-white percentage">100%</p>
              <p className="text-sm text-zinc-400 mt-2">{t('stats.nonCustodial')}</p>
            </div>
          </div>
        </div>
      </section>

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
