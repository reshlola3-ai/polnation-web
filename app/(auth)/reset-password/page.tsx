'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Lock, CheckCircle, XCircle } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null)

  // 检查是否有有效的重置会话
  useEffect(() => {
    const checkSession = async () => {
      // 检查 URL 中是否有 error
      const errorParam = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')
      
      if (errorParam) {
        setError(errorDescription || 'Invalid or expired reset link')
        setIsValidSession(false)
        return
      }

      // 检查当前 session（应该已经在 /auth/callback 中建立）
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        setIsValidSession(true)
      } else {
        // 没有 session，可能是直接访问页面或 session 已过期
        setError('Invalid or expired reset link. Please request a new one.')
        setIsValidSession(false)
      }
    }

    checkSession()
  }, [supabase, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        // 3秒后跳转到登录页
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // 加载中状态
  if (isValidSession === null) {
    return (
      <AuthLayout
        title="Reset Password"
        subtitle="Verifying your reset link..."
      >
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      </AuthLayout>
    )
  }

  // 无效链接
  if (!isValidSession) {
    return (
      <AuthLayout
        title="Link Expired"
        subtitle="This reset link is no longer valid"
      >
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          
          <p className="text-zinc-400 mb-6">
            {error || 'This password reset link has expired or is invalid.'}
          </p>

          <div className="space-y-3">
            <Link href="/forgot-password">
              <Button className="w-full">
                Request New Link
              </Button>
            </Link>
            
            <Link href="/login">
              <Button variant="ghost" className="w-full">
                Back to sign in
              </Button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    )
  }

  // 成功状态
  if (success) {
    return (
      <AuthLayout
        title="Password Reset!"
        subtitle="Your password has been successfully updated"
      >
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center glow-purple-sm">
            <CheckCircle className="w-8 h-8 text-purple-400" />
          </div>
          
          <p className="text-zinc-400 mb-6">
            Your password has been reset successfully.<br />
            Redirecting you to sign in...
          </p>

          <Link href="/login">
            <Button className="w-full">
              Sign In Now
            </Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  // 重置密码表单
  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your new password below"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <Input
          type="password"
          label="New Password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          required
        />

        <Input
          type="password"
          label="Confirm New Password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          required
        />

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Reset Password
        </Button>
      </form>
    </AuthLayout>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <AuthLayout title="Reset Password" subtitle="Loading...">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      </AuthLayout>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
