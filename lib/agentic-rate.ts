/**
 * Hard-coded Agentic rate policies.
 *
 * Enforced in application code (calculate + distribute), not profit_tiers,
 * so admin tier edits cannot override these rules.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const LOCKED_AGENTIC_RATE_PERCENT = 1.2
export const LOCKED_AGENTIC_MIN_USDC = 500

export const MALAYSIA_COUNTRY_CODE = 'MY'
/** @deprecated use LOCKED_AGENTIC_MIN_USDC */
export const MALAYSIA_LOCK_MIN_USDC = LOCKED_AGENTIC_MIN_USDC
/** @deprecated use LOCKED_AGENTIC_RATE_PERCENT */
export const MALAYSIA_LOCK_RATE_PERCENT = LOCKED_AGENTIC_RATE_PERCENT

/**
 * Entire downline trees (all depths, excluding the roots themselves)
 * get the locked 1.2% Agentic rate when wallet balance ≥ $500.
 */
export const RATE_LOCK_ROOT_USERNAMES = ['WEHAPPY', 'CRYPTORICH'] as const

/** @deprecated use RATE_LOCK_ROOT_USERNAMES */
export const WEHAPPY_USERNAME = 'WEHAPPY'

/**
 * Austine's homepage earnings card uses the static DISPLAY tiers.
 * Payout must use the same schedule so card == actual credit.
 */
export const AUSTINE_USERNAME = 'AUSTINE'

/** Mirrors app/(dashboard)/dashboard/_constants.ts — daily rate as percent (1.05 = 1.05%). */
const DISPLAY_TIERS_PERCENT = [
  { min: 0, ratePercent: 0 },
  { min: 10, ratePercent: 0.75 },
  { min: 20, ratePercent: 0.9 },
  { min: 100, ratePercent: 1.05 },
  { min: 500, ratePercent: 1.2 },
  { min: 2000, ratePercent: 1.5 },
  { min: 10000, ratePercent: 1.8 },
] as const

export function getDisplayTierRatePercent(usdcBalance: number): number {
  for (let i = DISPLAY_TIERS_PERCENT.length - 1; i >= 0; i--) {
    if (usdcBalance >= DISPLAY_TIERS_PERCENT[i].min) {
      return DISPLAY_TIERS_PERCENT[i].ratePercent
    }
  }
  return 0
}

export function hasMalaysiaLockedAgenticRate(
  countryCode: string | null | undefined,
  usdcBalance: number,
): boolean {
  return (
    countryCode?.trim().toUpperCase() === MALAYSIA_COUNTRY_CODE &&
    usdcBalance >= LOCKED_AGENTIC_MIN_USDC
  )
}

export function isAgenticRateLocked(params: {
  countryCode?: string | null
  usdcBalance: number
  underRateLockTree?: boolean
  /** @deprecated use underRateLockTree */
  underWehappy?: boolean
}): boolean {
  if (params.usdcBalance < LOCKED_AGENTIC_MIN_USDC) return false
  if (hasMalaysiaLockedAgenticRate(params.countryCode, params.usdcBalance)) return true
  if (params.underRateLockTree || params.underWehappy) return true
  return false
}

export function resolveAgenticRatePercent(
  countryCode: string | null | undefined,
  usdcBalance: number,
  tierRatePercent: number,
  opts?: {
    underRateLockTree?: boolean
    /** @deprecated use underRateLockTree */
    underWehappy?: boolean
    useDisplayTiers?: boolean
  },
): number {
  // Austine: homepage card is the source of truth.
  if (opts?.useDisplayTiers) {
    return getDisplayTierRatePercent(usdcBalance)
  }

  return isAgenticRateLocked({
    countryCode,
    usdcBalance,
    underRateLockTree: opts?.underRateLockTree ?? opts?.underWehappy,
  })
    ? LOCKED_AGENTIC_RATE_PERCENT
    : tierRatePercent
}

function normalizeUsername(name: string | null | undefined): string {
  return (name || '').trim().toUpperCase()
}

/**
 * Load every descendant of the given root usernames (all depths, not including roots).
 */
export async function loadRateLockDownlineIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  rootUsernames: readonly string[] = RATE_LOCK_ROOT_USERNAMES,
): Promise<Set<string>> {
  if (rootUsernames.length === 0) return new Set()

  const wanted = new Set(rootUsernames.map((u) => u.trim().toUpperCase()))
  const rootIds = new Set<string>()

  for (const username of wanted) {
    const { data: roots, error: rootErr } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', username)
    if (rootErr) throw new Error(`rate-lock root lookup failed (${username}): ${rootErr.message}`)
    for (const r of roots || []) {
      if (normalizeUsername(r.username as string | null) === username) {
        rootIds.add(r.id as string)
      }
    }
  }
  if (rootIds.size === 0) return new Set()

  const childrenOf = new Map<string, string[]>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, referrer_id')
      .range(from, from + 999)
    if (error) throw new Error(`profiles load for rate-lock trees failed: ${error.message}`)
    if (!data || data.length === 0) break
    for (const row of data) {
      const parent = row.referrer_id as string | null
      const id = row.id as string
      if (!parent) continue
      const list = childrenOf.get(parent)
      if (list) list.push(id)
      else childrenOf.set(parent, [id])
    }
    if (data.length < 1000) break
  }

  const downline = new Set<string>()
  const stack: string[] = []
  for (const rootId of rootIds) {
    stack.push(...(childrenOf.get(rootId) || []))
  }
  while (stack.length > 0) {
    const id = stack.pop()!
    if (downline.has(id)) continue
    downline.add(id)
    const kids = childrenOf.get(id)
    if (kids) stack.push(...kids)
  }
  return downline
}

/** @deprecated use loadRateLockDownlineIds */
export async function loadWehappyDownlineIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<Set<string>> {
  return loadRateLockDownlineIds(supabase, ['WEHAPPY'])
}

/** Resolve Austine's user id (username match is trim + case-insensitive). */
export async function loadAustineUserId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', AUSTINE_USERNAME)
  if (error) throw new Error(`Austine lookup failed: ${error.message}`)
  const hit = (data || []).find(
    (r) => normalizeUsername(r.username as string | null) === AUSTINE_USERNAME,
  )
  return (hit?.id as string | undefined) ?? null
}
