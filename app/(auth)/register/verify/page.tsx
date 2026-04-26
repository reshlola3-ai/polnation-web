'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Mail, CheckCircle, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const RESEND_COOLDOWN_SECONDS = 60

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const supabase = createClient()

  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [resendError, setResendError] = useState('')

  // Cooldown countdown — disable the resend button for 60s after the page
  // loads (we just sent the first email) and after each successful resend.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const handleResend = async () => {
    if (!email || cooldown > 0 || resendStatus === 'sending') return
    setResendStatus('sending')
    setResendError('')
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setResendStatus('error')
        setResendError(error.message)
      } else {
        setResendStatus('sent')
        setCooldown(RESEND_COOLDOWN_SECONDS)
      }
    } catch {
      setResendStatus('error')
      setResendError('Network error. Please try again.')
    }
  }

  return (
    <div className="text-center">
      <div className="mx-auto w-16 h-16 bg-purple-500/20 border border-purple-500/30 rounded-full flex items-center justify-center mb-6 glow-purple-sm">
        <Mail className="w-8 h-8 text-purple-400" />
      </div>

      <p className="text-zinc-400 mb-2">
        We&apos;ve sent a verification email to:
      </p>
      <p className="font-medium text-white mb-6 break-all">
        {email || 'your email address'}
      </p>

      <p className="text-sm text-zinc-500 mb-6">
        Click the link in the email to verify your account and complete registration.
        If you don&apos;t see the email, check your spam folder.
      </p>

      {resendStatus === 'sent' && (
        <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2 text-left">
          <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
          <span className="text-green-300 text-sm">Verification email resent.</span>
        </div>
      )}
      {resendStatus === 'error' && resendError && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-left">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span className="text-red-300 text-sm">{resendError}</span>
        </div>
      )}

      {email && (
        <Button
          variant="outline"
          className="w-full mb-3"
          onClick={handleResend}
          isLoading={resendStatus === 'sending'}
          disabled={cooldown > 0 || resendStatus === 'sending'}
        >
          {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend verification email'}
        </Button>
      )}

      <Link href="/login">
        <Button variant="ghost" className="w-full">
          Back to Sign In
        </Button>
      </Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout
      title="Check your email"
      subtitle="We've sent you a verification link"
    >
      <Suspense fallback={
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto" />
        </div>
      }>
        <VerifyEmailContent />
      </Suspense>
    </AuthLayout>
  )
}
