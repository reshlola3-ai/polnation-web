'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import {
  Shield, RefreshCw, CheckCircle, XCircle, AlertTriangle, X,
  Crown, ArrowLeft, Lock, Unlock, ExternalLink,
} from 'lucide-react'

interface ClaimItem {
  id: string
  user_id: string
  username: string | null
  email: string | null
  wallet_address: string | null
  level: number
  level_name: string
  amount: number
  status: string
  claimed_at: string
  reviewed_at: string | null
  rejected_reason: string | null
  real_name: string | null
  phone: string | null
  photo_url: string | null
  same_name_count: number
  claims_frozen: boolean
  staking_ratio?: number | null
  team_volume_live?: number | null
  staked_volume?: number | null
}

interface MaintenanceItem {
  id: string
  user_id: string
  username: string | null
  email: string | null
  level: number
  level_name: string
  amount: number
  required_days: number
  days_done: number
  threshold: number
  started_at: string | null
  staking_ratio: number | null
  admin_paused: boolean
}

interface InstallmentItem {
  id: string
  user_id: string
  username: string | null
  email: string | null
  level: number
  level_name: string
  amount: number
  total_days: number
  days_done: number
  released: number
  daily_amount: number
  started_at: string | null
  frozen?: boolean
}

interface LockedItem {
  user_id: string
  username: string | null
  email: string | null
  level: number
  is_admin_set: boolean
  is_influencer: boolean
  locked: number
}

interface UnlockItem {
  id: string
  user_id: string
  username: string | null
  email: string | null
  wallet_address: string | null
  requested_amount: number
  credited_amount: number | null
  current_locked: number | null
  status: string
  rejected_reason: string | null
  created_at: string
  reviewed_at: string | null
}

