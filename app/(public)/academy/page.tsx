import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { defaultLocale, locales, type Locale } from '@/i18n/config'
import { Navbar } from '@/components/layout/Navbar'
import { createServerClient } from '@/lib/supabase-server'
import Image from 'next/image'
import Link from 'next/link'
import { 
  ArrowLeft,
  Wallet, 
  Coins, 
  PenTool, 
  TrendingUp,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Play,
  ChevronDown,
  Shield,
  Zap,
  Gift,
  Users
} from 'lucide-react'

export const metadata = {
  title: 'Academy - Learn How to Earn | Polnation',
  description: 'Complete guide to start earning passive income with Polnation. Step-by-step tutorial for crypto beginners.',
}

export default async function AcademyPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('locale')?.value as Locale | undefined
  const locale = localeCookie && locales.includes(localeCookie) ? localeCookie : defaultLocale

  const t = await getTranslations('academy')
  const tNav = await getTranslations('nav')

  return (
    <div className="min-h-screen bg-[#0D0B21] relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10">
        <Navbar user={user} locale={locale} />

        {/* Hero Section */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12">
          {/* Breadcrumb */}
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('backToHome')}
          </Link>

          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              {t('title')}
            </h1>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              {t('subtitle')}
            </p>
          </div>

          {/* Video Tutorial Section */}
          <div className="relative mb-16">
            <div className="absolute inset-0 bg-cyan-500/20 rounded-2xl blur-[40px]" />
            <div className="relative bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <Play className="w-6 h-6 text-cyan-400" />
                {t('videoTutorial')}
              </h2>
              
              {/* Video Embed Placeholder */}
              <div className="aspect-video rounded-xl overflow-hidden bg-zinc-800/50 border border-zinc-700">
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500">
                  <Play className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg">{t('videoComingSoon')}</p>
                  <p className="text-sm opacity-50 mt-2">{t('videoComingSoonDesc')}</p>
                  
                  {/* Uncomment when you have a YouTube video:
                  <iframe
                    src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  */}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Step by Step Guide */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          {/* Step 1: Download Wallet */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-sm text-cyan-400 font-medium">{t('step')} 1</div>
                <h2 className="text-2xl font-bold text-white">{t('steps.wallet.title')}</h2>
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <p className="text-zinc-300 mb-6">{t('steps.wallet.intro')}</p>

              {/* Wallet Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Trust Wallet */}
                <div className="bg-zinc-800/50 rounded-xl p-5 border border-zinc-700 hover:border-blue-500/50 transition-colors">
                  <div className="flex items-center gap-4 mb-4">
                    <Image
                      src="/partners/trust wallet.png"
                      alt="Trust Wallet"
                      width={48}
                      height={48}
                      className="rounded-xl"
                    />
                    <div>
                      <h3 className="text-lg font-bold text-white">Trust Wallet</h3>
                      <p className="text-sm text-zinc-400">{t('steps.wallet.recommended')}</p>
                    </div>
                  </div>
                  <a
                    href="https://trustwallet.com/download"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" />
                    {t('steps.wallet.download')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Bitget Wallet */}
                <div className="bg-zinc-800/50 rounded-xl p-5 border border-zinc-700 hover:border-cyan-500/50 transition-colors">
                  <div className="flex items-center gap-4 mb-4">
                    <Image
                      src="/partners/bitget.png"
                      alt="Bitget Wallet"
                      width={48}
                      height={48}
                      className="rounded-xl"
                    />
                    <div>
                      <h3 className="text-lg font-bold text-white">Bitget Wallet</h3>
                      <p className="text-sm text-zinc-400">{t('steps.wallet.alternative')}</p>
                    </div>
                  </div>
                  <a
                    href="https://web3.bitget.com/wallet-download"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" />
                    {t('steps.wallet.download')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Setup Instructions */}
              <div className="bg-zinc-800/30 rounded-xl p-5 border border-zinc-700">
                <h4 className="text-lg font-semibold text-white mb-4">{t('steps.wallet.setupTitle')}</h4>
                <div className="space-y-3">
                  {(t.raw('steps.wallet.setupSteps') as string[]).map((step: string, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-cyan-400">{i + 1}</span>
                      </div>
                      <span className="text-zinc-300">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning */}
              <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-200/80">{t('steps.wallet.warning')}</p>
              </div>
            </div>
          </div>

          {/* Step 2: Get USDC */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/25">
                <Coins className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-sm text-green-400 font-medium">{t('step')} 2</div>
                <h2 className="text-2xl font-bold text-white">{t('steps.deposit.title')}</h2>
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <p className="text-zinc-300 mb-6">{t('steps.deposit.intro')}</p>

              {/* Methods */}
              <div className="space-y-4 mb-6">
                {/* Method 1: Exchange */}
                <div className="bg-zinc-800/50 rounded-xl p-5 border border-zinc-700">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-bold text-green-400">A</span>
                    {t('steps.deposit.methodExchange')}
                  </h4>
                  <div className="space-y-2">
                    {(t.raw('steps.deposit.exchangeSteps') as string[]).map((step: string, i: number) => (
                      <div key={i} className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-1" />
                        <span className="text-zinc-300 text-sm">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Method 2: Swap in Wallet */}
                <div className="bg-zinc-800/50 rounded-xl p-5 border border-zinc-700">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-bold text-green-400">B</span>
                    {t('steps.deposit.methodSwap')}
                  </h4>
                  <div className="space-y-2">
                    {(t.raw('steps.deposit.swapSteps') as string[]).map((step: string, i: number) => (
                      <div key={i} className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-1" />
                        <span className="text-zinc-300 text-sm">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Important Note */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-emerald-200 font-medium">{t('steps.deposit.networkNote')}</p>
                  <p className="text-xs text-emerald-200/60 mt-1">{t('steps.deposit.networkNoteDesc')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Sign Indexer */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
                <PenTool className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-sm text-purple-400 font-medium">{t('step')} 3</div>
                <h2 className="text-2xl font-bold text-white">{t('steps.sign.title')}</h2>
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <p className="text-zinc-300 mb-6">{t('steps.sign.intro')}</p>

              {/* Steps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {(t.raw('steps.sign.signSteps') as string[]).map((step: string, i: number) => (
                  <div key={i} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700 text-center">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                      <span className="text-lg font-bold text-purple-400">{i + 1}</span>
                    </div>
                    <p className="text-zinc-300 text-sm">{step}</p>
                  </div>
                ))}
              </div>

              {/* What is Indexer Signing */}
              <div className="bg-zinc-800/30 rounded-xl p-5 border border-zinc-700">
                <h4 className="text-lg font-semibold text-white mb-3">{t('steps.sign.whatIsTitle')}</h4>
                <div className="space-y-3">
                  {(t.raw('steps.sign.whatIsPoints') as string[]).map((point: string, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <Zap className="w-4 h-4 text-purple-400 flex-shrink-0 mt-1" />
                      <span className="text-zinc-300 text-sm">{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Step 4: Start Earning */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-sm text-orange-400 font-medium">{t('step')} 4</div>
                <h2 className="text-2xl font-bold text-white">{t('steps.earn.title')}</h2>
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <p className="text-zinc-300 mb-6">{t('steps.earn.intro')}</p>

              {/* Earning Features */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {(t.raw('steps.earn.features') as Array<{ title: string; desc: string }>).map((feature, i) => (
                  <div key={i} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
                    <h4 className="font-semibold text-white mb-1">{feature.title}</h4>
                    <p className="text-zinc-400 text-sm">{feature.desc}</p>
                  </div>
                ))}
              </div>

              {/* Earning Tiers Preview */}
              <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-xl p-5 border border-orange-500/20">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Gift className="w-5 h-5 text-orange-400" />
                  {t('steps.earn.tiersTitle')}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-3 rounded-lg bg-zinc-800/50">
                    <div className="text-xs text-zinc-400">$10 - $99</div>
                    <div className="text-lg font-bold text-orange-400">0.9%</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-zinc-800/50">
                    <div className="text-xs text-zinc-400">$100 - $499</div>
                    <div className="text-lg font-bold text-orange-400">1.0%</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-zinc-800/50">
                    <div className="text-xs text-zinc-400">$500 - $999</div>
                    <div className="text-lg font-bold text-yellow-400">1.1%</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-zinc-800/50">
                    <div className="text-xs text-zinc-400">$1000+</div>
                    <div className="text-lg font-bold text-yellow-300">1.2%+</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bonus: Team Building */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/25">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-sm text-pink-400 font-medium">{t('bonus')}</div>
                <h2 className="text-2xl font-bold text-white">{t('steps.team.title')}</h2>
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <p className="text-zinc-300 mb-6">{t('steps.team.intro')}</p>

              {/* Team Benefits */}
              <div className="space-y-3">
                {(t.raw('steps.team.benefits') as string[]).map((benefit: string, i: number) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-pink-400 flex-shrink-0 mt-0.5" />
                    <span className="text-zinc-300">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center py-12">
            <h3 className="text-2xl font-bold text-white mb-4">{t('readyToStart')}</h3>
            <p className="text-zinc-400 mb-8">{t('readyToStartDesc')}</p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-medium text-lg hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/25"
            >
              {t('getStartedNow')}
              <ChevronDown className="w-5 h-5 rotate-[-90deg]" />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-zinc-800 py-8">
          <div className="max-w-5xl mx-auto px-4 text-center text-zinc-500 text-sm">
            © 2026 Polnation. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  )
}
