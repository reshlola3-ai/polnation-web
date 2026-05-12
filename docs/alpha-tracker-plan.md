# Alpha Lead Tracker — Implementation Plan (v3)

**Status:** Plan only — not yet executed.
**Created:** 2026-05-12 (v1) · **Revised:** 2026-05-13 (v3 — real Arkham API, polygon.technology design)
**Owner:** TBD

---

## 1. Goal

Build a dedicated showcase section in Polnation that surfaces **real, interpreted on-chain alpha signals** from smart-money wallets. Users cannot act on the signals — they observe. The experience must feel:

- **Real** — actual labeled entities, actual transactions, live timestamps
- **Profitable-looking** — every signal carries a plain-language interpretation of *what the pattern means*
- **Cinematic** — feed feels alive, signals arrive with motion, the page breathes
- **Trustworthy** — Arkham Intelligence branding + transparent methodology

User mental model:
> "Polnation has smart-money intelligence feeding their strategies. I am watching the same signals their AI sees."

---

## 2. Role of Arkham API

Arkham is the **intelligence layer**. It turns anonymous on-chain noise into named, interpretable events.

| Function | Endpoint | What it produces |
|---|---|---|
| Identify smart-money wallets | `/intelligence/address/{addr}` | Entity name, type (trading firm / fund / whale) |
| Pull transfers with counterparty labels | `/transfers?base={addr}` | "Wintermute → Binance" not anonymous hashes |
| Token context | `/token/market/{id}`, `/token/price/history` | Price, 24h volume, liquidity for pattern detection |
| Entity track record | `/portfolio/timeSeries/entity/{entity}` | 30d PnL, holdings (credibility numbers in cards) |
| Convergence detection | `/token/top_flow/{token}` | Which entities are touching a given token right now |
| Discovery (ops) | `/intelligence/search` | Find new wallets to add to watchlist |

---

## 3. The Seven Alpha Patterns

| ID | Pattern | Poly token | Trigger |
|---|---|---|---|
| `pre_cex` | 🎯 Pre-CEX Accumulation | `--poly-amber` `#fee211` | Labeled market maker accumulates > $500K of token with 24h vol < $10M |
| `bridge_buy` | 🌉 Bridge-then-Buy | `--poly-bubblegum` `#e271d7` | Entity bridges > $1M into chain, then buys specific token within 30 min |
| `lp_position` | 💧 LP Positioning | `--poly-emerald` `#00cc06` | Entity adds > $200K LP to pool < 7 days old |
| `stable_rotation` | 🔄 Stable → Token Rotation | `--poly-purple` `#670de5` | Entity swaps > $500K stablecoin into single non-stable token |
| `convergence` | ⚡ Convergence | `--poly-orange` `#ff7421` | 2+ unrelated entities buy same token within 4h |
| `dca_dump` | 🩸 Smart DCA on Dump | `--poly-bubblegum` `#e271d7` | Token drops > 10% in 24h, entity buys > $300K against trend |
| `pre_gov` | 🗳️ Pre-Governance | `--poly-purple-subtle` `#ddcff2` | Governance token accumulated by entity in 48h before known vote |

All 7 pattern colors are **existing poly tokens** — no new tokens needed.

---

## 4. Confidence Score (real-time, no backtest)

Each signal gets 0–100 computed from live Arkham data:

```
confidence =
   entity_track_record  (0-30)   ← entity 30d PnL from Arkham portfolio
 + pattern_strength     (0-25)   ← per-pattern weight
 + token_liquidity_fit  (0-15)   ← volume in pattern's sweet spot
 + recency_context      (0-15)   ← no recent contradictions
 + convergence_bonus    (0-15)   ← N additional entities on same token
```

Breakdown shown on hover. Transparent algorithm = credibility.

---

## 5. Architecture

