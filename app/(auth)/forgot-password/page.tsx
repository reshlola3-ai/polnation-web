'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="We've sent you a password reset link"
      >
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          
          <p className="text-zinc-600 mb-6">
            We sent a password reset link to<br />
            <strong className="text-zinc-900">{email}</strong>
          </p>
          
          <p className="text-sm text-zinc-500 mb-6">
            Click the link in the email to reset your password.
            If you don't see the email, check your spam folder.
          </p>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSuccess(false)
                setEmail('')
              }}
            >
              Try a different email
            </Button>
            
            <Link href="/login">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to sign in
              </Button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Forgot password?"
      subtitle="No worries, we'll send you reset instructions"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
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

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Send Reset Link
        </Button>
      </form>

      <Link href="/login" className="mt-6 flex items-center justify-center text-sm text-zinc-600 hover:text-zinc-900">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to sign in
      </Link>
    </AuthLayout>
  )
}
