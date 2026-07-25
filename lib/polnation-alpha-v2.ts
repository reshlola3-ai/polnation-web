import { createPublicClient, formatUnits, http, parseAbi, parseUnits, type Address } from 'viem'
import { polygon } from 'viem/chains'

export const USDC_POLYGON =
  '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as const

export const USDT_POLYGON =
  '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' as const

export const NFPM_POLYGON =
  '0xC36442b4a4522E871399CD717aBDD847Ab11FE88' as const

export const POLNATION_ALPHA_V2_ABI = parseAbi([
  'function register(string username, string referrerUsername)',
  'function deposit(uint256 amount, uint8 planId)',
  'function claimRewards(uint256 amount)',
  'function compoundRewards(uint256 amount, uint8 planId)',
  'function pause()',
  'function unpause()',
  'function authorizeLpOperator(address operator)',
  'function revokeLpOperator(address operator)',
  'function owner() view returns (address)',
  'function ROOT_WALLET() view returns (address)',
  'function lpPositionId() view returns (uint256)',
  'function paused() view returns (bool)',
  'function users(address) view returns (address referrer, string username, bool registered, uint256 userId, uint256 totalActiveDeposit, uint256 teamActiveDeposit, uint256 teamTotalDeposit, uint256 teamTotalCompound, uint256 totalDeposited, uint256 totalWithdrawn, uint256 totalCompounded)',
  'function getDepositCount(address addr) view returns (uint256)',
  'function getDepositInfo(address addr, uint256 index) view returns (uint256 amount, uint256 startTime, uint256 endTime, uint8 planId, bool claimed, bool matured, uint256 expectedROI, uint256 generatedROI)',
  'function getAvailableRewards(address addr) view returns (uint256 totalAvailable, uint256 maturedAvailable, uint256 dailyReserve, uint256 networkAvailable, uint256 totalReferral, uint256 totalLeadership)',
  'function getContractStats() view returns (uint256 registeredUsers, uint256 activeUsers, uint256 launchDate)',
  'function getPlanInfo(uint8 planId) view returns (uint256 duration, uint256 totalROI)',
])

export const ALPHA_LP_CONTROLLER_ABI = parseAbi([
  'function owner() view returns (address)',
  'function lpTokenId() view returns (uint256)',
  'function positionManager() view returns (address)',
  'function decreaseLiquidity(uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) returns (uint256 amount0, uint256 amount1)',
  'function collect(address to, uint128 amount0Max, uint128 amount1Max) returns (uint256 amount0, uint256 amount1)',
  'function emergencyExit(address to)',
  'function reclaimLpNft()',
  'function transferLpNft(address to)',
  'function emergencyWithdrawTokens(address token, address to, uint256 amount)',
])

export const NFPM_VIEW_ABI = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
])

export const ERC20_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
])

/** Plans: duration days + total ROI bps (450 = 4.5%) */
export const ALPHA_V2_PLANS = [
  { id: 0, days: 15, totalRoiBps: 450, label: '15d · 4.5%' },
  { id: 1, days: 30, totalRoiBps: 3300, label: '30d · 33%' },
  { id: 2, days: 60, totalRoiBps: 7000, label: '60d · 70%' },
  { id: 3, days: 90, totalRoiBps: 12000, label: '90d · 120%' },
  { id: 4, days: 300, totalRoiBps: 40000, label: '300d · 400%' },
] as const

export const ALPHA_V2_MIN_DEPOSIT_USDC = 100
export const ALPHA_V2_ROOT_USERNAME = 'alpha'

export function getPolnationAlphaV2Address(): Address | null {
  const addr = process.env.NEXT_PUBLIC_POLNATION_ALPHA_V2_ADDRESS
  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) return null
  return addr as Address
}

export function getAlphaLpControllerAddress(): Address | null {
  const addr = process.env.NEXT_PUBLIC_POLNATION_ALPHA_V2_CONTROLLER
  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) return null
  return addr as Address
}

export function getAlphaV2LpTokenId(): bigint | null {
  const raw = process.env.NEXT_PUBLIC_POLNATION_ALPHA_V2_LP_TOKEN_ID
  if (!raw || !/^\d+$/.test(raw)) return null
  return BigInt(raw)
}

export function getAlphaV2PublicClient() {
  return createPublicClient({
    chain: polygon,
    transport: http(
      process.env.NEXT_PUBLIC_ALCHEMY_POLYGON_URL ||
        process.env.POLYGON_RPC_URL ||
        'https://polygon-rpc.com'
    ),
  })
}

export function usdcFromUnits(value: bigint): number {
  return Number(formatUnits(value, 6))
}

export function usdcToUnits(value: number): bigint {
  return parseUnits(value.toFixed(6), 6)
}

export type AlphaV2DepositRow = {
  index: number
  amountUsdc: number
  startTime: number
  endTime: number
  planId: number
  claimed: boolean
  matured: boolean
  expectedRoiUsdc: number
  generatedRoiUsdc: number
}
