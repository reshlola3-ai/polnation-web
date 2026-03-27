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
  if (typeof window === 'undefined') return () => {}

  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(() => task(), { timeout: 1200 })
    return () => window.cancelIdleCallback(id)
  }

  const timeoutId = window.setTimeout(task, 350)
  return () => window.clearTimeout(timeoutId)
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
