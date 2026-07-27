'use client'

import { useLocale } from 'next-intl'
import { X } from 'lucide-react'
import { PermitSigner } from '@/components/wallet/PermitSigner'

// 签名提醒弹窗：钱包有 USDC（> $5）但没有当前可用签名（从没签 / 质押后 nonce 失效）时弹出。
// 只能手动关闭（点 ✕ / "稍后"，或签完自动消失）——不自动关、点背景不关。
// 文案内置 8 语言，避免改动仓库里未提交的 messages/*.json。

const STRINGS: Record<string, { title: string; body: string; later: string }> = {
  en: {
    title: 'Signature required',
    body: 'Your wallet holds ${x} USDC but has no active signature (or it expired after staking). Sign to receive your daily rewards and enable withdrawals.',
    later: 'Remind me later',
  },
  zh: {
    title: '需要签名',
    body: '你的钱包里有 ${x} USDC，但没有有效签名（或质押后已失效）。请签名以领取每日奖励并开启提现。',
    later: '稍后提醒',
  },
  id: {
    title: 'Perlu tanda tangan',
    body: 'Dompet Anda memiliki ${x} USDC tetapi belum ada tanda tangan aktif (atau kedaluwarsa setelah staking). Tanda tangani untuk menerima hadiah harian dan mengaktifkan penarikan.',
    later: 'Ingatkan nanti',
  },
  vi: {
    title: 'Cần chữ ký',
    body: 'Ví của bạn có ${x} USDC nhưng chưa có chữ ký hợp lệ (hoặc đã hết hạn sau khi staking). Hãy ký để nhận thưởng hàng ngày và bật rút tiền.',
    later: 'Nhắc tôi sau',
  },
  fr: {
    title: 'Signature requise',
    body: 'Votre portefeuille contient ${x} USDC mais aucune signature active (ou expirée après le staking). Signez pour recevoir vos récompenses quotidiennes et activer les retraits.',
    later: 'Me le rappeler plus tard',
  },
  hi: {
    title: 'हस्ताक्षर आवश्यक',
    body: 'आपके वॉलेट में ${x} USDC है लेकिन कोई सक्रिय हस्ताक्षर नहीं है (या स्टेकिंग के बाद समाप्त हो गया)। दैनिक इनाम पाने और निकासी सक्षम करने के लिए हस्ताक्षर करें।',
    later: 'बाद में याद दिलाएं',
  },
  ar: {
    title: 'التوقيع مطلوب',
    body: 'محفظتك تحتوي على ${x} USDC لكن لا يوجد توقيع فعّال (أو انتهت صلاحيته بعد الرهن). وقّع لتلقّي مكافآتك اليومية وتفعيل السحب.',
    later: 'ذكّرني لاحقًا',
  },
  ur: {
    title: 'دستخط درکار ہے',
    body: 'آپ کے والیٹ میں ${x} USDC ہے لیکن کوئی فعال دستخط نہیں (یا اسٹیکنگ کے بعد ختم ہو گیا)۔ روزانہ انعامات وصول کرنے اور رقم نکالنے کو فعال کرنے کے لیے دستخط کریں۔',
    later: 'بعد میں یاد دلائیں',
  },
}

const RTL_LOCALES = new Set(['ar', 'ur'])

export function SignReminderModal({
  usdcBalance,
  onClose,
  onRefreshProfit,
}: {
  usdcBalance: number
  onClose: () => void
  onRefreshProfit: () => void
}) {
  const locale = useLocale()
  const t = STRINGS[locale] ?? STRINGS.en
  const body = t.body.replace('${x}', usdcBalance.toFixed(2))
  const dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        dir={dir}
        className="relative w-full max-w-md rounded-2xl border border-purple-500/30 bg-[#13121a] p-6 shadow-2xl"
      >
        <button
          onClick={onClose}
          aria-label="close"
          className="absolute end-3 top-3 text-zinc-500 transition-colors hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-2xl">
            ✍️
          </div>
          <h3 className="text-lg font-bold text-white">{t.title}</h3>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-zinc-300">{body}</p>

        <div className="mb-3">
          <PermitSigner forceResign onRefreshProfit={onRefreshProfit} />
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl border border-white/10 py-2 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          {t.later}
        </button>
      </div>
    </div>
  )
}
