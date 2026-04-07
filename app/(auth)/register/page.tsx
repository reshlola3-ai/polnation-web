'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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

  // Resolve referrer info from ref param
  useEffect(() => {
    async function fetchReferrer() {
      if (!referrerId) return
      const isShortCode = referrerId.length <= 6 && !referrerId.includes('-')
      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .eq(isShortCode ? 'referral_code' : 'id', isShortCode ? referrerId.toUpperCase() : referrerId)
        .single()
      if (data) {
        setReferrerName(data.username)
        setReferrerUuid(data.id)
      }
    }
    fetchReferrer()
  }, [referrerId, supabase])

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
      <form onSubmit={handleRegister} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {referrerName && (
          <div className="p-3 rounded-xl bg-[#F0FDF4] border border-[#16A34A]/20 text-[#16A34A] text-sm flex items-center gap-2">
            <User className="w-4 h-4" />
            Referred by: <strong>{referrerName}</strong>
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

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 bg-white text-gray-500">or sign up with wallet</span>
        </div>
      </div>

      <Link
        href="/login"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Continue with Wallet instead
      </Link>

      <p className="mt-5 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="text-[#16A34A] hover:underline font-medium">
          Sign in
        </Link>
      </p>

      <p className="mt-2 text-center text-xs text-gray-400">
        By creating an account you agree to our{' '}
        <Link href="/terms" className="text-[#16A34A] hover:underline">Terms</Link>
        {' '}and{' '}
        <Link href="/privacy" className="text-[#16A34A] hover:underline">Privacy Policy</Link>
      </p>
    </AuthLayout>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <AuthLayout title="Create your account" subtitle="Join Polnation today">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#16A34A]" />
        </div>
      </AuthLayout>
    }>
      <RegisterForm />
    </Suspense>
  )
}
