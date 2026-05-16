'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle,
  Circle,
  ExternalLink,
  Send,
  Calendar,
  Flame,
  Video,
  Share2,
  Twitter,
  MessageCircle,
  RefreshCw,
  AlertCircle,
  Gift,
  Lock,
  Loader2,
  X,
  Copy,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Users,
  Wallet,
  Info,
  Unlock,
  Trophy,
  Star,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { VerifyAccountGate } from '@/components/auth/VerifyAccountGate'

const LottieIcon = dynamic(
  () => import('@/components/ui/LottieIcon').then(mod => mod.LottieIcon),
  { ssr: false }
)

// Types
interface PendingSubmission {
  id: string
  submitted_url?: string
  submitted_content?: string
  created_at: string
  status: string
}

interface Task {
  id: string
  task_key: string
  name: string
  description: string
  reward_usd: number
  task_category: string
  is_repeatable: boolean
  verification_type: string
  social_url: string | null
  quest_group: string | null
  quest_step: number
  requires_referral_count: number
  completed_count: number
  pending_count: number
  pending_submissions: PendingSubmission[]
  last_completed: string | null
  can_complete: boolean
  is_unlocked: boolean
  is_completed: boolean
  is_pending: boolean
  referral_progress: number
  referral_target: number
}

interface Chapter {
  group: string
  index: number
  tasks: Task[]
  total: number
  completed: number
  is_complete: boolean
  is_accessible: boolean
}

interface Progress {
  total_task_bonus: number
  current_streak: number
  total_checkins: number
}

interface ReferralBonus {
  pending: number
  claimed: number
  count: number
}

interface BonusBreakdown {
  [key: string]: number
}

// Admin Telegram link
const ADMIN_TELEGRAM = 'https://t.me/polnationadmin'
const SUPPORT_TELEGRAM = 'https://t.me/polnationsupport'

