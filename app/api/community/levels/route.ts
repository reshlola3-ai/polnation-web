import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// GET: 获取社区等级配置 (公开数据，可长期缓存)
export async function GET() {
  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const { data: levels, error } = await supabaseAdmin
      .from('community_levels')
      .select('*')
      .order('level')

    if (error) throw error

    const response = NextResponse.json({ levels })
    
    // Static config - cache for 1 hour on CDN
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600')
    return response
  } catch (error) {
    console.error('Error fetching levels:', error)
    return NextResponse.json({ error: 'Failed to fetch levels' }, { status: 500 })
  }
}
