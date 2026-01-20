'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

interface ChainStatsData {
  totalStaked: number
  uniqueStakers: number
  totalRewardsPaid: number
  lastUpdated: string
  cached?: boolean
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`
  } else if (num >= 1000) {
    return `$${(num / 1000).toFixed(1)}K`
  }
  return `$${num.toFixed(0)}`
}

function formatCount(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K+`
  }
  return `${num.toLocaleString()}+`
}

export function ChainStats() {
  const t = useTranslations('home')
  const [stats, setStats] = useState<ChainStatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/chain-stats')
        const data = await response.json()
        setStats(data)
      } catch (error) {
        console.error('Failed to fetch chain stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    
    // 每 5 分钟刷新一次（虽然后端缓存 1 小时）
    const interval = setInterval(fetchStats, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // 显示默认值或加载中状态
  const displayStats = {
    totalStaked: stats?.totalStaked || 0,
    uniqueStakers: stats?.uniqueStakers || 0,
    totalRewardsPaid: stats?.totalRewardsPaid || 0,
  }

  return (
    <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
      <div className="glass-card-solid p-8 md:p-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Total Staked (TVL) */}
          <div className="text-center">
            <p className={`text-3xl md:text-4xl font-bold text-white stat-number ${loading ? 'animate-pulse' : ''}`}>
              {loading ? '...' : formatNumber(displayStats.totalStaked)}
            </p>
            <p className="text-sm text-zinc-400 mt-2">{t('stats.totalVolume')}</p>
          </div>
          
          {/* Unique Stakers */}
          <div className="text-center">
            <p className={`text-3xl md:text-4xl font-bold text-white stat-number ${loading ? 'animate-pulse' : ''}`}>
              {loading ? '...' : formatCount(displayStats.uniqueStakers)}
            </p>
            <p className="text-sm text-zinc-400 mt-2">{t('stats.activeUsers')}</p>
          </div>
          
          {/* Average APY */}
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-white percentage">
              365%
            </p>
            <p className="text-sm text-zinc-400 mt-2">{t('stats.avgApy')}</p>
          </div>
          
          {/* Non-Custodial */}
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-white percentage">
              100%
            </p>
            <p className="text-sm text-zinc-400 mt-2">{t('stats.nonCustodial')}</p>
          </div>
        </div>
        
        {/* Last Updated */}
        {stats?.lastUpdated && (
          <p className="text-center text-xs text-zinc-500 mt-6">
            Last updated: {new Date(stats.lastUpdated).toLocaleString()}
          </p>
        )}
      </div>
    </section>
  )
}
