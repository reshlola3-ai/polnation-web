import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseAbi, 
  parseUnits, 
  formatUnits,
} from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function getSupabaseUser() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { supabase: null, user: null }
  
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
    },
  })
  
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// Polygon 合约地址
const ADDRESSES = {
  USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' as `0x${string}`,      // USDT on Polygon
  USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,      // Native USDC on Polygon
  WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' as `0x${string}`,    // Wrapped MATIC/POL
  QUICKSWAP_ROUTER: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff' as `0x${string}`, // QuickSwap V2 Router
}

// ABI
const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
])

const QUICKSWAP_ROUTER_ABI = parseAbi([
  // Swap USDT -> USDC
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
  // Swap USDT -> MATIC (ETH)
  'function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
  // Get amounts out
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)',
])

const CONFIG = {
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  executorKey: process.env.EXECUTOR_PRIVATE_KEY,
  // 滑点容忍度 (2%)
  slippageTolerance: 0.02,
}

// 用户请求提现
export async function POST(request: NextRequest) {
  const { user } = await getSupabaseUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { tokenType, amount, polAmount } = await request.json()

    // amount 现在是美元金额
    if (!tokenType || !amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // 支持 USDC 和 POL
    if (tokenType !== 'USDC' && tokenType !== 'POL') {
      return NextResponse.json({ error: 'Invalid token type. Use USDC or POL' }, { status: 400 })
    }

    // 获取配置
    const { data: config } = await supabaseAdmin
      .from('airdrop_config')
      .select('*')
      .single()

    const minAmount = config?.min_withdrawal_usdc || 0.1

    if (parseFloat(amount) < minAmount) {
      return NextResponse.json({ 
        error: `最低提现金额为 $${minAmount}` 
      }, { status: 400 })
    }

    // 获取用户利润
    const { data: profits } = await supabaseAdmin
      .from('user_profits')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!profits) {
      return NextResponse.json({ error: 'No profits available' }, { status: 400 })
    }

    // 检查可用余额（美元）
    const available = profits.available_usdc || 0
    if (parseFloat(amount) > available) {
      return NextResponse.json({ error: '余额不足' }, { status: 400 })
    }

    // 获取用户钱包地址
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single()

    if (!profile?.wallet_address) {
      return NextResponse.json({ error: 'No wallet connected' }, { status: 400 })
    }

    // 计算实际发送的代币数量
    const actualTokenAmount = tokenType === 'POL' && polAmount 
      ? parseFloat(polAmount) 
      : parseFloat(amount)

    // 创建提现记录
    const { data: withdrawal, error: withdrawError } = await supabaseAdmin
      .from('withdrawals')
      .insert({
        user_id: user.id,
        token_type: tokenType,
        amount: actualTokenAmount, // 实际代币数量
        usd_amount: parseFloat(amount), // 美元金额
        wallet_address: profile.wallet_address,
        status: 'pending',
      })
      .select()
      .single()

    if (withdrawError) throw withdrawError

    // 扣除用户余额（美元）
    await supabaseAdmin
      .from('user_profits')
      .update({
        available_usdc: profits.available_usdc - parseFloat(amount),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    // 尝试立即执行转账（通过 QuickSwap 兑换）
    if (CONFIG.executorKey) {
      try {
        const result = await executeSwapAndTransfer(
          withdrawal.id,
          tokenType,
          parseFloat(amount), // USD 金额
          actualTokenAmount,  // 实际代币数量
          profile.wallet_address,
          supabaseAdmin
        )

        if (result.success) {
          return NextResponse.json({
            success: true,
            message: 'Withdrawal completed',
            tx_hash: result.tx_hash,
          })
        }
      } catch (err) {
        console.error('Auto-execute failed:', err)
        // 如果自动执行失败，退还余额
        await refundBalance(user.id, parseFloat(amount), supabaseAdmin)
        
        // 更新提现状态为失败
        await supabaseAdmin
          .from('withdrawals')
          .update({
            status: 'failed',
            error_message: err instanceof Error ? err.message : 'Unknown error',
          })
          .eq('id', withdrawal.id)

        return NextResponse.json({
          error: err instanceof Error ? err.message : 'Transfer failed',
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Withdrawal request submitted',
      withdrawal_id: withdrawal.id,
    })
  } catch (error) {
    console.error('Withdrawal error:', error)
    return NextResponse.json({ error: 'Withdrawal failed' }, { status: 500 })
  }
}

// 退还余额
async function refundBalance(
  userId: string,
  amount: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  const { data: profits } = await supabase
    .from('user_profits')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (profits) {
    await supabase
      .from('user_profits')
      .update({
        available_usdc: profits.available_usdc + amount,
      })
      .eq('user_id', userId)
  }
}

// 通过 QuickSwap 兑换并转账
async function executeSwapAndTransfer(
  withdrawalId: string,
  tokenType: string,
  usdAmount: number,
  tokenAmount: number,
  recipient: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ success: boolean; tx_hash?: string }> {
  if (!CONFIG.executorKey) {
    throw new Error('Executor key not configured')
  }

  // 确保私钥格式正确
  const privateKey = CONFIG.executorKey.startsWith('0x') 
    ? CONFIG.executorKey as `0x${string}`
    : `0x${CONFIG.executorKey}` as `0x${string}`

  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({
    chain: polygon,
    transport: http(CONFIG.rpcUrl),
  })

  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http(CONFIG.rpcUrl),
  })

  // 更新状态为 processing
  await supabase
    .from('withdrawals')
    .update({ status: 'processing' })
    .eq('id', withdrawalId)

  try {
    // USDT 有 6 位小数
    // 计算需要的 USDT 数量（加上滑点缓冲）
    const usdtAmountIn = parseUnits((usdAmount * 1.03).toFixed(6), 6) // 多准备 3% 的 USDT

    // 检查平台 USDT 余额
    const usdtBalance = await publicClient.readContract({
      address: ADDRESSES.USDT,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    })

    if (usdtBalance < usdtAmountIn) {
      throw new Error(`Insufficient platform USDT balance. Need ${formatUnits(usdtAmountIn, 6)}, have ${formatUnits(usdtBalance, 6)}`)
    }

    // 检查 USDT 对 QuickSwap Router 的授权
    const allowance = await publicClient.readContract({
      address: ADDRESSES.USDT,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [account.address, ADDRESSES.QUICKSWAP_ROUTER],
    })

    // 如果授权不足，先授权
    if (allowance < usdtAmountIn) {
      console.log('Approving USDT for QuickSwap Router...')
      const approveHash = await walletClient.writeContract({
        address: ADDRESSES.USDT,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [ADDRESSES.QUICKSWAP_ROUTER, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')], // Max approval
      })
      await publicClient.waitForTransactionReceipt({ hash: approveHash })
      console.log('USDT approved')
    }

    let txHash: `0x${string}`
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600) // 10 分钟

    if (tokenType === 'USDC') {
      // USDT -> USDC 兑换路径
      const path = [ADDRESSES.USDT, ADDRESSES.USDC]
      
      // 获取预期输出
      const amountsOut = await publicClient.readContract({
        address: ADDRESSES.QUICKSWAP_ROUTER,
        abi: QUICKSWAP_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [usdtAmountIn, path],
      })

      const expectedOut = amountsOut[1]
      const minOut = parseUnits(usdAmount.toFixed(6), 6) // 至少要得到用户请求的数量

      if (expectedOut < minOut) {
        throw new Error(`Swap output too low. Expected ${formatUnits(expectedOut, 6)}, need ${usdAmount}`)
      }

      // 执行兑换，直接发送到用户钱包
      txHash = await walletClient.writeContract({
        address: ADDRESSES.QUICKSWAP_ROUTER,
        abi: QUICKSWAP_ROUTER_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [
          usdtAmountIn,
          minOut,
          path,
          recipient as `0x${string}`, // 直接发送到用户钱包
          deadline,
        ],
      })

    } else {
      // POL: USDT -> MATIC/POL 兑换路径 (USDT -> WMATIC -> unwrap)
      const path = [ADDRESSES.USDT, ADDRESSES.WMATIC]
      
      // 获取预期输出
      const amountsOut = await publicClient.readContract({
        address: ADDRESSES.QUICKSWAP_ROUTER,
        abi: QUICKSWAP_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [usdtAmountIn, path],
      })

      const expectedOut = amountsOut[1]
      // 使用前端计算的 POL 数量，减去 5% 滑点
      const minOut = parseUnits((tokenAmount * 0.95).toFixed(18), 18) // POL/MATIC 18 位小数

      console.log(`Swapping for POL: expected ${formatUnits(expectedOut, 18)}, min ${tokenAmount * 0.95}`)

      // 执行兑换，直接发送 MATIC/POL 到用户钱包
      txHash = await walletClient.writeContract({
        address: ADDRESSES.QUICKSWAP_ROUTER,
        abi: QUICKSWAP_ROUTER_ABI,
        functionName: 'swapExactTokensForETH',
        args: [
          usdtAmountIn,
          minOut,
          path,
          recipient as `0x${string}`, // 直接发送到用户钱包
          deadline,
        ],
      })
    }

    // 等待确认
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    if (receipt.status !== 'success') {
      throw new Error('Transaction failed')
    }

    // 更新记录
    await supabase
      .from('withdrawals')
      .update({
        status: 'completed',
        tx_hash: txHash,
        processed_at: new Date().toISOString(),
      })
      .eq('id', withdrawalId)

    // 更新用户已提现金额
    const { data: withdrawal } = await supabase
      .from('withdrawals')
      .select('user_id')
      .eq('id', withdrawalId)
      .single()

    if (withdrawal) {
      const { data: profits } = await supabase
        .from('user_profits')
        .select('*')
        .eq('user_id', withdrawal.user_id)
        .single()

      if (profits) {
        await supabase
          .from('user_profits')
          .update({
            withdrawn_usdc: (profits.withdrawn_usdc || 0) + usdAmount,
          })
          .eq('user_id', withdrawal.user_id)
      }
    }

    return { success: true, tx_hash: txHash }

  } catch (error) {
    console.error('Swap and transfer error:', error)
    throw error
  }
}

// 获取提现记录
export async function GET() {
  const { user } = await getSupabaseUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { data: withdrawals } = await supabaseAdmin
      .from('withdrawals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ withdrawals })
  } catch (error) {
    console.error('Error fetching withdrawals:', error)
    return NextResponse.json({ error: 'Failed to fetch withdrawals' }, { status: 500 })
  }
}
