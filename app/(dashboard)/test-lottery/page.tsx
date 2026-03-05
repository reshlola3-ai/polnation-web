'use client'

import { useEffect, useState } from 'react'
import { LotteryWheel } from '@/components/lottery/LotteryWheel'
import { ArrowLeft, Info } from 'lucide-react'
import Link from 'next/link'

const translations: Record<string, any> = {
  en: {
    title: "Lucky Wheel",
    subtitle: "Spin the wheel to win USDC and bonus rewards!",
    spin: "SPIN",
    spinning: "Spinning...",
    congratulations: "Congratulations!",
    youWon: "You won",
    tryAgain: "Better luck next time!",
    noSpins: "No Spins Left",
    noSpinsDesc: "Invite friends or claim airdrops to earn more spins!",
    loginRequired: "Please log in to spin the wheel.",
    history: "Spin History",
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
    todaySpins: "Spins",
    available: "Available",
    used: "Used",
    close: "Close",
    spinNow: "Spin Now!",
    remainingSpins: "Spins Available",
    unlimitedSpins: "∞ Unlimited Spins (Influencer)",
    bonusNote: "⭐ Bonus added to your Unlock Progress",
    usdcNote: "💰 USDC added to your Withdrawable Balance",
    checkSpins: "Check for new spins",
    back: "Back",
    pageTitle: "Lucky Wheel",
    pageDesc: "Win real USDC and bonus rewards!",
    howToEarn: "How to Earn Spins",
    earnMethod1: "Invite a friend who participates in staking and claims 7 days of airdrops → +1 Spin",
    earnMethod2: "Your airdrop claims reach multiples of 7 (7, 14, 21...) → +1 Spin each",
    earnMethod3: "Become an Influencer → Unlimited Spins",
    rewardInfo: "Reward Info",
    rewardUsdc: "USDC rewards go directly to your withdrawable balance",
    rewardBonus: "Bonus rewards are added to your unlock progress",
  },
  vi: {
    title: "Vòng Quay May Mắn",
    subtitle: "Quay vòng quay để thắng USDC và phần thưởng!",
    spin: "QUAY",
    spinning: "Đang quay...",
    congratulations: "Chúc mừng!",
    youWon: "Bạn đã thắng",
    tryAgain: "Chúc may mắn lần sau!",
    noSpins: "Hết Lượt Quay",
    noSpinsDesc: "Mời bạn bè hoặc nhận airdrop để kiếm thêm lượt quay!",
    loginRequired: "Vui lòng đăng nhập để quay.",
    history: "Lịch Sử Quay",
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
    todaySpins: "Lượt Quay",
    available: "Còn lại",
    used: "Đã dùng",
    close: "Đóng",
    spinNow: "Quay Ngay!",
    remainingSpins: "Lượt Quay Còn Lại",
    unlimitedSpins: "∞ Không Giới Hạn (Influencer)",
    bonusNote: "⭐ Thưởng đã được thêm vào Tiến Trình Mở Khóa",
    usdcNote: "💰 USDC đã được thêm vào Số Dư Rút Được",
    checkSpins: "Kiểm tra lượt quay mới",
    back: "Quay lại",
    pageTitle: "Vòng Quay May Mắn",
    pageDesc: "Thắng USDC và phần thưởng thật!",
    howToEarn: "Cách Kiếm Lượt Quay",
    earnMethod1: "Mời bạn tham gia staking và nhận 7 ngày airdrop → +1 Lượt",
    earnMethod2: "Số lần nhận airdrop đạt bội của 7 (7, 14, 21...) → +1 Lượt mỗi lần",
    earnMethod3: "Trở thành Influencer → Quay Không Giới Hạn",
    rewardInfo: "Thông Tin Thưởng",
    rewardUsdc: "USDC thưởng được chuyển thẳng vào số dư rút được",
    rewardBonus: "Bonus thưởng được thêm vào tiến trình mở khóa",
  },
  id: {
    title: "Roda Keberuntungan",
    subtitle: "Putar roda untuk memenangkan USDC dan bonus!",
    spin: "PUTAR",
    spinning: "Memutar...",
    congratulations: "Selamat!",
    youWon: "Anda memenangkan",
    tryAgain: "Semoga beruntung lain kali!",
    noSpins: "Tidak Ada Putaran",
    noSpinsDesc: "Undang teman atau klaim airdrop untuk mendapat putaran!",
    loginRequired: "Silakan masuk untuk memutar.",
    history: "Riwayat Putaran",
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
    todaySpins: "Putaran",
    available: "Tersedia",
    used: "Terpakai",
    close: "Tutup",
    spinNow: "Putar Sekarang!",
    remainingSpins: "Putaran Tersedia",
    unlimitedSpins: "∞ Tanpa Batas (Influencer)",
    bonusNote: "⭐ Bonus ditambahkan ke Progres Buka Kunci",
    usdcNote: "💰 USDC ditambahkan ke Saldo Dapat Ditarik",
    checkSpins: "Periksa putaran baru",
    back: "Kembali",
    pageTitle: "Roda Keberuntungan",
    pageDesc: "Menangkan USDC dan bonus nyata!",
    howToEarn: "Cara Mendapat Putaran",
    earnMethod1: "Undang teman yang ikut staking dan klaim 7 hari airdrop → +1 Putaran",
    earnMethod2: "Klaim airdrop Anda mencapai kelipatan 7 (7, 14, 21...) → +1 Putaran",
    earnMethod3: "Jadi Influencer → Putaran Tak Terbatas",
    rewardInfo: "Info Hadiah",
    rewardUsdc: "Hadiah USDC langsung masuk saldo yang dapat ditarik",
    rewardBonus: "Hadiah bonus ditambahkan ke progres buka kunci",
  },
  fr: {
    title: "Roue de la Chance",
    subtitle: "Tournez la roue pour gagner des USDC et des bonus !",
    spin: "TOURNER",
    spinning: "En cours...",
    congratulations: "Félicitations !",
    youWon: "Vous avez gagné",
    tryAgain: "Bonne chance la prochaine fois !",
    noSpins: "Plus de Tours",
    noSpinsDesc: "Invitez des amis ou réclamez des airdrops pour gagner des tours !",
    loginRequired: "Connectez-vous pour tourner.",
    history: "Historique",
    noHistory: "Aucun historique",
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
    todaySpins: "Tours",
    available: "Disponible",
    used: "Utilisé",
    close: "Fermer",
    spinNow: "Tourner !",
    remainingSpins: "Tours Disponibles",
    unlimitedSpins: "∞ Tours Illimités (Influencer)",
    bonusNote: "⭐ Bonus ajouté à votre Progression de Déverrouillage",
    usdcNote: "💰 USDC ajouté à votre Solde Retirable",
    checkSpins: "Vérifier les nouveaux tours",
    back: "Retour",
    pageTitle: "Roue de la Chance",
    pageDesc: "Gagnez de vrais USDC et des bonus !",
    howToEarn: "Comment Gagner des Tours",
    earnMethod1: "Invitez un ami qui participe au staking et réclame 7 jours d'airdrop → +1 Tour",
    earnMethod2: "Vos réclamations d'airdrop atteignent un multiple de 7 (7, 14, 21...) → +1 Tour",
    earnMethod3: "Devenez Influencer → Tours Illimités",
    rewardInfo: "Info Récompenses",
    rewardUsdc: "Les récompenses USDC vont directement dans votre solde retirable",
    rewardBonus: "Les bonus sont ajoutés à votre progression de déverrouillage",
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
              { emoji: '💰', label: t.prizes.usdc_05, chance: '15%', note: 'Withdrawable' },
              { emoji: '💰', label: t.prizes.usdc_1, chance: '7%', note: 'Withdrawable' },
              { emoji: '🏆', label: t.prizes.usdc_5, chance: '2.5%', note: 'Withdrawable' },
              { emoji: '👑', label: t.prizes.usdc_10, chance: '0.5%', note: 'Withdrawable' },
              { emoji: '⭐', label: t.prizes.bonus_1, chance: '20%', note: 'Unlock Progress' },
              { emoji: '⭐', label: t.prizes.bonus_2, chance: '10%', note: 'Unlock Progress' },
              { emoji: '⭐', label: t.prizes.bonus_3, chance: '5%', note: 'Unlock Progress' },
              { emoji: '😊', label: t.prizes.thanks, chance: '40%', note: '' },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl">
                <div>
                  <span className="text-sm text-white">
                    {p.emoji} {p.label}
                  </span>
                  {p.note && (
                    <p className="text-[10px] text-zinc-600">{p.note}</p>
                  )}
                </div>
                <span className="text-xs text-zinc-500">{p.chance}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How to earn spins */}
      <div className="mt-4 max-w-lg w-full">
        <div className="glass-card-solid rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" />
            {t.howToEarn}
          </h3>
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-2.5 bg-white/5 rounded-xl">
              <span className="text-purple-400 font-bold text-sm mt-0.5">1.</span>
              <p className="text-zinc-300 text-sm">{t.earnMethod1}</p>
            </div>
            <div className="flex items-start gap-2 p-2.5 bg-white/5 rounded-xl">
              <span className="text-purple-400 font-bold text-sm mt-0.5">2.</span>
              <p className="text-zinc-300 text-sm">{t.earnMethod2}</p>
            </div>
            <div className="flex items-start gap-2 p-2.5 bg-white/5 rounded-xl">
              <span className="text-purple-400 font-bold text-sm mt-0.5">3.</span>
              <p className="text-zinc-300 text-sm">{t.earnMethod3}</p>
            </div>
          </div>

          {/* Reward info */}
          <div className="mt-4 pt-3 border-t border-white/5">
            <h4 className="text-white text-sm font-medium mb-2">{t.rewardInfo}</h4>
            <div className="space-y-1">
              <p className="text-xs text-green-400/80">💰 {t.rewardUsdc}</p>
              <p className="text-xs text-purple-400/80">⭐ {t.rewardBonus}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
