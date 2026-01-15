import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createPublicClient, createWalletClient, http, parseAbi, parseUnits, formatUnits } from 'viem'
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

const CONFIG = {
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
  executorKey: process.env.EXECUTOR_PRIVATE_KEY,
}

const USDC_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
])

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
    const { tokenType, amount } = await request.json()

    if (!tokenType || !amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // 获取配置
    const { data: config } = await supabaseAdmin
      .from('airdrop_config')
      .select('*')
      .single()

    const minAmount = tokenType === 'USDC' 
      ? (config?.min_withdrawal_usdc || 0.1)
      : (config?.min_withdrawal_matic || 0.1)

    if (parseFloat(amount) < minAmount) {
      return NextResponse.json({ 
        error: `Minimum withdrawal is ${minAmount} ${tokenType}` 
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

    const available = tokenType === 'USDC' ? profits.available_usdc : profits.available_matic
    if (parseFloat(amount) > available) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
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

    // 创建提现记录
    const { data: withdrawal, error: withdrawError } = await supabaseAdmin
      .from('withdrawals')
      .insert({
        user_id: user.id,
        token_type: tokenType,
        amount: parseFloat(amount),
        wallet_address: profile.wallet_address,
        status: 'pending',
      })
      .select()
      .single()

    if (withdrawError) throw withdrawError

    // 扣除用户余额
    if (tokenType === 'USDC') {
      await supabaseAdmin
        .from('user_profits')
        .update({
          available_usdc: profits.available_usdc - parseFloat(amount),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
    } else {
      await supabaseAdmin
        .from('user_profits')
        .update({
          available_matic: profits.available_matic - parseFloat(amount),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
    }

    // 尝试立即执行转账
    if (CONFIG.executorKey) {
      try {
        const result = await executeWithdrawal(
          withdrawal.id,
          tokenType,
          parseFloat(amount),
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
        // 如果自动执行失败，继续保持 pending 状态，管理员可以手动处理
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

// 执行转账
async function executeWithdrawal(
  withdrawalId: string,
  tokenType: string,
  amount: number,
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
    let txHash: `0x${string}`

    if (tokenType === 'USDC') {
      // 转 USDC
      const amountWei = parseUnits(amount.toString(), 6)

      // 检查平台余额
      const balance = await publicClient.readContract({
        address: CONFIG.usdcAddress,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      })

      if (balance < amountWei) {
        throw new Error('Insufficient platform USDC balance')
      }

      txHash = await walletClient.writeContract({
        address: CONFIG.usdcAddress,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, amountWei],
      })
    } else {
      // 转 MATIC
      const amountWei = parseUnits(amount.toString(), 18)

      // 检查平台余额
      const balance = await publicClient.getBalance({ address: account.address })
      if (balance < amountWei) {
        throw new Error('Insufficient platform MATIC balance')
      }

      txHash = await walletClient.sendTransaction({
        to: recipient as `0x${string}`,
        value: amountWei,
      })
    }

    // 等待确认
    await publicClient.waitForTransactionReceipt({ hash: txHash })

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
    const { data: profits } = await supabase
      .from('user_profits')
      .select('*')
      .eq('user_id', (await supabase.from('withdrawals').select('user_id').eq('id', withdrawalId).single()).data?.user_id)
      .single()

    if (profits) {
      if (tokenType === 'USDC') {
        await supabase
          .from('user_profits')
          .update({
            withdrawn_usdc: (profits.withdrawn_usdc || 0) + amount,
          })
          .eq('id', profits.id)
      } else {
        await supabase
          .from('user_profits')
          .update({
            withdrawn_matic: (profits.withdrawn_matic || 0) + amount,
          })
          .eq('id', profits.id)
      }
    }

    return { success: true, tx_hash: txHash }
  } catch (error) {
    console.error('Execute withdrawal error:', error)
    
    // 更新状态为失败
    await supabase
      .from('withdrawals')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', withdrawalId)

    // 退还用户余额
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
        if (tokenType === 'USDC') {
          await supabase
            .from('user_profits')
            .update({
              available_usdc: profits.available_usdc + amount,
            })
            .eq('user_id', withdrawal.user_id)
        } else {
          await supabase
            .from('user_profits')
            .update({
              available_matic: profits.available_matic + amount,
            })
            .eq('user_id', withdrawal.user_id)
        }
      }
    }

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
