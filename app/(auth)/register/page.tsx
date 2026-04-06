'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { WalletLogin } from '@/components/wallet/WalletLogin'
import { Web3Provider } from '@/components/providers/Web3Provider'
import { User } from 'lucide-react'

function RegisterForm() {
  const searchParams = useSearchParams()
  const referrerId = searchParams.get('ref')

  return (
    <AuthLayout
      title="Join Polnation"
      subtitle={referrerId ? 'You were invited — connect your wallet to get started' : 'Connect your wallet to create an account'}
    >
      {referrerId && (
        <div className="mb-5 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center gap-2 text-sm text-purple-300">
          <User className="w-4 h-4 shrink-0" />
          Referral code: <span className="font-mono font-bold">{referrerId}</span>
        </div>
      )}

      <Web3Provider>
        <WalletLogin redirect="/dashboard" autoRegister={true} referrerId={referrerId} />
      </Web3Provider>

      <p className="mt-6 text-center text-xs text-zinc-500">
        Already have an account?{' '}
        <Link href="/login" className="text-purple-400 hover:underline">Sign in</Link>
      </p>

      <p className="mt-3 text-center text-xs text-zinc-500">
        By connecting you agree to our{' '}
        <Link href="/terms" className="text-purple-400 hover:underline">Terms</Link>
        {' '}and{' '}
        <Link href="/privacy" className="text-purple-400 hover:underline">Privacy Policy</Link>
      </p>
    </AuthLayout>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <AuthLayout title="Join Polnation" subtitle="Connect your wallet to get started">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      </AuthLayout>
    }>
      <RegisterForm />
    </Suspense>
  )
}
