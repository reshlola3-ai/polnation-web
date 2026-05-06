'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// Shape posted back by the Login Widget — see
// https://core.telegram.org/widgets/login#receiving-authorization-data
interface TelegramWidgetUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

type WindowWithCallback = Window & {
  onTelegramAuth?: (user: TelegramWidgetUser) => void
}

interface Props {
  redirect: string
  /** Referral code from the page URL (e.g. `?ref=ABCD`); pass null when absent. */
  referralCode: string | null
}

export function TelegramLoginButton({ redirect, referralCode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Bot username must be exposed at build time because the widget script needs
  // it as an attribute. Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME on Vercel.
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

  useEffect(() => {
    const container = containerRef.current
    if (!botUsername || !container) return

    const win = window as WindowWithCallback
    win.onTelegramAuth = (user) => {
      setError('')
      setLoading(true)
      void (async () => {
        try {
          const res = await fetch('/api/auth/telegram-widget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...user, ref: referralCode || undefined }),
          })
          const data = await res.json()
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'auth_failed')
          }
          router.push(redirect)
          router.refresh()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Telegram login failed')
          setLoading(false)
        }
      })()
    }

    // The widget renders its iframe button at the script tag's DOM position,
    // so injecting the script into our container is what places the button.
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-radius', '8')
    container.appendChild(script)

    return () => {
      delete (window as WindowWithCallback).onTelegramAuth
      // Clean up the injected script + any iframe the widget rendered.
      while (container.firstChild) {
        container.removeChild(container.firstChild)
      }
    }
  }, [botUsername, redirect, referralCode, router])

  if (!botUsername) return null

  return (
    <div className="space-y-2">
      <div ref={containerRef} className={loading ? 'opacity-50 pointer-events-none' : ''} />
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