export default function TasksPage() {
  const t = useTranslations('tasks')
  const tCommon = useTranslations('common')
  const tQ = useTranslations('tasks.quest')

  const getTaskName = (task: Task) => {
    try {
      const translated = t(`taskDb.${task.task_key}.name` as Parameters<typeof t>[0])
      if (translated && !String(translated).startsWith('taskDb.')) return String(translated)
    } catch { /* fallback */ }
    return task.name
  }
  const getTaskDesc = (task: Task) => {
    try {
      const translated = t(`taskDb.${task.task_key}.description` as Parameters<typeof t>[0])
      if (translated && !String(translated).startsWith('taskDb.')) return String(translated)
    } catch { /* fallback */ }
    return task.description
  }

  const router = useRouter()

  // Data state
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [checkinTask, setCheckinTask] = useState<Task | null>(null)
  const [progress, setProgress] = useState<Progress>({ total_task_bonus: 0, current_streak: 0, total_checkins: 0 })
  const [referralBonus, setReferralBonus] = useState<ReferralBonus>({ pending: 0, claimed: 0, count: 0 })
  const [bonusBreakdown, setBonusBreakdown] = useState<BonusBreakdown>({})
  const [referralCount, setReferralCount] = useState(0)
  const [referralLink, setReferralLink] = useState('')
  const [profileHasWallet, setProfileHasWallet] = useState(false)

  // UI state
  const [isLoading, setIsLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [claimingReferral, setClaimingReferral] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [socialVisited, setSocialVisited] = useState<Set<string>>(new Set())
  const [showBonusModal, setShowBonusModal] = useState(false)
  const [expandedChapter, setExpandedChapter] = useState<string | null>('ch1')
  const [videoUrl, setVideoUrl] = useState('')
  const [promotionUrl, setPromotionUrl] = useState('')

  // Share modal
  const [showShareModal, setShowShareModal] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [allCopied, setAllCopied] = useState(false)

  // Wallet tooltip
  const [showWalletTooltip, setShowWalletTooltip] = useState(false)

  // Verification status — Tasks gate passes if EITHER telegram_verified OR twitter_verified.
  // Telegram is the primary path (TG-login users are auto-verified). Twitter is the legacy
  // path kept for users who already linked Twitter before this change.
  const [verified, setVerified] = useState<boolean | null>(null)
  const [verifiedStatusLoaded, setVerifiedStatusLoaded] = useState(false)

  // Load referral link + verification status on mount
  // Run this FIRST (separate from fetchTasks) so the gate shows immediately
  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase
          .from('profiles')
          .select('referral_code, wallet_address, twitter_verified, telegram_verified')
          .eq('id', user.id)
          .single()
        const refCode = profile?.referral_code || user.id
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://polnation.com'
        setReferralLink(`${baseUrl}/register?ref=${refCode}`)
        setProfileHasWallet(!!profile?.wallet_address)
        setVerified(!!profile?.twitter_verified || !!profile?.telegram_verified)
      } catch { /* ignore */ }
      finally {
        setVerifiedStatusLoaded(true)
      }
    }
    loadData()
  }, [])

  const fetchTasks = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/tasks')
      if (res.ok) {
        const data = await res.json()
        setChapters(data.chapters || [])
        setCheckinTask(data.checkin_task || null)
        setProgress(data.progress || { total_task_bonus: 0, current_streak: 0, total_checkins: 0 })
        setReferralBonus(data.referral_bonus || { pending: 0, claimed: 0, count: 0 })
        setBonusBreakdown(data.bonus_breakdown || {})
        setReferralCount(data.referral_count || 0)
        if (data.profile?.has_signed) setProfileHasWallet(true)
      }
    } catch { /* ignore */ }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const completeTask = async (taskKey: string, submittedUrl?: string, submittedContent?: string) => {
    setSubmitting(taskKey)
    setMessage(null)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_key: taskKey, submitted_url: submittedUrl, submitted_content: submittedContent }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.redirect) {
          setMessage({ type: 'error', text: data.error || 'Failed' })
          setTimeout(() => router.push(data.redirect), 1500)
          return
        }
        setMessage({ type: 'error', text: data.error || 'Failed to complete task' })
        return
      }
      setMessage({ type: 'success', text: data.message })
      fetchTasks()
      if (taskKey === 'promotion_post') setPromotionUrl('')
      if (taskKey === 'video_review') setVideoUrl('')
    } catch {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setSubmitting(null)
    }
  }

  const claimReferralBonus = async () => {
    if (referralBonus.pending <= 0) return
    setClaimingReferral(true)
    try {
      const res = await fetch('/api/tasks/claim-referral', { method: 'POST' })
      const data = await res.json()
      if (res.ok) { setMessage({ type: 'success', text: data.message }); fetchTasks() }
      else { setMessage({ type: 'error', text: data.error || 'Failed to claim bonus' }) }
    } catch { setMessage({ type: 'error', text: 'Network error' }) }
    finally { setClaimingReferral(false) }
  }

  const getSocialIcon = (taskKey: string) => {
    if (taskKey.includes('twitter')) return <LottieIcon src="/x.json" className="w-7 h-7" />
    if (taskKey.includes('telegram')) return <LottieIcon src="/telegram.json" className="w-7 h-7" />
    if (taskKey.includes('whatsapp')) return <img src="/whatsapp.webp" alt="WhatsApp" className="w-7 h-7" />
    if (taskKey.includes('facebook')) return <LottieIcon src="/facebook.json" className="w-7 h-7" />
    return <Share2 className="w-7 h-7 text-blue-400" />
  }

  const getChapterTitle = (group: string) => {
    if (group === 'ch1') return tQ('ch1Title')
    if (group === 'ch2') return tQ('ch2Title')
    if (group === 'ch3') return tQ('ch3Title')
    return group
  }

  const getChapterIcon = (group: string) => {
    if (group === 'ch1') return <Sparkles className="w-5 h-5" />
    if (group === 'ch2') return <Users className="w-5 h-5" />
    if (group === 'ch3') return <Trophy className="w-5 h-5" />
    return <Star className="w-5 h-5" />
  }

  const getChapterColor = (group: string) => {
    if (group === 'ch1') return { bg: 'from-purple-600 to-indigo-600', border: 'border-purple-500/40', badge: 'bg-purple-500/20 text-purple-300' }
    if (group === 'ch2') return { bg: 'from-[var(--poly-purple)] to-[var(--poly-purple-hover)]', border: 'border-[var(--poly-purple)]/40', badge: 'bg-[var(--poly-purple)]/20 text-white/70' }
    if (group === 'ch3') return { bg: 'from-white/20 to-white/10', border: 'border-white/[0.12]', badge: 'bg-white/[0.08] text-white/70' }
    return { bg: 'from-zinc-600 to-zinc-700', border: 'border-zinc-500/40', badge: 'bg-zinc-500/20 text-zinc-300' }
  }

  const getChapterBonus = (group: string) => {
    if (group === 'ch1') return tQ('ch1Bonus')
    if (group === 'ch2') return tQ('ch2Bonus')
    if (group === 'ch3') return tQ('ch3Bonus')
    return ''
  }

  // Share modal full ad text
  const getAdText = () => {
    return tQ('shareModalAdText').replace('{referralLink}', referralLink || 'https://polnation.com/register?ref=YOUR_CODE')
  }

  // ── Loading ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-white/10 rounded w-1/3 mb-4" />
          <div className="h-32 bg-white/5 rounded" />
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-white/10 rounded w-1/3" />
          <div className="h-24 bg-white/5 rounded" />
          <div className="h-40 bg-white/5 rounded" />
          <div className="h-40 bg-white/5 rounded" />
        </div>
      </div>
    )
  }

  // ── Main UI ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-white">{t('title')}</h1>
          <p className="text-zinc-400 text-sm truncate">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTasks} className="shrink-0">
          <RefreshCw className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">{tCommon('refresh')}</span>
        </Button>
      </div>

      {/* Message banner */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Verification gate — passes if telegram_verified OR twitter_verified.
          Telegram is primary; Twitter shown as secondary option for users who
          already had it linked before this change. */}
      {!verifiedStatusLoaded && (
        <div className="glass-card-solid p-4 animate-pulse">
          <div className="h-5 bg-white/10 rounded w-1/3 mb-3" />
          <div className="h-10 bg-white/5 rounded" />
        </div>
      )}

      {verifiedStatusLoaded && verified === false && (
        <VerifyAccountGate onTelegramBound={() => setVerified(true)} />
      )}

      {verifiedStatusLoaded && verified !== false && <>

      {/* Progress banner */}
      <div className="glass-card-solid rounded-2xl p-4 md:p-5 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-zinc-500 mb-1">{t('totalBonus')}</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl md:text-3xl font-bold text-white font-mono">${progress.total_task_bonus.toFixed(2)}</p>
            <button onClick={() => setShowBonusModal(true)}
              className="w-5 h-5 rounded-full bg-white/10 text-zinc-400 hover:bg-white/20 hover:text-white flex items-center justify-center text-xs font-bold transition-colors shrink-0">?</button>
          </div>
          <p className="text-xs text-zinc-600 mt-1">{t('addedToProgress')}</p>
        </div>
        <div className="text-right shrink-0 border-l border-white/[0.06] pl-4">
          <div className="flex items-center justify-end gap-1.5 mb-1">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-sm font-semibold text-white font-mono">{progress.current_streak}</span>
            <span className="text-xs text-zinc-500">{t('dayStreak')}</span>
          </div>
          <p className="text-xs text-zinc-500 font-mono">{progress.total_checkins} {t('totalCheckins')}</p>
        </div>
      </div>

      {/* Daily Check-in */}
      {checkinTask && (
        <div className="glass-card-solid rounded-2xl overflow-hidden">
          <div className="px-4 md:px-5 py-3 border-b border-white/[0.06] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <p className="font-semibold text-white text-sm">{t('checkin.title')}</p>
                <p className="text-zinc-500 text-xs">{t('checkin.subtitle')}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-white font-semibold font-mono text-lg leading-none">{progress.current_streak}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{t('checkin.streakDays')}</p>
            </div>
          </div>
          <div className="px-3 md:px-5 py-4">
            <div className="flex items-end justify-between mb-4 gap-1">
              {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 1.0].map((reward, index) => {
                const day = index + 1
                const isCompleted = day <= progress.current_streak
                const isToday = day === progress.current_streak + 1
                const isBonus = day === 7
                return (
                  <div key={day} className="flex flex-col items-center flex-1 gap-1">
                    <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center transition-all ${
                      isBonus
                        ? (isCompleted ? 'bg-[#00e28a]' : 'bg-cyan-500/20 border border-cyan-500/30')
                        : (isCompleted ? 'bg-purple-500' : isToday ? 'bg-white/[0.06] border-2 border-purple-400 border-dashed' : 'bg-white/[0.04] border border-white/10')
                    }`}>
                      {isBonus
                        ? (isCompleted
                            ? <Gift className="w-4 h-4 text-black" />
                            : <Gift className="w-4 h-4 text-cyan-400" />)
                        : isCompleted
                          ? <CheckCircle className="w-4 h-4 text-white" />
                          : <span className="text-xs text-zinc-500 font-mono">{day}</span>}
                    </div>
                    <span className={`text-xs font-mono ${isCompleted ? 'text-[#00e28a]' : 'text-zinc-600'}`}>${reward.toFixed(1)}</span>
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => completeTask('daily_checkin')}
              disabled={!checkinTask.can_complete || submitting === 'daily_checkin'}
              className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] ${
                checkinTask.can_complete
                  ? 'bg-purple-500 hover:bg-purple-400 text-white'
                  : 'bg-white/[0.06] text-zinc-500 cursor-not-allowed'
              }`}
            >
              {submitting === 'daily_checkin'
                ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
                : checkinTask.can_complete
                  ? <span className="flex items-center justify-center gap-2"><Calendar className="w-4 h-4" />{t('checkin.checkInNow')}</span>
                  : <span className="flex items-center justify-center gap-2"><CheckCircle className="w-4 h-4" />{t('checkin.checkedIn')}</span>}
            </button>
            {progress.current_streak >= 5 && progress.current_streak < 7 && (
              <p className="text-center text-xs text-zinc-400 mt-2 flex items-center justify-center gap-1">
                <Flame className="w-3 h-3 text-orange-400" />
                {t('checkin.streakBonus', { n: 7 - progress.current_streak })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Chapters ───────────────────────────────────────────────────── */}
      {chapters.map((chapter) => {
        const isExpanded = expandedChapter === chapter.group
        const progressPct = chapter.total > 0 ? Math.round((chapter.completed / chapter.total) * 100) : 0

        return (
          <div key={chapter.group} className="glass-card-solid rounded-2xl overflow-hidden border-t-2 border-t-purple-500/25">
            {/* Chapter header */}
            <button
              className={`w-full px-4 md:px-5 py-4 flex items-center gap-3 text-left transition-colors hover:bg-white/[0.02] ${!chapter.is_accessible ? 'opacity-50 cursor-default' : ''}`}
              onClick={() => {
                if (!chapter.is_accessible) return
                setExpandedChapter(isExpanded ? null : chapter.group)
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {chapter.is_complete && <CheckCircle className="w-4 h-4 text-[#00e28a] shrink-0" />}
                  {!chapter.is_complete && !chapter.is_accessible && <Lock className="w-4 h-4 text-zinc-600 shrink-0" />}
                  <p className="font-semibold text-white text-sm truncate">{getChapterTitle(chapter.group)}</p>
                </div>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  {tQ('chapterProgress', { done: chapter.completed, total: chapter.total })} · {progressPct}%
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-20 hidden sm:block">
                  <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
                {chapter.is_accessible
                  ? (isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />)
                  : <Lock className="w-4 h-4 text-zinc-600" />}
              </div>
            </button>

            {/* Locked message */}
            {!chapter.is_accessible && (
              <div className="px-4 py-3 border-t border-white/[0.04]">
                <p className="text-zinc-600 text-xs flex items-center gap-1.5">
                  <Lock className="w-3 h-3" />
                  {tQ('chapterLocked', { n: chapter.index - 1 })}
                </p>
              </div>
            )}

            {/* Chapter tasks */}
            {chapter.is_accessible && isExpanded && (
              <div className="border-t border-white/[0.06] divide-y divide-white/[0.04]">
                {chapter.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    chapter={chapter}
                    submitting={submitting}
                    socialVisited={socialVisited}
                    promotionUrl={promotionUrl}
                    videoUrl={videoUrl}
                    referralLink={referralLink}
                    profileHasWallet={profileHasWallet}
                    showWalletTooltip={showWalletTooltip && task.task_key === 'wallet_connect'}
                    getTaskName={getTaskName}
                    getTaskDesc={getTaskDesc}
                    getSocialIcon={getSocialIcon}
                    tQ={tQ}
                    tCommon={tCommon}
                    onComplete={completeTask}
                    onSocialVisit={(key) => setSocialVisited(prev => new Set(prev).add(key))}
                    onShowShareModal={() => setShowShareModal(true)}
                    onToggleWalletTooltip={() => setShowWalletTooltip(v => !v)}
                    onSetPromotionUrl={setPromotionUrl}
                    onSetVideoUrl={setVideoUrl}
                  />
                ))}

                {/* Chapter completion row */}
                {chapter.is_complete && (
                  <div className="px-4 py-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#00e28a]" />
                    <span className="text-[#00e28a] text-xs font-medium">{tQ('chapterComplete')} {getChapterBonus(chapter.group)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Referral bonus card */}
      <div className="glass-card-solid rounded-2xl overflow-hidden">
        <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
          <Gift className="w-4 h-4 text-[#00e28a]" />
          <h3 className="font-semibold text-white text-sm">{t('referral.title')}</h3>
          <span className="px-2 py-0.5 bg-white/[0.06] text-zinc-400 text-xs rounded-full ml-auto">{t('referral.autoTag')}</span>
        </div>
        <div className="p-4">
          <p className="text-xs text-zinc-500 mb-3">{t('referral.description')}</p>
          <div className="p-3 bg-[#00e28a]/[0.06] border border-[#00e28a]/20 rounded-xl mb-3">
            <div className="flex items-center gap-5">
              <div>
                <p className="text-xs text-zinc-500">{t('referral.available')}</p>
                <p className="text-lg font-bold text-[#00e28a] font-mono">${referralBonus.pending.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">{t('referral.referrals')}</p>
                <p className="text-lg font-bold text-white font-mono">{referralBonus.count}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">{t('referral.claimed')}</p>
                <p className="text-lg font-bold text-zinc-500 font-mono">${referralBonus.claimed.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <Button onClick={claimReferralBonus} disabled={referralBonus.pending <= 0 || claimingReferral}
            isLoading={claimingReferral}
            className="w-full bg-[#00e28a] hover:bg-[#00e28a]/90 text-black font-semibold disabled:bg-white/[0.06] disabled:text-zinc-500">
            <Gift className="w-4 h-4 mr-2" />
            {t('referral.claimAmount', { amount: referralBonus.pending.toFixed(2) })}
          </Button>
        </div>
      </div>

      {/* ── Share Modal ─────────────────────────────────────────────────── */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowShareModal(false)}>
          <div className="glass-card-solid border border-white/[0.10] rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-purple-400" />
                {tQ('shareModalTitle')}
              </h3>
              <button onClick={() => setShowShareModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <div className="mb-4">
              <label className="text-xs text-zinc-500 mb-1.5 block">{tQ('shareModalLinkLabel')}</label>
              <div className="flex gap-2">
                <div className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono truncate">{referralLink}</div>
                <Button size="sm" variant="outline" onClick={() => {
                  navigator.clipboard.writeText(referralLink)
                  setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000)
                }}>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  {linkCopied ? tQ('copied') : tQ('copyLink')}
                </Button>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-zinc-500 mb-1.5 block">{tQ('shareModalAdCopy')}</label>
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
                <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">{getAdText()}</pre>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-xs" onClick={() => {
                navigator.clipboard.writeText(getAdText())
                setAllCopied(true); setTimeout(() => setAllCopied(false), 2000)
              }}>
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                {allCopied ? tQ('copied') : tQ('copyAll')}
              </Button>
              <Button className="flex-1 text-xs bg-white/[0.08] hover:bg-white/[0.12] text-white" onClick={() => {
                const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(getAdText())}`
                window.open(tweetUrl, '_blank')
              }}>
                <Twitter className="w-3.5 h-3.5 mr-1.5" />
                {tQ('shareToX')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bonus Breakdown Modal ───────────────────────────────────────── */}
      {showBonusModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowBonusModal(false)}>
          <div className="glass-card-solid border border-white/[0.10] rounded-2xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">{t('bonusModal.title')}</h3>
              <button onClick={() => setShowBonusModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries({
                checkin: t('bonusModal.checkin'),
                social: t('bonusModal.social'),
                onboarding: t('bonusModal.profileSetup'),
                promotion: t('bonusModal.promotion'),
                video: t('bonusModal.videoReview'),
                community: t('bonusModal.community'),
                referral: t('bonusModal.referralBonus'),
              }).filter(([k]) => (bonusBreakdown[k] || 0) > 0).map(([k, label]) => (
                <div key={k} className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">{label}</span>
                  <span className="text-sm font-mono text-[#00e28a]">${(bonusBreakdown[k] || 0).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-white/[0.06] pt-3 mt-2 flex justify-between items-center">
                <span className="text-xs text-zinc-500">Total</span>
                <span className="text-lg font-bold font-mono text-[#00e28a]">${progress.total_task_bonus.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      </>}
    </div>
  )
}

// ── TaskRow component ─────────────────────────────────────────────────
interface TaskRowProps {
  task: Task
  chapter: Chapter
  submitting: string | null
  socialVisited: Set<string>
  promotionUrl: string
  videoUrl: string
  referralLink: string
  profileHasWallet: boolean
  showWalletTooltip: boolean
  getTaskName: (t: Task) => string
  getTaskDesc: (t: Task) => string
  getSocialIcon: (key: string) => React.ReactNode
  tQ: ReturnType<typeof useTranslations<'tasks.quest'>>
  tCommon: ReturnType<typeof useTranslations<'common'>>
  onComplete: (key: string, url?: string, content?: string) => void
  onSocialVisit: (key: string) => void
  onShowShareModal: () => void
  onToggleWalletTooltip: () => void
  onSetPromotionUrl: (v: string) => void
  onSetVideoUrl: (v: string) => void
}

function TaskRow({
  task, submitting, socialVisited, promotionUrl, videoUrl, referralLink, profileHasWallet, showWalletTooltip,
  getTaskName, getTaskDesc, getSocialIcon, tQ, tCommon,
  onComplete, onSocialVisit, onShowShareModal, onToggleWalletTooltip, onSetPromotionUrl, onSetVideoUrl,
}: TaskRowProps) {
  const isGroupTask = task.task_key.startsWith('community_group_')
  const isVideoTask = task.task_key === 'video_review'
  const isPromotionTask = task.task_key === 'promotion_post'
  const isWalletTask = task.task_key === 'wallet_connect'
  const isShareTask = task.task_key === 'copy_referral_link'
  const isSocialTask = task.task_category === 'social'
  const isReferralTask = task.verification_type === 'referral_check'

  const rowBg = task.is_completed ? 'bg-[#00e28a]/[0.03]' : !task.is_unlocked ? 'opacity-40' : ''

  return (
    <div className={`px-4 py-3.5 ${rowBg}`}>
      <div className="flex items-start gap-3">
        {/* Status indicator */}
        <div className="shrink-0 mt-0.5">
          {task.is_completed
            ? <CheckCircle className="w-4 h-4 text-[#00e28a]" />
            : task.is_pending
              ? <div className="w-4 h-4 rounded-full border-2 border-zinc-500 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-zinc-500" /></div>
              : !task.is_unlocked
                ? <Lock className="w-4 h-4 text-zinc-600" />
                : <Circle className="w-4 h-4 text-zinc-600" />}
        </div>

        <div className="flex-1 min-w-0">
          {/* Task name + reward */}
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {isSocialTask && <div className="w-4 h-4 shrink-0">{getSocialIcon(task.task_key)}</div>}
              {isWalletTask && <Wallet className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
              {isGroupTask && <Users className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
              {isReferralTask && <Gift className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
              {isShareTask && <Share2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
              <p className={`font-medium text-sm ${task.is_unlocked ? 'text-white/90' : 'text-zinc-500'}`}>{getTaskName(task)}</p>
              {isWalletTask && (
                <button onClick={onToggleWalletTooltip} className="p-0.5 hover:bg-white/10 rounded-full transition-colors shrink-0">
                  <Info className="w-3 h-3 text-zinc-600 hover:text-zinc-400" />
                </button>
              )}
            </div>
            <p className={`text-xs font-mono shrink-0 ${task.is_completed ? 'text-zinc-600 line-through' : 'text-[#00e28a]'}`}>
              +${task.reward_usd}
            </p>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed">{getTaskDesc(task)}</p>

          {/* Wallet tooltip */}
          {isWalletTask && showWalletTooltip && (
            <div className="mt-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs text-zinc-300 whitespace-pre-wrap">
              <p className="font-medium text-zinc-200 mb-1">{tQ('walletTooltipTitle')}</p>
              {tQ('walletTooltipBody')}
            </div>
          )}

          {/* Referral progress bar */}
          {isReferralTask && task.referral_target > 0 && !task.is_completed && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-500 font-mono">{tQ('referralProgress', { current: task.referral_progress, target: task.referral_target })}</span>
                <span className="text-zinc-600 font-mono">{Math.round((task.referral_progress / task.referral_target) * 100)}%</span>
              </div>
              <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((task.referral_progress / task.referral_target) * 100))}%` }} />
              </div>
            </div>
          )}

          {/* Pending status */}
          {task.is_pending && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              {tQ('waitingReview')}
            </div>
          )}

          {/* Actions */}
          {!task.is_completed && !task.is_pending && task.is_unlocked && (
            <div className="mt-2.5">
              {isSocialTask && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { if (task.social_url) { window.open(task.social_url, '_blank'); onSocialVisit(task.task_key) } }}
                    className="gap-1.5 text-xs">
                    <ExternalLink className="w-3 h-3" />
                    {tQ('visit')}
                  </Button>
                  <Button size="sm" onClick={() => onComplete(task.task_key)}
                    disabled={!socialVisited.has(task.task_key) || submitting === task.task_key}
                    isLoading={submitting === task.task_key}
                    className="text-xs bg-purple-500 hover:bg-purple-400">
                    {tQ('verify')}
                  </Button>
                </div>
              )}

              {isWalletTask && (
                <Button size="sm" onClick={() => onComplete(task.task_key)}
                  disabled={!profileHasWallet || submitting === task.task_key}
                  isLoading={submitting === task.task_key}
                  className="gap-1.5 text-xs bg-purple-500 hover:bg-purple-400">
                  <Wallet className="w-3 h-3" />
                  {tQ('walletConnectBtn')}
                </Button>
              )}

              {isShareTask && (
                <Button size="sm" onClick={() => {
                  onShowShareModal()
                  setTimeout(() => onComplete(task.task_key), 3000)
                }}
                  disabled={submitting === task.task_key}
                  isLoading={submitting === task.task_key}
                  className="gap-1.5 text-xs bg-purple-500 hover:bg-purple-400">
                  <Share2 className="w-3 h-3" />
                  {tQ('shareModalTitle')}
                </Button>
              )}

              {isGroupTask && (
                <div className="space-y-1.5">
                  <p className="text-xs text-zinc-500">{tQ('contactAdminDesc')}</p>
                  <a
                    href={ADMIN_TELEGRAM}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onComplete(task.task_key, undefined, `User is requesting verification for task: ${task.task_key}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.10] text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    <LottieIcon src="/telegram.json" className="w-3.5 h-3.5" />
                    {tQ('contactAdminTelegram')}
                    <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              )}

              {task.verification_type === 'profile_check' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => window.location.href = '/profile'}
                    className="gap-1.5 text-xs">
                    <ExternalLink className="w-3 h-3" />
                    {tQ('goToProfile')}
                  </Button>
                  <Button size="sm" onClick={() => onComplete(task.task_key)}
                    disabled={submitting === task.task_key} isLoading={submitting === task.task_key}
                    className="text-xs bg-purple-500 hover:bg-purple-400">
                    {tQ('claimReward')}
                  </Button>
                </div>
              )}

              {isReferralTask && (
                <Button size="sm" onClick={() => onComplete(task.task_key)}
                  disabled={!task.can_complete || submitting === task.task_key}
                  isLoading={submitting === task.task_key}
                  className={`text-xs ${task.can_complete ? 'bg-purple-500 hover:bg-purple-400' : ''}`}>
                  {task.can_complete ? tQ('claimReward') : tQ('referralProgress', { current: task.referral_progress, target: task.referral_target })}
                </Button>
              )}

              {isPromotionTask && (
                <div className="flex gap-2">
                  <Input placeholder={useTranslations('tasks')('promotion.placeholder')} value={promotionUrl}
                    onChange={e => onSetPromotionUrl(e.target.value)} className="flex-1 text-xs h-8" />
                  <Button size="sm" onClick={() => onComplete(task.task_key, promotionUrl)}
                    disabled={!promotionUrl || submitting === task.task_key}
                    isLoading={submitting === task.task_key}
                    className="bg-purple-500 hover:bg-purple-400">
                    <Send className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {isVideoTask && (
                <div className="flex gap-2">
                  <Input placeholder={useTranslations('tasks')('video.placeholder')} value={videoUrl}
                    onChange={e => onSetVideoUrl(e.target.value)} className="flex-1 text-xs h-8" />
                  <Button size="sm" onClick={() => onComplete(task.task_key, videoUrl)}
                    disabled={!videoUrl || submitting === task.task_key}
                    isLoading={submitting === task.task_key}
                    className="bg-purple-500 hover:bg-purple-400">
                    <Send className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