```
┌─ Supabase ──────────────────────────────────────────────────┐
│ alpha_wallets                                                │
│   address, arkham_entity, entity_type, chains,              │
│   pnl_30d, win_rate, portfolio_usd,                         │
│   is_active, last_refreshed_at                              │
│                                                              │
│ alpha_signals                                                │
│   id, wallet_address, entity_name, pattern_id,              │
│   confidence, confidence_breakdown (jsonb),                 │
│   tx_hashes (text[]), chain, token_symbol,                  │
│   amount_usd, what_text, meaning_text,                      │
│   observed_at, expires_at                                   │
└─────────────────────────────────────────────────────────────┘
              ▲                              ▼
              │ write                        │ Supabase Realtime
┌─ Vercel Cron (every 5 min) ─────┐   ┌─ Frontend ──────────────────┐
│ /api/cron/refresh-alpha-tracker  │   │ Server Component (initial)  │
│  1. Read active wallets          │   │ Client: Realtime sub        │
│  2. Arkham /transfers per wallet │   │ New row → animate card in   │
│  3. Run 7 pattern detectors      │   └─────────────────────────────┘
│  4. Score + interpret            │
│  5. Insert alpha_signals         │
└──────────────────────────────────┘
```

**Refresh:** every 5 min (Vercel Cron paid minimum) → feels live  
**Push:** Supabase Realtime → no polling needed on frontend  
**Chains:** all 15 Arkham supports  
**Users:** read-only

---

## 6. File Structure

```
app/(dashboard)/alpha/
  page.tsx                         ← server component (initial load)
  AlphaClient.tsx                  ← client orchestrator + Realtime sub
  components/
    StatsBar.tsx
    ConvergenceAlert.tsx
    SignalFeed.tsx
    SignalCard.tsx
    PatternLegend.tsx
    TopWalletsTable.tsx
    MethodologyPanel.tsx
    LiveTicker.tsx

app/api/cron/refresh-alpha-tracker/
  route.ts                         ← CRON_SECRET protected

lib/alpha-tracker/
  arkham-client.ts                 ← Arkham API wrapper (auth, rate-limit, retry)
  types.ts
  scoring.ts                       ← confidence computation
  interpret.ts                     ← pattern → what/meaning text templates
  refresh-job.ts                   ← pipeline orchestrator
  patterns/
    pre-cex.ts
    bridge-buy.ts
    lp-position.ts
    stable-rotation.ts
    convergence.ts
    dca-dump.ts
    pre-governance.ts
    index.ts

supabase/migrations/
  20260513_alpha_tracker.sql

scripts/
  seed-alpha-wallets.ts

components/layout/Navbar.tsx       ← add "Alpha" link
app/(dashboard)/dashboard/DashboardClient.tsx
                                   ← add entry card (between Quick Actions + Community)
messages/{en,zh,vi,id,fr,es}.json  ← alpha.* keys
vercel.json                        ← */5 * * * *
```

---

## 7. Design System

All components use the **existing polygon.technology primitives**. Zero new design tokens beyond pattern colors (which are aliased from existing poly tokens).

### 7.1 Primitive mapping

| Use | Component / token |
|---|---|
| Signal cards | `NotchedCard` — chamfered corners = editorial "intelligence card" feel |
| Stats hero + entry card | `BevelCard size="lg"` — single bevel, matches staking tiles |
| Pattern chips + quick actions | `BevelCard size="sm"` |
| All section/card labels | `EyebrowTag` |
| All numeric values | `MonoStat` (`PolySansMono` tabular nums) |
| Live pulse dot | `--poly-orange` `#ff7421` (no new color) |
| Positive PnL | `--poly-emerald` `#00cc06` |
| Convergence highlight | `--poly-orange` |
| Primary accent | `--poly-purple` `#670de5` |

### 7.2 Card states

Cards age gracefully using opacity on `strokeColor` prop:

| State | Treatment |
|---|---|
| NEW (< 60s) | `strokeColor` = pattern color at 80% · `NEW` badge in `EyebrowTag` style |
| LIVE (< 30 min) | `strokeColor` = pattern color at 40% |
| AGED (> 30 min) | `strokeColor` = `rgba(255,255,255,0.18)` (default) |
| EXPIRED (> 24h) | filtered out |

### 7.3 Animation on new signal

1. Slot reserved (bg fades in, height expands — 150ms)
2. `NotchedCard` slides down from above feed (250ms `ease-out`)
3. SVG stroke flashes: pattern color → default (400ms)
4. `NEW` EyebrowTag fades in (200ms)

---

## 8. Frontend — Component Mockups

### 8.1 Dashboard entry card (placement: between Quick Actions + Community)

Inside `DashboardClient.tsx`, after the Quick Actions grid, before the Community section:

```tsx
// BevelCard size="lg" — same language as Quick Action tiles
<Link href="/alpha">
  <BevelCard size="lg" pad={20}>
    <div className="flex items-start justify-between mb-3">
      <div>
        <EyebrowTag>Alpha Intel</EyebrowTag>
        <p className="text-sm font-semibold text-white mt-1 tracking-tight">
          Smart-Money Signal Engine
        </p>
      </div>
      {/* live pulse */}
      <span className="flex items-center gap-1.5 text-[11px] text-[--poly-orange]"
            style={{ fontFamily: 'var(--poly-font-mono)' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-[--poly-orange] animate-pulse" />
        LIVE
      </span>
    </div>

    {/* Stats row */}
    <div className="flex items-center gap-4 mb-4">
      <div>
        <MonoStat value="7" size="tile" />
        <EyebrowTag className="mt-0.5">Signals today</EyebrowTag>
      </div>
      <div className="w-px h-7 bg-white/10" />
      <div>
        <MonoStat value="4" size="tile" />
        <EyebrowTag className="mt-0.5">Entities active</EyebrowTag>
      </div>
      <div className="w-px h-7 bg-white/10" />
      <div>
        <span className="text-[11px] text-white/40"
              style={{ fontFamily: 'var(--poly-font-mono)' }}>8 min ago</span>
        <EyebrowTag className="mt-0.5">Last signal</EyebrowTag>
      </div>
    </div>

    {/* Latest signal preview */}
    <div className="rounded-lg border border-[--poly-stroke-dark] px-3 py-2 bg-white/[0.02]">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(254,226,17,0.12)',
                       color: '#fee211',
                       fontFamily: 'var(--poly-font-mono)' }}>
          🎯 PRE-CEX
        </span>
        <span className="text-[10px] text-white/35"
              style={{ fontFamily: 'var(--poly-font-mono)' }}>Conf. 82</span>
      </div>
      <p className="text-[12px] text-white/70 leading-snug">
        WINTERMUTE accumulated <span className="text-white font-semibold">$1.8M MATIC</span>
      </p>
    </div>

    {/* CTA */}
    <div className="flex justify-end mt-3">
      <span className="text-[12px] text-[--poly-purple] flex items-center gap-1"
            style={{ fontFamily: 'var(--poly-font-mono)' }}>
        Open Tracker <ArrowUpRight className="w-3 h-3" />
      </span>
    </div>
  </BevelCard>
</Link>
```

---

### 8.2 `/alpha` page — full layout

