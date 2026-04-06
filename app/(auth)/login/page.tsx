'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { WalletLogin } from '@/components/wallet/WalletLogin'
import { Web3Provider } from '@/components/providers/Web3Provider'

function LoginForm() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'
  const ref = searchParams.get('ref')

  return (
    <AuthLayout
      title="Welcome to Polnation"
      subtitle="Connect your wallet to sign in or create an account"
    >
      <Web3Provider>
        <WalletLogin redirect={redirect} autoRegister={true} referrerId={ref} />
      </Web3Provider>

      <p className="mt-6 text-center text-xs text-zinc-500">
        By connecting you agree to our{' '}
        <Link href="/terms" className="text-purple-400 hover:underline">Terms</Link>
        {' '}and{' '}
        <Link href="/privacy" className="text-purple-400 hover:underline">Privacy Policy</Link>
      </p>
    </AuthLayout>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <AuthLayout title="Welcome to Polnation" subtitle="Connect your wallet to continue">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      </AuthLayout>
    }>
      <LoginForm />
    </Suspense>
  )
}
