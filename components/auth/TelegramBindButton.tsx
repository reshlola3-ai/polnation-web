'use client'

import { useEffect, useRef, useState } from 'react'

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
  onTelegramBindAuth?: (user: TelegramWidgetUser) => void
}

interface Props {
  onBound?: (telegramUsername: string | null) => void
  alreadyBoundLabel?: string
  errorLabels?: {
    alreadyBound?: string
    generic?: string
  }
}

export function TelegramBindButton({ onBound, errorLabels }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

  useEffect(() => {
    const container = containerRef.current
    if (!botUsername || !container) return

    const win = window as WindowWithCallback
    win.onTelegramBindAuth = (user) => {
      setError('')
      setLoading(true)
      void (async () => {
        try {
          const res = await fetch('/api/auth/bind-telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user),
          })
          const data = await res.json()
          if (!res.ok) {
            if (data.error === 'telegram_already_bound') {
              throw new Error(errorLabels?.alreadyBound || 'This Telegram account is already linked to another account.')
            }
            throw new Error(errorLabels?.generic || 'Failed to bind Telegram. Please try again.')
          }
          onBound?.(data.telegram_username || null)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Telegram bind failed')
          setLoading(false)
        }
      })()
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramBindAuth(user)')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-radius', '8')
    container.appendChild(script)

    return () => {
      delete (window as WindowWithCallback).onTelegramBindAuth
      while (container.firstChild) {
        container.removeChild(container.firstChild)
      }
    }
  }, [botUsername, onBound, errorLabels?.alreadyBound, errorLabels?.generic])

  if (!botUsername) {
    return (
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
        Telegram login is not configured. Please contact support.
      </div>
    )
  }

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
