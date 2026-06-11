// 一次性回填：按新语义重算所有用户的 real_level
// 新语义：起步 L1，团队业绩每达到一级解锁门槛升一级（≥$100 即 L2，≥$1200 即 L3）
// 用法: node scripts/backfill-real-levels.mjs [--dry-run]
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// 读取 .env.local
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const dryRun = process.argv.includes('--dry-run')
const supabase = createClient(url, key)

const { data: levels, error: lvlErr } = await supabase
  .from('community_levels')
  .select('*')
  .order('level')
if (lvlErr) throw lvlErr

const { data: statuses, error: stErr } = await supabase
  .from('user_community_status')
  .select('user_id, real_level, current_level, is_admin_set, admin_set_level, is_influencer, team_volume_l123')
if (stErr) throw stErr

console.log(`Levels: ${levels.length} | Users: ${statuses.length} | ${dryRun ? 'DRY RUN' : 'LIVE'}\n`)

let updated = 0
let unchanged = 0
let failed = 0

for (const s of statuses) {
  const vol = Number(s.team_volume_l123) || 0
  let earnedBase = 0
  for (const lvl of levels) {
    const unlock = s.is_influencer ? Number(lvl.unlock_volume_influencer) : Number(lvl.unlock_volume_normal)
    if (vol >= unlock) earnedBase = lvl.level
    else break
  }
  const newReal = earnedBase + 1

  if (newReal === s.real_level) {
    unchanged++
    continue
  }

  const adminNote = s.is_admin_set
    ? ` [admin-set L${s.admin_set_level ?? s.current_level}: ${newReal >= (s.admin_set_level ?? s.current_level) ? 'UNLOCKS' : 'still locked'}]`
    : ''
  console.log(`${s.user_id}  vol=$${vol.toFixed(2)}  real_level ${s.real_level} -> ${newReal}${adminNote}`)

  if (!dryRun) {
    const { error } = await supabase
      .from('user_community_status')
      .update({ real_level: newReal, updated_at: new Date().toISOString() })
      .eq('user_id', s.user_id)
    if (error) {
      console.error(`  FAILED: ${error.message}`)
      failed++
      continue
    }
  }
  updated++
}

console.log(`\nDone. updated=${updated} unchanged=${unchanged} failed=${failed}`)
