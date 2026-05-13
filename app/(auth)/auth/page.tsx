'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Web3Provider } from '@/components/providers/Web3Provider'
import { WalletAuthFlow } from '@/components/auth/WalletAuthFlow'
import { EmailAuthForm } from '@/components/auth/EmailAuthForm'
import { TelegramLoginButton } from '@/components/auth/TelegramLoginButton'
import { User } from 'lucide-react'

function AuthContent() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'
  const ref = searchParams.get('ref')
  const modeParam = searchParams.get('mode')

  const [mode, setMode] = useState<'signin' | 'signup'>(
    modeParam === 'signup' ? 'signup' : 'signin',
  )
  const [referrerName, setReferrerName] = useState<string | null>(null)
  const [referrerUuid, setReferrerUuid] = useState<string | null>(null)

  // Referrer banner + email-signup metadata both need the resolved UUID, so we
  // hit the public referrer API once (it bypasses RLS, handles short codes).
  useEffect(() => {
    if (!ref) return
    let cancelled = false
    fetch(`/api/referrer?ref=${encodeURIComponent(ref)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        if (data.name) setReferrerName(data.name)
        if (data.id) setReferrerUuid(data.id)
      })
      .catch(() => { /* silent — referrer display is non-critical */ })
    return () => { cancelled = true }
  }, [ref])

  const isSignUp = mode === 'signup'

  return (
    <AuthLayout
      title={isSignUp ? 'Create your account' : 'Sign in'}
      subtitle={
        referrerName
          ? `Invited by ${referrerName}`
          : isSignUp
          ? 'Join Polnation today'
          : 'Welcome back to Polnation'
      }
    >
      {referrerName && (
        <div className="mb-4 p-3 rounded-xl bg-white/[0.04] border border-purple-500/30 text-purple-300 text-sm flex items-center gap-2">
          <User className="w-4 h-4" />
          Referred by: <strong>{referrerName}</strong>
        </div>
      )}

      {/* Wallet — primary path. autoRegister=true so first-time wallets get an
          account; existing wallets just log in. */}
      <Web3Provider>
        <WalletAuthFlow
          redirect={redirect}
          referrerId={referrerUuid || ref}
          autoRegister={true}
        />
      </Web3Provider>

      {/* Telegram — for users who joined via Mini App */}
      <div className="mt-4">
        <p className="text-xs text-zinc-500 mb-2 text-center">
          Joined Polnation in Telegram? Continue here.
        </p>
        <div className="flex justify-center">
          <TelegramLoginButton redirect={redirect} referralCode={ref} />
        </div>
      </div>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 bg-[#1A1333] text-zinc-500">or with email</span>
        </div>
      </div>

      {/* Email — tabs switch between signin/signup */}
      <div className="mb-3 flex gap-1 rounded-lg bg-white/[0.04] p-1">
        {(['signin', 'signup'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setMode(t)}
            className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              mode === t
                ? 'bg-purple-600 text-white'
                : 'text-white/55 hover:text-white/80'
            }`}
          >
            {t === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <EmailAuthForm mode={mode} redirect={redirect} referrerUuid={referrerUuid} />

      <p className="mt-5 text-center text-xs text-zinc-600">
        By {isSignUp ? 'creating an account' : 'signing in'} you agree to our{' '}
        <Link href="/terms" className="text-purple-400 hover:underline">Terms</Link>
        {' '}and{' '}
        <Link href="/privacy" className="text-purple-400 hover:underline">Privacy Policy</Link>
      </p>
    </AuthLayout>
  )
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout title="Sign in" subtitle="Welcome to Polnation">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          </div>
        </AuthLayout>
      }
    >
      <AuthContent />
    </Suspense>
  )
}
