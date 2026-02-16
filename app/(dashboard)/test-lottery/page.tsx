'use client'

import { useEffect, useState } from 'react'
import { LotteryWheel } from '@/components/lottery/LotteryWheel'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const translations: Record<string, any> = {
  en: {
    title: "Daily Spin",
    subtitle: "Complete your daily check-in to unlock one free spin!",
    spin: "SPIN",
    spinning: "Spinning...",
    congratulations: "Congratulations!",
    youWon: "You won",
    tryAgain: "Better luck tomorrow!",
    noSpins: "No Spins Left",
    noSpinsDesc: "You've used your daily spin. Come back tomorrow!",
    loginRequired: "Please log in to spin the wheel.",
    history: "Recent Wins",
    noHistory: "No spin history yet",
    prizes: {
      usdc_05: "$0.50 USDC",
      usdc_1: "$1 USDC",
      usdc_5: "$5 USDC",
      usdc_10: "$10 USDC",
      bonus_1: "+$1 Bonus",
      bonus_2: "+$2 Bonus",
      bonus_3: "+$3 Bonus",
      thanks: "Try Again",
    },
    todaySpins: "Today's Spins",
    available: "Available",
    used: "Used",
    close: "Close",
    spinNow: "Spin Now!",
    back: "Back",
    pageTitle: "Lucky Wheel",
    pageDesc: "Spin the wheel daily for a chance to win USDC and bonus rewards!",
  },
  vi: {
    title: "Vòng Quay May Mắn",
    subtitle: "Hoàn thành điểm danh hàng ngày để mở khóa một lượt quay miễn phí!",
    spin: "QUAY",
    spinning: "Đang quay...",
    congratulations: "Chúc mừng!",
    youWon: "Bạn đã thắng",
    tryAgain: "Chúc may mắn vào ngày mai!",
    noSpins: "Hết Lượt Quay",
    noSpinsDesc: "Bạn đã dùng lượt quay hôm nay. Quay lại vào ngày mai!",
    loginRequired: "Vui lòng đăng nhập để quay.",
    history: "Thắng Gần Đây",
    noHistory: "Chưa có lịch sử quay",
    prizes: {
      usdc_05: "$0.50 USDC",
      usdc_1: "$1 USDC",
      usdc_5: "$5 USDC",
      usdc_10: "$10 USDC",
      bonus_1: "+$1 Thưởng",
      bonus_2: "+$2 Thưởng",
      bonus_3: "+$3 Thưởng",
      thanks: "Thử Lại",
    },
    todaySpins: "Lượt Quay Hôm Nay",
    available: "Còn lại",
    used: "Đã dùng",
    close: "Đóng",
    spinNow: "Quay Ngay!",
    back: "Quay lại",
    pageTitle: "Vòng Quay May Mắn",
    pageDesc: "Quay vòng quay mỗi ngày để có cơ hội nhận USDC và thưởng!",
  },
  id: {
    title: "Putaran Harian",
    subtitle: "Selesaikan check-in harian untuk membuka satu putaran gratis!",
    spin: "PUTAR",
    spinning: "Memutar...",
    congratulations: "Selamat!",
    youWon: "Anda memenangkan",
    tryAgain: "Semoga beruntung besok!",
    noSpins: "Tidak Ada Putaran",
    noSpinsDesc: "Anda sudah menggunakan putaran harian. Kembali besok!",
    loginRequired: "Silakan masuk untuk memutar.",
    history: "Kemenangan Terbaru",
    noHistory: "Belum ada riwayat putaran",
    prizes: {
      usdc_05: "$0,50 USDC",
      usdc_1: "$1 USDC",
      usdc_5: "$5 USDC",
      usdc_10: "$10 USDC",
      bonus_1: "+$1 Bonus",
      bonus_2: "+$2 Bonus",
      bonus_3: "+$3 Bonus",
      thanks: "Coba Lagi",
    },
    todaySpins: "Putaran Hari Ini",
    available: "Tersedia",
    used: "Terpakai",
    close: "Tutup",
    spinNow: "Putar Sekarang!",
    back: "Kembali",
    pageTitle: "Roda Keberuntungan",
    pageDesc: "Putar roda setiap hari untuk kesempatan memenangkan USDC dan bonus!",
  },
  fr: {
    title: "Roue Quotidienne",
    subtitle: "Effectuez votre check-in quotidien pour débloquer un tour gratuit !",
    spin: "TOURNER",
    spinning: "En cours...",
    congratulations: "Félicitations !",
    youWon: "Vous avez gagné",
    tryAgain: "Bonne chance demain !",
    noSpins: "Plus de Tours",
    noSpinsDesc: "Vous avez déjà utilisé votre tour quotidien. Revenez demain !",
    loginRequired: "Connectez-vous pour tourner.",
    history: "Gains Récents",
    noHistory: "Aucun historique de tours",
    prizes: {
      usdc_05: "0,50 $ USDC",
      usdc_1: "1 $ USDC",
      usdc_5: "5 $ USDC",
      usdc_10: "10 $ USDC",
      bonus_1: "+1 $ Bonus",
      bonus_2: "+2 $ Bonus",
      bonus_3: "+3 $ Bonus",
      thanks: "Réessayer",
    },
    todaySpins: "Tours Aujourd'hui",
    available: "Disponible",
    used: "Utilisé",
    close: "Fermer",
    spinNow: "Tourner !",
    back: "Retour",
    pageTitle: "Roue de la Chance",
    pageDesc: "Tournez la roue chaque jour pour gagner des USDC et des bonus !",
  },
}

function getLocale(): string {
  if (typeof document === 'undefined') return 'en'
  const match = document.cookie.match(/locale=([^;]+)/)
  return match ? match[1] : 'en'
}

export default function TestLotteryPage() {
  const [locale, setLocale] = useState('en')

  useEffect(() => {
    setLocale(getLocale())
  }, [])

  const t = translations[locale] || translations.en

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-8">
      {/* Back button */}
      <div className="w-full max-w-lg mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.back}
        </Link>
      </div>

      {/* Page header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent mb-2">
          🎡 {t.pageTitle}
        </h1>
        <p className="text-zinc-400 text-sm max-w-md mx-auto">{t.pageDesc}</p>
      </div>

      {/* Lottery Wheel */}
      <div className="glass-card-solid p-6 md:p-10 rounded-2xl max-w-lg w-full">
        <LotteryWheel t={t} />
      </div>

      {/* Prize table */}
      <div className="mt-8 max-w-lg w-full">
        <div className="glass-card-solid rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 text-center">🎁 Prize Pool</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { emoji: '💰', label: t.prizes.usdc_05, chance: '15%' },
              { emoji: '💰', label: t.prizes.usdc_1, chance: '7%' },
              { emoji: '🏆', label: t.prizes.usdc_5, chance: '2.5%' },
              { emoji: '👑', label: t.prizes.usdc_10, chance: '0.5%' },
              { emoji: '⭐', label: t.prizes.bonus_1, chance: '20%' },
              { emoji: '⭐', label: t.prizes.bonus_2, chance: '10%' },
              { emoji: '⭐', label: t.prizes.bonus_3, chance: '5%' },
              { emoji: '😊', label: t.prizes.thanks, chance: '40%' },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl">
                <span className="text-sm text-white">
                  {p.emoji} {p.label}
                </span>
                <span className="text-xs text-zinc-500">{p.chance}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
