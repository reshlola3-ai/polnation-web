import { createPublicClient, formatUnits, http, parseAbi, parseUnits, type Address } from 'viem'
import { polygon } from 'viem/chains'

export const USDC_POLYGON =
  '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as const

export const AAVE_POOL_POLYGON =
  '0x794a61358D6845594F94dc1DB02A252b5b4814aD' as const

// aToken for NATIVE USDC on Aave V3 Polygon (aPolUSDCn).
// The deployed AlphaYieldStrategy's aaveBalance() reads the wrong aToken
// (aPolUSDC, the bridged-USDC.e one) and always returns 0, so off-chain
// reads must query this token's balanceOf(strategy) directly.
export const AUSDC_NATIVE_POLYGON =
  '0xA4D94019934D8333Ef880ABFFbF2FDd611C762BD' as const

export const ERC20_BALANCE_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
])

export const ALPHA_STAKE_ABI = parseAbi([
  'function stake(uint256 amount, uint8 tierId)',
  'function stakeWithPermit(uint256 amount, uint8 tierId, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function withdraw(uint256 positionId)',
  'function emergencyUnstake(uint256 positionId)',
  'function nextPositionId() view returns (uint256)',
  'function totalStaked() view returns (uint256)',
  'function aaveBalance() view returns (uint256)',
  'function totalAssets() view returns (uint256)',
  'function idleBalance() view returns (uint256)',
  'function MIN_STAKE() view returns (uint256)',
  'function owner() view returns (address)',
  'function getPosition(uint256 positionId) view returns (address user, uint256 amount, uint8 tierId, uint64 startTime, uint64 unlockTime, bool closed)',
  'function getUserPositions(address user) view returns (uint256[])',
  'function ownerWithdrawInstant(address to, uint256 amount)',
  'function queueWithdrawal(address to, uint256 amount) returns (uint256)',
  'function executeWithdrawal(uint256 withdrawalId)',
  'function cancelWithdrawal(uint256 withdrawalId)',
  'function nextWithdrawalId() view returns (uint256)',
  'function pendingWithdrawals(uint256 withdrawalId) view returns (address to, uint256 amount, uint256 executeAfter, bool executed, bool cancelled)',
  'event Staked(uint256 indexed positionId, address indexed user, uint256 amount, uint8 tierId, uint64 unlockTime)',
  'event Withdrawn(uint256 indexed positionId, address indexed user, uint256 amount)',
  'event EarlyUnstaked(uint256 indexed positionId, address indexed user, uint256 returned, uint256 penalty)',
])

export const ALPHA_TIERS = [
  { id: 0, days: 15, dailyRateBps: 100 },
  { id: 1, days: 30, dailyRateBps: 110 },
  { id: 2, days: 60, dailyRateBps: 120 },
  { id: 3, days: 150, dailyRateBps: 130 },
  { id: 4, days: 300, dailyRateBps: 150 },
] as const

export const OWNER_WITHDRAW_TIMELOCK_USDC = 50_000

export function getAlphaStakeAddress(): Address | null {
  const addr = process.env.NEXT_PUBLIC_ALPHASTAKE_ADDRESS
  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) return null
  return addr as Address
}

export function getAlphaStrategyAddress(): Address | null {
  const addr = process.env.NEXT_PUBLIC_ALPHA_STRATEGY_ADDRESS
  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) return null
  return addr as Address
}

export function getAlphaPublicClient() {
  return createPublicClient({
    chain: polygon,
    transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
  })
}

export function usdcFromUnits(value: bigint): number {
  return Number(formatUnits(value, 6))
}

export function usdcToUnits(value: number): bigint {
  return parseUnits(value.toFixed(6), 6)
}

export type OnChainPosition = {
  positionId: number
  user: string
  amountUsdc: number
  amountRaw: string
  tierId: number
  tierDays: number
  startTime: string
  unlockTime: string
  closed: boolean
  status: 'active' | 'matured' | 'closed'
}
