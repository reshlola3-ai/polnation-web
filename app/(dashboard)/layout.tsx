import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Navbar } from '@/components/layout/Navbar'
import { BottomNav } from '@/components/layout/BottomNav'
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

  // Get locale from cookie
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('locale')?.value as Locale | undefined
  const locale = localeCookie && locales.includes(localeCookie) ? localeCookie : defaultLocale

  return (
    <Web3Provider>
      <div className="min-h-screen bg-[#0D0B21] relative">
        {/* Unsupported Wallet Overlay */}
        <UnsupportedWalletOverlay />
        
        {/* Static Background Effects */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[80px]" />
        </div>
        
        {/* Top Navigation - Hidden on mobile */}
        <div className="hidden md:block relative z-20">
          <Navbar user={user} locale={locale} />
        </div>
        
        {/* Mobile Header */}
        <div className="md:hidden relative z-20">
          <Navbar user={user} locale={locale} isMobile />
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
