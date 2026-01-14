import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { User, Users, Wallet, ArrowRight } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 获取用户 profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // 如果 profile 未完成，重定向到 profile 页面
  if (profile && !profile.profile_completed) {
    redirect('/profile')
  }

  // 获取团队统计
  const { data: teamStats } = await supabase
    .rpc('get_team_stats', { user_id: user.id })

  const stats = teamStats?.[0] || { total_team_members: 0, level1_members: 0 }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
        <h1 className="text-2xl font-bold text-zinc-900">
          Welcome back, {profile?.username || 'User'}! 👋
        </h1>
        <p className="mt-2 text-zinc-600">
          Here's an overview of your Polnation account.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Team Members */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Total Team</p>
              <p className="text-2xl font-bold text-zinc-900">{stats.total_team_members}</p>
            </div>
          </div>
        </div>

        {/* Direct Referrals */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Direct Referrals</p>
              <p className="text-2xl font-bold text-zinc-900">{stats.level1_members}</p>
            </div>
          </div>
        </div>

        {/* Wallet Status */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              profile?.wallet_address ? 'bg-green-100' : 'bg-amber-100'
            }`}>
              <Wallet className={`w-6 h-6 ${
                profile?.wallet_address ? 'text-green-600' : 'text-amber-600'
              }`} />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Wallet</p>
              <p className="text-lg font-semibold text-zinc-900">
                {profile?.wallet_address 
                  ? `${profile.wallet_address.slice(0, 6)}...${profile.wallet_address.slice(-4)}`
                  : 'Not Connected'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <Link href="/profile" className="group">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100 hover:border-emerald-200 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                  <User className="w-6 h-6 text-zinc-600 group-hover:text-emerald-600 transition-colors" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900">Your Profile</h3>
                  <p className="text-sm text-zinc-500">Manage your account settings</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-zinc-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </Link>

        {/* Referral Card */}
        <Link href="/referral" className="group">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100 hover:border-emerald-200 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                  <Users className="w-6 h-6 text-zinc-600 group-hover:text-emerald-600 transition-colors" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900">Referral Network</h3>
                  <p className="text-sm text-zinc-500">View your team and referrals</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-zinc-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </Link>
      </div>

      {/* Referral Link */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
        <h3 className="text-lg font-semibold mb-2">Share Your Referral Link</h3>
        <p className="text-emerald-100 text-sm mb-4">
          Invite friends and grow your network
        </p>
        <div className="bg-white/20 backdrop-blur rounded-xl p-3 flex items-center justify-between">
          <code className="text-sm truncate">
            {typeof window !== 'undefined' 
              ? `${window.location.origin}/register?ref=${user.id}`
              : `https://polnation.com/register?ref=${user.id}`
            }
          </code>
          <button 
            className="ml-2 px-3 py-1 bg-white text-emerald-600 rounded-lg text-sm font-medium hover:bg-emerald-50 transition-colors"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/register?ref=${user.id}`)
            }}
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  )
}
