'use client'

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

const ENTITIES = [
  // Market makers
  { id: 'wintermute',        name: 'Wintermute',        type: 'Market Maker',  domain: 'wintermute.com',       bio: 'Largest algorithmic crypto market maker, active across 50+ exchanges.' },
  { id: 'jump-trading',      name: 'Jump Crypto',        type: 'Market Maker',  domain: 'jumpcrypto.com',       bio: 'Crypto arm of Jump Trading; deep liquidity across DeFi and CeFi.' },
  { id: 'cumberland',        name: 'Cumberland DRW',     type: 'Market Maker',  domain: 'cumberlandsig.com',    bio: 'OTC desk and market maker under DRW; one of the earliest institutional players.' },
  { id: 'galaxy-digital',    name: 'Galaxy Digital',     type: 'Market Maker',  domain: 'galaxy.com',           bio: 'Publicly listed crypto financial services firm with active trading desk.' },
  { id: 'dwf-labs',          name: 'DWF Labs',           type: 'Market Maker',  domain: 'dwf-labs.com',         bio: 'Global Web3 VC and market maker, known for aggressive token deals.' },
  { id: 'flow-traders',      name: 'Flow Traders',       type: 'Market Maker',  domain: 'flowtraders.com',      bio: 'Dutch HFT firm and one of the largest ETP liquidity providers in crypto.' },
  { id: 'gsr-markets',       name: 'GSR Markets',        type: 'Market Maker',  domain: 'gsr.io',               bio: 'Programmatic crypto market maker and ecosystem partner for token projects.' },
  { id: 'qcp-capital',       name: 'QCP Capital',        type: 'Market Maker',  domain: 'qcp.capital',          bio: 'Singapore-based crypto options and OTC desk, Asia\'s most active volatility trader.' },
  { id: 'kronos-research',   name: 'Kronos Research',    type: 'Market Maker',  domain: 'kronosresearch.com',   bio: 'Taipei HFT and market-making firm; significant volume on Binance and Bybit.' },
  { id: 'keyrock',           name: 'Keyrock',            type: 'Market Maker',  domain: 'keyrock.eu',           bio: 'European algorithmic market maker with automated DeFi liquidity strategies.' },
  { id: 'b2c2',              name: 'B2C2',               type: 'Market Maker',  domain: 'b2c2.com',             bio: 'Institutional crypto liquidity provider backed by SBI Group.' },
  // Trading firms
  { id: 'amber',             name: 'Amber Group',        type: 'Trading Firm',  domain: 'ambergroup.io',        bio: 'Asia-Pacific digital asset trading and investment group.' },
  { id: 'jane-street',       name: 'Jane Street',        type: 'Trading Firm',  domain: 'janestreet.com',       bio: 'Global quant trading firm, growing presence in crypto derivatives.' },
  // Funds
  { id: 'blocktower-capital',name: 'BlockTower Capital', type: 'Fund',          domain: 'blocktower.com',       bio: 'Multi-strategy crypto fund known for DeFi-native trading and early altcoin bets.' },
  { id: 'framework-ventures',name: 'Framework Ventures', type: 'Fund',          domain: 'framework.ventures',   bio: 'Thesis-driven DeFi fund; early backer of Chainlink, Synthetix, Keep Network.' },
  { id: 'dragonfly-capital', name: 'Dragonfly Capital',  type: 'Fund',          domain: 'dragonfly.xyz',        bio: 'Global crypto fund bridging East and West; invested in dYdX, MakerDAO, Compound.' },
  { id: 'paradigm',          name: 'Paradigm',           type: 'Fund',          domain: 'paradigm.xyz',         bio: 'Research-driven crypto VC; portfolio includes Uniswap, Optimism, FTX (early).' },
  { id: 'polychain-capital', name: 'Polychain Capital',  type: 'Fund',          domain: 'polychain.capital',    bio: 'One of the first pure-play crypto hedge funds; $1B+ AUM, heavy DeFi presence.' },
  { id: 'multicoin-capital', name: 'Multicoin Capital',  type: 'Fund',          domain: 'multicoin.capital',    bio: 'Thesis-driven fund; early Solana backer, active governance voter across protocols.' },
  { id: 'pantera-capital',   name: 'Pantera Capital',    type: 'Fund',          domain: 'pantera.com',          bio: 'Oldest US Bitcoin fund; invests across BTC, early-stage crypto, and DeFi.' },
  { id: 'delphi-digital',    name: 'Delphi Digital',     type: 'Fund',          domain: 'delphidigital.io',     bio: 'Research house turned active fund; strong on Cosmos, Terra (early), and gaming.' },
  // Individuals
  { id: 'tetranode',         name: 'Tetranode',          type: 'Individual',    domain: null,                   bio: 'Pseudonymous DeFi whale and Curve ecosystem power user; one of the largest veCRV holders.' },
  { id: 'justin-sun',        name: 'Justin Sun',         type: 'Individual',    domain: 'tron.network',         bio: 'TRON founder and Huobi backer; aggressively active across DeFi and altcoins.' },
  { id: 'arthur-hayes',      name: 'Arthur Hayes',       type: 'Individual',    domain: 'bitmex.com',           bio: 'BitMEX co-founder; macro-focused crypto writer and active high-conviction trader.' },
  { id: 'vitalik-buterin',   name: 'Vitalik Buterin',    type: 'Individual',    domain: 'ethereum.org',         bio: 'Ethereum creator; on-chain moves signal ETH ecosystem priorities.' },
  { id: 'andrew-kang',       name: 'Andrew Kang',        type: 'Individual',    domain: null,                   bio: 'Mechanism Capital founder; known for large leveraged altcoin positions on-chain.' },
  { id: 'sifu',              name: 'Sifu',               type: 'Individual',    domain: null,                   bio: 'Former Wonderland treasury manager; active DeFi yield and governance participant.' },
  { id: 'cobie',             name: 'Cobie',              type: 'Individual',    domain: null,                   bio: 'Influential CT trader and UpOnly host; on-chain moves closely followed by community.' },
  { id: 'hasu',              name: 'Hasu',               type: 'Individual',    domain: null,                   bio: 'Crypto researcher and Flashbots strategist; on-chain activity tied to MEV and staking.' },
  { id: 'adam-cochran',      name: 'Adam Cochran',       type: 'Individual',    domain: null,                   bio: 'Synthetix contributor and VC; vocal on-chain governance participant.' },
] as const