export default function AdminClaimsPage() {
  const router = useRouter()
  const [pending, setPending] = useState<ClaimItem[]>([])
  const [recent, setRecent] = useState<ClaimItem[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([])
  const [maintDays, setMaintDays] = useState<Record<string, string>>({})
  const [installment, setInstallment] = useState<InstallmentItem[]>([])
  const [instDays, setInstDays] = useState<Record<string, string>>({})
  const [locked, setLocked] = useState<LockedItem[]>([])
  const [lockRelease, setLockRelease] = useState<Record<string, string>>({})
  const [unlockAmt, setUnlockAmt] = useState<Record<string, string>>({})
  const [unlockPending, setUnlockPending] = useState<UnlockItem[]>([])
  const [unlockRecent, setUnlockRecent] = useState<UnlockItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/community/claims')
      if (res.status === 401) { router.push('/admin/login'); return }
      const data = await res.json()
      setPending(data.pending || [])
      setRecent(data.recent || [])
      setMaintenance(data.maintenance || [])
      setInstallment(data.installment || [])
      setLocked(data.locked || [])
      setUnlockPending(data.unlockPending || [])
      setUnlockRecent(data.unlockRecent || [])
    } catch {
      setError('Failed to fetch claims')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  const act = async (body: Record<string, unknown>, key: string) => {
    setProcessing(key)
    setError(''); setSuccess('')
    try {
      const res = await fetch('/api/admin/community/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Operation failed'); return }
      setSuccess(data.message || 'Done')
      fetchData()
    } catch {
      setError('Network error')
    } finally {
      setProcessing(null)
    }
  }

  const approve = (c: ClaimItem) => act({ action: 'approve', claim_id: c.id }, c.id)
  const reject = (c: ClaimItem) => {
    const reason = prompt('驳回理由（会显示给用户，不冻结账号）：') ?? ''
    act({ action: 'reject', claim_id: c.id, reason }, c.id)
  }
  const approveMaintenance = (c: ClaimItem) => {
    const d = Math.max(1, Math.round(Number(maintDays[c.id] || 15)))
    act({ action: 'approve_maintenance', claim_id: c.id, days: d }, c.id)
  }
  const approveInstallment = (c: ClaimItem) => {
    const d = Math.max(1, Math.round(Number(instDays[c.id] || 10)))
    act({ action: 'approve_installment', claim_id: c.id, days: d }, c.id)
  }
  const releaseMaintenance = (m: MaintenanceItem) =>
    act({ action: 'release_maintenance', claim_id: m.id }, 'release-' + m.id)
  const toggleMaintenancePause = (m: MaintenanceItem) =>
    act({ action: m.admin_paused ? 'resume_maintenance' : 'pause_maintenance', claim_id: m.id }, 'pause-' + m.id)
  const releaseLocked = (l: LockedItem) => {
    const raw = lockRelease[l.user_id]
    const amount = raw !== undefined && raw !== '' ? Number(raw) : l.locked
    if (!Number.isFinite(amount) || amount <= 0) { setError('请输入放行金额'); return }
    const release = Math.min(amount, l.locked)
    const remaining = Math.max(0, l.locked - release)
    if (!confirm(`确认放行 $${release.toFixed(2)} 到 ${l.username || l.email || '该用户'} 的可提现余额？剩余锁定 $${remaining.toFixed(2)}。`)) return
    act({ action: 'release_locked', user_id: l.user_id, amount }, 'lock-' + l.user_id)
  }
  const voidLocked = (l: LockedItem) => {
    if (!confirm(`作废 ${(l.username || l.email || '该用户')} 的 $${l.locked.toFixed(2)} 锁定额度？这笔钱不会给用户，也会从其累计收益中扣除（当没发生过）。`)) return
    act({ action: 'void_locked', user_id: l.user_id }, 'lock-' + l.user_id)
  }
  const unfreeze = (c: ClaimItem) => act({ action: 'unfreeze', user_id: c.user_id }, 'unfreeze-' + c.user_id)

  const unlockApprove = (u: UnlockItem) => {
    const locked = u.current_locked ?? u.requested_amount
    const raw = unlockAmt[u.id]
    const amount = raw !== undefined && raw !== '' ? Math.max(0, Number(raw)) : locked
    act({ action: 'unlock_approve', request_id: u.id, amount }, 'unlock-' + u.id)
  }
  const unlockReject = (u: UnlockItem) => {
    const reason = prompt('驳回理由（可选）：') ?? ''
    act({ action: 'unlock_reject', request_id: u.id, reason }, 'unlock-' + u.id)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <header className="border-b border-zinc-700 bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Claim 审批</h1>
              <p className="text-xs text-zinc-400">社群奖池领取 · 身份审核 · 工资解锁</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/community">
              <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                <Crown className="w-4 h-4 mr-2" /> Community
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin/community" className="inline-flex items-center gap-1 text-zinc-400 hover:text-white text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> 返回 Community
        </Link>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-5 h-5" />{error}
            <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-400">
            <CheckCircle className="w-5 h-5" />{success}
            <button onClick={() => setSuccess('')} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* 待审 */}
        <h2 className="text-white font-semibold mb-3">待审批 ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-zinc-500 text-sm mb-8">没有待审批的 claim。</p>
        ) : (
          <div className="grid gap-3 mb-8">
            {pending.map((c) => (
              <div key={c.id} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 flex gap-4">
                {/* 照片 */}
                <button
                  onClick={() => c.photo_url && setZoomPhoto(c.photo_url)}
                  className="w-20 h-20 rounded-lg overflow-hidden bg-zinc-700 flex-shrink-0 flex items-center justify-center"
                >
                  {c.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photo_url} alt="identity" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-zinc-500 text-xs">无照片</span>
                  )}
                </button>

                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium">{c.real_name || '—'}</span>
                    {c.same_name_count > 1 && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        ⚠️ {c.same_name_count} 个账号同名
                      </span>
                    )}
                    <span className="text-[11px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                      L{c.level} {c.level_name} · ${c.amount}
                    </span>
                    {typeof c.staking_ratio === 'number' && (
                      <span className={`text-[11px] px-2 py-0.5 rounded ${c.staking_ratio >= 0.5 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                        质押 {(c.staking_ratio * 100).toFixed(0)}% / 非质押 {(100 - c.staking_ratio * 100).toFixed(0)}%
                        {c.staking_ratio < 0.5 && ' · 建议维持'}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-400 text-sm mt-0.5">{c.username || '—'} · {c.email || '—'}</p>
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="text-emerald-300 hover:text-emerald-200 text-sm mt-0.5 inline-flex items-center gap-1">
                      📞 {c.phone}
                    </a>
                  )}
                  {c.wallet_address && (
                    <a href={`https://polygonscan.com/address/${c.wallet_address}`} target="_blank" rel="noopener noreferrer"
                      className="text-zinc-500 hover:text-emerald-400 text-xs inline-flex items-center gap-1 mt-0.5">
                      {c.wallet_address.slice(0, 6)}...{c.wallet_address.slice(-4)} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <p className="text-zinc-600 text-xs mt-0.5">提交于 {new Date(c.claimed_at).toLocaleString()}</p>
                </div>

                {/* 操作 */}
                <div className="flex flex-col gap-2 justify-center flex-shrink-0">
                  <Button size="sm" onClick={() => approve(c)} disabled={processing === c.id}
                    className="bg-green-500 hover:bg-green-600">
                    {processing === c.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-1" /> 立即批准</>}
                  </Button>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      value={maintDays[c.id] ?? '15'}
                      onChange={(e) => setMaintDays((s) => ({ ...s, [c.id]: e.target.value }))}
                      className="w-14 px-2 py-1.5 rounded bg-zinc-900 border border-zinc-600 text-white text-xs text-center"
                    />
                    <Button size="sm" variant="outline" onClick={() => approveMaintenance(c)} disabled={processing === c.id}
                      className="flex-1 border-amber-500 text-amber-300 hover:bg-amber-500/20 whitespace-nowrap">
                      <Lock className="w-4 h-4 mr-1" /> 批准+维持
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      value={instDays[c.id] ?? '10'}
                      onChange={(e) => setInstDays((s) => ({ ...s, [c.id]: e.target.value }))}
                      className="w-14 px-2 py-1.5 rounded bg-zinc-900 border border-zinc-600 text-white text-xs text-center"
                    />
                    <Button size="sm" variant="outline" onClick={() => approveInstallment(c)} disabled={processing === c.id}
                      className="flex-1 border-emerald-500 text-emerald-300 hover:bg-emerald-500/20 whitespace-nowrap">
                      <Unlock className="w-4 h-4 mr-1" /> 批准+分期
                    </Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => reject(c)} disabled={processing === c.id}
                    className="border-red-500 text-red-400 hover:bg-red-500/20">
                    <XCircle className="w-4 h-4 mr-1" /> 驳回+冻结
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bonus 维持期 */}
        <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-400" /> 维持中 ({maintenance.length})
        </h2>
        {maintenance.length === 0 ? (
          <p className="text-zinc-500 text-sm mb-8">没有维持中的奖励。</p>
        ) : (
          <div className="grid gap-3 mb-8">
            {maintenance.map((m) => {
              const pct = m.required_days > 0 ? Math.min(100, (m.days_done / m.required_days) * 100) : 0
              return (
                <div key={m.id} className="bg-zinc-800/50 border border-amber-700/40 rounded-xl p-4 flex gap-4 items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium">{m.username || m.email || '—'}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                        L{m.level} {m.level_name} · ${m.amount}
                      </span>
                      {typeof m.staking_ratio === 'number' && (
                        <span className={`text-[11px] px-2 py-0.5 rounded ${m.staking_ratio >= 0.5 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                          质押 {(m.staking_ratio * 100).toFixed(0)}%
                        </span>
                      )}
                      {m.admin_paused && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-red-500/20 text-red-300">⏸ 已暂停</span>
                      )}
                    </div>
                    <p className="text-zinc-400 text-sm mt-1">
                      已维持 <span className="text-white font-medium">{m.days_done} / {m.required_days}</span> 天 · 门槛 ${m.threshold.toFixed(0)}
                      {m.admin_paused && <span className="text-red-300 ml-1">（倒计时已暂停）</span>}
                    </p>
                    <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden mt-1.5 max-w-xs">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    {m.started_at && (
                      <p className="text-zinc-600 text-xs mt-1">进入维持 {new Date(m.started_at).toLocaleString()}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button size="sm" onClick={() => releaseMaintenance(m)} disabled={processing === 'release-' + m.id}
                      className="bg-emerald-500 hover:bg-emerald-600">
                      {processing === 'release-' + m.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Unlock className="w-4 h-4 mr-1" /> 立即放行</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleMaintenancePause(m)} disabled={processing === 'pause-' + m.id}
                      className={m.admin_paused ? 'border-emerald-500 text-emerald-300 hover:bg-emerald-500/20' : 'border-amber-500 text-amber-300 hover:bg-amber-500/20'}>
                      {processing === 'pause-' + m.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : (m.admin_paused ? <>▶ 恢复倒数</> : <>⏸ 暂停倒数</>)}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Bonus 分期发放 */}
        <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Unlock className="w-4 h-4 text-emerald-400" /> 分期发放中 ({installment.length})
        </h2>
        {installment.length === 0 ? (
          <p className="text-zinc-500 text-sm mb-8">没有分期发放中的奖励。</p>
        ) : (
          <div className="grid gap-3 mb-8">
            {installment.map((m) => {
              const pct = m.total_days > 0 ? Math.min(100, (m.days_done / m.total_days) * 100) : 0
              return (
                <div key={m.id} className="bg-zinc-800/50 border border-emerald-700/40 rounded-xl p-4 flex gap-4 items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium">{m.username || m.email || '—'}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                        L{m.level} {m.level_name} · ${m.amount}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        每天 ${m.daily_amount}
                      </span>
                      {m.frozen && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-medium">⏸ 已暂停（账号冻结）</span>
                      )}
                    </div>
                    <p className="text-zinc-400 text-sm mt-1">
                      已发 <span className="text-white font-medium">{m.days_done} / {m.total_days}</span> 天 · 已到账 ${m.released.toFixed(2)} / ${m.amount}
                      {m.frozen && <span className="text-red-400"> · 已停止发放</span>}
                    </p>
                    <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden mt-1.5 max-w-xs">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    {m.started_at && (
                      <p className="text-zinc-600 text-xs mt-1">进入分期 {new Date(m.started_at).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 锁定日薪汇总：所有 community_locked_usdc > 0 的用户 */}
        <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-400" /> 锁定日薪 ({locked.length})
          {locked.length > 0 && (
            <span className="text-sm text-zinc-400 font-normal">
              · 合计锁定 ${locked.reduce((a, l) => a + l.locked, 0).toFixed(2)}
            </span>
          )}
        </h2>
        <p className="text-zinc-500 text-xs mb-3">未进入可提现的每日工资。可放行指定金额到可提现，或作废清零（不给用户、并从累计收益扣除）。</p>
        {locked.length === 0 ? (
          <p className="text-zinc-500 text-sm mb-8">没有锁定的日薪。</p>
        ) : (
          <div className="grid gap-3 mb-8">
            {locked.map((l) => (
              <div key={l.user_id} className="bg-zinc-800/50 border border-amber-700/40 rounded-xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium">{l.username || l.email || '—'}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-700 text-zinc-300">L{l.level}</span>
                    {l.is_admin_set && <span className="text-[11px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">admin-set</span>}
                    {l.is_influencer && <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">influencer</span>}
                  </div>
                  <p className="text-amber-300 text-lg font-bold tabular-nums mt-1">${l.locked.toFixed(2)} <span className="text-zinc-500 text-xs font-normal">锁定</span></p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={l.locked.toFixed(2)}
                    value={lockRelease[l.user_id] ?? ''}
                    onChange={(e) => setLockRelease((s) => ({ ...s, [l.user_id]: e.target.value }))}
                    className="w-24 px-2 py-1.5 rounded bg-zinc-900 border border-zinc-600 text-white text-xs text-right"
                  />
                  <Button size="sm" onClick={() => releaseLocked(l)} disabled={processing === 'lock-' + l.user_id}
                    className="bg-emerald-500 hover:bg-emerald-600 whitespace-nowrap">
                    {processing === 'lock-' + l.user_id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Unlock className="w-4 h-4 mr-1" /> 放行</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => voidLocked(l)} disabled={processing === 'lock-' + l.user_id}
                    className="border-red-500 text-red-400 hover:bg-red-500/20 whitespace-nowrap">
                    <XCircle className="w-4 h-4 mr-1" /> 作废
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Influencer-lock 解锁申请 */}
        <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-400" /> 工资解锁申请 ({unlockPending.length})
        </h2>
        {unlockPending.length === 0 ? (
          <p className="text-zinc-500 text-sm mb-8">没有待审批的解锁申请。</p>
        ) : (
          <div className="grid gap-3 mb-8">
            {unlockPending.map((u) => (
              <div key={u.id} className="bg-zinc-800/50 border border-amber-700/40 rounded-xl p-4 flex gap-4 items-center">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium">{u.username || u.email || '—'}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      🔒 锁定 ${(u.current_locked ?? u.requested_amount).toFixed(2)}
                    </span>
                    {u.current_locked != null && Math.abs(u.current_locked - u.requested_amount) > 0.01 && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-700 text-zinc-400">
                        申请时 ${u.requested_amount.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-400 text-sm mt-0.5">{u.email || '—'}</p>
                  {u.wallet_address && (
                    <a href={`https://polygonscan.com/address/${u.wallet_address}`} target="_blank" rel="noopener noreferrer"
                      className="text-zinc-500 hover:text-emerald-400 text-xs inline-flex items-center gap-1 mt-0.5">
                      {u.wallet_address.slice(0, 6)}...{u.wallet_address.slice(-4)} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <p className="text-zinc-600 text-xs mt-0.5">申请于 {new Date(u.created_at).toLocaleString()}</p>
                </div>
                <div className="flex flex-col gap-2 justify-center flex-shrink-0 w-48">
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-400 text-sm">$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={unlockAmt[u.id] ?? (u.current_locked ?? u.requested_amount).toFixed(2)}
                        onChange={(e) => setUnlockAmt((s) => ({ ...s, [u.id]: e.target.value }))}
                        className="flex-1 w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-600 text-white text-sm text-right"
                      />
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-0.5">放行金额 · 余额继续锁定</p>
                  </div>
                  <Button size="sm" onClick={() => unlockApprove(u)} disabled={processing === 'unlock-' + u.id}
                    className="bg-green-500 hover:bg-green-600">
                    {processing === 'unlock-' + u.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Unlock className="w-4 h-4 mr-1" /> 批准放行</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => unlockReject(u)} disabled={processing === 'unlock-' + u.id}
                    className="border-red-500 text-red-400 hover:bg-red-500/20">
                    <XCircle className="w-4 h-4 mr-1" /> 驳回
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {unlockRecent.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-zinc-700 mb-8">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800/80">
                <tr className="border-b border-zinc-700 text-left text-xs text-zinc-400">
                  <th className="px-3 py-2">账号</th>
                  <th className="px-3 py-2">解锁金额</th>
                  <th className="px-3 py-2">结果</th>
                  <th className="px-3 py-2">时间</th>
                </tr>
              </thead>
              <tbody>
                {unlockRecent.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-700/50">
                    <td className="px-3 py-2 text-zinc-300">{u.username || u.email || '—'}</td>
                    <td className="px-3 py-2 text-zinc-300">${(u.credited_amount ?? u.requested_amount).toFixed(2)}</td>
                    <td className="px-3 py-2">
                      {u.status === 'approved' ? (
                        <span className="text-emerald-400 text-xs">✓ 已批准</span>
                      ) : (
                        <span className="text-red-400 text-xs">✕ 已驳回{u.rejected_reason ? `（${u.rejected_reason}）` : ''}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 text-xs">{u.reviewed_at ? new Date(u.reviewed_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 最近已审 */}
        <h2 className="text-white font-semibold mb-3">最近已审 ({recent.length})</h2>
        {recent.length === 0 ? (
          <p className="text-zinc-500 text-sm">暂无记录。</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-700">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800/80">
                <tr className="border-b border-zinc-700 text-left text-xs text-zinc-400">
                  <th className="px-3 py-2">真名</th>
                  <th className="px-3 py-2">账号</th>
                  <th className="px-3 py-2">等级</th>
                  <th className="px-3 py-2">金额</th>
                  <th className="px-3 py-2">结果</th>
                  <th className="px-3 py-2">时间</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-700/50">
                    <td className="px-3 py-2 text-white">{c.real_name || '—'}</td>
                    <td className="px-3 py-2 text-zinc-400">{c.username || c.email || '—'}</td>
                    <td className="px-3 py-2 text-zinc-300">L{c.level} {c.level_name}</td>
                    <td className="px-3 py-2 text-zinc-300">${c.amount}</td>
                    <td className="px-3 py-2">
                      {c.status === 'completed' ? (
                        <span className="text-emerald-400 text-xs">✓ 已批准</span>
                      ) : (
                        <span className="text-red-400 text-xs">✕ 已驳回{c.rejected_reason ? `（${c.rejected_reason}）` : ''}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 text-xs">{c.reviewed_at ? new Date(c.reviewed_at).toLocaleString() : '—'}</td>
                    <td className="px-3 py-2">
                      {c.claims_frozen && (
                        <Button size="sm" variant="outline" onClick={() => unfreeze(c)} disabled={processing === 'unfreeze-' + c.user_id}
                          className="border-cyan-600/50 text-cyan-300 hover:bg-cyan-500/10">
                          {processing === 'unfreeze-' + c.user_id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <><Unlock className="w-3 h-3 mr-1" /> 解冻</>}
                        </Button>
                      )}
                      {!c.claims_frozen && c.status === 'rejected' && (
                        <span className="text-zinc-600 text-xs inline-flex items-center gap-1"><Lock className="w-3 h-3" /> —</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* 照片放大 */}
      {zoomPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setZoomPhoto(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomPhoto} alt="identity" className="max-h-[90vh] max-w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}
