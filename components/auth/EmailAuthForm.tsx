'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Mail, Lock, User } from 'lucide-react'

interface Props {
  mode: 'signin' | 'signup'
  redirect?: string
  /** Resolved referrer UUID from /api/referrer (already converted from short code) */
  referrerUuid?: string | null
}

export function EmailAuthForm({ mode, redirect = '/dashboard', referrerUuid = null }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const isSignUp = mode === 'signup'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (isSignUp) {
      if (password !== confirmPassword) { setError('Passwords do not match'); return }
      if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    }

    setIsLoading(true)
    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
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
        if (signUpError) {
          setError(signUpError.message)
        } else {
          router.push('/register/verify?email=' + encodeURIComponent(email))
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          setError(signInError.message)
        } else {
          router.push(redirect)
          router.refresh()
        }
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      {isSignUp && (
        <Input
          type="text"
          label="Username (optional)"
          placeholder="e.g. crypto_alice"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          leftIcon={<User className="w-4 h-4" />}
        />
      )}

      <div>
        <Input
          type="password"
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          required
        />
        {!isSignUp && (
          <div className="mt-1.5 text-right">
            <Link href="/forgot-password" className="text-xs text-zinc-500 hover:text-purple-400 transition-colors">
              Forgot password?
            </Link>
          </div>
        )}
      </div>

      {isSignUp && (
        <Input
          type="password"
          label="Confirm Password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          required
        />
      )}

      <Button type="submit" className="w-full" isLoading={isLoading}>
        {isSignUp ? 'Create Account' : 'Sign In'}
      </Button>
    </form>
  )
}
