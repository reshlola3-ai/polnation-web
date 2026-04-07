'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, CheckCircle, RefreshCw, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface TelegramVerifyProps {
  onVerified?: () => void
}

type Step = 'idle' | 'code_ready' | 'polling' | 'verified'

export function TelegramVerify({ onVerified }: TelegramVerifyProps) {
  const [step, setStep] = useState<Step>('idle')
  const [code, setCode] = useState<string | null>(null)
  const [botUrl, setBotUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const generateCode = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/telegram-verify', { method: 'POST' })
      const data = await res.json()

      if (data.already_verified) {
        setStep('verified')
        onVerified?.()
        return
      }

      if (data.code) {
        setCode(data.code)
        setBotUrl(data.bot_url)
        setStep('code_ready')
      } else {
        setError('Failed to generate code, please try again.')
      }
    } catch {
      setError('Network error, please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const startPolling = () => {
    setStep('polling')
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/telegram-verify')
        const data = await res.json()
        if (data.verified) {
          clearInterval(pollRef.current!)
          setStep('verified')
          onVerified?.()
        }
      } catch { /* ignore transient errors */ }
    }, 3000)

    // Stop polling after 15 minutes
    globalThis.setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        setStep('code_ready')
        setError('Verification timed out. Please generate a new code.')
      }
    }, 15 * 60 * 1000)
  }

  if (step === 'verified') {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
        <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
        <div>
          <p className="text-emerald-400 font-semibold text-sm">Telegram Verified</p>
          <p className="text-emerald-500/70 text-xs">You are verified as a real person. Tasks are now unlocked.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
          <Send className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <p className="font-semibold text-white text-sm">Verify with Telegram</p>
          <p className="text-zinc-500 text-xs">Required to access tasks — proves you&apos;re human</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {step === 'idle' && (
          <>
            <p className="text-zinc-400 text-sm leading-relaxed">
              To prevent bots, we require a one-time Telegram verification before you can complete tasks.
              This only takes 30 seconds.
            </p>
            <Button
              onClick={generateCode}
              isLoading={isLoading}
              className="w-full gap-2"
            >
              <Send className="w-4 h-4" />
              Get Verification Code
            </Button>
          </>
        )}

        {(step === 'code_ready' || step === 'polling') && code && (
          <>
            <div className="space-y-3">
              <p className="text-zinc-400 text-sm">Your verification code:</p>
              <div className="flex items-center justify-center py-3 rounded-xl bg-white/5 border border-white/10">
                <code className="text-2xl font-mono font-bold tracking-widest text-white">
                  {code}
                </code>
              </div>
              <ol className="text-zinc-400 text-sm space-y-1 list-decimal list-inside">
                <li>Click the button below to open Telegram</li>
                <li>The bot will appear — tap <strong className="text-white">Start</strong></li>
                <li>Verification happens automatically</li>
              </ol>
            </div>

            <a
              href={botUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => step === 'code_ready' && startPolling()}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-500/90 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Telegram Bot
            </a>

            {step === 'polling' && (
              <div className="flex items-center justify-center gap-2 text-zinc-500 text-xs">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Waiting for verification...
              </div>
            )}

            <button
              type="button"
              onClick={generateCode}
              disabled={isLoading}
              className="w-full text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Code expired? Generate a new one
            </button>
          </>
        )}
      </div>
    </div>
  )
}
