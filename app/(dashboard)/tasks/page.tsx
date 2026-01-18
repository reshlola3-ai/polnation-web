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
  Gift
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useTranslations } from 'next-intl'

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

export default function TasksPage() {
  const t = useTranslations('tasks')
  const tCommon = useTranslations('common')
  
  const [tasks, setTasks] = useState<Task[]>([])
  const [progress, setProgress] = useState<Progress>({ total_task_bonus: 0, current_streak: 0, total_checkins: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [promotionUrl, setPromotionUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [socialVisited, setSocialVisited] = useState<Set<string>>(new Set())

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
    fetchTasks()
  }, [fetchTasks])

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
    if (taskKey.includes('twitter')) return <Twitter className="w-5 h-5" />
    if (taskKey.includes('telegram')) return <MessageCircle className="w-5 h-5" />
    if (taskKey.includes('discord')) return <MessageCircle className="w-5 h-5" />
    return <Share2 className="w-5 h-5" />
  }

  const socialTasks = tasks.filter(t => t.task_category === 'social')
  const promotionTasks = tasks.filter(t => t.task_category === 'promotion')
  const checkinTask = tasks.find(t => t.task_category === 'checkin')
  const videoTasks = tasks.filter(t => t.task_category === 'video')

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
          <p className="text-zinc-400">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTasks}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {tCommon('refresh')}
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

      {/* Progress Card */}
      <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-purple-200 text-sm">{t('totalBonus')}</p>
            <p className="text-3xl font-bold text-white currency">${progress.total_task_bonus.toFixed(2)}</p>
            <p className="text-purple-200 text-xs mt-1">{t('addedToProgress')}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-5 h-5 text-orange-300" />
              <span className="text-lg font-semibold text-white stat-number">{progress.current_streak} {t('dayStreak')}</span>
            </div>
            <p className="text-purple-200 text-sm"><span className="stat-number">{progress.total_checkins}</span> {t('totalCheckins')}</p>
          </div>
        </div>
      </div>

      {/* Daily Check-in */}
      {checkinTask && (
        <div className="overflow-hidden rounded-2xl">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 relative">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-2 left-4 w-8 h-8 border-2 border-cyan-300 rounded-full"></div>
              <div className="absolute bottom-2 right-8 w-6 h-6 border-2 border-purple-300 rounded-full"></div>
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center shadow-lg">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{t('checkin.title')}</h3>
                  <p className="text-purple-200 text-sm">{t('checkin.subtitle')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-cyan-300 text-2xl font-bold stat-number">{progress.current_streak}</p>
                <p className="text-purple-200 text-xs">{t('checkin.streakDays')}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#1A1333] px-6 py-5 border-x border-b border-purple-500/20">
            <div className="flex items-center mb-4">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const isCompleted = day <= progress.current_streak
                const isToday = day === progress.current_streak + 1
                const isBonus = day === 7
                const lineCompleted = day < progress.current_streak

                return (
                  <div key={day} className="flex-1 flex items-center">
                    <div className="flex flex-col items-center">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-all
                        ${isBonus ? (
                          isCompleted 
                            ? 'bg-gradient-to-br from-cyan-400 to-cyan-500 shadow-lg scale-110 glow-purple-sm' 
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
                          <div className="text-center">
                            {isCompleted ? (
                              <span className="text-lg">🎉</span>
                            ) : (
                              <Gift className="w-5 h-5 text-cyan-300" />
                            )}
                          </div>
                        ) : isCompleted ? (
                          <CheckCircle className="w-5 h-5 text-white" />
                        ) : isToday ? (
                          <Circle className="w-5 h-5 text-purple-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-zinc-600" />
                        )}
                      </div>
                      <span className={`text-xs font-medium ${
                        isCompleted ? 'text-purple-400' : isToday ? 'text-purple-300' : 'text-zinc-600'
                      }`}>
                        {isBonus ? t('checkin.bonus') : `Day ${day}`}
                      </span>
                      <span className={`text-xs currency ${
                        isCompleted ? 'text-emerald-400' : 'text-zinc-600'
                      }`}>
                        {isBonus ? '+$1.0' : `+$${checkinTask.reward_usd}`}
                      </span>
                    </div>
                    
                    {day < 7 && (
                      <div className={`flex-1 h-1 mx-1 rounded-full transition-all duration-300 ${
                        lineCompleted 
                          ? 'bg-gradient-to-r from-purple-500 to-indigo-500' 
                          : 'bg-white/10'
                      }`} style={{ marginTop: '-32px' }} />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between text-sm mb-4 px-2">
              <div className="flex items-center gap-1 text-zinc-400">
                <Flame className="w-4 h-4 text-purple-400" />
                <span>{t('checkin.totalCheckins')}: <span className="font-bold text-purple-400 stat-number">{progress.total_checkins}</span></span>
              </div>
              <div className="text-zinc-400">
                {t('checkin.earned')}: <span className="font-bold text-emerald-400 currency">${progress.total_task_bonus.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => completeTask('daily_checkin')}
              disabled={!checkinTask.can_complete || submitting === 'daily_checkin'}
              className={`
                w-full py-3 rounded-xl font-bold text-lg transition-all
                ${checkinTask.can_complete 
                  ? 'btn-gradient text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] glow-purple' 
                  : 'bg-white/10 text-zinc-500 cursor-not-allowed'
                }
              `}
            >
              {submitting === 'daily_checkin' ? (
                <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
              ) : checkinTask.can_complete ? (
                <span className="flex items-center justify-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {t('checkin.checkInNow')}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  {t('checkin.checkedIn')}
                </span>
              )}
            </button>

            {progress.current_streak >= 5 && progress.current_streak < 7 && (
              <p className="text-center text-sm text-purple-400 mt-3 font-medium">
                🔥 {t('checkin.streakBonus', { n: 7 - progress.current_streak })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Social Tasks */}
      {socialTasks.length > 0 && (
        <div className="glass-card-solid p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-400" />
            {t('social.title')}
          </h3>
          <div className="space-y-3">
            {socialTasks.map(task => (
              <div key={task.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  task.completed_count > 0 ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {getSocialIcon(task.task_key)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{task.name}</p>
                  <p className="text-sm text-zinc-500">{task.description}</p>
                </div>
                <div className="text-right mr-4">
                  <p className="font-semibold text-emerald-400 currency">+${task.reward_usd}</p>
                </div>
                {task.completed_count > 0 ? (
                  <div className="flex items-center gap-1 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm">{t('social.done')}</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSocialClick(task)}
                      className="gap-1"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t('social.visit')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSocialComplete(task)}
                      disabled={!socialVisited.has(task.task_key) || submitting === task.task_key}
                      isLoading={submitting === task.task_key}
                    >
                      {t('social.verify')}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Promotion Task */}
      {promotionTasks.length > 0 && (
        <div className="glass-card-solid p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-purple-400" />
            {t('promotion.title')}
          </h3>
          {promotionTasks.map(task => (
            <div key={task.id} className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-400">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{task.name}</p>
                  <p className="text-sm text-zinc-500">{task.description}</p>
                  <p className="text-xs text-purple-400 mt-1">
                    {t('promotion.completed', { n: task.completed_count })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-400 currency">+${task.reward_usd}</p>
                  <p className="text-xs text-zinc-500">{t('promotion.perSubmission')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={t('promotion.placeholder')}
                  value={promotionUrl}
                  onChange={(e) => setPromotionUrl(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() => completeTask(task.task_key, promotionUrl)}
                  disabled={!promotionUrl || submitting === task.task_key}
                  isLoading={submitting === task.task_key}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {tCommon('submit')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Task */}
      {videoTasks.length > 0 && (
        <div className="glass-card-solid p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Video className="w-5 h-5 text-red-400" />
            {t('video.title')}
          </h3>
          {videoTasks.map(task => (
            <div key={task.id} className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center text-red-400">
                  <Video className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{task.name}</p>
                  <p className="text-sm text-zinc-500">{task.description}</p>
                  <p className="text-xs text-red-400 mt-1">
                    {t('video.submitted', { n: task.completed_count })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-400 currency">+${task.reward_usd}</p>
                  <p className="text-xs text-zinc-500">{t('video.afterApproval')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={t('video.placeholder')}
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() => completeTask(task.task_key, videoUrl)}
                  disabled={!videoUrl || submitting === task.task_key}
                  isLoading={submitting === task.task_key}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {tCommon('submit')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
