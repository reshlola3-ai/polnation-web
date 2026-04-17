import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import Image from 'next/image'
import { Navbar } from '@/components/layout/Navbar'
import { BottomNav } from '@/components/layout/BottomNav'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { Web3Provider } from '@/components/providers/Web3Provider'
import { UnsupportedWalletOverlay } from '@/components/layout/UnsupportedWalletOverlay'
import { defaultLocale, locales, type Locale } from '@/i18n/config'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('wallet_address')
    .eq('id', user.id)
    .single()
  const walletAddress: string | null = profile?.wallet_address ?? null

  // Get locale from cookie
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('locale')?.value as Locale | undefined
  const locale = localeCookie && locales.includes(localeCookie) ? localeCookie : defaultLocale

  return (
    <Web3Provider>
      <div className="min-h-screen bg-[#0D0B21] relative">
        {/* Unsupported Wallet Overlay */}
        <UnsupportedWalletOverlay />

        {/* Subtle ambient background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[140px]" />
          <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[130px]" />
          <div className="absolute -bottom-40 right-1/4 w-[550px] h-[550px] bg-cyan-600/12 rounded-full blur-[140px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-violet-600/15 rounded-full blur-[110px]" />
        </div>
        
        {/* Desktop Navigation */}
        <div className="hidden md:block relative z-20">
          <Navbar user={user} locale={locale} />
        </div>

        {/* Mobile Header — logo + language only; navigation is in BottomNav */}
        <div className="md:hidden sticky top-0 z-20 bg-[#0D0B21] border-b border-white/[0.05]">
          <div className="flex items-center justify-between h-12 px-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image src="/logo.svg" alt="Polnation" width={26} height={26} className="rounded-lg" />
              <span className="font-display text-base text-white">Polnation</span>
            </Link>
            <div className="flex items-center gap-2">
              {walletAddress && (
                <span className="text-xs font-mono text-zinc-400 bg-white/5 border border-white/10 px-2 py-1 rounded-lg">
                  {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
                </span>
              )}
              <LanguageSwitcher currentLocale={locale} />
            </div>
          </div>
        </div>
        
        {/* Main Content - Add bottom padding for mobile nav */}
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 pb-24 md:pb-6">
          {children}
        </main>
        
        {/* Bottom Navigation - Mobile only */}
        <BottomNav />
      </div>
    </Web3Provider>
  )
}
