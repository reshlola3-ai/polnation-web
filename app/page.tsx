import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase-server'
import { Navbar } from '@/components/layout/Navbar'
import { ArrowRight, Users, Wallet, Shield, TrendingUp, Sparkles } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { defaultLocale, locales, type Locale } from '@/i18n/config'

// 动态导入 3D 组件，禁用 SSR
const Logo3D = dynamic(() => import('@/components/ui/Logo3D').then(mod => mod.Logo3D), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[300px] md:h-[400px] flex items-center justify-center">
      <div className="w-24 h-24 rounded-full bg-purple-500/20 animate-pulse" />
    </div>
  )
})

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

          {/* Right: 3D Logo */}
          <div className="order-1 lg:order-2">
            <Logo3D />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-card-solid p-6 hover:border-purple-500/40 transition-all duration-300 group">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{t('features.network.title')}</h3>
            <p className="text-zinc-400 text-sm">
              {t('features.network.description')}
            </p>
          </div>

          <div className="glass-card-solid p-6 hover:border-purple-500/40 transition-all duration-300 group">
            <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-cyan-500/30 transition-colors">
              <Wallet className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{t('features.wallet.title')}</h3>
            <p className="text-zinc-400 text-sm">
              {t('features.wallet.description')}
            </p>
          </div>

          <div className="glass-card-solid p-6 hover:border-purple-500/40 transition-all duration-300 group">
            <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-pink-500/30 transition-colors">
              <Shield className="w-6 h-6 text-pink-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{t('features.staking.title')}</h3>
            <p className="text-zinc-400 text-sm">
              {t('features.staking.description')}
            </p>
          </div>

          <div className="glass-card-solid p-6 hover:border-purple-500/40 transition-all duration-300 group">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-500/30 transition-colors">
              <TrendingUp className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{t('features.rewards.title')}</h3>
            <p className="text-zinc-400 text-sm">
              {t('features.rewards.description')}
            </p>
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
