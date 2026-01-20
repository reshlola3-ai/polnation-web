'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink } from 'lucide-react'

interface Transaction {
  hash: string
  from: string
  to: string
  value: string
  asset: string
  timestamp: string
}

interface ChainStatsData {
  totalValue: number
  uniqueAddresses: number
  latestTransactions: Transaction[]
  poolAddress: string
  lastUpdated: string
  cached?: boolean
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(2)}M`
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

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatTimeAgo(timestamp: string): string {
  if (!timestamp) return ''
  const now = new Date()
  const time = new Date(timestamp)
  const diff = Math.floor((now.getTime() - time.getTime()) / 1000)
  
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
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
    
    // 每 5 分钟刷新一次
    const interval = setInterval(fetchStats, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
      {/* Stats Cards */}
      <div className="glass-card-solid p-8 md:p-12 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Total Value Locked */}
          <div className="text-center">
            <p className={`text-3xl md:text-4xl font-bold text-white stat-number ${loading ? 'animate-pulse' : ''}`}>
              {loading ? '...' : formatNumber(stats?.totalValue || 0)}
            </p>
            <p className="text-sm text-zinc-400 mt-2">{t('stats.totalVolume')}</p>
          </div>
          
          {/* Unique Addresses */}
          <div className="text-center">
            <p className={`text-3xl md:text-4xl font-bold text-white stat-number ${loading ? 'animate-pulse' : ''}`}>
              {loading ? '...' : formatCount(stats?.uniqueAddresses || 0)}
            </p>
            <p className="text-sm text-zinc-400 mt-2">{t('stats.activeUsers')}</p>
          </div>
          
          {/* APY */}
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
      </div>

      {/* Latest Transactions */}
      {stats?.latestTransactions && stats.latestTransactions.length > 0 && (
        <div className="glass-card-solid p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Latest Transactions</h3>
            <a 
              href={`https://polygonscan.com/address/${stats.poolAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              View All <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          
          <div className="space-y-3">
            {stats.latestTransactions.map((tx, index) => (
              <a
                key={tx.hash || index}
                href={`https://polygonscan.com/tx/${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <span className="text-xs text-purple-400">TX</span>
                  </div>
                  <div>
                    <p className="text-sm text-white font-mono">
                      {shortenAddress(tx.from)} → Pool
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatTimeAgo(tx.timestamp)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white font-mono">
                    {tx.value} {tx.asset}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Last Updated */}
      {stats?.lastUpdated && (
        <p className="text-center text-xs text-zinc-500 mt-6">
          Data from{' '}
          <a 
            href={`https://polygonscan.com/address/${stats.poolAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:underline"
          >
            PolygonScan
          </a>
          {' '}• Updated: {new Date(stats.lastUpdated).toLocaleString()}
        </p>
      )}
    </section>
  )
}
