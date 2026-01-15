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
    <div className="space-y-8">
      {/* Profile 未完成提示 */}
      {profile && !profile.profile_completed && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-amber-800 font-medium">Complete your profile</p>
            <p className="text-amber-600 text-sm">Add your details to unlock all features</p>
          </div>
          <Link 
            href="/profile" 
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            Complete Now
          </Link>
        </div>
      )}

      {/* Welcome Section + Referrer Info */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">
              Welcome back, {profile?.username || 'User'}! 👋
            </h1>
            <p className="mt-2 text-zinc-600">
              Here's an overview of your Polnation account.
            </p>
          </div>
          
          {/* Referrer Badge */}
          <div className="flex items-center gap-3 bg-zinc-50 rounded-xl px-4 py-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Referred by</p>
              {referrer ? (
                <p className="text-sm font-semibold text-zinc-900">{referrer.username || referrer.email}</p>
              ) : (
                <p className="text-sm font-medium text-zinc-400">None</p>
              )}
            </div>
          </div>
        </div>
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
