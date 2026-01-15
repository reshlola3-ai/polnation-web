import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import { Navbar } from '@/components/layout/Navbar'
import { ArrowRight, Users, Wallet, Shield, TrendingUp } from 'lucide-react'

export default async function HomePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-emerald-50/30 to-teal-50/40">
      <Navbar user={user} />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-zinc-900 tracking-tight">
            Welcome to{' '}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Polnation
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-zinc-600 max-w-2xl mx-auto">
            The premier soft staking demonstration platform. 
            Build your network, grow your team, and earn rewards together.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25"
              >
                Go to Dashboard
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25"
                >
                  Get Started
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-zinc-700 bg-white rounded-xl hover:bg-zinc-50 transition-all border border-zinc-200"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">Build Your Network</h3>
            <p className="text-zinc-600 text-sm">
              Invite friends and grow your referral network with our easy-to-use platform.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">Connect Wallet</h3>
            <p className="text-zinc-600 text-sm">
              Securely connect your wallet using WalletConnect with Trust, Bitget, or SafePal.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">Soft Staking</h3>
            <p className="text-zinc-600 text-sm">
              Keep your USDC in your own wallet. No smart contract risks, full control.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">Earn Rewards</h3>
            <p className="text-zinc-600 text-sm">
              Earn rewards based on your team's total staked volume through periodic snapshots.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="font-bold text-xl text-zinc-900">Polnation</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-sm text-zinc-500 hover:text-zinc-700">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-zinc-500 hover:text-zinc-700">
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
