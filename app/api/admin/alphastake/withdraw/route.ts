import { NextRequest, NextResponse } from 'next/server'
import { createWalletClient, http, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { polygon } from 'viem/chains'
import { verifyAdmin } from '@/lib/admin-auth'
import {
  ALPHA_STAKE_ABI,
  getAlphaPublicClient,
  getAlphaStakeAddress,
  OWNER_WITHDRAW_TIMELOCK_USDC,
  usdcToUnits,
} from '@/lib/alphastake'

function getExecutorAccount() {
  const key = process.env.EXECUTOR_PRIVATE_KEY
  if (!key) return null
  return privateKeyToAccount((key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`)
}

export async function POST(request: NextRequest) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stakeAddress = getAlphaStakeAddress()
  if (!stakeAddress) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_ALPHASTAKE_ADDRESS is not configured' },
      { status: 500 }
    )
  }

  const account = getExecutorAccount()
  if (!account) {
    return NextResponse.json(
      { error: 'EXECUTOR_PRIVATE_KEY is not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const action = body.action as 'instant' | 'queue' | 'execute' | 'cancel' | 'penalties'

    const publicClient = getAlphaPublicClient()
    const owner = await publicClient.readContract({
      address: stakeAddress,
      abi: ALPHA_STAKE_ABI,
      functionName: 'owner',
    })

    if (owner.toLowerCase() !== account.address.toLowerCase()) {
      return NextResponse.json(
        { error: 'Executor wallet is not AlphaStake owner. Use the owner wallet configured at deploy time.' },
        { status: 403 }
      )
    }

    const walletClient = createWalletClient({
      account,
      chain: polygon,
      transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
    })

    let hash: `0x${string}`
    let withdrawalId: number | undefined

    if (action === 'instant') {
      const to = body.to as Address
      const amount = Number(body.amount)
      if (!to || !amount || amount <= 0) {
        return NextResponse.json({ error: 'to and amount are required' }, { status: 400 })
      }
      if (amount >= OWNER_WITHDRAW_TIMELOCK_USDC) {
        return NextResponse.json(
          { error: `Use queue for withdrawals >= $${OWNER_WITHDRAW_TIMELOCK_USDC.toLocaleString()}` },
          { status: 400 }
        )
      }

      hash = await walletClient.writeContract({
        address: stakeAddress,
        abi: ALPHA_STAKE_ABI,
        functionName: 'ownerWithdrawInstant',
        args: [to, usdcToUnits(amount)],
      })
    } else if (action === 'queue') {
      const to = body.to as Address
      const amount = Number(body.amount)
      if (!to || !amount || amount <= 0) {
        return NextResponse.json({ error: 'to and amount are required' }, { status: 400 })
      }
      if (amount < OWNER_WITHDRAW_TIMELOCK_USDC) {
        return NextResponse.json(
          { error: `Use instant for withdrawals < $${OWNER_WITHDRAW_TIMELOCK_USDC.toLocaleString()}` },
          { status: 400 }
        )
      }

      hash = await walletClient.writeContract({
        address: stakeAddress,
        abi: ALPHA_STAKE_ABI,
        functionName: 'queueWithdrawal',
        args: [to, usdcToUnits(amount)],
      })
    } else if (action === 'penalties') {
      const to = body.to as Address
      if (!to) {
        return NextResponse.json({ error: 'to is required' }, { status: 400 })
      }

      hash = await walletClient.writeContract({
        address: stakeAddress,
        abi: ALPHA_STAKE_ABI,
        functionName: 'withdrawPenalties',
        args: [to],
      })
    } else if (action === 'execute' || action === 'cancel') {
      withdrawalId = Number(body.withdrawalId)
      if (Number.isNaN(withdrawalId) || withdrawalId < 0) {
        return NextResponse.json({ error: 'withdrawalId is required' }, { status: 400 })
      }

      hash = await walletClient.writeContract({
        address: stakeAddress,
        abi: ALPHA_STAKE_ABI,
        functionName: action === 'execute' ? 'executeWithdrawal' : 'cancelWithdrawal',
        args: [BigInt(withdrawalId)],
      })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    return NextResponse.json({
      success: true,
      txHash: hash,
      blockNumber: receipt.blockNumber.toString(),
      withdrawalId,
    })
  } catch (err) {
    console.error('[admin/alphastake/withdraw] POST failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Withdrawal transaction failed' },
      { status: 500 }
    )
  }
}
