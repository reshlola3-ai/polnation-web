import { NextRequest, NextResponse } from 'next/server'
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

// 合约地址
const ADDRESSES = {
  USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
  WPOL: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' as `0x${string}`,
  QUICKSWAP_ROUTER: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff' as `0x${string}`,
}

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
])

const QUICKSWAP_ROUTER_ABI = parseAbi([
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)',
])

const CONFIG = {
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  executorKey: process.env.EXECUTOR_PRIVATE_KEY,
}

// 测试 WPOL → USDC 兑换
export async function POST(request: NextRequest) {
  try {
    const { wpolAmount, recipient } = await request.json()

    if (!wpolAmount || !recipient) {
      return NextResponse.json({ 
        error: 'Missing parameters. Need: wpolAmount (number), recipient (address)' 
      }, { status: 400 })
    }

    if (!CONFIG.executorKey) {
      return NextResponse.json({ error: 'Executor key not configured' }, { status: 500 })
    }

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

    // WPOL 有 18 位小数
    const wpolAmountIn = parseUnits(wpolAmount.toString(), 18)

    // 1. 检查 WPOL 余额
    const wpolBalance = await publicClient.readContract({
      address: ADDRESSES.WPOL,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    })

    console.log(`WPOL Balance: ${formatUnits(wpolBalance, 18)}`)

    if (wpolBalance < wpolAmountIn) {
      return NextResponse.json({ 
        error: `Insufficient WPOL. Need ${wpolAmount}, have ${formatUnits(wpolBalance, 18)}` 
      }, { status: 400 })
    }

    // 2. 检查授权
    const allowance = await publicClient.readContract({
      address: ADDRESSES.WPOL,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [account.address, ADDRESSES.QUICKSWAP_ROUTER],
    })

    // 3. 如果授权不足，先授权
    if (allowance < wpolAmountIn) {
      console.log('Approving WPOL for QuickSwap Router...')
      const approveHash = await walletClient.writeContract({
        address: ADDRESSES.WPOL,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [ADDRESSES.QUICKSWAP_ROUTER, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
      })
      await publicClient.waitForTransactionReceipt({ hash: approveHash })
      console.log('WPOL approved:', approveHash)
    }

    // 4. 设置路径：WPOL → USDC
    const path = [ADDRESSES.WPOL, ADDRESSES.USDC]

    // 5. 获取预期输出
    const amountsOut = await publicClient.readContract({
      address: ADDRESSES.QUICKSWAP_ROUTER,
      abi: QUICKSWAP_ROUTER_ABI,
      functionName: 'getAmountsOut',
      args: [wpolAmountIn, path],
    })

    const expectedUSDC = amountsOut[1]
    // 设置最小输出（5% 滑点）
    const minOut = expectedUSDC * BigInt(95) / BigInt(100)

    console.log(`Expected USDC: ${formatUnits(expectedUSDC, 6)}`)
    console.log(`Min USDC (5% slippage): ${formatUnits(minOut, 6)}`)

    // 6. 执行 swap
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600) // 10 分钟

    const txHash = await walletClient.writeContract({
      address: ADDRESSES.QUICKSWAP_ROUTER,
      abi: QUICKSWAP_ROUTER_ABI,
      functionName: 'swapExactTokensForTokens',
      args: [
        wpolAmountIn,
        minOut,
        path,
        recipient as `0x${string}`,
        deadline,
      ],
    })

    console.log('Transaction hash:', txHash)

    // 7. 等待确认
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    if (receipt.status !== 'success') {
      return NextResponse.json({ error: 'Transaction failed' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'WPOL → USDC swap completed!',
      tx_hash: txHash,
      details: {
        wpolIn: wpolAmount,
        expectedUSDC: formatUnits(expectedUSDC, 6),
        recipient: recipient,
        polygonscan: `https://polygonscan.com/tx/${txHash}`,
      }
    })

  } catch (error) {
    console.error('Test swap error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Swap failed' 
    }, { status: 500 })
  }
}

// 获取当前 WPOL 余额和预估输出
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const wpolAmount = searchParams.get('amount') || '1'

    if (!CONFIG.executorKey) {
      return NextResponse.json({ error: 'Executor key not configured' }, { status: 500 })
    }

    const privateKey = CONFIG.executorKey.startsWith('0x') 
      ? CONFIG.executorKey as `0x${string}`
      : `0x${CONFIG.executorKey}` as `0x${string}`

    const account = privateKeyToAccount(privateKey)

    const publicClient = createPublicClient({
      chain: polygon,
      transport: http(CONFIG.rpcUrl),
    })

    // 获取 WPOL 余额
    const wpolBalance = await publicClient.readContract({
      address: ADDRESSES.WPOL,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    })

    // 获取预估输出
    const wpolAmountIn = parseUnits(wpolAmount, 18)
    const path = [ADDRESSES.WPOL, ADDRESSES.USDC]

    let expectedUSDC = '0'
    try {
      const amountsOut = await publicClient.readContract({
        address: ADDRESSES.QUICKSWAP_ROUTER,
        abi: QUICKSWAP_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [wpolAmountIn, path],
      })
      expectedUSDC = formatUnits(amountsOut[1], 6)
    } catch (e) {
      console.error('getAmountsOut error:', e)
    }

    return NextResponse.json({
      platformWallet: account.address,
      wpolBalance: formatUnits(wpolBalance, 18),
      testAmount: wpolAmount,
      expectedUSDC: expectedUSDC,
      path: 'WPOL → USDC',
    })

  } catch (error) {
    console.error('GET error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed' 
    }, { status: 500 })
  }
}
