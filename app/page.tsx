import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import { Navbar } from '@/components/layout/Navbar'
import { ArrowRight, Users, Wallet, Shield, TrendingUp, Sparkles } from 'lucide-react'

export default async function HomePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gradient-radial relative overflow-hidden">
      {/* Animated Background */}
      <div className="stars fixed inset-0 pointer-events-none" />
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
      
      <Navbar user={user} />

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-8">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">The Future of Soft Staking</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white tracking-tight">
            Welcome to{' '}
            <span className="bg-gradient-to-r from-purple-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent">
              Polnation
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto">
            The premier soft staking platform. 
            Build your network, grow your team, and earn rewards together.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white btn-gradient rounded-xl transition-all glow-purple"
              >
                Go to Dashboard
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white btn-gradient rounded-xl transition-all glow-purple"
                >
                  Get Started
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-white/5 rounded-xl hover:bg-white/10 transition-all border border-white/10"
                >
                  Sign In
                </Link>
              </>
            )}
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
            <h3 className="text-lg font-semibold text-white mb-2">Build Your Network</h3>
            <p className="text-zinc-400 text-sm">
              Invite friends and grow your referral network with our easy-to-use platform.
            </p>
          </div>

          <div className="glass-card-solid p-6 hover:border-purple-500/40 transition-all duration-300 group">
            <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-cyan-500/30 transition-colors">
              <Wallet className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Connect Wallet</h3>
            <p className="text-zinc-400 text-sm">
              Securely connect your wallet using WalletConnect with Trust, Bitget, or SafePal.
            </p>
          </div>

          <div className="glass-card-solid p-6 hover:border-purple-500/40 transition-all duration-300 group">
            <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-pink-500/30 transition-colors">
              <Shield className="w-6 h-6 text-pink-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Soft Staking</h3>
            <p className="text-zinc-400 text-sm">
              Keep your USDC in your own wallet. No smart contract risks, full control.
            </p>
          </div>

          <div className="glass-card-solid p-6 hover:border-purple-500/40 transition-all duration-300 group">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-500/30 transition-colors">
              <TrendingUp className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Earn Rewards</h3>
            <p className="text-zinc-400 text-sm">
              Earn rewards based on your team's total staked volume through periodic snapshots.
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
              <p className="text-sm text-zinc-400 mt-2">Total Volume</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-white stat-number">5,000+</p>
              <p className="text-sm text-zinc-400 mt-2">Active Users</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-white percentage">12%</p>
              <p className="text-sm text-zinc-400 mt-2">Avg. APY</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-white percentage">100%</p>
              <p className="text-sm text-zinc-400 mt-2">Non-Custodial</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-purple-500/20 bg-[#0D0B21]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center glow-purple-sm">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="font-display text-xl text-white">Polnation</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-sm text-zinc-500 hover:text-purple-400 transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-zinc-500 hover:text-purple-400 transition-colors">
                Terms of Service
              </Link>
            </div>
            <p className="text-sm text-zinc-500">
              © 2026 Polnation. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
