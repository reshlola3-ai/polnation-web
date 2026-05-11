# Accruing Profit Ticker — Implementation Plan

**Status:** Plan only — not yet executed.
**Created:** 2026-05-12
**Scope:** Frontend-only cosmetic ticker. **No backend changes.**

---

## 1. What this is

A purely visual number that ticks up every second on the user's dashboard, showing the "profit they would receive if admin distributed right now." It feels alive — the number grows in real-time.

It is **not** a new reward stream. The actual payout still comes from the existing 24-hour admin distribution flow (`app/(admin)/admin/airdrop`). When admin clicks "Distribute" (whether after 1 hour or 24 hours), the user's real `availableWithdraw` jumps up by a full day's worth — which is **already how the existing system works** (`profit = balance × rate`, no time proration). The ticker just visualizes the accrual between distributions.

---

## 2. What stays exactly the same

- `permit_signatures` table — already exists, ticker only **reads** the `hasSignature` flag
- `profit_tiers` table — already exists, ticker uses the same tier→rate mapping
- `airdrop_config.last_distribution_at` — already exists, ticker uses it as the "ticker start" timestamp
- `app/(admin)/admin/airdrop` — admin flow untouched
- `/api/admin/airdrop/distribute` — distribution logic untouched
- `profitData.availableWithdraw` — the real claimable balance, untouched
- The 24h interval, the tier rates, the Merkle distribution — all untouched

---

## 3. What gets added

### 3a. One new API endpoint (read-only)

`GET /api/profits/accrual-state`

Returns the minimal state the ticker needs:

```ts
{
  hasSignature: boolean,            // already known client-side; mirror for completeness
  usdcBalance: number,              // on-chain balanceOf, cached 60s
  tierRate: number | null,          // rate_percent / 100, e.g. 0.012 for Gold
  tierName: string | null,          // 'Gold', 'Diamond', etc.
  lastDistributionAt: string | null,// ISO timestamp from airdrop_config
  intervalSeconds: number,          // typically 86400
  targetDaily: number,              // balance × tierRate, cap value
}
```

This consolidates the three existing reads (`profit_tiers`, `airdrop_config`, on-chain `balanceOf`) into one call. ~30 lines of code, reuses the existing supabase + viem clients.

### 3b. One new client component

`components/dashboard/AccruingTicker.tsx`

```
Props: { state: AccrualState }

Behavior:
  • Computes per-second rate = targetDaily / intervalSeconds
  • elapsed = now − lastDistributionAt  (seconds, clamped to [0, intervalSeconds])
  • accrued = min(elapsed × perSecondRate, targetDaily)
  • Updates display via requestAnimationFrame, ~1 update/sec
  • Formats with 6 decimal places so the last digit visibly ticks
  • Disabled / hidden when:
      - hasSignature = false  → shows "Sign to activate" CTA instead
      - tierRate = null       → shows "Balance below minimum tier"
      - lastDistributionAt is null → shows "Waiting for first distribution"
```

### 3c. Integration point

Modify `app/(dashboard)/dashboard/DashboardClient.tsx` — only the Withdrawable card block (currently lines 487-509):

```tsx
{/* Withdrawable */}
<NotchedCard pad={16} className="min-w-0">
  <div className="flex flex-col items-start gap-2">
    <div className="w-8 h-8 …"><ArrowUpRight … /></div>
    <Link href="/earnings" …>
      <MonoStat prefix="$" value={profitData.availableWithdraw.toFixed(2)} />
    </Link>
    <div className="flex items-center gap-0.5">
      <EyebrowTag>{t('assetAvailableTitle')}</EyebrowTag>
      <HelpCircle … />
    </div>

    {/* ▼ NEW: accruing ticker subline */}
    <AccruingTicker state={accrualState} />
    {/* ▲ */}
  </div>
</NotchedCard>
```

The ticker renders as a thin subline under the existing "Withdrawable" number:

```
$0.00
WITHDRAWABLE
  +$0.001247 accruing…   ← animated, color #00e28a
```

