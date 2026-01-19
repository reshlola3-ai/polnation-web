import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Navbar } from '@/components/layout/Navbar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Web3Provider } from '@/components/providers/Web3Provider'
import { BubbleBackground } from '@/components/animate-ui/components/backgrounds/bubble'
import { defaultLocale, locales, type Locale } from '@/i18n/config'

// Polnation brand colors for bubble background
const bubbleColors = {
  first: '147,51,234',    // Purple
  second: '139,92,246',   // Light Purple
  third: '6,182,212',     // Cyan
  fourth: '168,85,247',   // Purple accent
  fifth: '124,58,237',    // Violet
  sixth: '34,211,238',    // Bright Cyan (interactive)
}

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
      <div className="min-h-screen relative">
        {/* Animated Bubble Background */}
        <BubbleBackground 
          interactive 
          colors={bubbleColors}
          className="fixed inset-0 bg-gradient-to-br from-[#0D0B21] via-[#1A1333] to-[#0D0B21]"
        />
        
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
