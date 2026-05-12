import { createClient } from '@supabase/supabase-js'
import { AlphaClient } from './AlphaClient'
import type { AlphaSignal, AlphaEntity } from '@/lib/alpha-tracker/types'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default async function AlphaPage() {
  const supabase = getSupabase()

  const [{ data: signals }, { data: entities }] = await Promise.all([
    supabase
      .from('alpha_signals')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('observed_at', { ascending: false })
      .limit(50),
    supabase
      .from('alpha_entities')
      .select('*')
      .eq('is_active', true)
      .order('pnl_30d', { ascending: false })
      .limit(20),
  ])

  return (
    <AlphaClient
      initialSignals={(signals ?? []) as AlphaSignal[]}
      entities={(entities ?? []) as AlphaEntity[]}
    />
  )
}
