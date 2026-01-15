import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { User, Users } from 'lucide-react'
import { DashboardClient } from './DashboardClient'

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </div>

      {/* Wallet Section - Client Component */}
      <DashboardClient userId={user.id} />
    </div>
  )
}
