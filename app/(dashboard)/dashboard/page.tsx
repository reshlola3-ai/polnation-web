import { DashboardClient } from './DashboardClient'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import {
  getAuthUser,
  getProfile,
  getTeamStats,
  getProfitSnapshot,
  ensureReferralCode,
} from '@/lib/dashboard-data'

export default async function DashboardPage() {
  // Await everything *cheap* in parallel. team_stats is the slowest (RPC may
  // hit Supabase functions for ~100-400ms), so we kick it off but don't await
  // — the unresolved Promise is streamed into a Suspense boundary inside
  // DashboardClient.
  const teamStatsPromise = getTeamStats()

  const [t, user, profileRaw, profitSummary] = await Promise.all([
    getTranslations('dashboard'),
    getAuthUser(),
    getProfile(),
    getProfitSnapshot(),
  ])

  const profile = profileRaw ? await ensureReferralCode(profileRaw) : profileRaw

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
        teamStatsPromise={teamStatsPromise}
        initialProfitSummary={profitSummary}
      />
    </div>
  )
}
