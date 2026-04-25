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
      <div className="min-h-screen kraken-dashboard-surface relative overflow-x-hidden">
        {/* Unsupported Wallet Overlay */}
        <UnsupportedWalletOverlay />

        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 kraken-dashboard-bg" />
        
        {/* Desktop Navigation */}
        <div className="hidden md:block relative z-20">
          <Navbar user={user} locale={locale} />
        </div>

        {/* Mobile Header — logo + language only; navigation is in BottomNav */}
        <div className="md:hidden sticky top-0 z-20 bg-[var(--kraken-panel)] border-b border-[var(--kraken-border)]">
          <div className="flex items-center justify-between h-12 px-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image src="/logo.svg" alt="Polnation" width={26} height={26} />
              <span className="poly-heading text-base">Polnation</span>
            </Link>
            <div className="flex items-center gap-2">
              {walletAddress && (
                <span className="poly-mono text-xs text-[var(--kraken-muted)] bg-white/[0.04] border border-[var(--kraken-border)] px-2 py-1">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              )}
              <LanguageSwitcher currentLocale={locale} />
            </div>
          </div>
        </div>
        
        {/* Main Content - Add bottom padding for mobile nav */}
        <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 pb-24 md:pb-8">
          {children}
        </main>
        
        {/* Bottom Navigation - Mobile only */}
        <BottomNav />
      </div>
    </Web3Provider>
  )
}
