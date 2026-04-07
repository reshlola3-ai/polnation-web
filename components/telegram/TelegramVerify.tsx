'use client'

import { useState, useEffect } from 'react'
import { Send, CheckCircle } from 'lucide-react'
import Script from 'next/script'

interface TelegramVerifyProps {
  onVerified?: () => void
}

interface TelegramAuthData {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthData) => void
  }
}

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'PolnationBot'

export function TelegramVerify({ onVerified }: TelegramVerifyProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'verified' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    window.onTelegramAuth = async (user: TelegramAuthData) => {
      setStatus('loading')
      setErrorMsg(null)
      try {
        const res = await fetch('/api/auth/telegram-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user),
        })
        const data = await res.json()
        if (data.ok) {
          setStatus('verified')
          onVerified?.()
        } else {
          setErrorMsg(data.error || 'Verification failed. Please try again.')
          setStatus('error')
        }
      } catch {
        setErrorMsg('Network error. Please try again.')
        setStatus('error')
      }
    }

    return () => {
      window.onTelegramAuth = undefined
    }
  }, [onVerified])

  if (status === 'verified') {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
        <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
        <div>
          <p className="text-emerald-400 font-semibold text-sm">Telegram Verified</p>
          <p className="text-emerald-500/70 text-xs">You are verified. Tasks are now unlocked.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
          <Send className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <p className="font-semibold text-white text-sm">Verify with Telegram</p>
          <p className="text-zinc-500 text-xs">One-tap verification — proves you&apos;re human</p>
        </div>
      </div>

      <div className="px-5 py-5 space-y-4">
        {status === 'error' && errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {errorMsg}
          </div>
        )}

        <p className="text-zinc-400 text-sm leading-relaxed">
          To prevent bots, we require a one-time Telegram login before you can complete tasks.
          Tap the button below — it only takes a few seconds.
        </p>

        {status === 'loading' ? (
          <div className="flex items-center justify-center py-3 text-zinc-400 text-sm gap-2">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-blue-400 rounded-full animate-spin" />
            Verifying...
          </div>
        ) : (
          <div className="flex justify-center">
            <Script
              src="https://telegram.org/js/telegram-widget.js?22"
              data-telegram-login={BOT_USERNAME}
              data-size="large"
              data-onauth="onTelegramAuth(user)"
              strategy="lazyOnload"
            />
          </div>
        )}
      </div>
    </div>
  )
}
