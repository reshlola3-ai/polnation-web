import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { DashboardClient } from './DashboardClient'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

export default async function DashboardPage() {
  const t = await getTranslations('dashboard')
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 获取用户 profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, wallet_address, profile_completed')
    .eq('id', user.id)
    .single()

  // 获取团队统计
  const { data: teamStats } = await supabase
    .rpc('get_team_stats', { user_id: user.id })

  const stats = teamStats?.[0] || { total_team_members: 0, level1_members: 0 }

  return (
    <div className="space-y-4">
      {/* Profile incomplete warning */}
      {profile && !profile.profile_completed && (
        <div className="glass-card-solid p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 border-amber-500/30">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-amber-300 font-medium text-sm">{t('completeProfile')}</p>
              <p className="text-amber-400/70 text-xs">{t('completeProfileDesc')}</p>
            </div>
          </div>
          <Link 
            href="/profile" 
            className="w-full sm:w-auto px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-400 transition-colors text-center"
          >
            {t('completeNow')}
          </Link>
        </div>
      )}

      {/* Main Dashboard Content */}
      <DashboardClient 
        userId={user.id} 
        profile={profile}
        teamStats={stats}
      />
    </div>
  )
}
