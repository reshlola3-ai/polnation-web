'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

interface HeroCtaButtonsProps {
  isLoggedIn: boolean
  goToDashboardLabel: string
  getStartedLabel: string
  signInLabel: string
}

function runOnIdle(task: () => void) {
  const g = globalThis as typeof globalThis & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
    cancelIdleCallback?: (id: number) => void
  }

  if (typeof g.requestIdleCallback === 'function') {
    const id = g.requestIdleCallback(() => task(), { timeout: 1200 })
    return () => g.cancelIdleCallback?.(id)
  }

  const timeoutId = globalThis.setTimeout(task, 350)
  return () => globalThis.clearTimeout(timeoutId)
}

export function HeroCtaButtons({
  isLoggedIn,
  goToDashboardLabel,
  getStartedLabel,
  signInLabel,
}: HeroCtaButtonsProps) {
  const router = useRouter()

  useEffect(() => {
    const cleanup = runOnIdle(() => {
      router.prefetch(isLoggedIn ? '/dashboard' : '/register')
    })
    return cleanup
  }, [isLoggedIn, router])

  if (isLoggedIn) {
    return (
      <Link
        href="/dashboard"
        prefetch={false}
        onMouseEnter={() => router.prefetch('/dashboard')}
        onFocus={() => router.prefetch('/dashboard')}
        className="inline-flex items-center justify-center px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-medium text-white btn-gradient rounded-xl transition-all glow-purple"
      >
        {goToDashboardLabel}
        <ArrowRight className="ml-2 w-5 h-5 animate-arrow-nudge" />
      </Link>
    )
  }

  return (
    <>
      <Link
        href="/register"
        prefetch={false}
        onMouseEnter={() => router.prefetch('/register')}
        onFocus={() => router.prefetch('/register')}
        className="inline-flex items-center justify-center px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-medium text-white btn-gradient rounded-xl transition-all glow-purple"
      >
        {getStartedLabel}
        <ArrowRight className="ml-2 w-5 h-5 animate-arrow-nudge" />
      </Link>
      <Link
        href="/login"
        prefetch={false}
        onMouseEnter={() => router.prefetch('/login')}
        onFocus={() => router.prefetch('/login')}
        className="inline-flex items-center justify-center px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-medium text-white bg-white/5 rounded-xl hover:bg-white/10 transition-all border border-white/10"
      >
        {signInLabel}
      </Link>
    </>
  )
}
