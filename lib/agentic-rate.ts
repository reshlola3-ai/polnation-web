/**
 * Hard-coded Agentic rate locks.
 *
 * Enforced in application code (calculate + distribute), not profit_tiers,
 * so admin tier edits cannot override these policies.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const LOCKED_AGENTIC_RATE_PERCENT = 1.2
export const LOCKED_AGENTIC_MIN_USDC = 500

export const MALAYSIA_COUNTRY_CODE = 'MY'
/** @deprecated use LOCKED_AGENTIC_MIN_USDC */
export const MALAYSIA_LOCK_MIN_USDC = LOCKED_AGENTIC_MIN_USDC
/** @deprecated use LOCKED_AGENTIC_RATE_PERCENT */
export const MALAYSIA_LOCK_RATE_PERCENT = LOCKED_AGENTIC_RATE_PERCENT

/** Root username whose entire downline tree is rate-locked at ≥ $500. */
export const WEHAPPY_USERNAME = 'WEHAPPY'

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
  underWehappy?: boolean
}): boolean {
  if (params.usdcBalance < LOCKED_AGENTIC_MIN_USDC) return false
  if (hasMalaysiaLockedAgenticRate(params.countryCode, params.usdcBalance)) return true
  if (params.underWehappy) return true
  return false
}

export function resolveAgenticRatePercent(
  countryCode: string | null | undefined,
  usdcBalance: number,
  tierRatePercent: number,
  opts?: { underWehappy?: boolean },
): number {
  return isAgenticRateLocked({
    countryCode,
    usdcBalance,
    underWehappy: opts?.underWehappy,
  })
    ? LOCKED_AGENTIC_RATE_PERCENT
    : tierRatePercent
}

/**
 * Load every descendant of WEHAPPY (all depths, not including WEHAPPY themself).
 * Used by airdrop calculate/distribute so the lock survives global tier edits.
 */
export async function loadWehappyDownlineIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<Set<string>> {
  const { data: roots, error: rootErr } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', WEHAPPY_USERNAME)

  if (rootErr) throw new Error(`WEHAPPY lookup failed: ${rootErr.message}`)

  const root = (roots || []).find(
    (r) => (r.username as string | null)?.trim().toUpperCase() === WEHAPPY_USERNAME,
  )
  if (!root?.id) return new Set()

  const rootId = root.id as string
  const childrenOf = new Map<string, string[]>()

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, referrer_id')
      .range(from, from + 999)
    if (error) throw new Error(`profiles load for WEHAPPY tree failed: ${error.message}`)
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
  const stack = [...(childrenOf.get(rootId) || [])]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (downline.has(id)) continue
    downline.add(id)
    const kids = childrenOf.get(id)
    if (kids) stack.push(...kids)
  }
  return downline
}
