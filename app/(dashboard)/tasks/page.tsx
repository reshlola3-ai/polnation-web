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
  Mail,
  Lock,
  Loader2,
  X,
  Copy,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

// Dynamically import LottieIcon to avoid SSR issues
const LottieIcon = dynamic(
  () => import('@/components/ui/LottieIcon').then(mod => mod.LottieIcon),
  { ssr: false }
)

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
  completed_count: number
  last_completed: string | null
  can_complete: boolean
}

interface Progress {
  total_task_bonus: number
  current_streak: number
  total_checkins: number
}

// Check if email is a wallet-generated placeholder
function isWalletEmail(email: string | null | undefined): boolean {
  if (!email) return true
  return email.endsWith('@wallet.polnation.com')
}

export default function TasksPage() {
  const t = useTranslations('tasks')
  const tCommon = useTranslations('common')
  const router = useRouter()
  
  const [tasks, setTasks] = useState<Task[]>([])
  const [progress, setProgress] = useState<Progress>({ total_task_bonus: 0, current_streak: 0, total_checkins: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [promotionUrl, setPromotionUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [socialVisited, setSocialVisited] = useState<Set<string>>(new Set())
  
  // Promotion post generator state
  const [showPostModal, setShowPostModal] = useState(false)
  const [referralLink, setReferralLink] = useState('')
  const [postCopied, setPostCopied] = useState(false)
  
  // Email verification state
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [needsEmailBinding, setNeedsEmailBinding] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(true)
  const [bindingEmail, setBindingEmail] = useState('')
  const [bindingPassword, setBindingPassword] = useState('')
  const [bindingPasswordConfirm, setBindingPasswordConfirm] = useState('')
  const [bindingError, setBindingError] = useState('')
  const [bindingSuccess, setBindingSuccess] = useState(false)
  const [isBindingLoading, setIsBindingLoading] = useState(false)

  // Check user email on mount and fetch referral link
  useEffect(() => {
    async function checkUserEmail() {
      setCheckingEmail(true)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user?.email) {
          setUserEmail(user.email)
          setNeedsEmailBinding(isWalletEmail(user.email))
          
          // Fetch referral_code from profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('referral_code')
            .eq('id', user.id)
            .single()
          
          // Use short referral_code if available, fallback to user.id
          const refCode = profile?.referral_code || user.id
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://polnation.com'
          setReferralLink(`${baseUrl}/register?ref=${refCode}`)
        } else {
          setNeedsEmailBinding(true)
        }
      } catch (err) {
        console.error('Error checking email:', err)
        setNeedsEmailBinding(true)
      } finally {
        setCheckingEmail(false)
      }
    }
    
    checkUserEmail()
  }, [])

  // Handle email binding - directly update via admin API
  const handleBindEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setBindingError('')

    // Validate password
    if (bindingPassword.length < 6) {
      setBindingError(t('passwordTooShort'))
      return
    }
    if (bindingPassword !== bindingPasswordConfirm) {
      setBindingError(t('passwordMismatch'))
      return
    }

    setIsBindingLoading(true)

    try {
      const res = await fetch('/api/auth/bind-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: bindingEmail,
          password: bindingPassword
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setBindingError(data.error || 'Failed to bind email')
      } else {
        setBindingSuccess(true)
        // Reload page after short delay to refresh auth state
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      }
    } catch (err) {
      console.error('Error binding email:', err)
      setBindingError('Network error, please try again')
    } finally {
      setIsBindingLoading(false)
    }
  }

  const fetchTasks = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/tasks')
      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks || [])
        setProgress(data.progress || { total_task_bonus: 0, current_streak: 0, total_checkins: 0 })
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Only fetch tasks if email is verified
    if (!needsEmailBinding && !checkingEmail) {
      fetchTasks()
    }
  }, [fetchTasks, needsEmailBinding, checkingEmail])

  const completeTask = async (taskKey: string, submittedUrl?: string) => {
    setSubmitting(taskKey)
    setMessage(null)

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_key: taskKey, submitted_url: submittedUrl }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Handle redirect for profile setup
        if (data.redirect) {
          setMessage({ type: 'error', text: data.error || 'Failed to complete task' })
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

  const handleSocialClick = (task: Task) => {
    if (task.social_url) {
      window.open(task.social_url, '_blank')
      setSocialVisited(prev => new Set(prev).add(task.task_key))
    }
  }

  const handleSocialComplete = (task: Task) => {
    if (socialVisited.has(task.task_key)) {
      completeTask(task.task_key)
    }
  }

  const getSocialIcon = (taskKey: string) => {
    if (taskKey.includes('twitter')) return <LottieIcon src="/x.json" className="w-8 h-8" />
    if (taskKey.includes('telegram')) return <LottieIcon src="/telegram.json" className="w-8 h-8" />
    if (taskKey.includes('whatsapp')) return <img src="/whatsapp.png" alt="WhatsApp" className="w-8 h-8" />
    if (taskKey.includes('facebook')) return <LottieIcon src="/facebook.json" className="w-8 h-8" />
    return <Share2 className="w-8 h-8 text-blue-400" />
  }

  const onboardingTasks = tasks.filter(t => t.task_category === 'onboarding')
  const socialTasks = tasks.filter(t => t.task_category === 'social')
  const promotionTasks = tasks.filter(t => t.task_category === 'promotion')
  const checkinTask = tasks.find(t => t.task_category === 'checkin')
  const videoTasks = tasks.filter(t => t.task_category === 'video')

  // Show loading while checking email
  if (checkingEmail) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-white/5 rounded"></div>
        </div>
      </div>
    )
  }

  // Show email binding UI if needed
  if (needsEmailBinding) {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-purple-500/20 rounded-2xl flex items-center justify-center">
            <Lock className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t('emailRequired')}</h1>
          <p className="text-zinc-400">{t('emailRequiredDesc')}</p>
        </div>

        {/* Binding Form */}
        <div className="glass-card-solid p-6">
          {bindingSuccess ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto bg-green-500/20 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-green-400 font-medium">{t('emailBoundSuccess')}</p>
                <p className="text-zinc-400 text-sm mt-2">
                  {bindingEmail}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-zinc-500 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{t('refreshingPage')}</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleBindEmail} className="space-y-4">
              {bindingError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {bindingError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  {t('yourEmail')}
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={bindingEmail}
                  onChange={(e) => setBindingEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  {t('setPassword')}
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={bindingPassword}
                  onChange={(e) => setBindingPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  required
                  minLength={6}
                />
                <p className="text-xs text-zinc-500 mt-1">{t('passwordHint')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  {t('confirmPassword')}
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={bindingPasswordConfirm}
                  onChange={(e) => setBindingPasswordConfirm(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  required
                  minLength={6}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                isLoading={isBindingLoading}
                disabled={!bindingEmail || !bindingPassword || !bindingPasswordConfirm || isBindingLoading}
              >
                {t('bindEmail')}
              </Button>
            </form>
          )}
        </div>

        {/* Info */}
        <div className="glass-card-solid p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-2">{t('whyEmailRequired')}</h3>
          <ul className="text-xs text-zinc-500 space-y-1.5">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
              <span>{t('reason1')}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
              <span>{t('reason2')}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
              <span>{t('reason3')}</span>
            </li>
          </ul>
        </div>

        {/* Other features still available */}
        <div className="text-center">
          <p className="text-zinc-500 text-xs mb-2">{t('otherFeatures')}</p>
          <div className="flex justify-center gap-3">
            <Link href="/dashboard" className="text-purple-400 text-xs hover:text-purple-300">
              Dashboard
            </Link>
            <Link href="/earnings" className="text-purple-400 text-xs hover:text-purple-300">
              Earnings
            </Link>
            <Link href="/community" className="text-purple-400 text-xs hover:text-purple-300">
              Community
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-white/5 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Mobile optimized */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-white">{t('title')}</h1>
          <p className="text-zinc-400 text-sm md:text-base truncate">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTasks} className="shrink-0">
          <RefreshCw className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">{tCommon('refresh')}</span>
        </Button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Progress Card - Mobile optimized */}
      <div className="relative overflow-hidden rounded-xl md:rounded-2xl p-4 md:p-6 bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-purple-200 text-xs md:text-sm">{t('totalBonus')}</p>
            <p className="text-2xl md:text-3xl font-bold text-white currency">${progress.total_task_bonus.toFixed(2)}</p>
            <p className="text-purple-200 text-[10px] md:text-xs mt-1">{t('addedToProgress')}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center justify-end gap-1.5 md:gap-2 mb-1 md:mb-2">
              <Flame className="w-4 h-4 md:w-5 md:h-5 text-orange-300" />
              <span className="text-base md:text-lg font-semibold text-white stat-number">{progress.current_streak} {t('dayStreak')}</span>
            </div>
            <p className="text-purple-200 text-xs md:text-sm"><span className="stat-number">{progress.total_checkins}</span> {t('totalCheckins')}</p>
          </div>
        </div>
      </div>

      {/* Onboarding Tasks - Profile Setup */}
      {onboardingTasks.length > 0 && onboardingTasks.some(t => t.can_complete) && (
        <div className="glass-card-solid p-4 md:p-6 border-2 border-purple-500/30 bg-gradient-to-r from-purple-900/20 to-indigo-900/20">
          <h3 className="font-semibold text-white mb-3 md:mb-4 flex items-center gap-2 text-sm md:text-base">
            <Gift className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
            {t('onboarding.title')}
            <span className="ml-auto px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full">
              {t('onboarding.newUser')}
            </span>
          </h3>
          <div className="space-y-3">
            {onboardingTasks.map(task => (
              <div key={task.id} className="p-3 md:p-4 bg-white/5 rounded-xl border border-purple-500/20">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    task.completed_count > 0 ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {task.completed_count > 0 ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Gift className="w-5 h-5" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-white text-sm md:text-base">{task.name}</p>
                        <p className="text-xs md:text-sm text-zinc-500 mt-0.5">{task.description}</p>
                      </div>
                      <p className="font-semibold text-emerald-400 currency text-sm md:text-base shrink-0">+${task.reward_usd}</p>
                    </div>
                    
                    <div className="mt-3">
                      {task.completed_count > 0 ? (
                        <div className="flex items-center gap-1.5 text-green-400">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">{t('onboarding.completed')}</span>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push('/profile')}
                            className="flex-1 md:flex-none gap-1.5 text-xs md:text-sm py-2"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {t('onboarding.goToProfile')}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => completeTask(task.task_key)}
                            disabled={submitting === task.task_key}
                            isLoading={submitting === task.task_key}
                            className="flex-1 md:flex-none text-xs md:text-sm py-2"
                          >
                            {t('onboarding.claimReward')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Check-in - Mobile optimized */}
      {checkinTask && (
        <div className="overflow-hidden rounded-xl md:rounded-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 md:px-6 py-3 md:py-4 relative">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-2 left-4 w-6 md:w-8 h-6 md:h-8 border-2 border-cyan-300 rounded-full"></div>
              <div className="absolute bottom-2 right-8 w-4 md:w-6 h-4 md:h-6 border-2 border-purple-300 rounded-full"></div>
            </div>
            <div className="flex items-center justify-between relative z-10 gap-3">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center shadow-lg shrink-0">
                  <Calendar className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-base md:text-lg">{t('checkin.title')}</h3>
                  <p className="text-purple-200 text-xs md:text-sm truncate">{t('checkin.subtitle')}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-cyan-300 text-xl md:text-2xl font-bold stat-number">{progress.current_streak}</p>
                <p className="text-purple-200 text-[10px] md:text-xs">{t('checkin.streakDays')}</p>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-[#1A1333] px-3 md:px-6 py-4 md:py-5 border-x border-b border-purple-500/20">
            {/* Mobile: 7 small circles in a row - Progressive rewards */}
            <div className="flex items-center justify-between mb-4 gap-1">
              {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 1.0].map((reward, index) => {
                const day = index + 1
                const isCompleted = day <= progress.current_streak
                const isToday = day === progress.current_streak + 1
                const isBonus = day === 7

                return (
                  <div key={day} className="flex flex-col items-center flex-1">
                    <div className={`
                      w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center mb-1 transition-all
                      ${isBonus ? (
                        isCompleted 
                          ? 'bg-gradient-to-br from-cyan-400 to-cyan-500 shadow-lg scale-105 md:scale-110' 
                          : 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md'
                      ) : (
                        isCompleted 
                          ? 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md' 
                          : isToday 
                            ? 'bg-white/10 border-2 border-purple-400 border-dashed'
                            : 'bg-white/5'
                      )}
                    `}>
                      {isBonus ? (
                        isCompleted ? (
                          <span className="text-sm md:text-lg">🎉</span>
                        ) : (
                          <Gift className="w-3.5 h-3.5 md:w-5 md:h-5 text-cyan-300" />
                        )
                      ) : isCompleted ? (
                        <CheckCircle className="w-3.5 h-3.5 md:w-5 md:h-5 text-white" />
                      ) : (
                        <span className="text-[10px] md:text-xs text-zinc-500 font-medium">{day}</span>
                      )}
                    </div>
                    <span className={`text-[9px] md:text-xs font-medium ${
                      isCompleted ? 'text-emerald-400' : 'text-zinc-600'
                    }`}>
                      ${reward.toFixed(1)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Stats row */}
            <div className="flex items-center justify-between text-xs md:text-sm mb-3 md:mb-4 px-1 md:px-2">
              <div className="flex items-center gap-1 text-zinc-400">
                <Flame className="w-3.5 h-3.5 md:w-4 md:h-4 text-purple-400" />
                <span className="stat-number">{progress.total_checkins}</span>
                <span className="hidden sm:inline">{t('checkin.totalCheckins')}</span>
              </div>
              <div className="text-zinc-400">
                <span className="hidden sm:inline">{t('checkin.earned')}: </span>
                <span className="font-bold text-emerald-400 currency">${progress.total_task_bonus.toFixed(2)}</span>
              </div>
            </div>

            {/* Check-in Button */}
            <button
              onClick={() => completeTask('daily_checkin')}
              disabled={!checkinTask.can_complete || submitting === 'daily_checkin'}
              className={`
                w-full py-2.5 md:py-3 rounded-xl font-bold text-base md:text-lg transition-all active:scale-[0.98]
                ${checkinTask.can_complete 
                  ? 'btn-gradient text-white shadow-lg' 
                  : 'bg-white/10 text-zinc-500 cursor-not-allowed'
                }
              `}
            >
              {submitting === 'daily_checkin' ? (
                <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
              ) : checkinTask.can_complete ? (
                <span className="flex items-center justify-center gap-2">
                  <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                  {t('checkin.checkInNow')}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                  {t('checkin.checkedIn')}
                </span>
              )}
            </button>

            {progress.current_streak >= 5 && progress.current_streak < 7 && (
              <p className="text-center text-xs md:text-sm text-purple-400 mt-2 md:mt-3 font-medium">
                🔥 {t('checkin.streakBonus', { n: 7 - progress.current_streak })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Social Tasks - Mobile optimized */}
      {socialTasks.length > 0 && (
        <div className="glass-card-solid p-4 md:p-6">
          <h3 className="font-semibold text-white mb-3 md:mb-4 flex items-center gap-2 text-sm md:text-base">
            <Share2 className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
            {t('social.title')}
          </h3>
          <div className="space-y-3">
            {socialTasks.map(task => (
              <div key={task.id} className="p-3 md:p-4 bg-white/5 rounded-xl border border-white/10">
                {/* Mobile: Vertical layout, Desktop: Horizontal */}
                <div className="flex items-start gap-3">
                  {/* Icon - no background box */}
                  <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                    {getSocialIcon(task.task_key)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-white text-sm md:text-base">{task.name}</p>
                        <p className="text-xs md:text-sm text-zinc-500 mt-0.5">{task.description}</p>
                      </div>
                      <p className="font-semibold text-emerald-400 currency text-sm md:text-base shrink-0">+${task.reward_usd}</p>
                    </div>
                    
                    {/* Actions - Full width on mobile */}
                    <div className="mt-3">
                      {task.completed_count > 0 ? (
                        <div className="flex items-center gap-1.5 text-green-400">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">{t('social.done')}</span>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSocialClick(task)}
                            className="flex-1 md:flex-none gap-1.5 text-xs md:text-sm py-2"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {t('social.visit')}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSocialComplete(task)}
                            disabled={!socialVisited.has(task.task_key) || submitting === task.task_key}
                            isLoading={submitting === task.task_key}
                            className="flex-1 md:flex-none text-xs md:text-sm py-2"
                          >
                            {t('social.verify')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Promotion Task - Mobile optimized */}
      {promotionTasks.length > 0 && (
        <div className="glass-card-solid p-4 md:p-6">
          <h3 className="font-semibold text-white mb-3 md:mb-4 flex items-center gap-2 text-sm md:text-base">
            <MessageCircle className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
            {t('promotion.title')}
          </h3>
          {promotionTasks.map(task => (
            <div key={task.id} className="space-y-3 md:space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-400 shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm md:text-base">{task.name}</p>
                      <p className="text-xs md:text-sm text-zinc-500 mt-0.5">{task.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-emerald-400 currency text-sm md:text-base">+${task.reward_usd}</p>
                      <p className="text-[10px] md:text-xs text-zinc-500">{t('promotion.perSubmission')}</p>
                    </div>
                  </div>
                  <p className="text-xs text-purple-400 mt-1">
                    {t('promotion.completed', { n: task.completed_count })}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {/* Generate Post Button */}
                <Button
                  variant="outline"
                  onClick={() => setShowPostModal(true)}
                  className="w-full border-purple-500/30 hover:bg-purple-500/10"
                >
                  <Sparkles className="w-4 h-4 mr-2 text-purple-400" />
                  {t('promotion.generatePost')}
                </Button>
                
                {/* Submit URL */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder={t('promotion.placeholder')}
                    value={promotionUrl}
                    onChange={(e) => setPromotionUrl(e.target.value)}
                    className="flex-1 text-sm"
                  />
                  <Button
                    onClick={() => completeTask(task.task_key, promotionUrl)}
                    disabled={!promotionUrl || submitting === task.task_key}
                    isLoading={submitting === task.task_key}
                    className="w-full sm:w-auto"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {tCommon('submit')}
                  </Button>
                </div>
                
                {/* Contact Support */}
                <a
                  href="https://t.me/polnationsupport"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-xs text-zinc-500 hover:text-purple-400 transition-colors mt-2"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Contact Support
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Task - Mobile optimized */}
      {videoTasks.length > 0 && (
        <div className="glass-card-solid p-4 md:p-6">
          <h3 className="font-semibold text-white mb-3 md:mb-4 flex items-center gap-2 text-sm md:text-base">
            <Video className="w-4 h-4 md:w-5 md:h-5 text-red-400" />
            {t('video.title')}
          </h3>
          {videoTasks.map(task => (
            <div key={task.id} className="space-y-3 md:space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center text-red-400 shrink-0">
                  <Video className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm md:text-base">{task.name}</p>
                      <p className="text-xs md:text-sm text-zinc-500 mt-0.5">{task.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-emerald-400 currency text-sm md:text-base">+${task.reward_usd}</p>
                      <p className="text-[10px] md:text-xs text-zinc-500">{t('video.afterApproval')}</p>
                    </div>
                  </div>
                  <p className="text-xs text-red-400 mt-1">
                    {t('video.submitted', { n: task.completed_count })}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder={t('video.placeholder')}
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="flex-1 text-sm"
                />
                <Button
                  onClick={() => completeTask(task.task_key, videoUrl)}
                  disabled={!videoUrl || submitting === task.task_key}
                  isLoading={submitting === task.task_key}
                  className="w-full sm:w-auto"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {tCommon('submit')}
                </Button>
              </div>
              
              {/* Contact Support */}
              <a
                href="https://t.me/polnationsupport"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs text-zinc-500 hover:text-red-400 transition-colors mt-2"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Contact Support
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Post Generator Modal */}
      {showPostModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowPostModal(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                {t('promotion.shareAndEarn')}
              </h3>
              <button onClick={() => setShowPostModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <div className="bg-zinc-800/50 rounded-xl p-4 mb-4 border border-zinc-700">
              <pre className="text-sm text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">
                {t('promotion.postTemplate', { referralLink: referralLink || 'https://polnation.com/register?ref=YOUR_CODE' })}
              </pre>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const postText = t('promotion.postTemplate', { referralLink: referralLink || 'https://polnation.com/register?ref=YOUR_CODE' })
                  navigator.clipboard.writeText(postText)
                  setPostCopied(true)
                  setTimeout(() => setPostCopied(false), 2000)
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                {postCopied ? t('promotion.copiedSuccess') : t('promotion.copyText')}
              </Button>
              <Button
                className="flex-1 bg-black hover:bg-zinc-800"
                onClick={() => {
                  const postText = t('promotion.postTemplate', { referralLink: referralLink || 'https://polnation.com/register?ref=YOUR_CODE' })
                  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(postText)}`
                  window.open(tweetUrl, '_blank')
                }}
              >
                <Twitter className="w-4 h-4 mr-2" />
                {t('promotion.shareToX')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
