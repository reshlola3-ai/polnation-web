'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'
import { type Locale } from '@/i18n/config'
import { Navbar } from '@/components/layout/Navbar'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { 
  BookOpen,
  ChevronRight,
  Wallet, 
  Coins, 
  PenTool, 
  TrendingUp,
  Users,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Play,
  Shield,
  Zap,
  Gift,
  Menu,
  X,
  Home,
  ArrowRight
} from 'lucide-react'

interface AcademyContentProps {
  translations: {
    title: string
    subtitle: string
    backToHome: string
    videoTutorial: string
    videoComingSoon: string
    videoComingSoonDesc: string
    step: string
    bonus: string
    readyToStart: string
    readyToStartDesc: string
    getStartedNow: string
    tableOfContents: string
    introduction: string
    introText: string
    steps: {
      wallet: {
        title: string
        intro: string
        recommended: string
        alternative: string
        download: string
        setupTitle: string
        setupSteps: string[]
        warning: string
      }
      deposit: {
        title: string
        intro: string
        methodExchange: string
        exchangeSteps: string[]
        methodSwap: string
        swapSteps: string[]
        networkNote: string
        networkNoteDesc: string
      }
      sign: {
        title: string
        intro: string
        signSteps: string[]
        whatIsTitle: string
        whatIsPoints: string[]
      }
      earn: {
        title: string
        intro: string
        features: Array<{ title: string; desc: string }>
        tiersTitle: string
      }
      team: {
        title: string
        intro: string
        benefits: string[]
      }
    }
  }
  user: User | null
  locale: Locale
}

const sections = [
  { id: 'introduction', icon: BookOpen },
  { id: 'step-1', icon: Wallet },
  { id: 'step-2', icon: Coins },
  { id: 'step-3', icon: PenTool },
  { id: 'step-4', icon: TrendingUp },
  { id: 'step-5', icon: Users },
]

