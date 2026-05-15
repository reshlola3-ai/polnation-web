'use client'

import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { Twitter, Send } from 'lucide-react'
import { TwitterVerify } from '@/components/twitter/TwitterVerify'
import { TelegramBindButton } from '@/components/auth/TelegramBindButton'

interface Props {
  onTelegramBound?: () => void
}

export function VerifyAccountGate({ onTelegramBound }: Props) {
  const t = useTranslations('verifyGate')

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
            <Send className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm flex items-center gap-2">
              {t('telegramTitle')}
              <span className="px-1.5 py-0.5 bg-[var(--poly-purple)]/20 text-purple-300 text-[10px] rounded-full">
                {t('recommended')}
              </span>
            </p>
            <p className="text-zinc-500 text-xs">{t('telegramSubtitle')}</p>
          </div>
        </div>
        <div className="px-5 py-5 space-y-3">
          <p className="text-zinc-400 text-sm leading-relaxed">{t('telegramDescription')}</p>
          <TelegramBindButton
            onBound={onTelegramBound}
            errorLabels={{
              alreadyBound: t('telegramAlreadyBound'),
              generic: t('telegramGenericError'),
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 px-2">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">{t('orDivider')}</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <Suspense fallback={null}>
        <TwitterVerify />
      </Suspense>
    </div>
  )
}
