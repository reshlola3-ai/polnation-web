'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { WalletLogin } from '@/components/wallet/WalletLogin'
import { Web3Provider } from '@/components/providers/Web3Provider'
import { Mail, Lock } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'
  const ref = searchParams.get('ref')
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showWallet, setShowWallet] = useState(false)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push(redirect)
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (showWallet) {
    return (
      <AuthLayout
        title="Connect Wallet"
        subtitle="Sign in or create account with your wallet"
      >
        <Web3Provider>
          <WalletLogin redirect={redirect} autoRegister={true} referrerId={ref} />
        </Web3Provider>
        <button
          onClick={() => setShowWallet(false)}
          className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back to email login
        </button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Polnation account"
    >
      <form onSubmit={handleEmailLogin} className="space-y-4">
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
          <div className="mt-1.5 text-right">
            <Link href="/forgot-password" className="text-xs text-gray-500 hover:text-[#16A34A] transition-colors">
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Sign In
        </Button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 bg-white text-gray-500">or</span>
        </div>
      </div>

      {/* Wallet login as secondary option */}
      <button
        type="button"
        onClick={() => setShowWallet(true)}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Continue with Wallet
      </button>

      <p className="mt-5 text-center text-sm text-gray-500">
        Don&apos;t have an account?{' '}
        <Link href={`/register${ref ? `?ref=${ref}` : ''}`} className="text-[#16A34A] hover:underline font-medium">
          Create one
        </Link>
      </p>
    </AuthLayout>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <AuthLayout title="Welcome back" subtitle="Sign in to your Polnation account">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#16A34A]" />
        </div>
      </AuthLayout>
    }>
      <LoginForm />
    </Suspense>
  )
}