```
┌─ sticky LiveTicker (full width) ─────────────────────────────────────────┐
│ 🟠 ▸ WINTERMUTE bought $1.8M MATIC 8m  ▸ JUMP added $420K LP 14m  ▸ … │
└──────────────────────────────────────────────────────────────────────────┘

┌─ page header ────────────────────────────────────────────────────────────┐
│  ALPHA LEAD TRACKER              [EyebrowTag: Powered by Arkham Intel]  │
│  Smart-money signal engine                                               │
└──────────────────────────────────────────────────────────────────────────┘

┌─ StatsBar — BevelCard size="lg" ─────────────────────────────────────────┐
│  MonoStat(23)          MonoStat(7)        MonoStat(4)    8 min ago       │
│  EyebrowTag:WALLETS    SIGNALS TODAY   ACTIVE ENTITIES   LAST SIGNAL     │
└──────────────────────────────────────────────────────────────────────────┘

┌─ ConvergenceAlert (conditional) — BevelCard size="lg" orange stroke ─────┐
│  EyebrowTag: ⚡ CONVERGENCE DETECTED                       Conf. 94      │
│  3 entities bought $LINK within 4h                                       │
│  • WINTERMUTE $2.1M · JUMP $850K · CUMBERLAND $1.4M                     │
│  Interpretation text …                          [View on Arkham ↗]      │
└──────────────────────────────────────────────────────────────────────────┘

┌─ main (2/3) ──────────────────┐  ┌─ aside (1/3, sticky) ─────────────┐
│ SignalFeed                    │  │ PatternLegend — BevelCard sm × 7  │
│ (Realtime sub, new cards      │  │  🎯 Pre-CEX       3               │
│  animate in from top)         │  │  🌉 Bridge-Buy    1               │
│                               │  │  💧 LP Position   0               │
│  ┌─ NotchedCard (LIVE) ─────┐ │  │  🔄 Stable Rot.   2               │
│  │ EyebrowTag: 🎯 PRE-CEX   │ │  │  ⚡ Convergence  ● 1             │
│  │ EyebrowTag: 8 min ago    │ │  │  🩸 DCA on Dump   0               │
│  │ Conf ████░░ 82           │ │  │  🗳️ Pre-Gov       1               │
│  │                          │ │  │ (click to filter)                │
│  │ WHAT                     │ │  ├───────────────────────────────────┤
│  │ WINTERMUTE accumulated   │ │  │ TopWalletsTable                  │
│  │ $1.8M MATIC · Polygon    │ │  │  1. WINTERMUTE    +$12.4M        │
│  │ 3 txs · 21 min span      │ │  │  2. JUMP          +$9.8M         │
│  │ Entity: Trading Firm     │ │  │  3. CUMBERLAND    +$7.2M         │
│  │ 30d PnL: +$12.4M         │ │  │  (links → Arkham)               │
│  │                          │ │  └───────────────────────────────────┘
│  │ WHAT IT MEANS            │ │
│  │ Market makers accum.     │ │
│  │ below avg daily vol      │ │
│  │ often precedes liquidity │ │
│  │ events …                 │ │
│  │                          │ │
│  │ [Arkham ↗] [3 Txs ↗]    │ │
│  └──────────────────────────┘ │
│                               │
│  ┌─ NotchedCard (aged) ─────┐ │
│  │ …                        │ │
│  └──────────────────────────┘ │
└───────────────────────────────┘

┌─ MethodologyPanel (collapsible, BevelCard size="lg") ────────────────────┐
│  EyebrowTag: METHODOLOGY                                           [+]   │
│  Data source · Signal detection · Confidence scoring · Refresh cadence  │
│  ⚠ Disclaimer                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

**Responsive:**
- Desktop ≥ 1024px: main 2/3 + aside 1/3 sticky
- Tablet 768–1023px: single column, PatternLegend becomes horizontal chip row above feed
- Mobile < 768px: single column, LiveTicker 2 lines, TopWallets collapses to tab below feed

---

### 8.3 Signal card detail (`NotchedCard`)

Two-segment narrative:

```
┌── NotchedCard (strokeColor = pattern color at 40%) ──────────────────────┐
│  EyebrowTag: 🎯 PRE-CEX ACCUMULATION        EyebrowTag: 8 MIN AGO        │
│  ─────────────────────────────────────────────────────────────────────── │
│                                                                           │
│  Confidence  ████████░░  82                                              │
│  (hover → 5-component breakdown in BevelCard sm)                        │
│                                                                           │
│  EyebrowTag: WHAT                                                        │
│  ▸  WINTERMUTE  accumulated  MonoStat($1.8M)  MATIC                     │
│  ▸  3 transactions · 21 min span · Polygon                              │
│  ▸  Entity: Trading Firm  ·  30d PnL: +$12.4M                           │
│                                                                           │
│  EyebrowTag: WHAT IT MEANS                                               │
│  Market makers accumulating below average daily volume often precedes   │
│  liquidity events — exchange listings, OTC deals, or announcements.     │
│  MATIC currently at $0.52 · 24h vol $8.2M (below typical baseline).     │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────── │
│  [View on Arkham ↗]    [View 3 transactions ↗]                          │
└───────────────────────────────────────────────────────────────────────────┘
```

---

### 8.4 Confidence score hover tooltip

```
┌─ BevelCard size="sm" ──────────────────────────────┐
│  EyebrowTag: CONFIDENCE BREAKDOWN                  │
│                                                    │
│  Entity track record   28 / 30                    │
│  Pattern strength      18 / 25                    │
│  Token liquidity fit   14 / 15                    │
│  Recency context       12 / 15                    │
│  Convergence bonus     10 / 15                    │
│  ─────────────────────────────                    │
│  MonoStat: 82 / 100                               │
└────────────────────────────────────────────────────┘
```

---

### 8.5 LiveTicker (sticky bar)

Full-width horizontal marquee below Navbar. CSS `animation: marquee linear infinite`.

```tsx
// Sticky below navbar, full bleed
<div className="sticky top-[var(--navbar-height)] z-40 overflow-hidden
                border-b border-[--poly-stroke-dark]"
     style={{ background: 'var(--poly-primary)' }}>
  <div className="flex items-center animate-marquee gap-8 py-1.5 px-4 whitespace-nowrap">
    <span className="flex items-center gap-1.5 text-[--poly-orange]"
          style={{ fontFamily: 'var(--poly-font-mono)', fontSize: 11 }}>
      <span className="w-1.5 h-1.5 rounded-full bg-[--poly-orange] animate-pulse" />
      LIVE
    </span>
    {signals.map(s => (
      <span key={s.id} className="text-[11px] text-white/60"
            style={{ fontFamily: 'var(--poly-font-mono)' }}>
        {s.entity_name} · {s.what_text} · {relativeTime(s.observed_at)}
      </span>
    ))}
  </div>
