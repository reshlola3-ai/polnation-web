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
