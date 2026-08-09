/**
 * Malaysia Agentic rate policy.
 *
 * This is intentionally enforced in application code rather than profit_tiers:
 * admins may edit the global tiers, but those edits must never override this rule.
 */
export const MALAYSIA_COUNTRY_CODE = 'MY'
export const MALAYSIA_LOCK_MIN_USDC = 500
export const MALAYSIA_LOCK_RATE_PERCENT = 1.2

export function hasMalaysiaLockedAgenticRate(
  countryCode: string | null | undefined,
  usdcBalance: number,
): boolean {
  return (
    countryCode?.trim().toUpperCase() === MALAYSIA_COUNTRY_CODE &&
    usdcBalance >= MALAYSIA_LOCK_MIN_USDC
  )
}

export function resolveAgenticRatePercent(
  countryCode: string | null | undefined,
  usdcBalance: number,
  tierRatePercent: number,
): number {
  return hasMalaysiaLockedAgenticRate(countryCode, usdcBalance)
    ? MALAYSIA_LOCK_RATE_PERCENT
    : tierRatePercent
}
