'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

interface TransferLabels {
  warning?: string
  confirm?: string
  cancel?: string
  transferring?: string
}

interface Props {
  onBound?: (telegramUsername: string | null) => void
  alreadyBoundLabel?: string
  errorLabels?: {
    alreadyBound?: string
    generic?: string
  }
  transferLabels?: TransferLabels
}

const DEFAULT_TRANSFER: Required<TransferLabels> = {
  warning:
    'This Telegram is linked to another account. Transferring moves it here — the other account will no longer be able to log in with Telegram.',
  confirm: 'Transfer & link here',
  cancel: 'Cancel',
  transferring: 'Transferring…',
}

export function TelegramBindButton({ onBound, errorLabels, transferLabels }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Holds the verified widget payload when the TG is already on another account
  // (409). The same payload is reused for the confirmed transfer — its HMAC is
  // valid for 24h, so no second Telegram authorization is needed.
  const [pendingTransfer, setPendingTransfer] = useState<TelegramWidgetUser | null>(null)
  const [transferring, setTransferring] = useState(false)

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
  const tl = { ...DEFAULT_TRANSFER, ...transferLabels }

  const submitBind = useCallback(
    async (user: TelegramWidgetUser, transfer: boolean) => {
      setError('')
      if (transfer) setTransferring(true)
      else setLoading(true)
      try {
        const res = await fetch('/api/auth/bind-telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transfer ? { ...user, transfer: true } : user),
        })
        const data = await res.json()
        if (!res.ok) {
          // First-time conflict → offer the transfer flow instead of dead-ending.
          if (data.error === 'telegram_already_bound') {
            setPendingTransfer(user)
            return
          }
          throw new Error(errorLabels?.generic || 'Failed to bind Telegram. Please try again.')
        }
        setPendingTransfer(null)
        onBound?.(data.telegram_username || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Telegram bind failed')
      } finally {
        setLoading(false)
        setTransferring(false)
      }
    },
    [errorLabels?.generic, onBound],
  )

  // Keep the latest submitBind in a ref so the window-scoped widget callback
  // always calls the current closure without re-registering the script.
  const submitRef = useRef<((user: TelegramWidgetUser, transfer: boolean) => Promise<void>) | null>(null)
  useEffect(() => {
    submitRef.current = submitBind
  }, [submitBind])

  useEffect(() => {
    const container = containerRef.current
    if (!botUsername || !container) return

    const win = window as WindowWithCallback
    win.onTelegramBindAuth = (user) => {
      setPendingTransfer(null)
      void submitRef.current?.(user, false)
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
  }, [botUsername])

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

      {/* Transfer confirmation — shown when the TG is already on another account */}
      {pendingTransfer && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
          <p className="text-amber-200 text-xs leading-snug">{tl.warning}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { void submitBind(pendingTransfer, true) }}
              disabled={transferring}
              className="flex-1 px-3 py-2 rounded-lg bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {transferring ? tl.transferring : tl.confirm}
            </button>
            <button
              type="button"
              onClick={() => { setPendingTransfer(null); setError('') }}
              disabled={transferring}
              className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white text-sm hover:bg-white/[0.10] active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {tl.cancel}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
