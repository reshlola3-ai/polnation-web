'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Mail, Lock } from 'lucide-react'
import { WalletLogin, isDAppBrowser } from '@/components/wallet/WalletLogin'
import { Web3Provider } from '@/components/providers/Web3Provider'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDApp, setIsDApp] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)

  // Detect DApp browser on mount
  useState(() => {
    if (typeof window !== 'undefined') {
      setIsDApp(isDAppBrowser())
    }
  })

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

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

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
        },
      })

      if (error) {
        setError(error.message)
        setIsLoading(false)
      }
    } catch {
      setError('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  // In DApp browser - simplified view
  if (isDApp && !showEmailForm) {
    return (
      <AuthLayout
        title="Welcome to Polnation"
        subtitle="Connect your wallet to get started"
      >
        {/* Wallet Login - Primary for DApp browsers */}
        <div className="mb-6">
          <Web3Provider>
            <WalletLogin redirect={redirect} autoRegister={true} />
          </Web3Provider>
        </div>

        <div className="text-center">
          <button 
            onClick={() => setShowEmailForm(true)}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Or sign in with email instead
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Don't have an account?{' '}
          <span className="text-purple-400">
            Wallet login auto-creates one
          </span>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Polnation account"
    >
      {/* Wallet Login - Best for DApp browsers */}
      <div className="mb-4">
        <Web3Provider>
          <WalletLogin redirect={redirect} autoRegister={true} />
        </Web3Provider>
      </div>

      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-[#1A1333] text-zinc-500">or</span>
        </div>
      </div>

      {/* Google Sign In - Hidden in DApp browsers since it won't work */}
      {!isDApp && (
        <>
          <Button
            type="button"
            variant="secondary"
            className="w-full mb-4"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#1A1333] text-zinc-500">or sign in with email</span>
            </div>
          </div>
        </>
      )}

      {/* Email Sign In Form */}
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
          <div className="mt-2 text-right">
            <Link 
              href="/forgot-password" 
              className="text-sm link-purple"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Sign In
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Don't have an account?{' '}
        <Link href="/register" className="link-purple font-medium">
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      </AuthLayout>
    }>
      <LoginForm />
    </Suspense>
  )
}
