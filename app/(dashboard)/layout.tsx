import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Web3Provider } from '@/components/providers/Web3Provider'

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

  return (
    <Web3Provider>
      <div className="min-h-screen bg-gradient-radial relative">
        {/* Animated Background */}
        <div className="stars fixed inset-0 pointer-events-none" />
        <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <Navbar user={user} />
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </Web3Provider>
  )
}
