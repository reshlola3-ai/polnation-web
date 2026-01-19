import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Navbar } from '@/components/layout/Navbar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Web3Provider } from '@/components/providers/Web3Provider'
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
      <div className="min-h-screen bg-gradient-radial relative">
        {/* Animated Background */}
        <div className="stars fixed inset-0 pointer-events-none" />
        <div className="fixed top-0 right-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-purple-600/20 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />
        <div className="fixed bottom-0 left-0 w-[200px] md:w-[400px] h-[200px] md:h-[400px] bg-cyan-500/10 rounded-full blur-[60px] md:blur-[100px] pointer-events-none" />
        
        {/* Top Navigation - Hidden on mobile */}
        <div className="hidden md:block">
          <Navbar user={user} locale={locale} />
        </div>
        
        {/* Mobile Header */}
        <div className="md:hidden">
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
