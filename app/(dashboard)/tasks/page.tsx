'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  CheckCircle, 
  Circle, 
  ExternalLink, 
  Send, 
  Calendar,
  Trophy,
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
      
      // 清空输入
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'social': return <Share2 className="w-5 h-5" />
      case 'promotion': return <MessageCircle className="w-5 h-5" />
      case 'checkin': return <Calendar className="w-5 h-5" />
      case 'video': return <Video className="w-5 h-5" />
      default: return <Gift className="w-5 h-5" />
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
          <div className="h-8 bg-zinc-200 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-zinc-100 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Tasks</h1>
          <p className="text-zinc-500">Complete tasks to increase your unlock progress</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTasks}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Progress Card */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-200 text-sm">Total Task Bonus</p>
            <p className="text-3xl font-bold">${progress.total_task_bonus.toFixed(2)}</p>
            <p className="text-purple-200 text-xs mt-1">Added to your unlock progress</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-5 h-5 text-orange-300" />
              <span className="text-lg font-semibold">{progress.current_streak} day streak</span>
            </div>
            <p className="text-purple-200 text-sm">{progress.total_checkins} total check-ins</p>
          </div>
        </div>
      </div>

      {/* Daily Check-in - 红包签到风格 */}
      {checkinTask && (
        <div className="overflow-hidden rounded-2xl shadow-lg">
          {/* 红包头部 */}
          <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-4 relative">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-2 left-4 w-8 h-8 border-2 border-yellow-300 rounded-full"></div>
              <div className="absolute bottom-2 right-8 w-6 h-6 border-2 border-yellow-300 rounded-full"></div>
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                  <Calendar className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">每日签到</h3>
                  <p className="text-red-100 text-sm">连续签到7天领取红包</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-yellow-300 text-2xl font-bold">{progress.current_streak}</p>
                <p className="text-red-100 text-xs">累计天数</p>
              </div>
            </div>
          </div>

          {/* 红包内容 - 签到进度 */}
          <div className="bg-gradient-to-b from-amber-50 to-orange-50 px-6 py-5">
            {/* 7天签到格子 */}
            <div className="flex items-center justify-between gap-2 mb-4">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const isCompleted = day <= progress.current_streak
                const isToday = day === progress.current_streak + 1
                const isBonus = day === 7

                return (
                  <div key={day} className="flex-1 flex flex-col items-center">
                    {/* 圆点/红包图标 */}
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-all
                      ${isBonus ? (
                        isCompleted 
                          ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-lg scale-110' 
                          : 'bg-gradient-to-br from-red-500 to-red-600 shadow-md'
                      ) : (
                        isCompleted 
                          ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-md' 
                          : isToday 
                            ? 'bg-white border-2 border-red-400 border-dashed'
                            : 'bg-zinc-200'
                      )}
                    `}>
                      {isBonus ? (
                        // 第7天红包图标
                        <div className="text-center">
                          {isCompleted ? (
                            <span className="text-lg">🧧</span>
                          ) : (
                            <Gift className="w-5 h-5 text-yellow-300" />
                          )}
                        </div>
                      ) : isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : isToday ? (
                        <Circle className="w-5 h-5 text-red-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-zinc-400" />
                      )}
                    </div>
                    {/* 天数标签 */}
                    <span className={`text-xs font-medium ${
                      isCompleted ? 'text-red-600' : isToday ? 'text-red-500' : 'text-zinc-400'
                    }`}>
                      {isBonus ? '红包' : `${day}天`}
                    </span>
                    {/* 奖励金额 */}
                    <span className={`text-xs ${
                      isCompleted ? 'text-emerald-600' : 'text-zinc-400'
                    }`}>
                      {isBonus ? '+$1.0' : `+$${checkinTask.reward_usd}`}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* 进度条连接线 */}
            <div className="relative h-1 bg-zinc-200 rounded-full mx-5 -mt-[72px] mb-16">
              <div 
                className="absolute h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (progress.current_streak / 6) * 100)}%` }}
              />
            </div>

            {/* 统计信息 */}
            <div className="flex items-center justify-between text-sm mb-4 px-2">
              <div className="flex items-center gap-1 text-zinc-600">
                <Flame className="w-4 h-4 text-orange-500" />
                <span>累计签到 <span className="font-bold text-red-600">{progress.total_checkins}</span> 天</span>
              </div>
              <div className="text-zinc-600">
                已获得 <span className="font-bold text-emerald-600">${progress.total_task_bonus.toFixed(2)}</span>
              </div>
            </div>

            {/* 签到按钮 */}
            <button
              onClick={() => completeTask('daily_checkin')}
              disabled={!checkinTask.can_complete || submitting === 'daily_checkin'}
              className={`
                w-full py-3 rounded-xl font-bold text-lg transition-all
                ${checkinTask.can_complete 
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]' 
                  : 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                }
              `}
            >
              {submitting === 'daily_checkin' ? (
                <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
              ) : checkinTask.can_complete ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="text-xl">🎁</span>
                  立即签到
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  今日已签到
                </span>
              )}
            </button>

            {/* 提示文字 */}
            {progress.current_streak >= 5 && progress.current_streak < 7 && (
              <p className="text-center text-sm text-red-500 mt-3 font-medium">
                🔥 还差 {7 - progress.current_streak} 天就能领取 $1 红包奖励！
              </p>
            )}
          </div>
        </div>
      )}

      {/* Social Tasks */}
      {socialTasks.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
          <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-500" />
            Social Media Tasks
          </h3>
          <div className="space-y-3">
            {socialTasks.map(task => (
              <div key={task.id} className="flex items-center gap-4 p-4 bg-zinc-50 rounded-xl">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  task.completed_count > 0 ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {getSocialIcon(task.task_key)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-zinc-900">{task.name}</p>
                  <p className="text-sm text-zinc-500">{task.description}</p>
                </div>
                <div className="text-right mr-4">
                  <p className="font-semibold text-emerald-600">+${task.reward_usd}</p>
                </div>
                {task.completed_count > 0 ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm">Done</span>
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
                      Visit
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSocialComplete(task)}
                      disabled={!socialVisited.has(task.task_key) || submitting === task.task_key}
                      isLoading={submitting === task.task_key}
                    >
                      Verify
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
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
          <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-purple-500" />
            Promotion Tasks
          </h3>
          {promotionTasks.map(task => (
            <div key={task.id} className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                  {getCategoryIcon(task.task_category)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-zinc-900">{task.name}</p>
                  <p className="text-sm text-zinc-500">{task.description}</p>
                  <p className="text-xs text-purple-600 mt-1">
                    Completed {task.completed_count} times
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-600">+${task.reward_usd}</p>
                  <p className="text-xs text-zinc-500">per submission</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Paste your post URL here..."
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
                  Submit
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Task */}
      {videoTasks.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
          <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
            <Video className="w-5 h-5 text-red-500" />
            Video Tasks
          </h3>
          {videoTasks.map(task => (
            <div key={task.id} className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
                  <Video className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-zinc-900">{task.name}</p>
                  <p className="text-sm text-zinc-500">{task.description}</p>
                  <p className="text-xs text-red-600 mt-1">
                    Submitted {task.completed_count} times (Manual review required)
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-600">+${task.reward_usd}</p>
                  <p className="text-xs text-zinc-500">after approval</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Paste your video URL (YouTube, TikTok, etc.)..."
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
                  Submit
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
