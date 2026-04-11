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
    earnMethod1: "Invite a friend who verifies Twitter and claims their first airdrop → +1 Spin",
    earnMethod2: "Your airdrop claims reach multiples of 7 (7, 14, 21...) → +1 Spin each",
    earnMethod3: "Become an Influencer → Contact admin for exclusive spin bonuses",
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
    earnMethod1: "Mời bạn xác minh Twitter và nhận airdrop lần đầu → +1 Lượt",
    earnMethod2: "Số lần nhận airdrop đạt bội của 7 (7, 14, 21...) → +1 Lượt mỗi lần",
    earnMethod3: "Trở thành Influencer → Liên hệ admin để nhận spin độc quyền",
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
    earnMethod1: "Undang teman yang verifikasi Twitter dan klaim airdrop pertama → +1 Putaran",
    earnMethod2: "Klaim airdrop Anda mencapai kelipatan 7 (7, 14, 21...) → +1 Putaran",
    earnMethod3: "Jadi Influencer → Hubungi admin untuk bonus putaran eksklusif",
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
    earnMethod1: "Invitez un ami qui vérifie Twitter et réclame son premier airdrop → +1 Tour",
    earnMethod2: "Vos réclamations d'airdrop atteignent un multiple de 7 (7, 14, 21...) → +1 Tour",
    earnMethod3: "Devenez Influencer → Contactez l'admin pour des tours exclusifs",
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

interface SpinData {
  remainingSpins: number
  totalSpins: number
  usedSpins: number
  isInfluencer: boolean
  selfAirdropCount: number
  progressToNextSpin: number
  nextMilestone: number
}

export default function TestLotteryPage() {
  const [locale, setLocale] = useState('en')
  const [spinData, setSpinData] = useState<SpinData | null>(null)

  useEffect(() => {
    setLocale(getLocale())
    fetch('/api/lottery')
      .then(r => r.json())
      .then(d => setSpinData(d))
      .catch(() => {})
  }, [])

  const t = translations[locale] || translations.en

  const progressPct = spinData ? (spinData.progressToNextSpin / 7) * 100 : 0

  return (
    <div className="min-h-[80vh] flex flex-col items-center py-6 px-4">
      {/* Back button */}
      <div className="w-full max-w-lg mb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.back}
        </Link>
      </div>

      {/* Page header */}
      <div className="text-center mb-5">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-amber-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent mb-1">
          🎡 {t.pageTitle}
        </h1>
        <p className="text-zinc-400 text-sm">{t.pageDesc}</p>
      </div>

      {/* ─── How to Earn Spins — shown ABOVE the wheel ─── */}
      <div className="max-w-lg w-full mb-5">
        <div className="glass-card-solid rounded-2xl p-5 border border-purple-500/20">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" />
            {t.howToEarn}
          </h3>

          <div className="space-y-3">
            {/* Method 1: referral */}
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-sm">👥</span>
              </div>
              <div>
                <p className="text-white text-sm font-medium">Invite a Friend</p>
                <p className="text-zinc-400 text-xs mt-0.5">{t.earnMethod1}</p>
              </div>
            </div>

            {/* Method 2: self airdrops — with live progress */}
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-sm">✈️</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">Claim Airdrops</p>
                <p className="text-zinc-400 text-xs mt-0.5">{t.earnMethod2}</p>
                {spinData && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">
                        {spinData.progressToNextSpin} / 7 claims toward next spin
                      </span>
                      <span className="text-cyan-400 font-medium">
                        {spinData.selfAirdropCount} total
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full transition-all duration-700"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    {spinData.progressToNextSpin > 0 && (
                      <p className="text-[10px] text-cyan-400/70 mt-1">
                        {7 - spinData.progressToNextSpin} more claims → unlock 1 spin 🎰
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Method 3: influencer */}
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-sm">⭐</span>
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Become Influencer</p>
                <p className="text-zinc-400 text-xs mt-0.5">{t.earnMethod3}</p>
                <a
                  href="https://t.me/polnation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-500/25 transition-colors"
                >
                  Contact Admin →
                </a>
              </div>
            </div>
          </div>

          {/* Spin count summary */}
          {spinData && (
            <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20">
              <div className="text-2xl font-bold text-white">
                {spinData.remainingSpins}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{t.remainingSpins}</p>
                <p className="text-xs text-zinc-500">{spinData.usedSpins} used · {spinData.totalSpins} total earned</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Lottery Wheel ─── */}
      <div className="glass-card-solid p-5 md:p-8 rounded-2xl max-w-lg w-full border border-white/10">
        <LotteryWheel t={t} />
      </div>

      {/* ─── Reward info ─── */}
      <div className="mt-3 max-w-lg w-full flex gap-2">
        <div className="flex-1 flex items-center gap-2 p-2.5 bg-green-500/10 rounded-xl border border-green-500/20">
          <span className="text-base">💰</span>
          <p className="text-xs text-green-400">{t.rewardUsdc}</p>
        </div>
        <div className="flex-1 flex items-center gap-2 p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20">
          <span className="text-base">⭐</span>
          <p className="text-xs text-purple-400">{t.rewardBonus}</p>
        </div>
      </div>

      {/* ─── Prize table (compact) ─── */}
      <div className="mt-4 max-w-lg w-full">
        <div className="glass-card-solid rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-3 text-center text-sm">🎁 Prize Odds</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { emoji: '💰', label: t.prizes.usdc_05, chance: '15%', color: 'text-green-400' },
              { emoji: '💰', label: t.prizes.usdc_1, chance: '7%', color: 'text-green-400' },
              { emoji: '🏆', label: t.prizes.usdc_5, chance: '2.5%', color: 'text-green-400' },
              { emoji: '👑', label: t.prizes.usdc_10, chance: '0.5%', color: 'text-green-400' },
              { emoji: '⭐', label: t.prizes.bonus_1, chance: '20%', color: 'text-purple-400' },
              { emoji: '⭐', label: t.prizes.bonus_2, chance: '10%', color: 'text-purple-400' },
              { emoji: '⭐', label: t.prizes.bonus_3, chance: '5%', color: 'text-purple-400' },
              { emoji: '😊', label: t.prizes.thanks, chance: '40%', color: 'text-zinc-500' },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                <span className={`text-xs font-medium ${p.color}`}>
                  {p.emoji} {p.label}
                </span>
                <span className="text-[10px] text-zinc-600 ml-1">{p.chance}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
