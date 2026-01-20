import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 合约地址
const ADDRESSES = {
  usdc: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
  vault: '0x1cf4293125913cb3dea4ad7f2bb4795b9e896ce9',
  pool: '0x6669b4706cc152f359e947bca68e263a87c52634',
  distributor: '0x3ef3d8ba38ebe18db153cec108f4d14ce00dd9ae',
}

// Alchemy RPC URL
const ALCHEMY_URL = `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || 'EPSkgE2Y0OHmmJnMwU8KX'}`

// 缓存 key 和过期时间
const CACHE_KEY = 'chain_stats_cache'
const CACHE_TTL_SECONDS = 3600 // 1 小时

// ERC20 balanceOf 函数签名
const BALANCE_OF_SELECTOR = '0x70a08231'

async function getUSDCBalance(address: string): Promise<number> {
  try {
    // 构建 balanceOf 调用数据
    const data = BALANCE_OF_SELECTOR + address.slice(2).padStart(64, '0')
    
    const response = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            to: ADDRESSES.usdc,
            data: data,
          },
          'latest',
        ],
        id: 1,
      }),
    })

    const result = await response.json()
    if (result.result) {
      // USDC 有 6 位小数
      const balance = parseInt(result.result, 16) / 1e6
      return balance
    }
    return 0
  } catch (error) {
    console.error('Error getting USDC balance:', error)
    return 0
  }
}

async function getTransactionCount(address: string): Promise<number> {
  try {
    // 使用 PolygonScan API 获取交易数量
    const response = await fetch(
      `https://api.polygonscan.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=desc&apikey=YourApiKeyToken`
    )
    const data = await response.json()
    
    if (data.status === '1' && data.result) {
      // 这只返回最近的交易，我们需要用 Alchemy 获取更准确的数据
      return data.result.length > 0 ? 100 : 0 // 估算值
    }
    return 0
  } catch (error) {
    console.error('Error getting transaction count:', error)
    return 0
  }
}

async function getUniqueStakers(): Promise<number> {
  try {
    // 使用 Alchemy 的 getAssetTransfers 获取唯一发送者
    const response = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [
          {
            fromBlock: '0x0',
            toBlock: 'latest',
            toAddress: ADDRESSES.vault,
            category: ['erc20'],
            withMetadata: false,
            maxCount: '0x3e8', // 1000
          },
        ],
        id: 1,
      }),
    })

    const result = await response.json()
    if (result.result && result.result.transfers) {
      // 获取唯一发送者数量
      const uniqueSenders = new Set(
        result.result.transfers.map((tx: { from: string }) => tx.from.toLowerCase())
      )
      return uniqueSenders.size
    }
    return 0
  } catch (error) {
    console.error('Error getting unique stakers:', error)
    return 0
  }
}

async function getTotalRewardsPaid(): Promise<number> {
  try {
    // 获取 distributor 发出的 USDC 转账总额
    const response = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [
          {
            fromBlock: '0x0',
            toBlock: 'latest',
            fromAddress: ADDRESSES.distributor,
            category: ['erc20'],
            withMetadata: false,
            maxCount: '0x3e8', // 1000
          },
        ],
        id: 1,
      }),
    })

    const result = await response.json()
    if (result.result && result.result.transfers) {
      // 计算总转账金额
      const total = result.result.transfers.reduce(
        (sum: number, tx: { value: number }) => sum + (tx.value || 0),
        0
      )
      return total
    }
    return 0
  } catch (error) {
    console.error('Error getting total rewards:', error)
    return 0
  }
}

export async function GET() {
  try {
    // 尝试从 Supabase 获取缓存
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      
      // 检查缓存
      const { data: cache } = await supabase
        .from('system_cache')
        .select('*')
        .eq('key', CACHE_KEY)
        .single()
      
      if (cache && cache.data) {
        const cacheAge = (Date.now() - new Date(cache.updated_at).getTime()) / 1000
        if (cacheAge < CACHE_TTL_SECONDS) {
          return NextResponse.json({
            ...cache.data,
            cached: true,
            cacheAge: Math.round(cacheAge),
          })
        }
      }
    }

    // 获取链上数据
    const [vaultBalance, uniqueStakers, totalRewards] = await Promise.all([
      getUSDCBalance(ADDRESSES.vault),
      getUniqueStakers(),
      getTotalRewardsPaid(),
    ])

    const stats = {
      totalStaked: vaultBalance,
      uniqueStakers: uniqueStakers,
      totalRewardsPaid: totalRewards,
      lastUpdated: new Date().toISOString(),
    }

    // 保存到缓存
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      await supabase
        .from('system_cache')
        .upsert({
          key: CACHE_KEY,
          data: stats,
          updated_at: new Date().toISOString(),
        })
    }

    return NextResponse.json({
      ...stats,
      cached: false,
    })
  } catch (error) {
    console.error('Chain stats error:', error)
    
    // 返回默认值
    return NextResponse.json({
      totalStaked: 0,
      uniqueStakers: 0,
      totalRewardsPaid: 0,
      lastUpdated: new Date().toISOString(),
      error: 'Failed to fetch chain data',
    })
  }
}
