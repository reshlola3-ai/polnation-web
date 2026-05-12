/**
 * Seed alpha tracker entities into Supabase.
 * Run: npx tsx scripts/seed-alpha-entities.ts
 *
 * These are Arkham entity IDs (slugs). Arkham's /transfers endpoint accepts
 * an entity ID as `base` and aggregates activity across all the entity's
 * wallets and chains — so one entry = full coverage of that organization.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

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

const ENTITIES = [
  // Active market-makers / trading firms
  { entity_id: 'wintermute',         display_name: 'Wintermute',         entity_type: 'market_maker' },
  { entity_id: 'jump-trading',       display_name: 'Jump Crypto',        entity_type: 'market_maker' },
  { entity_id: 'cumberland',         display_name: 'Cumberland DRW',     entity_type: 'market_maker' },
  { entity_id: 'galaxy-digital',     display_name: 'Galaxy Digital',     entity_type: 'market_maker' },
  { entity_id: 'dwf-labs',           display_name: 'DWF Labs',           entity_type: 'market_maker' },
  { entity_id: 'flow-traders',       display_name: 'Flow Traders',       entity_type: 'market_maker' },
  { entity_id: 'amber',              display_name: 'Amber Group',        entity_type: 'trading_firm' },
  { entity_id: 'gsr-markets',        display_name: 'GSR Markets',        entity_type: 'market_maker' },
  { entity_id: 'jane-street',        display_name: 'Jane Street',        entity_type: 'trading_firm' },

  // Active DeFi-savvy funds
  { entity_id: 'blocktower-capital', display_name: 'BlockTower Capital', entity_type: 'fund' },
  { entity_id: 'framework-ventures', display_name: 'Framework Ventures', entity_type: 'fund' },
] as const

async function seed() {
  console.log(`Seeding ${ENTITIES.length} alpha entities…`)

  for (const e of ENTITIES) {
    const { error } = await supabase
      .from('alpha_entities')
      .upsert(
        { ...e, is_active: true },
        { onConflict: 'entity_id' }
      )

    if (error) console.error(`  ✗ ${e.display_name}: ${error.message}`)
    else       console.log(`  ✓ ${e.display_name}`)
  }

  console.log('\nDone. Trigger cron:')
  console.log('  curl -H "Authorization: Bearer $CRON_SECRET" https://www.polnation.com/api/cron/refresh-alpha-tracker')
}

seed().catch(console.error)
