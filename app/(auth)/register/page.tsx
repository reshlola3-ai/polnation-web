'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { InlineWalletPicker } from '@/components/wallet/InlineWalletPicker'
import { TelegramLoginButton } from '@/components/auth/TelegramLoginButton'
import { Web3Provider } from '@/components/providers/Web3Provider'
import { Mail, Lock, User } from 'lucide-react'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const referrerId = searchParams.get('ref')
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [referrerName, setReferrerName] = useState<string | null>(null)
  const [referrerUuid, setReferrerUuid] = useState<string | null>(null)

  // Resolve referrer info from ref param — uses API to bypass Supabase RLS on public page
  useEffect(() => {
    async function fetchReferrer() {
      if (!referrerId) return
      try {
        const res = await fetch(`/api/referrer?ref=${encodeURIComponent(referrerId)}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.name) setReferrerName(data.name)
        if (data.id) setReferrerUuid(data.id)
      } catch {
        // silently fail — referrer display is non-critical
      }
    }
    fetchReferrer()
  }, [referrerId])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }

    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            username: username.trim() || undefined,
            referrer_id: referrerUuid || null,
          },
        },
      })

      if (error) {
        setError(error.message)
      } else {
        router.push('/register/verify?email=' + encodeURIComponent(email))
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle={referrerName ? `Invited by ${referrerName}` : 'Join Polnation today'}
    >
      {referrerName && (
        <div className="mb-4 p-3 bg-white/[0.04] border border-[var(--poly-purple)]/30 text-[var(--poly-purple)] text-sm flex items-center gap-2">
          <User className="w-4 h-4" />
          Referred by: <strong>{referrerName}</strong>
        </div>
      )}

      {/* Wallet picker — primary path */}
      <Web3Provider>
        <InlineWalletPicker redirect="/dashboard" autoRegister={true} referrerId={referrerUuid} />
      </Web3Provider>

      {/* Telegram signup — for users who joined via the Mini App */}
      <div className="mt-4">
        <p className="text-xs text-zinc-500 mb-2 text-center">
          Joined Polnation in Telegram? Continue here.
        </p>
        <div className="flex justify-center">
          <TelegramLoginButton redirect="/dashboard" referralCode={referrerId} />
        </div>
      </div>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 bg-[#1A1333] text-zinc-500">or sign up with email</span>
        </div>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <Input
          type="email"
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="w-4 h-4" />}
          required
        />

        <Input
          type="text"
          label="Username (optional)"
          placeholder="e.g. crypto_alice"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          leftIcon={<User className="w-4 h-4" />}
        />

        <Input
          type="password"
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          required
        />

        <Input
          type="password"
          label="Confirm Password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          required
        />

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Create Account
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link href="/login" className="text-purple-400 hover:underline font-medium">
          Sign in
        </Link>
      </p>

      <p className="mt-2 text-center text-xs text-zinc-600">
        By creating an account you agree to our{' '}
        <Link href="/terms" className="text-purple-400 hover:underline">Terms</Link>
        {' '}and{' '}
        <Link href="/privacy" className="text-purple-400 hover:underline">Privacy Policy</Link>
      </p>
    </AuthLayout>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <AuthLayout title="Create your account" subtitle="Join Polnation today">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      </AuthLayout>
    }>
      <RegisterForm />
    </Suspense>
  )
}
