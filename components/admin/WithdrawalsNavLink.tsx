'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ArrowDownToLine } from 'lucide-react'

const LS_KEY = 'admin_withdrawals_last_seen'

/** Reads the "last seen withdrawals" timestamp; initializes to now on first use
 *  so historical withdrawals don't all show as unread. */
export function markWithdrawalsSeen() {
  try { localStorage.setItem(LS_KEY, new Date().toISOString()) } catch { /* ignore */ }
}

// Admin nav link to /admin/withdrawals with an unread-style red badge: counts
// withdrawals created since the admin last opened the withdrawals page. Polls
// every 30s so new withdrawals surface without a refresh.
export function WithdrawalsNavLink() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        let since = localStorage.getItem(LS_KEY)
        if (!since) { since = new Date().toISOString(); localStorage.setItem(LS_KEY, since) }
        const res = await fetch(`/api/admin/withdrawals/count?since=${encodeURIComponent(since)}`)
        if (!res.ok) return
        const j = await res.json()
        if (alive) setCount(j.count || 0)
      } catch { /* ignore */ }
    }
    load()
    const t = setInterval(load, 30_000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  return (
    <Link href="/admin/withdrawals" className="relative inline-block">
      <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
        <ArrowDownToLine className="w-4 h-4 mr-2" />
        Withdrawals
      </Button>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center border border-zinc-900 animate-pulse">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
