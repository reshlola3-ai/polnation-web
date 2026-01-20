import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 合约地址
const ADDRESSES = {
  usdc: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
  wpol: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
  pool: '0x6669b4706cc152f359e947bca68e263a87c52634', // 主要展示这个地址
  distributor: '0x3ef3d8ba38ebe18db153cec108f4d14ce00dd9ae',
}

// Alchemy RPC URL
const ALCHEMY_URL = `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || 'EPSkgE2Y0OHmmJnMwU8KX'}`

// 缓存 key 和过期时间
const CACHE_KEY = 'chain_stats_cache'
const CACHE_TTL_SECONDS = 3600 // 1 小时

// ERC20 balanceOf 函数签名
const BALANCE_OF_SELECTOR = '0x70a08231'

// 获取代币余额
async function getTokenBalance(tokenAddress: string, walletAddress: string, decimals: number): Promise<number> {
  try {
    const data = BALANCE_OF_SELECTOR + walletAddress.slice(2).padStart(64, '0')
    
    const response = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: tokenAddress, data }, 'latest'],
        id: 1,
      }),
    })

    const result = await response.json()
    if (result.result && result.result !== '0x') {
      return parseInt(result.result, 16) / Math.pow(10, decimals)
    }
    return 0
  } catch (error) {
    console.error('Error getting token balance:', error)
    return 0
  }
}

// 获取 POL 价格
async function getPOLPrice(): Promise<number> {
  try {
    const response = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'alchemy_getTokenMetadata',
        params: [ADDRESSES.wpol],
        id: 1,
      }),
    })
    // 使用固定价格作为备选（从 PolygonScan 获取的最新价格）
    return 0.135
  } catch {
    return 0.135
  }
}

// 获取 Pool 总价值 (USDC + WPOL)
async function getPoolTotalValue(): Promise<number> {
  try {
    const [usdcBalance, wpolBalance, polPrice] = await Promise.all([
      getTokenBalance(ADDRESSES.usdc, ADDRESSES.pool, 6),
      getTokenBalance(ADDRESSES.wpol, ADDRESSES.pool, 18),
      getPOLPrice(),
    ])
    
    const usdcValue = usdcBalance * 1 // USDC = $1
    const wpolValue = wpolBalance * polPrice
    
    return usdcValue + wpolValue
  } catch (error) {
    console.error('Error getting pool value:', error)
    return 0
  }
}

// 获取最新交易
async function getLatestTransactions(): Promise<Array<{
  hash: string
  from: string
  to: string
  value: string
  asset: string
  timestamp: string
}>> {
  try {
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
            toAddress: ADDRESSES.pool,
            category: ['erc20', 'external'],
            withMetadata: true,
            maxCount: '0x5', // 最新 5 笔
            order: 'desc',
          },
        ],
        id: 1,
      }),
    })

    const result = await response.json()
    
    if (result.result && result.result.transfers) {
      return result.result.transfers.map((tx: {
        hash: string
        from: string
        to: string
        value: number
        asset: string
        metadata: { blockTimestamp: string }
      }) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value?.toFixed(2) || '0',
        asset: tx.asset || 'POL',
        timestamp: tx.metadata?.blockTimestamp || '',
      }))
    }
    return []
  } catch (error) {
    console.error('Error getting transactions:', error)
    return []
  }
}

// 获取唯一交互地址数
async function getUniqueAddresses(): Promise<number> {
  try {
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
            toAddress: ADDRESSES.pool,
            category: ['erc20', 'external'],
            withMetadata: false,
            maxCount: '0x3e8',
          },
        ],
        id: 1,
      }),
    })

    const result = await response.json()
    if (result.result && result.result.transfers) {
      const uniqueSenders = new Set(
        result.result.transfers.map((tx: { from: string }) => tx.from.toLowerCase())
      )
      return uniqueSenders.size
    }
    return 0
  } catch (error) {
    console.error('Error getting unique addresses:', error)
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
    const [poolValue, uniqueAddresses, latestTransactions] = await Promise.all([
      getPoolTotalValue(),
      getUniqueAddresses(),
      getLatestTransactions(),
    ])

    const stats = {
      totalValue: poolValue,
      uniqueAddresses: uniqueAddresses,
      latestTransactions: latestTransactions,
      poolAddress: ADDRESSES.pool,
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
      totalValue: 0,
      uniqueAddresses: 0,
      latestTransactions: [],
      poolAddress: ADDRESSES.pool,
      lastUpdated: new Date().toISOString(),
      error: 'Failed to fetch chain data',
    })
  }
}
