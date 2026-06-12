import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { verifyAdmin } from '@/lib/admin-auth'
import { polygon } from 'viem/chains'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}


const CONFIG = {
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
}

const USDC_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
])

// 获取所有用户社群状态
export async function GET(request: NextRequest) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    // 获取所有用户
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, username, email, wallet_address')
      .order('created_at', { ascending: false })

    // 获取所有用户的社群状态
    const { data: statuses } = await supabaseAdmin
      .from('user_community_status')
      .select('*')

    // 获取等级配置
    const { data: levels } = await supabaseAdmin
      .from('community_levels')
      .select('*')
      .order('level')

    // 创建状态映射
    const statusMap = new Map(
      (statuses || []).map(s => [s.user_id, s])
    )

    // 合并所有用户数据
    const allUsers = (profiles || []).map(p => {
      const status = statusMap.get(p.id)
      return {
        user_id: p.id,
        username: p.username,
        email: p.email,
        wallet_address: p.wallet_address,
        real_level: status?.real_level || 0,
        current_level: status?.current_level || 0,
        is_admin_set: status?.is_admin_set || false,
        is_influencer: status?.is_influencer || false,
        team_volume_l123: status?.team_volume_l123 || 0,
        total_community_earned: status?.total_community_earned || 0,
      }
    })

    return NextResponse.json({
      users: allUsers,
      levels,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}

// 管理用户社群状态
export async function POST(request: NextRequest) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { action, user_id, ...params } = await request.json()

    if (!action || !user_id) {
      return NextResponse.json({ error: 'action and user_id required' }, { status: 400 })
    }

    // 确保用户有社群状态记录
    let { data: status } = await supabaseAdmin
      .from('user_community_status')
      .select('*')
      .eq('user_id', user_id)
      .single()

    if (!status) {
      const { data: newStatus } = await supabaseAdmin
        .from('user_community_status')
        .insert({ user_id, real_level: 0, current_level: 0 })
        .select()
        .single()
      status = newStatus
    }

    const now = new Date().toISOString()

    switch (action) {
      case 'set_influencer': {
        // 设置为 Influencer
        await supabaseAdmin
          .from('user_community_status')
          .update({
            is_influencer: true,
            influencer_set_at: now,
            influencer_set_by: 'admin',
            updated_at: now,
          })
          .eq('user_id', user_id)

        return NextResponse.json({ success: true, message: 'Set as Influencer' })
      }

      case 'remove_influencer': {
        // 移除 Influencer
        await supabaseAdmin
          .from('user_community_status')
          .update({
            is_influencer: false,
            influencer_set_at: null,
            influencer_set_by: null,
            updated_at: now,
          })
          .eq('user_id', user_id)

        return NextResponse.json({ success: true, message: 'Influencer status removed' })
      }

      case 'set_level': {
        // 手动设置等级
        const { level } = params
        if (level === undefined || level < 0 || level > 6) {
          return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
        }

        await supabaseAdmin
          .from('user_community_status')
          .update({
            is_admin_set: true,
            admin_set_level: level,
            current_level: level,
            admin_set_at: now,
            admin_set_by: 'admin',
            updated_at: now,
          })
          .eq('user_id', user_id)

        return NextResponse.json({ success: true, message: `Level set to Level ${level}` })
      }

      case 'restore_real_level': {
        // 复原到真实等级：按【当前】团队业绩重算，避免还原成陈旧的 real_level
        const { data: levels } = await supabaseAdmin
          .from('community_levels')
          .select('*')
          .order('level')

        const volume = status?.team_volume_l123 || 0
        let earnedBase = 0
        for (const level of levels || []) {
          const unlockVolume = status?.is_influencer
            ? level.unlock_volume_influencer
            : level.unlock_volume_normal
          if (volume >= unlockVolume) earnedBase = level.level
          else break
        }
        const realLevel = earnedBase + 1

        await supabaseAdmin
          .from('user_community_status')
          .update({
            is_admin_set: false,
            admin_set_level: null,
            real_level: realLevel,
            current_level: realLevel,
            admin_set_at: null,
            admin_set_by: null,
            updated_at: now,
          })
          .eq('user_id', user_id)

        return NextResponse.json({
          success: true,
          message: `Restored to real level L${realLevel} (based on $${volume.toFixed(2)} team volume)`,
        })
      }

      case 'refresh_volume': {
        // 刷新用户的团队 volume
        const { data: referrals } = await supabaseAdmin
          .rpc('get_all_referrals', { user_id })

        if (!referrals || referrals.length === 0) {
          await supabaseAdmin
            .from('user_community_status')
            .update({
              team_volume_l123: 0,
              team_volume_updated_at: now,
              updated_at: now,
            })
            .eq('user_id', user_id)

          return NextResponse.json({ success: true, volume: 0 })
        }

        // 获取 L1-L3 下线
        const l123Referrals = referrals.filter((r: { level: number }) => r.level <= 3)
        const walletsToFetch = l123Referrals.filter((r: { wallet_address: string | null }) => r.wallet_address)

        let totalVolume = 0

        if (walletsToFetch.length > 0) {
          const publicClient = createPublicClient({
            chain: polygon,
            transport: http(CONFIG.rpcUrl),
          })

          // 并发分批读取钱包余额，避免 RPC 限流
          const BATCH_SIZE = 25
          for (let i = 0; i < walletsToFetch.length; i += BATCH_SIZE) {
            const batch = walletsToFetch.slice(i, i + BATCH_SIZE)
            const results = await Promise.allSettled(
              batch.map((referral: { wallet_address: string }) =>
                publicClient.readContract({
                  address: CONFIG.usdcAddress,
                  abi: USDC_ABI,
                  functionName: 'balanceOf',
                  args: [referral.wallet_address as `0x${string}`],
                })
              )
            )

            // 任何一个钱包读失败 → 整个 refresh 失败，避免 volume 少算导致误掉级
            const failed = results.filter(r => r.status === 'rejected')
            if (failed.length > 0) {
              console.error('RPC failures in batch:', failed.map(f => (f as PromiseRejectedResult).reason))
              return NextResponse.json({
                error: `Failed to read ${failed.length} wallet balance(s). Please retry.`,
              }, { status: 503 })
            }

            for (const r of results) {
              if (r.status === 'fulfilled') {
                totalVolume += parseFloat(formatUnits(r.value as bigint, 6))
              }
            }
          }
        }

        // 更新 volume
        await supabaseAdmin
          .from('user_community_status')
          .update({
            team_volume_l123: totalVolume,
            team_volume_updated_at: now,
            updated_at: now,
          })
          .eq('user_id', user_id)

        // 重新计算真实等级
        const { data: levels } = await supabaseAdmin
          .from('community_levels')
          .select('*')
          .order('level')

        // earnedBase = 已达到解锁门槛的最高等级（0 = 一个门槛都没到）
        let earnedBase = 0
        for (const level of levels || []) {
          const unlockVolume = status?.is_influencer
            ? level.unlock_volume_influencer
            : level.unlock_volume_normal

          if (totalVolume >= unlockVolume) {
            earnedBase = level.level
          } else {
            break
          }
        }

        // real_level 语义与领奖升级流程一致：起步 L1，每达到一级门槛升一级
        // （业绩 ≥ $100 即 L2，≥ $1200 即 L3，与 claim 后 current_level+1 对齐）
        const realLevel = earnedBase + 1

        await supabaseAdmin
          .from('user_community_status')
          .update({
            real_level: realLevel,
            // 自然用户：current_level 与 real_level 同步（起步 L1，每过一档门槛 +1）
            ...(status?.is_admin_set ? {} : { current_level: realLevel }),
          })
          .eq('user_id', user_id)

        return NextResponse.json({ success: true, volume: totalVolume, real_level: realLevel })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
  }
}