When the admin distributes, the next polling tick refreshes `lastDistributionAt`, which resets `elapsed` to ~0, so the ticker visibly resets to `+$0.000000` and starts climbing again. `availableWithdraw` simultaneously jumps up — the visual handoff feels natural.

---

## 4. Math precision

- `targetDaily = balance × rate_percent / 100`
- `perSecondRate = targetDaily / 86400` (or whatever `intervalSeconds` is in admin config)
- With `balance = $1000`, Gold tier 1.05%/day → daily = $10.50 → per-second = $0.0001215
  - So 6 decimal places lets the last digit shift every ~8 seconds → not too fast, not too slow
- With Elite tier $50K → daily = $900 → per-second = $0.01042 → ticker visibly jumps every second
- Clamp at `targetDaily` so even if the user keeps the page open past 24h, the number stops at "1 day"

---

## 5. State refresh strategy

- On mount: fetch `/api/profits/accrual-state` once
- Re-fetch every 60s (covers admin distribution events without WebSockets)
- Re-fetch immediately when window regains focus (`visibilitychange` listener)
- The ticker math runs purely client-side between fetches — server load stays minimal

---

## 6. Edge cases

| Case | Behavior |
|---|---|
| User hasn't signed permit | Show "Sign to start earning" link → existing signature flow |
| USDC balance below minimum tier (< $10) | Show "Add USDC to start accruing" hint |
| User's balance changes mid-day | Ticker re-fetches on next 60s tick; new rate applies forward |
| Admin distributes mid-page-view | `lastDistributionAt` advances → ticker resets to ~0, `availableWithdraw` jumps |
| `lastDistributionAt` is null (very first ever) | Ticker shows "Activates after first distribution cycle" |
| Page is left open for 24h+ | Ticker caps at `targetDaily`, stops climbing visually |
| Page is open during `interval_seconds` config change | Next 60s fetch picks up new value, ticker reflects new pace |

---

## 7. Why this is safe

- **No new tables, no schema migration** — every value already lives in the existing DB or on-chain
- **No write paths** — only adds a read-only API endpoint
- **No effect on actual payouts** — `availableWithdraw` and the Merkle distribution are untouched
- **Admin behavior unchanged** — they still click the same button at the same cadence
- **If we want to remove the feature later**, delete one component + revert ~15 lines in `DashboardClient.tsx`

---

## 8. File touch list

```
app/api/profits/accrual-state/route.ts          ← NEW (~50 lines)
components/dashboard/AccruingTicker.tsx          ← NEW (~80 lines)
app/(dashboard)/dashboard/DashboardClient.tsx   ← +15 lines, ~3 lines diff for import
messages/{en,zh,vi,id,fr,es}.json                ← + 4 translation keys
                                                 (accruing, signToActivate,
                                                  needMinBalance, waitingFirstCycle)
```

---

## 9. Effort estimate

| Phase | Hours |
|---|---|
| `/api/profits/accrual-state` endpoint | 0.5 |
| `AccruingTicker` component + animation | 1.0 |
| Integration into Withdrawable card + states | 0.5 |
| i18n (6 languages) | 0.5 |
| Manual test (sign-in, distribute, balance change) | 0.5 |
| **Total** | **~3.0** |

Can ship in one commit.

---

## 10. Pre-flight checklist

- [ ] Confirm `airdrop_config.interval_seconds` is the source of truth for the 24h cadence
- [ ] Confirm `profit_tiers` table columns are `level, name, min_usdc, max_usdc, rate_percent, is_active`
- [ ] Confirm the existing on-chain USDC balance cache (60s) is acceptable for ticker accuracy
- [ ] Decide: ticker shown only on `/dashboard`, or also on `/earnings`?
- [ ] Decide: also expose to the Telegram lottery-mini route, or web dashboard only?

---

## 11. Out of scope (for future)

- WebSocket push for instant ticker reset on distribution (60s polling is enough for v1)
- Per-user custom rate override (current plan uses tier rate only)
- Animated number flip transitions (CSS-only fade is enough for v1)
- Showing a "next distribution in HH:MM:SS" countdown alongside the ticker (could be a v2 add-on)
