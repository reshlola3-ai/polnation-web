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
import { TwitterVerify } from '@/components/twitter/TwitterVerify'
import { Suspense } from 'react'

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

  // Twitter verification state — true/false/null(loading)
  const [twitterVerified, setTwitterVerified] = useState<boolean | null>(null)
  const [twitterStatusLoaded, setTwitterStatusLoaded] = useState(false)

  // Load referral link + twitter status on mount
  // Run this FIRST (separate from fetchTasks) so the gate shows immediately
  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase
          .from('profiles')
          .select('referral_code, wallet_address, twitter_verified')
          .eq('id', user.id)
          .single()
        const refCode = profile?.referral_code || user.id
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://polnation.com'
        setReferralLink(`${baseUrl}/register?ref=${refCode}`)
        setProfileHasWallet(!!profile?.wallet_address)
        setTwitterVerified(!!profile?.twitter_verified)
      } catch { /* ignore */ }
      finally {
        setTwitterStatusLoaded(true)
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
        if (data.profile?.has_wallet) setProfileHasWallet(true)
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

      {/* Twitter verification gate — show skeleton while loading, gate once loaded */}
      {!twitterStatusLoaded && (
        <div className="glass-card-solid p-4 animate-pulse">
          <div className="h-5 bg-white/10 rounded w-1/3 mb-3" />
          <div className="h-10 bg-white/5 rounded" />
        </div>
      )}

      {twitterStatusLoaded && twitterVerified === false && (
        <Suspense fallback={null}>
          <TwitterVerify />
        </Suspense>
      )}

      {twitterStatusLoaded && twitterVerified !== false && <>

      {/* Progress banner */}
      <div className="relative overflow-hidden rounded-2xl p-4 md:p-6 bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-purple-200 text-xs md:text-sm">{t('totalBonus')}</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl md:text-3xl font-bold text-white currency">${progress.total_task_bonus.toFixed(2)}</p>
              <button onClick={() => setShowBonusModal(true)}
                className="w-5 h-5 rounded-full bg-white/20 text-white/80 hover:bg-white/30 flex items-center justify-center text-xs font-bold">?</button>
            </div>
            <p className="text-purple-200 text-[10px] md:text-xs mt-1">{t('addedToProgress')}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center justify-end gap-1.5 mb-1">
              <Flame className="w-4 h-4 text-orange-300" />
              <span className="text-base font-semibold text-white">{progress.current_streak} {t('dayStreak')}</span>
            </div>
            <p className="text-purple-200 text-xs">{progress.total_checkins} {t('totalCheckins')}</p>
          </div>
        </div>
      </div>

      {/* Daily Check-in */}
      {checkinTask && (
        <div className="overflow-hidden rounded-2xl">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 md:px-6 py-3 md:py-4 relative">
            <div className="flex items-center justify-between relative z-10 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">{t('checkin.title')}</h3>
                  <p className="text-purple-200 text-xs">{t('checkin.subtitle')}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-white/85 text-xl font-bold">{progress.current_streak}</p>
                <p className="text-purple-200 text-[10px]">{t('checkin.streakDays')}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1A1333] px-3 md:px-6 py-4 border-x border-b border-purple-500/20">
            <div className="flex items-center justify-between mb-4 gap-1">
              {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 1.0].map((reward, index) => {
                const day = index + 1
                const isCompleted = day <= progress.current_streak
                const isToday = day === progress.current_streak + 1
                const isBonus = day === 7
                return (
                  <div key={day} className="flex flex-col items-center flex-1">
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center mb-1 transition-all ${
                      isBonus
                        ? (isCompleted ? 'bg-[#00e28a] shadow-lg scale-110' : 'bg-[var(--poly-purple)]')
                        : (isCompleted ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : isToday ? 'bg-white/10 border-2 border-purple-400 border-dashed' : 'bg-white/5')
                    }`}>
                      {isBonus ? (isCompleted ? <span className="text-sm">🎉</span> : <Gift className="w-4 h-4 text-white/50" />)
                        : isCompleted ? <CheckCircle className="w-4 h-4 text-white" />
                        : <span className="text-[10px] text-zinc-500 font-medium">{day}</span>}
                    </div>
                    <span className={`text-[9px] font-medium ${isCompleted ? 'text-[#00e28a]' : 'text-zinc-600'}`}>${reward.toFixed(1)}</span>
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => completeTask('daily_checkin')}
              disabled={!checkinTask.can_complete || submitting === 'daily_checkin'}
              className={`w-full py-2.5 rounded-xl font-bold text-base transition-all active:scale-[0.98] ${
                checkinTask.can_complete ? 'btn-gradient text-white shadow-lg' : 'bg-white/10 text-zinc-500 cursor-not-allowed'
              }`}
            >
              {submitting === 'daily_checkin' ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
                : checkinTask.can_complete
                  ? <span className="flex items-center justify-center gap-2"><Calendar className="w-4 h-4" />{t('checkin.checkInNow')}</span>
                  : <span className="flex items-center justify-center gap-2"><CheckCircle className="w-4 h-4" />{t('checkin.checkedIn')}</span>}
            </button>
            {progress.current_streak >= 5 && progress.current_streak < 7 && (
              <p className="text-center text-xs text-purple-400 mt-2">
                🔥 {t('checkin.streakBonus', { n: 7 - progress.current_streak })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Quest Chapters ─────────────────────────────────────────────── */}
      {chapters.map((chapter) => {
        const color = getChapterColor(chapter.group)
        const isExpanded = expandedChapter === chapter.group
        const progressPct = chapter.total > 0 ? Math.round((chapter.completed / chapter.total) * 100) : 0

        return (
          <div key={chapter.group} className={`rounded-2xl border ${color.border} overflow-hidden`}>
            {/* Chapter header */}
            <button
              className={`w-full bg-gradient-to-r ${color.bg} px-4 md:px-6 py-4 flex items-center gap-3 ${!chapter.is_accessible ? 'opacity-60' : ''}`}
              onClick={() => {
                if (!chapter.is_accessible) return
                setExpandedChapter(isExpanded ? null : chapter.group)
              }}
            >
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-white shrink-0">
                {chapter.is_complete ? <CheckCircle className="w-5 h-5" /> : !chapter.is_accessible ? <Lock className="w-5 h-5" /> : getChapterIcon(chapter.group)}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-bold text-white text-sm md:text-base truncate">{getChapterTitle(chapter.group)}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-white/70 text-xs">{tQ('chapterProgress', { done: chapter.completed, total: chapter.total })}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${color.badge}`}>{getChapterBonus(chapter.group)}</span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-16 hidden sm:block">
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white/80 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                </div>
                <p className="text-white/60 text-[10px] text-right mt-0.5">{progressPct}%</p>
              </div>
              {chapter.is_accessible && (isExpanded ? <ChevronUp className="w-4 h-4 text-white/70 shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/70 shrink-0" />)}
              {!chapter.is_accessible && <Lock className="w-4 h-4 text-white/40 shrink-0" />}
            </button>

            {/* Locked message */}
            {!chapter.is_accessible && (
              <div className="bg-[#1A1333] px-4 py-3 border-t border-white/5 text-center">
                <p className="text-zinc-500 text-sm flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  {tQ('chapterLocked', { n: chapter.index - 1 })}
                </p>
              </div>
            )}

            {/* Chapter tasks */}
            {chapter.is_accessible && isExpanded && (
              <div className="bg-[#1A1333] divide-y divide-white/5">
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

                {/* Chapter completion banner */}
                {chapter.is_complete && (
                  <div className="px-4 py-3 bg-white/[0.04] flex items-center justify-center gap-2">
                    <Trophy className="w-4 h-4 text-[#00e28a]" />
                    <span className="text-[#00e28a] text-sm font-medium">{tQ('chapterComplete')} {getChapterBonus(chapter.group)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Referral bonus card */}
      <div className="glass-card-solid p-4 md:p-6 border border-[#00e28a]/20 bg-[#00e28a]/[0.04]">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2 text-sm md:text-base">
          <Gift className="w-4 h-4 text-[#00e28a]" />
          {t('referral.title')}
          <span className="px-2 py-0.5 bg-[#00e28a]/[0.10] text-[#00e28a]/80 text-[10px] rounded-full">{t('referral.autoTag')}</span>
        </h3>
        <div className="p-3 md:p-4 bg-white/[0.04] rounded-xl border border-[#00e28a]/15">
          <p className="text-xs text-zinc-500 mb-3">{t('referral.description')}</p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-zinc-500">{t('referral.available')}</p>
                <p className="text-lg font-bold text-[#00e28a]">${referralBonus.pending.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">{t('referral.referrals')}</p>
                <p className="text-lg font-bold text-white">{referralBonus.count}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">{t('referral.claimed')}</p>
                <p className="text-lg font-bold text-zinc-400">${referralBonus.claimed.toFixed(2)}</p>
              </div>
            </div>
            <Button onClick={claimReferralBonus} disabled={referralBonus.pending <= 0 || claimingReferral}
              isLoading={claimingReferral} className="sm:ml-auto bg-[var(--poly-purple)] hover:bg-[var(--poly-purple-hover)]">
              <Gift className="w-4 h-4 mr-2" />
              {t('referral.claimAmount', { amount: referralBonus.pending.toFixed(2) })}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Share Modal ─────────────────────────────────────────────────── */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowShareModal(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-purple-400" />
                {tQ('shareModalTitle')}
              </h3>
              <button onClick={() => setShowShareModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Referral link */}
            <div className="mb-4">
              <label className="text-xs text-zinc-400 mb-1.5 block">{tQ('shareModalLinkLabel')}</label>
              <div className="flex gap-2">
                <div className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 truncate">{referralLink}</div>
                <Button size="sm" variant="outline" onClick={() => {
                  navigator.clipboard.writeText(referralLink)
                  setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000)
                }}>
                  <Copy className="w-4 h-4 mr-1" />
                  {linkCopied ? tQ('copied') : tQ('copyLink')}
                </Button>
              </div>
            </div>

            {/* Ad copy */}
            <div className="mb-4">
              <label className="text-xs text-zinc-400 mb-1.5 block">{tQ('shareModalAdCopy')}</label>
              <div className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700">
                <pre className="text-sm text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">{getAdText()}</pre>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => {
                navigator.clipboard.writeText(getAdText())
                setAllCopied(true); setTimeout(() => setAllCopied(false), 2000)
              }}>
                <Copy className="w-4 h-4 mr-2" />
                {allCopied ? tQ('copied') : tQ('copyAll')}
              </Button>
              <Button className="flex-1 bg-black hover:bg-zinc-800" onClick={() => {
                const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(getAdText())}`
                window.open(tweetUrl, '_blank')
              }}>
                <Twitter className="w-4 h-4 mr-2" />
                {tQ('shareToX')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bonus Breakdown Modal ───────────────────────────────────────── */}
      {showBonusModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowBonusModal(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{t('bonusModal.title')}</h3>
              <button onClick={() => setShowBonusModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              {Object.entries({
                checkin: t('bonusModal.checkin'),
                social: t('bonusModal.social'),
                onboarding: t('bonusModal.profileSetup'),
                promotion: t('bonusModal.promotion'),
                video: t('bonusModal.videoReview'),
                community: t('bonusModal.community'),
                referral: t('bonusModal.referralBonus'),
              }).filter(([k]) => (bonusBreakdown[k] || 0) > 0).map(([k, label]) => (
                <div key={k} className="flex justify-between text-zinc-300">
                  <span>{label}</span>
                  <span className="text-[#00e28a]">${(bonusBreakdown[k] || 0).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-zinc-700 pt-2 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-xs">Total</span>
                  <span className="text-lg font-bold text-[#00e28a]">${progress.total_task_bonus.toFixed(2)}</span>
                </div>
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

  const statusColor = task.is_completed ? 'text-[#00e28a]' : task.is_pending ? 'text-white/55' : !task.is_unlocked ? 'text-zinc-600' : 'text-zinc-400'
  const rowBg = task.is_completed ? 'bg-[#00e28a]/[0.04]' : task.is_pending ? 'bg-white/[0.03]' : !task.is_unlocked ? 'opacity-50' : ''

  return (
    <div className={`px-4 py-4 ${rowBg}`}>
      <div className="flex items-start gap-3">
        {/* Step indicator */}
        <div className="shrink-0 mt-0.5">
          {task.is_completed
            ? <CheckCircle className="w-5 h-5 text-green-400" />
            : task.is_pending
              ? <div className="w-5 h-5 rounded-full border-2 border-white/50 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white/50" /></div>
              : !task.is_unlocked
                ? <Lock className="w-5 h-5 text-zinc-600" />
                : <Circle className="w-5 h-5 text-zinc-500" />}
        </div>

        <div className="flex-1 min-w-0">
          {/* Task name + reward */}
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Social icon */}
              {isSocialTask && (
                <div className="w-5 h-5 shrink-0">{getSocialIcon(task.task_key)}</div>
              )}
              {isWalletTask && <Wallet className="w-4 h-4 text-indigo-400 shrink-0" />}
              {isGroupTask && <Users className="w-4 h-4 text-white/45 shrink-0" />}
              {isReferralTask && <Gift className="w-4 h-4 text-[#00e28a] shrink-0" />}
              {isShareTask && <Share2 className="w-4 h-4 text-purple-400 shrink-0" />}
              <p className={`font-medium text-sm ${task.is_unlocked ? 'text-white' : 'text-zinc-500'}`}>{getTaskName(task)}</p>
              {/* Wallet tooltip trigger */}
              {isWalletTask && (
                <button onClick={onToggleWalletTooltip} className="p-0.5 hover:bg-white/10 rounded-full transition-colors">
                  <Info className="w-3.5 h-3.5 text-zinc-400 hover:text-indigo-400" />
                </button>
              )}
            </div>
            <p className={`font-semibold text-sm shrink-0 ${task.is_completed ? 'text-zinc-500 line-through' : 'text-[#00e28a]'}`}>
              +${task.reward_usd}
            </p>
          </div>

          <p className="text-xs text-zinc-500">{getTaskDesc(task)}</p>

          {/* Wallet tooltip */}
          {isWalletTask && showWalletTooltip && (
            <div className="mt-2 p-3 bg-indigo-900/30 border border-indigo-500/30 rounded-lg text-xs text-indigo-200 whitespace-pre-wrap">
              <p className="font-semibold text-indigo-300 mb-1">{tQ('walletTooltipTitle')}</p>
              {tQ('walletTooltipBody')}
            </div>
          )}

          {/* Referral progress bar */}
          {isReferralTask && task.referral_target > 0 && !task.is_completed && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-400">{tQ('referralProgress', { current: task.referral_progress, target: task.referral_target })}</span>
                <span className="text-zinc-500">{Math.round((task.referral_progress / task.referral_target) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-[#00e28a] rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((task.referral_progress / task.referral_target) * 100))}%` }} />
              </div>
            </div>
          )}

          {/* Pending status */}
          {task.is_pending && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-white/55">
              <Loader2 className="w-3 h-3 animate-spin" />
              {tQ('waitingReview')}
            </div>
          )}

          {/* Actions */}
          {!task.is_completed && !task.is_pending && task.is_unlocked && (
            <div className="mt-3">
              {/* Social task buttons */}
              {isSocialTask && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { if (task.social_url) { window.open(task.social_url, '_blank'); onSocialVisit(task.task_key) } }}
                    className="gap-1.5 text-xs py-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    {tQ('visit')}
                  </Button>
                  <Button size="sm" onClick={() => onComplete(task.task_key)}
                    disabled={!socialVisited.has(task.task_key) || submitting === task.task_key}
                    isLoading={submitting === task.task_key}
                    className="text-xs py-1.5">
                    {tQ('verify')}
                  </Button>
                </div>
              )}

              {/* Wallet task */}
              {isWalletTask && (
                <Button size="sm" onClick={() => onComplete(task.task_key)}
                  disabled={!profileHasWallet || submitting === task.task_key}
                  isLoading={submitting === task.task_key}
                  className="gap-2 text-xs py-1.5 bg-indigo-600 hover:bg-indigo-500">
                  <Wallet className="w-3.5 h-3.5" />
                  {profileHasWallet ? tQ('walletConnectBtn') : tQ('walletConnectBtn')}
                </Button>
              )}

              {/* Share task — open modal, then auto-complete */}
              {isShareTask && (
                <Button size="sm" onClick={() => {
                  onShowShareModal()
                  // Auto-complete after delay when modal is opened
                  setTimeout(() => onComplete(task.task_key), 3000)
                }}
                  disabled={submitting === task.task_key}
                  isLoading={submitting === task.task_key}
                  className="gap-2 text-xs py-1.5 bg-purple-600 hover:bg-purple-500">
                  <Share2 className="w-3.5 h-3.5" />
                  {tQ('shareModalTitle')}
                </Button>
              )}

              {/* Group task: contact admin */}
              {isGroupTask && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">{tQ('contactAdminDesc')}</p>
                  <a
                    href={ADMIN_TELEGRAM}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      // Submit notification to API
                      onComplete(task.task_key, undefined, `User is requesting verification for task: ${task.task_key}`)
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    <LottieIcon src="/telegram.json" className="w-4 h-4" />
                    {tQ('contactAdminTelegram')}
                    <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Profile setup */}
              {task.verification_type === 'profile_check' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => window.location.href = '/profile'}
                    className="gap-1.5 text-xs py-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    {tQ('goToProfile')}
                  </Button>
                  <Button size="sm" onClick={() => onComplete(task.task_key)}
                    disabled={submitting === task.task_key} isLoading={submitting === task.task_key}
                    className="text-xs py-1.5">
                    {tQ('claimReward')}
                  </Button>
                </div>
              )}

              {/* Referral milestone */}
              {isReferralTask && (
                <Button size="sm" onClick={() => onComplete(task.task_key)}
                  disabled={!task.can_complete || submitting === task.task_key}
                  isLoading={submitting === task.task_key}
                  className={`text-xs py-1.5 ${task.can_complete ? 'bg-[var(--poly-purple)] hover:bg-[var(--poly-purple-hover)]' : ''}`}>
                  {task.can_complete ? tQ('claimReward') : tQ('referralProgress', { current: task.referral_progress, target: task.referral_target })}
                </Button>
              )}

              {/* Promotion task */}
              {isPromotionTask && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input placeholder={useTranslations('tasks')('promotion.placeholder')} value={promotionUrl}
                      onChange={e => onSetPromotionUrl(e.target.value)} className="flex-1 text-xs h-8" />
                    <Button size="sm" onClick={() => onComplete(task.task_key, promotionUrl)}
                      disabled={!promotionUrl || submitting === task.task_key}
                      isLoading={submitting === task.task_key}>
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Video task */}
              {isVideoTask && (
                <div className="flex gap-2">
                  <Input placeholder={useTranslations('tasks')('video.placeholder')} value={videoUrl}
                    onChange={e => onSetVideoUrl(e.target.value)} className="flex-1 text-xs h-8" />
                  <Button size="sm" onClick={() => onComplete(task.task_key, videoUrl)}
                    disabled={!videoUrl || submitting === task.task_key}
                    isLoading={submitting === task.task_key}>
                    <Send className="w-3.5 h-3.5" />
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
