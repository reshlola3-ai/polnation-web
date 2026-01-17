'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  ExternalLink, 
  RefreshCw,
  Settings,
  Eye,
  Video,
  MessageCircle,
  Calendar,
  Share2,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  Users,
  TrendingUp,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface TaskSubmission {
  id: string
  user_id: string
  status: string
  submitted_url: string | null
  submitted_content: string | null
  created_at: string
  updated_at: string
  reward_usd: number
  task_types: {
    task_key: string
    name: string
    reward_usd: number
    task_category: string
  }
  profiles: {
    email: string
    username: string | null
  }
}

interface TaskType {
  id: string
  task_key: string
  name: string
  description: string
  reward_usd: number
  task_category: string
  is_repeatable: boolean
  is_active: boolean
  social_url: string | null
  required_keyword: string | null
}

interface Stats {
  pending_count: number
  completed_today: number
  total_bonus_distributed: number
}

export default function AdminTasksPage() {
  const router = useRouter()
  const [pendingTasks, setPendingTasks] = useState<TaskSubmission[]>([])
  const [recentTasks, setRecentTasks] = useState<TaskSubmission[]>([])
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
  const [stats, setStats] = useState<Stats>({ pending_count: 0, completed_today: 0, total_bonus_distributed: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'recent' | 'config'>('pending')
  const [processing, setProcessing] = useState<string | null>(null)
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null)
  const [editingReward, setEditingReward] = useState<{ id: string; value: string } | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [tasksRes, configRes, statsRes] = await Promise.all([
        fetch('/api/admin/tasks'),
        fetch('/api/admin/tasks?action=config'),
        fetch('/api/admin/tasks?action=stats'),
      ])

      if (tasksRes.status === 401 || configRes.status === 401) {
        router.push('/admin/login')
        return
      }

      const tasksData = await tasksRes.json()
      const configData = await configRes.json()
      const statsData = await statsRes.json()

      setPendingTasks(tasksData.pending || [])
      setRecentTasks(tasksData.recent || [])
      setTaskTypes(configData.taskTypes || [])
      setStats(statsData)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const reviewTask = async (taskId: string, status: 'completed' | 'rejected', note?: string) => {
    setProcessing(taskId)
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review', task_id: taskId, status, note }),
      })

      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to review task:', error)
    } finally {
      setProcessing(null)
    }
  }

  const toggleTaskActive = async (taskTypeId: string) => {
    setProcessing(taskTypeId)
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_active', task_type_id: taskTypeId }),
      })

      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to toggle task:', error)
    } finally {
      setProcessing(null)
    }
  }

  const updateReward = async (taskTypeId: string, newReward: number) => {
    setProcessing(taskTypeId)
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'update_config', 
          task_type_id: taskTypeId, 
          updates: { reward_usd: newReward } 
        }),
      })

      if (res.ok) {
        fetchData()
        setEditingReward(null)
      }
    } catch (error) {
      console.error('Failed to update reward:', error)
    } finally {
      setProcessing(null)
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'social': return <Share2 className="w-4 h-4" />
      case 'promotion': return <MessageCircle className="w-4 h-4" />
      case 'checkin': return <Calendar className="w-4 h-4" />
      case 'video': return <Video className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'social': return 'bg-blue-100 text-blue-600'
      case 'promotion': return 'bg-purple-100 text-purple-600'
      case 'checkin': return 'bg-amber-100 text-amber-600'
      case 'video': return 'bg-red-100 text-red-600'
      default: return 'bg-zinc-100 text-zinc-600'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-zinc-800 rounded w-1/3"></div>
            <div className="h-64 bg-zinc-800 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Task Management</h1>
            <p className="text-zinc-400">Review submissions and configure tasks</p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Pending Review</p>
                <p className="text-2xl font-bold text-white">{stats.pending_count}</p>
              </div>
            </div>
          </div>
          <div className="bg-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Completed Today</p>
                <p className="text-2xl font-bold text-white">{stats.completed_today}</p>
              </div>
            </div>
          </div>
          <div className="bg-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Total Bonus Distributed</p>
                <p className="text-2xl font-bold text-white">${stats.total_bonus_distributed.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-zinc-800 pb-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-2" />
            Pending ({pendingTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'recent'
                ? 'bg-emerald-500 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Recent
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'config'
                ? 'bg-purple-500 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Configuration
          </button>
        </div>

        {/* Pending Tasks */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {pendingTasks.length === 0 ? (
              <div className="bg-zinc-800 rounded-xl p-12 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-white text-lg">No pending tasks</p>
                <p className="text-zinc-400">All submissions have been reviewed</p>
              </div>
            ) : (
              pendingTasks.map(task => (
                <div key={task.id} className="bg-zinc-800 rounded-xl p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getCategoryColor(task.task_types.task_category)}`}>
                        {getCategoryIcon(task.task_types.task_category)}
                      </div>
                      <div>
                        <p className="text-white font-medium">{task.task_types.name}</p>
                        <p className="text-zinc-400 text-sm">
                          {task.profiles.username || task.profiles.email}
                        </p>
                        <p className="text-zinc-500 text-xs mt-1">
                          Submitted {new Date(task.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 font-semibold">${task.reward_usd || task.task_types.reward_usd}</p>
                    </div>
                  </div>

                  {task.submitted_url && (
                    <div className="mt-4 p-3 bg-zinc-900 rounded-lg">
                      <p className="text-zinc-400 text-xs mb-1">Submitted URL:</p>
                      <a
                        href={task.submitted_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 text-sm hover:underline flex items-center gap-1"
                      >
                        {task.submitted_url}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => reviewTask(task.id, 'completed')}
                      disabled={processing === task.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => reviewTask(task.id, 'rejected')}
                      disabled={processing === task.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                    {task.submitted_url && (
                      <a
                        href={task.submitted_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Recent Tasks */}
        {activeTab === 'recent' && (
          <div className="bg-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Task</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Reward</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                {recentTasks.map(task => (
                  <tr key={task.id} className="hover:bg-zinc-700/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getCategoryColor(task.task_types.task_category)}`}>
                          {getCategoryIcon(task.task_types.task_category)}
                        </div>
                        <span className="text-white text-sm">{task.task_types.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-300 text-sm">
                      {task.profiles.username || task.profiles.email}
                    </td>
                    <td className="px-6 py-4">
                      {task.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                          <CheckCircle className="w-3 h-3" />
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                          <XCircle className="w-3 h-3" />
                          Rejected
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-emerald-400 text-sm">
                      ${task.reward_usd || task.task_types.reward_usd}
                    </td>
                    <td className="px-6 py-4 text-zinc-400 text-sm">
                      {new Date(task.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Configuration */}
        {activeTab === 'config' && (
          <div className="space-y-4">
            {taskTypes.map(task => (
              <div key={task.id} className="bg-zinc-800 rounded-xl overflow-hidden">
                <div
                  className="p-6 cursor-pointer hover:bg-zinc-700/50"
                  onClick={() => setExpandedConfig(expandedConfig === task.id ? null : task.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getCategoryColor(task.task_category)}`}>
                        {getCategoryIcon(task.task_category)}
                      </div>
                      <div>
                        <p className="text-white font-medium">{task.name}</p>
                        <p className="text-zinc-400 text-sm">{task.task_key}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleTaskActive(task.id)
                        }}
                        disabled={processing === task.id}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                          task.is_active
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-zinc-700 text-zinc-400'
                        }`}
                      >
                        {task.is_active ? (
                          <>
                            <ToggleRight className="w-4 h-4" />
                            Active
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4" />
                            Disabled
                          </>
                        )}
                      </button>
                      {expandedConfig === task.id ? (
                        <ChevronUp className="w-5 h-5 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-zinc-400" />
                      )}
                    </div>
                  </div>
                </div>

                {expandedConfig === task.id && (
                  <div className="px-6 pb-6 border-t border-zinc-700 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-zinc-400 text-xs mb-1">Description</p>
                        <p className="text-white text-sm">{task.description}</p>
                      </div>
                      <div>
                        <p className="text-zinc-400 text-xs mb-1">Category</p>
                        <p className="text-white text-sm capitalize">{task.task_category}</p>
                      </div>
                      <div>
                        <p className="text-zinc-400 text-xs mb-1">Reward (USD)</p>
                        {editingReward?.id === task.id ? (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="0.1"
                              value={editingReward.value}
                              onChange={(e) => setEditingReward({ id: task.id, value: e.target.value })}
                              className="w-20 px-2 py-1 bg-zinc-900 text-white rounded border border-zinc-700"
                            />
                            <button
                              onClick={() => updateReward(task.id, parseFloat(editingReward.value))}
                              disabled={processing === task.id}
                              className="px-3 py-1 bg-emerald-600 text-white rounded text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingReward(null)}
                              className="px-3 py-1 bg-zinc-700 text-white rounded text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <p
                            className="text-emerald-400 text-sm cursor-pointer hover:underline"
                            onClick={() => setEditingReward({ id: task.id, value: task.reward_usd.toString() })}
                          >
                            ${task.reward_usd} (click to edit)
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-zinc-400 text-xs mb-1">Repeatable</p>
                        <p className="text-white text-sm">{task.is_repeatable ? 'Yes' : 'No'}</p>
                      </div>
                      {task.social_url && (
                        <div className="col-span-2">
                          <p className="text-zinc-400 text-xs mb-1">Social URL</p>
                          <a
                            href={task.social_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 text-sm hover:underline"
                          >
                            {task.social_url}
                          </a>
                        </div>
                      )}
                      {task.required_keyword && (
                        <div>
                          <p className="text-zinc-400 text-xs mb-1">Required Keyword</p>
                          <p className="text-white text-sm">"{task.required_keyword}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
