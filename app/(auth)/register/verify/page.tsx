'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Mail } from 'lucide-react'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')

  return (
    <div className="text-center">
      <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
        <Mail className="w-8 h-8 text-emerald-600" />
      </div>

      <p className="text-zinc-600 mb-2">
        We've sent a verification email to:
      </p>
      <p className="font-medium text-zinc-900 mb-6">
        {email || 'your email address'}
      </p>

      <p className="text-sm text-zinc-500 mb-6">
        Click the link in the email to verify your account and complete registration.
        If you don't see the email, check your spam folder.
      </p>

      <Link href="/login">
        <Button variant="outline" className="w-full">
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
      <Suspense fallback={<div className="text-center">Loading...</div>}>
        <VerifyEmailContent />
      </Suspense>
    </AuthLayout>
  )
}