</div>
```

---

## 9. i18n Keys (`alpha.*`)

```
alpha.title
alpha.subtitle
alpha.powered_by
alpha.stats.wallets
alpha.stats.signals_today
alpha.stats.active_entities
alpha.stats.last_signal
alpha.convergence.heading
alpha.convergence.interpretation
alpha.card.what
alpha.card.what_it_means
alpha.card.confidence
alpha.card.view_arkham
alpha.card.view_txs
alpha.card.new_badge
alpha.legend.title
alpha.legend.filter_hint
alpha.top_wallets.title
alpha.methodology.heading
alpha.methodology.data_source
alpha.methodology.signal_detection
alpha.methodology.confidence
alpha.methodology.refresh
alpha.methodology.disclaimer
alpha.patterns.pre_cex.name
alpha.patterns.pre_cex.meaning     ← template string, interpolated at runtime
alpha.patterns.bridge_buy.name
alpha.patterns.bridge_buy.meaning
alpha.patterns.lp_position.name
alpha.patterns.lp_position.meaning
alpha.patterns.stable_rotation.name
alpha.patterns.stable_rotation.meaning
alpha.patterns.convergence.name
alpha.patterns.convergence.meaning
alpha.patterns.dca_dump.name
alpha.patterns.dca_dump.meaning
alpha.patterns.pre_gov.name
alpha.patterns.pre_gov.meaning
alpha.dashboard_card.heading
alpha.dashboard_card.cta
alpha.nav.label
```

---

## 10. Env Variables

```
ARKHAM_API_KEY=3652c57f-6901-4ec9-9eb4-fa7545ff2664   # already tested ✓
CRON_SECRET=…                                          # generate
SUPABASE_SERVICE_ROLE_KEY=…                            # already in project
```

---

## 11. Effort Estimate

| Phase | Content | Hours |
|---|---|---|
| 1 | Supabase migration + `arkham-client.ts` + types | 3.0 |
| 2 | 7 pattern detectors | 4.0 |
| 3 | Confidence scoring + interpretation templates | 2.0 |
| 4 | Cron route + refresh pipeline | 2.0 |
| 5 | `/alpha` page shell + LiveTicker + StatsBar | 2.5 |
| 6 | `SignalCard` (NotchedCard) + `SignalFeed` + Realtime + animations | 3.0 |
| 7 | `ConvergenceAlert` + `PatternLegend` + `TopWalletsTable` | 2.0 |
| 8 | `MethodologyPanel` + Dashboard entry card + Navbar link | 1.5 |
| 9 | i18n (6 langs × ~35 keys) | 2.0 |
| 10 | Seed script + first real signal E2E test | 1.5 |
| **Total** | | **~23.5h** |

Split into 3 commits:
1. Backend + migration (Phases 1–4)
2. `/alpha` frontend shell + cards (Phases 5–7)
3. Dashboard integration + i18n + ship (Phases 8–10)

---

## 12. Pre-flight Checklist

- [x] `ARKHAM_API_KEY` working (tested `GET /chains` → 15 chains)
- [ ] Credit balance checked on Arkham dashboard
- [ ] Initial wallet list: 15–20 entities curated via `/intelligence/search`
- [ ] Vercel paid plan confirmed (for 5-min Cron)
- [ ] `CRON_SECRET` generated and added to Vercel env vars

---

## 13. Future Upgrades (v2+)

- **Arkham WebSocket** — replace 5-min cron with real-time streaming
- **Telegram bot push** — high-confidence (> 85) signals to Polnation alpha-feed channel
- **Polymarket layer** — Arkham's full Polymarket API as 8th pattern type
- **Sound effects** — opt-in subtle ping on convergence signals
