'use client'

import type { AlphaSignal } from '@/lib/alpha-tracker/types'
import { PATTERN_META } from '@/lib/alpha-tracker/patterns/index'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

export function LiveTicker({ signals }: { signals: AlphaSignal[] }) {
  if (!signals.length) return null

  const items = [...signals, ...signals]   // duplicate for seamless loop

  return (
    <div
      className="overflow-hidden border-b"
      style={{ borderColor: 'var(--poly-stroke-dark)', background: 'var(--poly-primary)' }}
    >
      <div
        className="flex items-center gap-6 py-1.5 px-4 whitespace-nowrap"
        style={{
          animation: 'ticker-scroll 40s linear infinite',
          display: 'flex',
          width: 'max-content',
        }}
      >
        {/* Live badge */}
        <span
          className="flex items-center gap-1.5 shrink-0"
          style={{ fontFamily: 'var(--poly-font-mono)', fontSize: 11, color: 'var(--poly-orange)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--poly-orange)] animate-pulse" />
          LIVE
        </span>

        {items.map((s, i) => {
          const meta = PATTERN_META[s.pattern_id]
          return (
            <span
              key={`${s.id}-${i}`}
              className="text-white/55"
              style={{ fontFamily: 'var(--poly-font-mono)', fontSize: 11 }}
            >
              {meta?.emoji} {s.entity_name} · {s.what_text.split(' accumulated ')[1] ?? s.what_text.slice(0, 40)} · {relativeTime(s.observed_at)}
              <span className="mx-3 text-white/20">·</span>
            </span>
          )
        })}
      </div>

      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
