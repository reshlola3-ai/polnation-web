import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { User, Users, UserCheck, AlertCircle } from 'lucide-react'
import { DashboardClient } from './DashboardClient'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 获取用户 profile（包含推荐人信息）
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, referrer:referrer_id(id, username, email)')
    .eq('id', user.id)
    .single()

  // 获取团队统计
  const { data: teamStats } = await supabase
    .rpc('get_team_stats', { user_id: user.id })

  const stats = teamStats?.[0] || { total_team_members: 0, level1_members: 0 }
  
  // 推荐人信息
  const referrer = profile?.referrer as { id: string; username: string; email: string } | null

  return (
    <div className="space-y-6">
      {/* Profile 未完成提示 */}
      {profile && !profile.profile_completed && (
        <div className="glass-card-solid p-4 flex items-center gap-4 border-amber-500/30">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-amber-300 font-medium">Complete your profile</p>
            <p className="text-amber-400/70 text-sm">Add your details to unlock all features</p>
          </div>
          <Link 
            href="/profile" 
            className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-400 transition-colors"
          >
            Complete Now
          </Link>
        </div>
      )}

      {/* Welcome Section + Referrer Info */}
      <div className="glass-card-solid p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Welcome back, {profile?.username || 'User'}! 👋
            </h1>
            <p className="mt-2 text-zinc-400">
              Here's an overview of your Polnation account.
            </p>
          </div>
          
          {/* Referrer Badge */}
          <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Referred by</p>
              {referrer ? (
                <p className="text-sm font-semibold text-white">{referrer.username || referrer.email}</p>
              ) : (
                <p className="text-sm font-medium text-zinc-500">None</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team Members */}
        <div className="glass-card-solid p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Total Team</p>
              <p className="text-2xl font-bold text-white">{stats.total_team_members}</p>
            </div>
          </div>
        </div>

        {/* Direct Referrals */}
        <div className="glass-card-solid p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
              <User className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Direct Referrals</p>
              <p className="text-2xl font-bold text-white">{stats.level1_members}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Section - Client Component */}
      <DashboardClient userId={user.id} />
    </div>
  )
}
