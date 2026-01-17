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

      {/* Daily Check-in */}
      {checkinTask && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-zinc-900">{checkinTask.name}</h3>
              <p className="text-sm text-zinc-500">{checkinTask.description}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-emerald-600">+${checkinTask.reward_usd}</p>
              <p className="text-xs text-zinc-500">per day</p>
            </div>
          </div>

          {/* Streak Progress */}
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-zinc-500">7-day streak progress</span>
              <span className="text-sm font-medium text-zinc-700">{progress.current_streak}/7</span>
            </div>
            <div className="flex gap-1">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-full ${
                    i < progress.current_streak ? 'bg-amber-500' : 'bg-zinc-200'
                  }`}
                />
              ))}
            </div>
            {progress.current_streak >= 6 && (
              <p className="text-xs text-amber-600 mt-2">
                <Trophy className="w-3 h-3 inline mr-1" />
                {7 - progress.current_streak === 0 ? 'Claim your $1 bonus!' : `${7 - progress.current_streak} more day for $1 bonus!`}
              </p>
            )}
          </div>

          <Button
            onClick={() => completeTask('daily_checkin')}
            disabled={!checkinTask.can_complete || submitting === 'daily_checkin'}
            isLoading={submitting === 'daily_checkin'}
            className="w-full"
          >
            {checkinTask.can_complete ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Check In Now
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Already Checked In Today
              </>
            )}
          </Button>
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