const TYPE_COLOR: Record<string, string> = {
  'Market Maker': 'text-cyan-400  bg-cyan-400/10  border-cyan-400/20',
  'Trading Firm': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  'Fund':         'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  'Individual':   'text-zinc-300   bg-zinc-300/10   border-zinc-300/20',
}

function Avatar({ domain, name }: { domain: string | null; name: string }) {
  const [failed, setFailed] = useState(false)
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  if (!domain || failed) {
    return (
      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0
                      text-[11px] font-mono font-bold text-white/60">
        {initials}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-9 h-9 rounded-full object-contain bg-white/5 flex-shrink-0"
    />
  )
}

function EntityCard({ entity }: { entity: typeof ENTITIES[number] }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="relative flex items-start gap-3 p-3 rounded-xl border border-white/[0.07]
                 bg-white/[0.03] hover:bg-white/[0.06] transition-colors cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Avatar domain={entity.domain ?? null} name={entity.name} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate">{entity.name}</p>
        <span className={`inline-block mt-0.5 text-[10px] font-mono px-1.5 py-px rounded border ${TYPE_COLOR[entity.type]}`}>
          {entity.type}
        </span>
      </div>

      {hovered && (
        <div className="absolute z-10 bottom-full left-0 mb-2 w-64 p-3 rounded-xl
                        bg-[#0D0B21] border border-white/[0.12] shadow-xl text-xs text-white/70 leading-relaxed
                        pointer-events-none">
          <p className="font-semibold text-white/90 mb-1">{entity.name}</p>
          {entity.bio}
          <div className="absolute top-full left-4 -mt-px border-4 border-transparent border-t-white/[0.12]" />
        </div>
      )}
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
}

export function TrackedWalletsModal({ open, onClose }: Props) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, handleKey])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-2xl max-h-[80vh] flex flex-col
                   rounded-2xl border border-white/[0.10] bg-[#0D0B21] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <div>
            <h2 className="text-sm font-semibold text-white">Tracked Wallets</h2>
            <p className="text-[11px] text-white/40 mt-0.5 font-mono">{ENTITIES.length} entities · hover for details</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* entity grid */}
        <div className="overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ENTITIES.map(e => <EntityCard key={e.id} entity={e} />)}
        </div>
      </div>
    </div>
  )
}
