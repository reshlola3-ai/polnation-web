'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { countries } from '@/lib/countries'
import { Profile } from '@/lib/types'
import { User, Phone, Send, Wallet, Check, ExternalLink, CheckCircle } from 'lucide-react'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const { open } = useWeb3Modal()
  const { address, isConnected } = useAccount()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [referrerName, setReferrerName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [username, setUsername] = useState('')
  const [phoneCountryCode, setPhoneCountryCode] = useState('+86')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [countryCode, setCountryCode] = useState('CN')
  const [telegramUsername, setTelegramUsername] = useState('')

  const loadProfile = async () => {
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

  useEffect(() => {
    loadProfile()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 钱包连接后刷新 profile 数据
  useEffect(() => {
    if (address && !profile?.wallet_address) {
      // 钱包连接后，等待绑定完成再刷新
      const timer = setTimeout(() => {
        loadProfile()
      }, 2000)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address])

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="glass-card-solid p-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          {profile?.profile_completed ? 'Edit Profile' : 'Complete Your Profile'}
        </h1>
        <p className="text-zinc-400 mb-8">
          {profile?.profile_completed 
            ? 'Update your account information'
            : 'Please fill in your details to continue'
          }
        </p>

        <form onSubmit={handleSave} className="space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
              <Check className="w-4 h-4" />
              {success}
            </div>
          )}

          {referrerName && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Referred By
              </label>
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-300">
                <User className="w-4 h-4 text-zinc-500" />
                {referrerName}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Email
            </label>
            <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400">
              {profile?.email}
            </div>
          </div>

          <Input
            label="Username"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
            required
          />

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
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

          <Select
            label="Country"
            options={countryOptions}
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
          />

          <Input
            label="Telegram Username (Optional)"
            placeholder="@username"
            value={telegramUsername}
            onChange={(e) => setTelegramUsername(e.target.value)}
            leftIcon={<Send className="w-4 h-4" />}
          />

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Wallet Address
            </label>
            {profile?.wallet_address ? (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-green-300">Wallet Connected</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-zinc-300 bg-white/5 px-2 py-1 rounded">
                    {profile.wallet_address.slice(0, 10)}...{profile.wallet_address.slice(-8)}
                  </code>
                  <a
                    href={`https://polygonscan.com/address/${profile.wallet_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-purple-400 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-sm font-medium text-zinc-300">
                        {isConnected ? 'Binding wallet...' : 'No wallet connected'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Connect to start earning rewards
                      </p>
                    </div>
                  </div>
                  {!isConnected && (
                    <Button 
                      type="button"
                      size="sm" 
                      onClick={() => open()}
                      className="shrink-0"
                    >
                      <Wallet className="w-4 h-4 mr-2" />
                      Connect
                    </Button>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-purple-500/20">
                  <p className="text-xs text-purple-300 font-medium mb-1.5">Supported Wallets:</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs bg-purple-500/20 px-2 py-0.5 rounded text-purple-300">Trust</span>
                    <span className="text-xs bg-purple-500/20 px-2 py-0.5 rounded text-purple-300">SafePal</span>
                    <span className="text-xs bg-purple-500/20 px-2 py-0.5 rounded text-purple-300">Bitget</span>
                    <span className="text-xs bg-purple-500/20 px-2 py-0.5 rounded text-purple-300">TokenPocket</span>
                  </div>
                </div>
              </div>
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