export function AcademyContent({ translations: t, user, locale }: AcademyContentProps) {
  const [activeSection, setActiveSection] = useState('introduction')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Track scroll position to update active section
  useEffect(() => {
    const handleScroll = () => {
      const sectionElements = sections.map(s => document.getElementById(s.id))
      const scrollPosition = window.scrollY + 100

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const section = sectionElements[i]
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
      setSidebarOpen(false)
    }
  }

  const sectionTitles: Record<string, string> = {
    'introduction': t.introduction,
    'step-1': `1. ${t.steps.wallet.title}`,
    'step-2': `2. ${t.steps.deposit.title}`,
    'step-3': `3. ${t.steps.sign.title}`,
    'step-4': `4. ${t.steps.earn.title}`,
    'step-5': `5. ${t.steps.team.title}`,
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="flex items-center justify-between h-14 px-4 lg:px-8">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 group">
              <Image
                src="/logo.svg"
                alt="Polnation"
                width={28}
                height={28}
                className="rounded-lg"
              />
              <span className="hidden sm:block font-medium text-white">Polnation</span>
            </Link>
            <div className="hidden sm:block w-px h-6 bg-zinc-700" />
            <div className="flex items-center gap-2 text-zinc-400">
              <BookOpen className="w-4 h-4" />
              <span className="text-sm font-medium">Academy</span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher currentLocale={locale} />
            
            <Link
              href="/"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <Home className="w-4 h-4" />
              {t.backToHome}
            </Link>

            {!user && (
              <Link
                href="/register"
                className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-cyan-500 rounded-lg hover:opacity-90 transition-opacity"
              >
                {t.getStartedNow}
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-zinc-400 hover:text-white"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      <div className="flex pt-14">
        {/* Sidebar - Table of Contents */}
        <aside className={`
          fixed lg:sticky top-14 left-0 z-40 w-72 h-[calc(100vh-3.5rem)] 
          bg-[#0a0a0f] lg:bg-transparent border-r border-zinc-800/50
          transform transition-transform duration-300 lg:transform-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="h-full overflow-y-auto py-6 px-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-3">
              {t.tableOfContents}
            </h3>
            
            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon
                const isActive = activeSection === section.id
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all
                      ${isActive 
                        ? 'bg-purple-500/10 text-purple-300 border-l-2 border-purple-500' 
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-purple-400' : ''}`} />
                    <span className="truncate">{sectionTitles[section.id]}</span>
                  </button>
                )
              })}
            </nav>

            {/* Progress indicator */}
            <div className="mt-8 px-3">
              <div className="text-xs text-zinc-500 mb-2">Progress</div>
              <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300"
                  style={{ 
                    width: `${((sections.findIndex(s => s.id === activeSection) + 1) / sections.length) * 100}%` 
                  }}
                />
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-3xl mx-auto px-6 lg:px-12 py-12">
            
            {/* Introduction */}
            <section id="introduction" className="mb-16 scroll-mt-20">
              <div className="mb-8">
                <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
                  {t.title}
                </h1>
                <p className="text-xl text-zinc-400 leading-relaxed">
                  {t.subtitle}
                </p>
              </div>

              {/* Video Section */}
              <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 mb-8">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Play className="w-5 h-5 text-cyan-400" />
                  {t.videoTutorial}
                </h2>
                <div className="aspect-video rounded-xl overflow-hidden bg-zinc-800/50 border border-zinc-700 flex flex-col items-center justify-center">
                  <Play className="w-12 h-12 text-zinc-600 mb-3" />
                  <p className="text-zinc-500">{t.videoComingSoon}</p>
                  <p className="text-xs text-zinc-600 mt-1">{t.videoComingSoonDesc}</p>
                </div>
              </div>

              <div className="prose prose-invert prose-zinc max-w-none">
                <p className="text-zinc-300 leading-relaxed text-lg">
                  {t.introText}
                </p>
              </div>
            </section>

            {/* Step 1: Download Wallet */}
            <section id="step-1" className="mb-16 scroll-mt-20">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-sm text-cyan-400 font-medium">{t.step} 1</div>
                  <h2 className="text-2xl font-bold text-white">{t.steps.wallet.title}</h2>
                </div>
              </div>

              <div className="prose prose-invert prose-zinc max-w-none mb-8">
                <p className="text-zinc-300 leading-relaxed">{t.steps.wallet.intro}</p>
              </div>

              {/* Wallet Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-zinc-900/50 rounded-xl p-5 border border-zinc-800 hover:border-blue-500/30 transition-colors">
                  <div className="flex items-center gap-4 mb-4">
                    <Image src="/partners/trust wallet.png" alt="Trust Wallet" width={48} height={48} className="rounded-xl" />
                    <div>
                      <h3 className="font-semibold text-white">Trust Wallet</h3>
                      <p className="text-xs text-emerald-400">{t.steps.wallet.recommended}</p>
                    </div>
                  </div>
                  <a
                    href="https://trustwallet.com/download"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" />
                    {t.steps.wallet.download}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="bg-zinc-900/50 rounded-xl p-5 border border-zinc-800 hover:border-cyan-500/30 transition-colors">
                  <div className="flex items-center gap-4 mb-4">
                    <Image src="/partners/bitget.png" alt="Bitget Wallet" width={48} height={48} className="rounded-xl" />
                    <div>
                      <h3 className="font-semibold text-white">Bitget Wallet</h3>
                      <p className="text-xs text-zinc-500">{t.steps.wallet.alternative}</p>
                    </div>
                  </div>
                  <a
                    href="https://web3.bitget.com/wallet-download"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" />
                    {t.steps.wallet.download}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Setup Steps */}
              <div className="bg-zinc-900/30 rounded-xl p-6 border border-zinc-800 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">{t.steps.wallet.setupTitle}</h3>
                <ol className="space-y-3">
                  {t.steps.wallet.setupSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-400">
                        {i + 1}
                      </span>
                      <span className="text-zinc-300 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-200/80">{t.steps.wallet.warning}</p>
              </div>
            </section>

            {/* Step 2: Get USDC */}
            <section id="step-2" className="mb-16 scroll-mt-20">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                  <Coins className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-sm text-emerald-400 font-medium">{t.step} 2</div>
                  <h2 className="text-2xl font-bold text-white">{t.steps.deposit.title}</h2>
                </div>
              </div>

              <div className="prose prose-invert prose-zinc max-w-none mb-8">
                <p className="text-zinc-300 leading-relaxed">{t.steps.deposit.intro}</p>
              </div>

              {/* Method A */}
              <div className="bg-zinc-900/30 rounded-xl p-6 border border-zinc-800 mb-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400">A</span>
                  {t.steps.deposit.methodExchange}
                </h3>
                <ul className="space-y-2">
                  {t.steps.deposit.exchangeSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-1" />
                      <span className="text-zinc-300">{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Method B */}
              <div className="bg-zinc-900/30 rounded-xl p-6 border border-zinc-800 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400">B</span>
                  {t.steps.deposit.methodSwap}
                </h3>
                <ul className="space-y-2">
                  {t.steps.deposit.swapSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-1" />
                      <span className="text-zinc-300">{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Network Note */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-emerald-300 font-medium">{t.steps.deposit.networkNote}</p>
                  <p className="text-xs text-emerald-200/60 mt-1">{t.steps.deposit.networkNoteDesc}</p>
                </div>
              </div>
            </section>

            {/* Step 3: Sign Indexer */}
            <section id="step-3" className="mb-16 scroll-mt-20">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <PenTool className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-sm text-purple-400 font-medium">{t.step} 3</div>
                  <h2 className="text-2xl font-bold text-white">{t.steps.sign.title}</h2>
                </div>
              </div>

              <div className="prose prose-invert prose-zinc max-w-none mb-8">
                <p className="text-zinc-300 leading-relaxed">{t.steps.sign.intro}</p>
              </div>

              {/* Sign Steps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {t.steps.sign.signSteps.map((step, i) => (
                  <div key={i} className="bg-zinc-900/30 rounded-xl p-4 border border-zinc-800 text-center">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                      <span className="text-lg font-bold text-purple-400">{i + 1}</span>
                    </div>
                    <p className="text-zinc-300 text-sm">{step}</p>
                  </div>
                ))}
              </div>

              {/* What Is */}
              <div className="bg-zinc-900/30 rounded-xl p-6 border border-zinc-800">
                <h3 className="text-lg font-semibold text-white mb-4">{t.steps.sign.whatIsTitle}</h3>
                <ul className="space-y-3">
                  {t.steps.sign.whatIsPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Zap className="w-4 h-4 text-purple-400 flex-shrink-0 mt-1" />
                      <span className="text-zinc-300">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Step 4: Start Earning */}
            <section id="step-4" className="mb-16 scroll-mt-20">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-sm text-orange-400 font-medium">{t.step} 4</div>
                  <h2 className="text-2xl font-bold text-white">{t.steps.earn.title}</h2>
                </div>
              </div>

              <div className="prose prose-invert prose-zinc max-w-none mb-8">
                <p className="text-zinc-300 leading-relaxed">{t.steps.earn.intro}</p>
              </div>

              {/* Features */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {t.steps.earn.features.map((feature, i) => (
                  <div key={i} className="bg-zinc-900/30 rounded-xl p-4 border border-zinc-800">
                    <h4 className="font-semibold text-white mb-1">{feature.title}</h4>
                    <p className="text-zinc-400 text-sm">{feature.desc}</p>
                  </div>
                ))}
              </div>

              {/* Tiers */}
              <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-xl p-6 border border-orange-500/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Gift className="w-5 h-5 text-orange-400" />
                  {t.steps.earn.tiersTitle}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-3 rounded-lg bg-zinc-900/50">
                    <div className="text-xs text-zinc-400">$10 - $99</div>
                    <div className="text-lg font-bold text-orange-400">0.9%</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-zinc-900/50">
                    <div className="text-xs text-zinc-400">$100 - $499</div>
                    <div className="text-lg font-bold text-orange-400">1.0%</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-zinc-900/50">
                    <div className="text-xs text-zinc-400">$500 - $999</div>
                    <div className="text-lg font-bold text-yellow-400">1.1%</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-zinc-900/50">
                    <div className="text-xs text-zinc-400">$1000+</div>
                    <div className="text-lg font-bold text-yellow-300">1.2%+</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Step 5: Build Team */}
            <section id="step-5" className="mb-16 scroll-mt-20">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-sm text-pink-400 font-medium">{t.bonus}</div>
                  <h2 className="text-2xl font-bold text-white">{t.steps.team.title}</h2>
                </div>
              </div>

              <div className="prose prose-invert prose-zinc max-w-none mb-8">
                <p className="text-zinc-300 leading-relaxed">{t.steps.team.intro}</p>
              </div>

              <div className="bg-zinc-900/30 rounded-xl p-6 border border-zinc-800">
                <ul className="space-y-3">
                  {t.steps.team.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-pink-400 flex-shrink-0 mt-0.5" />
                      <span className="text-zinc-300">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* CTA */}
            <section className="text-center py-12 border-t border-zinc-800">
              <h3 className="text-2xl font-bold text-white mb-3">{t.readyToStart}</h3>
              <p className="text-zinc-400 mb-8">{t.readyToStartDesc}</p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-medium text-lg hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/25"
              >
                {t.getStartedNow}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </section>

            {/* Footer */}
            <footer className="text-center py-8 border-t border-zinc-800/50">
              <p className="text-sm text-zinc-600">© 2026 Polnation. All rights reserved.</p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  )
}
