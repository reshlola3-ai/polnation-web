import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { polygon } from 'viem/chains'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function verifyAdmin() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  return !!session
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

        return NextResponse.json({ success: true, message: '已设置为 Influencer' })
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

        return NextResponse.json({ success: true, message: '已移除 Influencer 状态' })
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

        return NextResponse.json({ success: true, message: `已设置等级为 Level ${level}` })
      }

      case 'restore_real_level': {
        // 复原到真实等级
        await supabaseAdmin
          .from('user_community_status')
          .update({
            is_admin_set: false,
            admin_set_level: null,
            current_level: status?.real_level || 0,
            admin_set_at: null,
            admin_set_by: null,
            updated_at: now,
          })
          .eq('user_id', user_id)

        return NextResponse.json({ success: true, message: '已复原到真实等级' })
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

          for (const referral of walletsToFetch) {
            try {
              const balance = await publicClient.readContract({
                address: CONFIG.usdcAddress,
                abi: USDC_ABI,
                functionName: 'balanceOf',
                args: [referral.wallet_address as `0x${string}`],
              })
              totalVolume += parseFloat(formatUnits(balance, 6))
            } catch (err) {
              console.error(`Failed to get balance:`, err)
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

        let realLevel = 0
        for (const level of levels || []) {
          const unlockVolume = status?.is_influencer
            ? level.unlock_volume_influencer
            : level.unlock_volume_normal

          if (totalVolume >= unlockVolume) {
            realLevel = level.level
          } else {
            break
          }
        }

        await supabaseAdmin
          .from('user_community_status')
          .update({
            real_level: realLevel,
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
