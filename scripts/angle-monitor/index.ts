/**
 * Angle Protocol USDC Monitor
 * Watches USDC Transfer events on Ethereum + Polygon where from/to is an Angle contract.
 * Broadcasts to Telegram group on every qualifying transfer >= MIN_USDC_AMOUNT.
 *
 * Run:  npx tsx scripts/angle-monitor/index.ts
 * Keep alive: pm2 start ecosystem.config.js
 */

import { createPublicClient, webSocket, parseAbiItem, formatUnits, type Address } from 'viem'
import { mainnet, polygon } from 'viem/chains'

// ─── Config ───────────────────────────────────────────────────────────────────

const BOT_TOKEN  = process.env.TG_BOT_TOKEN  || '8986937867:AAHBor_6yVvhQv51ZRpEZHc9fGbDYfxye8I'
const CHAT_ID    = process.env.TG_CHAT_ID    || '-1003548662779'
const ALCHEMY    = process.env.ALCHEMY_API_KEY || 'EPSkgE2Y0OHmmJnMwU8KX'
const MIN_USDC   = Number(process.env.MIN_USDC ?? 10)   // $10 default

const ETH_WS   = `wss://eth-mainnet.g.alchemy.com/v2/${ALCHEMY}`
const POLY_WS  = `wss://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY}`

const USDC_ETH  = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address
const USDC_POLY = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as Address

// Angle contracts — all lowercase for O(1) lookup
const ANGLE_ETH = new Map<string, string>([
  ['0x222222fd79264bbe280b4986f6fefbc3524d0137', 'Transmuter'],
  ['0x0022228a2cc5e7ef0274a7baa600d44da5ab5776', 'Savings (stUSD)'],
])

const ANGLE_POLY = new Map<string, string>([
  ['0x222222880e079445df703c0604706e71a538fd4f', 'Transmuter'],
])

// ─── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegram(text: string): Promise<void> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:                  CHAT_ID,
        text,
        parse_mode:               'HTML',
        disable_web_page_preview: true,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('[TG] send failed:', body)
    }
  } catch (err) {
    console.error('[TG] network error:', err)
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function fmtUsdc(value: bigint): string {
  const n = parseFloat(formatUnits(value, 6))
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`
}

// ─── Transfer handler ─────────────────────────────────────────────────────────

interface TransferLog {
  args: { from: Address; to: Address; value: bigint }
  transactionHash: `0x${string}`
}

async function handleTransfer(
  log: TransferLog,
  chain: 'Ethereum' | 'Polygon',
  angleContracts: Map<string, string>,
  explorerBase: string,
): Promise<void> {
  const { from, to, value } = log.args
  const fromL = from.toLowerCase()
  const toL   = to.toLowerCase()

  const toLabel   = angleContracts.get(toL)
  const fromLabel = angleContracts.get(fromL)
  if (!toLabel && !fromLabel) return   // not an Angle contract

  const usdcAmount = parseFloat(formatUnits(value, 6))
  if (usdcAmount < MIN_USDC) return

  const isDeposit      = !!toLabel
  const contractLabel  = isDeposit ? toLabel! : fromLabel!
  const counterparty   = isDeposit ? from : to
  const action         = isDeposit ? '📥 Deposit' : '📤 Withdraw'
  const txHash         = log.transactionHash

  const lines = [
    `${action}  <b>Angle Protocol</b> · ${chain}`,
    ``,
    `💵 <b>${fmtUsdc(value)} USDC</b>`,
    `🏦 Contract: ${contractLabel}`,
    `👤 ${isDeposit ? 'From' : 'To'}: <code>${shortAddr(counterparty)}</code>`,
    `🔗 <a href="${explorerBase}/tx/${txHash}">${shortHash(txHash)}</a>`,
  ]

  const msg = lines.join('\n')
  await sendTelegram(msg)
  console.log(`[${chain}] ${action} ${usdcAmount} USDC | ${contractLabel} | ${txHash}`)
}

// ─── Chain watcher ────────────────────────────────────────────────────────────

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
)

function watchChain(opts: {
  name:            'Ethereum' | 'Polygon'
  wsUrl:           string
  viemChain:       typeof mainnet | typeof polygon
  usdcAddress:     Address
  angleContracts:  Map<string, string>
  explorerBase:    string
}): void {
  const { name, wsUrl, viemChain, usdcAddress, angleContracts, explorerBase } = opts

  const client = createPublicClient({
    chain:     viemChain,
    transport: webSocket(wsUrl, { reconnect: { delay: 3_000, attempts: 100 } }),
  })

  client.watchEvent({
    address: usdcAddress,
    event:   TRANSFER_EVENT,
    onLogs:  (logs) => {
      for (const log of logs) {
        handleTransfer(log as unknown as TransferLog, name, angleContracts, explorerBase)
          .catch(err => console.error(`[${name}] handler error:`, err))
      }
    },
    onError: (err) => console.error(`[${name}] WS error:`, err),
  })

  console.log(`[${name}] ✓ Subscribed — USDC threshold $${MIN_USDC}`)
}

// ─── Entry ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🔍 Angle Protocol Monitor starting…')

  await sendTelegram(
    '🤖 <b>Angle Monitor Online</b>\n\n' +
    `Watching USDC flows ≥ $${MIN_USDC} on Ethereum &amp; Polygon.\n` +
    `Contracts: Transmuter + Savings (stUSD)`
  )

  watchChain({
    name:           'Ethereum',
    wsUrl:          ETH_WS,
    viemChain:      mainnet,
    usdcAddress:    USDC_ETH,
    angleContracts: ANGLE_ETH,
    explorerBase:   'https://etherscan.io',
  })

  watchChain({
    name:           'Polygon',
    wsUrl:          POLY_WS,
    viemChain:      polygon,
    usdcAddress:    USDC_POLY,
    angleContracts: ANGLE_POLY,
    explorerBase:   'https://polygonscan.com',
  })
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
