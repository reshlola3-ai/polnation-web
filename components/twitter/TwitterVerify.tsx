'use client'

import { useSearchParams } from 'next/navigation'
import { Twitter, CheckCircle, AlertCircle } from 'lucide-react'

const ERROR_MESSAGES: Record<string, string> = {
  already_linked: 'This Twitter account is already linked to another Polnation account.',
  cancelled: 'Authorization was cancelled. Please try again.',
  invalid_state: 'Session expired. Please try again.',
  token_failed: 'Failed to connect Twitter. Please try again.',
  user_fetch_failed: 'Could not retrieve your Twitter profile. Please try again.',
}

export function TwitterVerify() {
  const searchParams = useSearchParams()
  const error = searchParams.get('twitter_error')

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0">
          <Twitter className="w-4 h-4 text-sky-400" />
        </div>
        <div>
          <p className="font-semibold text-white text-sm">Connect Twitter / X</p>
          <p className="text-zinc-500 text-xs">One account per person — prevents duplicate accounts</p>
        </div>
      </div>

      <div className="px-5 py-5 space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{ERROR_MESSAGES[error] || 'Something went wrong. Please try again.'}</span>
          </div>
        )}

        <p className="text-zinc-400 text-sm leading-relaxed">
          To access tasks, connect your Twitter / X account. Each Twitter account can only be linked to one Polnation account.
        </p>

        <a
          href="/api/auth/twitter"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm transition-colors"
        >
          <Twitter className="w-4 h-4" />
          Connect Twitter / X
        </a>
      </div>
    </div>
  )
}
