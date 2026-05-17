'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { countries } from '@/lib/countries'
import { Profile } from '@/lib/types'
import { User, Phone, Send, Wallet, Check, ExternalLink, CheckCircle, Mail, Lock, AlertCircle, LogOut } from 'lucide-react'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'
import { isPlaceholderEmail, getPlaceholderType } from '@/lib/auth/placeholder-email'
import { signOutEverywhere } from '@/lib/auth/sign-out'
import { TelegramBindButton } from '@/components/auth/TelegramBindButton'

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-zinc-300 mb-2">
      {children} <span className="text-red-400">*</span>
    </label>
  )
}

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

  // Email + password binding for users on a placeholder email (wallet or TG).
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [emailBound, setEmailBound] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailError, setEmailError] = useState('')

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleSignOut = async () => {
    setIsLoggingOut(true)
    await signOutEverywhere('/login')
  }

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

  // 钱包连接后自动绑定到数据库，然后刷新 profile
  useEffect(() => {
    async function autoBindWallet() {
      if (!address || profile?.wallet_address) return

      const normalizedAddress = address.toLowerCase()

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 检查钱包是否已被其他用户绑定
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('wallet_address', normalizedAddress)
          .single()

        if (existingProfile && existingProfile.id !== user.id) {
          setError('This wallet is already bound to another account')
          return
        }

        // 钱包可用，自动绑定
        if (!existingProfile) {
          const { error: bindError } = await supabase
            .from('profiles')
            .update({
              wallet_address: normalizedAddress,
              wallet_bound_at: new Date().toISOString(),
            })
            .eq('id', user.id)

          if (bindError) {
            console.error('Failed to auto-bind wallet:', bindError)
            return
          }
        }

        loadProfile()
      } catch (err) {
        console.error('Auto-bind wallet error:', err)
      }
    }

    autoBindWallet()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!username.trim()) { setError('Username is required'); return }
    if (!phoneNumber.trim()) { setError('Phone number is required'); return }

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

  const handleBindEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError('')
    if (!newEmail.trim()) return
    if (newPassword.length < 6) {
      setEmailError('Password must be at least 6 characters')
      return
    }
    setIsSendingEmail(true)
    try {
      const res = await fetch('/api/auth/bind-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEmailError(data.error || 'Failed to bind email')
        return
      }
      setEmailBound(true)
      setNewPassword('') // don't keep plaintext password in React state
      // Reload profile so the bound email reflects in the form and the card hides.
      await loadProfile()
    } catch {
      setEmailError('An unexpected error occurred')
    } finally {
      setIsSendingEmail(false)
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

  const placeholderType = getPlaceholderType(profile?.email)
  const needsEmailBinding = isPlaceholderEmail(profile?.email)
  const isTelegramUser = placeholderType === 'telegram'

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="glass-card-solid p-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          {profile?.profile_completed ? 'Edit Profile' : 'Complete Your Profile'}
        </h1>
        <p className="text-zinc-400 mb-2">
          {profile?.profile_completed
            ? 'Update your account information'
            : 'Fill in your details to start earning'
          }
        </p>
        {!profile?.profile_completed && (
          <p className="text-xs text-zinc-500 mb-6">Fields marked <span className="text-red-400">*</span> are required</p>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
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

          {/* Email — show real email or a hint for placeholder accounts */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Email</label>
            <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-sm">
              {needsEmailBinding ? (
                <span className="text-zinc-600 italic">
                  {isTelegramUser
                    ? 'No email — Telegram account'
                    : 'No email — wallet account'}
                </span>
              ) : (
                profile?.email
              )}
            </div>
          </div>

          {/* Username — required, highlighted */}
          <div>
            <RequiredLabel>Username</RequiredLabel>
            <Input
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              required
            />
            <p className="text-xs text-zinc-600 mt-1">This is your public display name</p>
          </div>

          {/* Phone — required */}
          <div>
            <RequiredLabel>Phone Number</RequiredLabel>
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

          {/* Country — required */}
          <div>
            <RequiredLabel>Country</RequiredLabel>
            <Select
              options={countryOptions}
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
            />
          </div>

          {/* Telegram — optional */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Telegram Username <span className="text-zinc-600 text-xs font-normal">(optional)</span>
            </label>
            <Input
              placeholder="@username"
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value)}
              leftIcon={<Send className="w-4 h-4" />}
            />
            <p className="text-xs text-zinc-600 mt-1">Used for community notifications</p>
          </div>

          {/* Wallet */}
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
                    <span className="text-xs bg-purple-500/20 px-2 py-0.5 rounded text-purple-300">Bitget</span>
                    <span className="text-xs bg-purple-500/20 px-2 py-0.5 rounded text-purple-300">Trust</span>
                    <span className="text-xs bg-purple-500/20 px-2 py-0.5 rounded text-purple-300">MetaMask</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Telegram verified-link status. Separate from the optional
              "Telegram Username" text field above — this is the cryptographically
              verified TG identity used to gate Tasks / prevent duplicates. */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Telegram Account
            </label>
            {profile?.telegram_verified ? (
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-300">Telegram Linked</span>
                </div>
                <code className="text-sm font-mono text-zinc-300 bg-white/5 px-2 py-1 rounded inline-block mt-1">
                  @{profile.telegram_username || `tg_${String(profile.telegram_chat_id ?? '').slice(-6)}`}
                </code>
                <p className="text-xs text-zinc-500 mt-2">One Telegram account per profile — cannot be changed.</p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-3">
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-zinc-300">No Telegram linked</p>
                    <p className="text-xs text-zinc-500">Required to access Tasks rewards</p>
                  </div>
                </div>
                <TelegramBindButton
                  onBound={() => loadProfile()}
                  errorLabels={{
                    alreadyBound: 'This Telegram account is already linked to another account.',
                    generic: 'Failed to link Telegram. Please try again.',
                  }}
                />
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" isLoading={isSaving}>
            {profile?.profile_completed ? 'Save Changes' : 'Complete Profile'}
          </Button>
        </form>
      </div>

      {/* Email + password binding — for users on a placeholder email
          (wallet-registered or Telegram-registered). Lets them sign in on
          web from any browser. */}
      {needsEmailBinding && (
        <div className="glass-card-solid p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <Mail className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">
                {isTelegramUser ? 'Set up web login' : 'Bind Email Address'}
              </h3>
              <p className="text-xs text-zinc-500">
                {isTelegramUser
                  ? 'Sign in on polnation.com from any browser. Your Telegram login keeps working.'
                  : 'Add an email and password for account recovery.'}
              </p>
            </div>
          </div>

          {emailBound ? (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              Web login ready. Sign in at polnation.com with {newEmail}.
            </div>
          ) : (
            <form onSubmit={handleBindEmail} className="space-y-3">
              {emailError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {emailError}
                </div>
              )}
              <Input
                type="email"
                placeholder="you@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                autoComplete="email"
                required
              />
              <Input
                type="password"
                placeholder="Password (6+ characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <Button type="submit" className="w-full" isLoading={isSendingEmail}>
                Save
              </Button>
            </form>
          )}
        </div>
      )}

      {/* Log out */}
      <div className="glass-card-solid p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
              <LogOut className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Log Out</h3>
              <p className="text-xs text-zinc-500">Sign out and return to the login screen.</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowLogoutConfirm(true)}
            className="shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            Log Out
          </Button>
        </div>
      </div>

      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => !isLoggingOut && setShowLogoutConfirm(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-sm glass-card-solid border border-white/[0.10] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <LogOut className="w-4 h-4 text-red-400" />
              </div>
              <h3 className="font-semibold text-white text-sm">Confirm Log Out</h3>
            </div>
            <p className="text-sm text-zinc-400 mb-5">
              Are you sure you want to log out? You&apos;ll need to sign in again to access your account.
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSignOut}
                isLoading={isLoggingOut}
                className="flex-1 bg-red-500 hover:bg-red-400"
              >
                Log Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
