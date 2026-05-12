import { BevelCard }  from '@/components/ui/poly/BevelCard'
import { EyebrowTag } from '@/components/ui/poly/EyebrowTag'
import { ExternalLink } from 'lucide-react'
import type { AlphaWallet } from '@/lib/alpha-tracker/types'

function formatPnl(n: number): string {
  const abs = Math.abs(n)
  const sign = n >= 0 ? '+' : '-'
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

export function TopWalletsTable({ wallets }: { wallets: AlphaWallet[] }) {
  if (!wallets.length) return null

  return (
    <BevelCard size="lg" pad={16}>
      <EyebrowTag className="mb-3">Top Alpha Wallets · 30d</EyebrowTag>
      <div className="space-y-2">
        {wallets.slice(0, 8).map((w, i) => (
          <a
            key={w.id}
            href={`https://intel.arkm.com/explorer/address/${w.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 py-1 hover:bg-white/[0.03] rounded-lg px-1 -mx-1 transition-colors group"
          >
            <span
              className="text-[10px] text-white/30 tabular-nums w-4 shrink-0"
              style={{ fontFamily: 'var(--poly-font-mono)' }}
            >
              {i + 1}
            </span>
            <img
              src={`https://effigy.im/a/${w.address}.png`}
              alt=""
              className="w-5 h-5 rounded-full shrink-0 opacity-80"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <span className="flex-1 min-w-0">
              <span className="text-[11px] text-white/70 truncate block">
                {w.arkham_entity ?? `${w.address.slice(0, 6)}…${w.address.slice(-4)}`}
              </span>
              <span className="text-[10px] text-white/35">
                {w.entity_type ?? 'entity'}
              </span>
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <span
                className="text-[11px] tabular-nums"
                style={{
                  fontFamily: 'var(--poly-font-mono)',
                  color: w.pnl_30d >= 0 ? 'var(--poly-emerald)' : '#f87171',
                }}
              >
                {formatPnl(w.pnl_30d)}
              </span>
              <ExternalLink className="w-2.5 h-2.5 text-white/20 group-hover:text-white/40 transition-colors" />
            </div>
          </a>
        ))}
      </div>
    </BevelCard>
  )
}
