/**
 * Seed initial alpha wallets into Supabase.
 * Run: npx tsx scripts/seed-alpha-wallets.ts
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local manually (no dotenv dep needed)
try {
  const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of env.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
} catch { /* file not found */ }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Well-known smart-money wallets with public Arkham attribution.
// Addresses sourced from publicly available Arkham entity pages.
// Update arkham_entity / entity_type once Arkham API confirms labels.
const WALLETS = [
  // Market makers
  { address: '0x4f3af332a30973106fe146af0b4220352be589bc', arkham_entity: 'Wintermute', entity_type: 'market_maker',  chains: ['ethereum', 'polygon', 'arbitrum_one'] },
  { address: '0x9cf9358300e34bf0273eae5aced2b32f0b5c2e29', arkham_entity: 'Jump Trading', entity_type: 'trading_firm',  chains: ['ethereum', 'polygon'] },
  { address: '0x5c985e89dde482efe97ea9f1950ad149eb73829b', arkham_entity: 'Cumberland', entity_type: 'trading_firm',   chains: ['ethereum'] },
  { address: '0x9507c04b10486547584c37bcbd931b2a4fee9a41', arkham_entity: 'Amber Group', entity_type: 'trading_firm', chains: ['ethereum', 'bsc'] },
  { address: '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43', arkham_entity: 'GSR', entity_type: 'market_maker',          chains: ['ethereum', 'polygon'] },

  // DeFi funds / known whales
  { address: '0x28c6c06298d514db089934071355e5743bf21d60', arkham_entity: 'Binance Hot Wallet', entity_type: 'cex',  chains: ['ethereum', 'polygon'] },
  { address: '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503', arkham_entity: 'Binance 14', entity_type: 'cex',           chains: ['ethereum'] },
  { address: '0xf977814e90da44bfa03b6295a0616a897441acec', arkham_entity: 'Binance 8', entity_type: 'cex',            chains: ['ethereum', 'bsc'] },

  // Polygon-native DeFi players
  { address: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0', arkham_entity: 'Polygon Foundation', entity_type: 'fund', chains: ['ethereum', 'polygon'] },
  { address: '0x742d35cc6634c0532925a3b844bc454e4438f44e', arkham_entity: 'Polygon Bridge', entity_type: 'bridge',    chains: ['ethereum', 'polygon'] },

  // Arbitrage / strategy wallets
  { address: '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', arkham_entity: 'Binance 1', entity_type: 'cex',            chains: ['ethereum'] },
  { address: '0xdfd5293d8e347dfe59e90efd55b2956a1343963d', arkham_entity: 'Binance 16', entity_type: 'cex',           chains: ['ethereum', 'polygon'] },

  // DeFi protocols / governance heavy wallets
  { address: '0xba12222222228d8ba445958a75a0704d566bf2c8', arkham_entity: 'Balancer Vault', entity_type: 'defi',      chains: ['ethereum', 'polygon', 'arbitrum_one'] },
  { address: '0x1111111254fb6c44bac0bed2854e76f90643097d', arkham_entity: '1inch Router', entity_type: 'defi',        chains: ['ethereum', 'polygon', 'bsc'] },
  { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', arkham_entity: 'Circle USDC', entity_type: 'stablecoin',   chains: ['ethereum'] },
] as const

async function seed() {
  console.log(`Seeding ${WALLETS.length} alpha wallets…`)

  for (const wallet of WALLETS) {
    const { error } = await supabase
      .from('alpha_wallets')
      .upsert(
        {
          address:       wallet.address.toLowerCase(),
          arkham_entity: wallet.arkham_entity,
          entity_type:   wallet.entity_type,
          chains:        wallet.chains,
          is_active:     true,
        },
        { onConflict: 'address' }
      )

    if (error) {
      console.error(`  ✗ ${wallet.arkham_entity}:`, error.message)
    } else {
      console.log(`  ✓ ${wallet.arkham_entity}`)
    }
  }

  console.log('\nDone. Run the cron job to fetch first signals:')
  console.log('  curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/refresh-alpha-tracker')
}

seed().catch(console.error)
