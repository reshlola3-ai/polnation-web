// Earning tiers — must match database profit_tiers table.
// rate is daily rate as decimal (0.0075 = 0.75%). Distribution: once per 24h.
export const TIERS = [
  { min: 0, max: 9.99, rate: 0, name: 'Visitor' },
  { min: 10, max: 19.99, rate: 0.0075, name: 'Resident' },
  { min: 20, max: 99.99, rate: 0.009, name: 'Citizen' },
  { min: 100, max: 499.99, rate: 0.0105, name: 'Representative' },
  { min: 500, max: 1999.99, rate: 0.012, name: 'Senator' },
  { min: 2000, max: 9999.99, rate: 0.015, name: 'Ambassador' },
  { min: 10000, max: Infinity, rate: 0.018, name: 'Chancellor' },
] as const

export type Tier = (typeof TIERS)[number] & { index: number }

export function getTier(balance: number): Tier {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].min) return { ...TIERS[i], index: i }
  }
  return { ...TIERS[0], index: 0 }
}

export function getNextTier(balance: number) {
  const i = getTier(balance).index
  return i < TIERS.length - 1 ? TIERS[i + 1] : null
}

// Commission rates by referral level
export const COMMISSION_RATES: Record<number, number> = {
  1: 0.10, 2: 0.05, 3: 0.04, 4: 0.03, 5: 0.02, 6: 0.01,
}

export const TIER_ICONS: Record<string, string> = {
  Visitor: '👁️',
  Resident: '🏠',
  Citizen: '🎖️',
  Representative: '📋',
  Senator: '🏛️',
  Ambassador: '🌐',
  Chancellor: '👑',
}

export interface ProfitData {
  totalStakingProfit: number
  totalCommissionProfit: number
  availableWithdraw: number
  hasSignature: boolean
  // 严格签名判据（含 nonce 校验）：false = 没有当前可用签名（从没签 / 质押后 nonce 失效）
  canWithdraw: boolean
  communityPrizePool: number
  currentLevelName: string
  communityDailyRate: number
  communityDailyEarnings: number
  baseCommunityDailyEarnings: number
  momentumMultiplier: number
  momentumDaysUntilDecay: number
  momentumNextMultiplier: number
  momentumRecentReferrals: number
  teamEffectiveVolume: number
  teamNextUnlockVolume: number
  teamNextLevelName: string
  communityTotalEarned: number
  taskBonus: number
  teamVolumeOnly: number
  currentLevelNumber: number
  lastDistributionAt: string | null
  intervalSeconds: number
}

export interface ReferralData {
  level: number
  usdc_balance: number
}
