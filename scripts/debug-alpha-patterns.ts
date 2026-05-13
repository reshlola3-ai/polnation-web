/**
 * Debug: run patterns locally against live Arkham data for one entity.
 * Run: npx tsx scripts/debug-alpha-patterns.ts <entity_id>
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

try {
  const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
} catch {}

const entityId = process.argv[2] ?? 'jump-trading'

async function main() {
  const { getTransfers } = await import('../lib/alpha-tracker/arkham-client')
  const {
    detectPreCex, detectBridgeBuy, detectLpPosition, detectStableRotation,
    detectDcaDump, detectPreGovernance, detectNetAccumulation,
  } = await import('../lib/alpha-tracker/patterns/index')
  const { computeConfidence } = await import('../lib/alpha-tracker/scoring')

  console.log(`Fetching transfers for ${entityId}…`)
  const res = await getTransfers(entityId, { timeLast: '24h', usdGte: '50000', limit: 100 })
  const transfers = res.transfers ?? []
  console.log(`Got ${transfers.length} transfers\n`)

  const tokens: Record<string, { in: number; out: number }> = {}
  for (const t of transfers) {
    const sym = t.tokenSymbol?.toUpperCase() ?? '?'
    tokens[sym] ??= { in: 0, out: 0 }
    const usd = t.historicalUSD ?? 0
    if (t.toAddress?.arkhamEntity?.id === entityId)   tokens[sym].in  += usd
    if (t.fromAddress?.arkhamEntity?.id === entityId) tokens[sym].out += usd
  }
  console.log('Net flows by token:')
  for (const [sym, v] of Object.entries(tokens).sort((a, b) => Math.abs(b[1].in - b[1].out) - Math.abs(a[1].in - a[1].out)).slice(0, 8)) {
    console.log(`  ${sym.padEnd(10)} in=$${v.in.toFixed(0).padStart(12)}  out=$${v.out.toFixed(0).padStart(12)}  net=$${(v.in - v.out).toFixed(0).padStart(12)}`)
  }
  console.log()

  const args = [entityId, entityId, 'fund', 0, transfers] as const

  const results = [
    ['pre_cex',          detectPreCex(...args, {})],
    ['bridge_buy',       detectBridgeBuy(...args)],
    ['lp_position',      detectLpPosition(...args)],
    ['stable_rotation',  detectStableRotation(...args)],
    ['dca_dump',         detectDcaDump(...args, {})],
    ['pre_gov',          detectPreGovernance(...args)],
    ['net_accumulation', detectNetAccumulation(...args)],
  ] as const

  for (const [name, match] of results) {
    if (!match) {
      console.log(`  ${name.padEnd(20)} → null`)
      continue
    }
    const { score } = computeConfidence(match)
    console.log(`  ${name.padEnd(20)} → ${match.tokenSymbol} $${match.amountUsd.toFixed(0)} on ${match.chain}, score=${score}`)
  }
}

main().catch(console.error)
