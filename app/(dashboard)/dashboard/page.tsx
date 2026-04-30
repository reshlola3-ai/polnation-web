import { createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { DashboardClient } from './DashboardClient'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

// 生成 4 位随机 referral code（与数据库函数逻辑一致）
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export default async function DashboardPage() {
  const t = await getTranslations('dashboard')
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 获取用户 profile
  let { data: profile } = await supabase
    .from('profiles')
    .select('username, wallet_address, profile_completed, referral_code, email')
    .eq('id', user.id)
    .single()

  // 🛡️ 兜底：如果 referral_code 为空，自动生成一个
  if (profile && !profile.referral_code) {
    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (adminUrl && adminKey) {
      const supabaseAdmin = createClient(adminUrl, adminKey)
      // 生成唯一 code（尝试最多 10 次避免碰撞）
      for (let attempt = 0; attempt < 10; attempt++) {
        const newCode = generateReferralCode()
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ referral_code: newCode })
          .eq('id', user.id)
          .is('referral_code', null) // 只在仍为 null 时更新，防止并发
        
        if (!error) {
          profile = { ...profile, referral_code: newCode }
          console.log(`Auto-generated referral_code ${newCode} for user ${user.id}`)
          break
        }
        // 如果是唯一约束冲突，重试
        if (error.code === '23505') continue
        console.error('Failed to auto-generate referral_code:', error)
        break
      }
    }
  }

  // 获取团队统计
  const { data: teamStats } = await supabase
    .rpc('get_team_stats', { user_id: user.id })

  const stats = teamStats?.[0] || { total_team_members: 0, level1_members: 0 }

  return (
    <div className="space-y-4">
      {/* Profile incomplete warning */}
      {profile && !profile.profile_completed && (
        <div className="bg-white/[0.04] border border-white/[0.08] p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-white/60" />
            </div>
            <div>
              <p className="text-white/70 font-medium text-sm">{t('completeProfile')}</p>
              <p className="text-white/45 text-xs">{t('completeProfileDesc')}</p>
            </div>
          </div>
          <Link
            href="/profile"
            className="w-full sm:w-auto px-4 py-2 bg-[var(--poly-purple)] text-white text-sm font-medium hover:bg-[var(--poly-purple-hover)] transition-colors text-center shadow-cta-purple"
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
