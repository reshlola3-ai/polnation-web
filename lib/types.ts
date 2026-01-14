// 数据库类型定义

export interface Profile {
  id: string
  email: string
  username: string | null
  phone_country_code: string | null
  phone_number: string | null
  country_code: string | null
  telegram_username: string | null
  referrer_id: string | null
  wallet_address: string | null
  wallet_bound_at: string | null
  profile_completed: boolean
  created_at: string
  updated_at: string
}

export interface Referral extends Profile {
  level: number
  team_count: number
  usdc_balance?: number
}

export interface Snapshot {
  id: string
  snapshot_time: string
  total_users: number
  total_usdc: number
  triggered_by: string | null
  created_at: string
}

export interface SnapshotBalance {
  id: string
  snapshot_id: string
  user_id: string
  wallet_address: string
  usdc_balance: number
  created_at: string
}

export interface TeamStats {
  total_team_members: number
  level1_members: number
  total_team_volume: number
  level1_volume: number
}
