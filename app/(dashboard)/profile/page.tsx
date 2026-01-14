'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { countries } from '@/lib/countries'
import { Profile } from '@/lib/types'
import { User, Phone, Globe, Send, Wallet, Check } from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [referrerName, setReferrerName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [username, setUsername] = useState('')
  const [phoneCountryCode, setPhoneCountryCode] = useState('+86')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [countryCode, setCountryCode] = useState('CN')
  const [telegramUsername, setTelegramUsername] = useState('')

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
        setUsername(profileData.username || '')
        setPhoneCountryCode(profileData.phone_country_code || '+86')
        setPhoneNumber(profileData.phone_number || '')
        setCountryCode(profileData.country_code || 'CN')
        setTelegramUsername(profileData.telegram_username || '')

        // 获取推荐人信息
        if (profileData.referrer_id) {
          const { data: referrer } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', profileData.referrer_id)
            .single()
          
          if (referrer) {
            setReferrerName(referrer.username)
          }
        }
      }

      setIsLoading(false)
    }

    loadProfile()
  }, [supabase, router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      // 检查用户名是否已存在
      if (username !== profile?.username) {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username)
          .neq('id', user.id)
          .single()

        if (existingUser) {
          setError('Username is already taken')
          setIsSaving(false)
          return
        }
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username,
          phone_country_code: phoneCountryCode,
          phone_number: phoneNumber,
          country_code: countryCode,
          telegram_username: telegramUsername || null,
          profile_completed: true,
        })
        .eq('id', user.id)

      if (updateError) {
        setError(updateError.message)
      } else {
        setSuccess('Profile updated successfully!')
        
        // 如果是首次完善 profile，重定向到 dashboard
        if (!profile?.profile_completed) {
          setTimeout(() => {
            router.push('/dashboard')
          }, 1500)
        }
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  const countryOptions = countries.map(c => ({
    value: c.code,
    label: `${c.flag} ${c.name}`,
  }))

  const dialCodeOptions = countries.map(c => ({
    value: c.dialCode,
    label: `${c.flag} ${c.dialCode}`,
  }))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">
          {profile?.profile_completed ? 'Edit Profile' : 'Complete Your Profile'}
        </h1>
        <p className="text-zinc-600 mb-8">
          {profile?.profile_completed 
            ? 'Update your account information'
            : 'Please fill in your details to continue'
          }
        </p>

        <form onSubmit={handleSave} className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-green-50 text-green-600 text-sm flex items-center gap-2">
              <Check className="w-4 h-4" />
              {success}
            </div>
          )}

          {/* Referrer (read-only) */}
          {referrerName && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Referred By
              </label>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600">
                <User className="w-4 h-4" />
                {referrerName}
              </div>
            </div>
          )}

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Email
            </label>
            <div className="px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600">
              {profile?.email}
            </div>
          </div>

          {/* Username */}
          <Input
            label="Username"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
            required
          />

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Phone Number
            </label>
            <div className="flex gap-2">
              <div className="w-32">
                <Select
                  options={dialCodeOptions}
                  value={phoneCountryCode}
                  onChange={(e) => setPhoneCountryCode(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Input
                  type="tel"
                  placeholder="Phone number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  leftIcon={<Phone className="w-4 h-4" />}
                  required
                />
              </div>
            </div>
          </div>

          {/* Country */}
          <Select
            label="Country"
            options={countryOptions}
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
          />

          {/* Telegram */}
          <Input
            label="Telegram Username (Optional)"
            placeholder="@username"
            value={telegramUsername}
            onChange={(e) => setTelegramUsername(e.target.value)}
            leftIcon={<Send className="w-4 h-4" />}
          />

          {/* Wallet Address (read-only) */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Wallet Address
            </label>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600">
              <Wallet className="w-4 h-4" />
              {profile?.wallet_address 
                ? `${profile.wallet_address.slice(0, 10)}...${profile.wallet_address.slice(-8)}`
                : 'Not connected yet'
              }
            </div>
            {!profile?.wallet_address && (
              <p className="mt-1.5 text-sm text-zinc-500">
                You can connect your wallet from the dashboard
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" isLoading={isSaving}>
            {profile?.profile_completed ? 'Save Changes' : 'Complete Profile'}
          </Button>
        </form>
      </div>
    </div>
  )
}
