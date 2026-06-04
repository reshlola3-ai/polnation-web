'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LotteryWheel } from '@/components/lottery/LotteryWheel'
import { TelegramBindButton } from '@/components/auth/TelegramBindButton'
import { ArrowLeft, Info } from 'lucide-react'
import Link from 'next/link'
import { BevelCard } from '@/components/ui/poly/BevelCard'
import { EyebrowTag } from '@/components/ui/poly/EyebrowTag'
import { MonoStat } from '@/components/ui/poly/MonoStat'

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
      electronics: "📱 Premium Electronics",
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
    earnMethod1: "Invite a friend who registers and verifies Twitter → +1 Spin",
    earnMethod2: "Your airdrop claims reach multiples of 7 (7, 14, 21...) → +1 Spin each",
    earnMethod3: "Become an Influencer → Contact admin for exclusive spin bonuses",
    shareBtn: "Share",
    shareCopied: "Copied!",
    rewardInfo: "Reward Info",
    rewardUsdc: "USDC rewards go directly to your withdrawable balance",
    rewardBonus: "Bonus rewards are added to your unlock progress",
    freeSpinTitle: "Join our Telegram → Free Spin",
    freeSpinDesc: "Link your Telegram and join the official group to earn 1 free spin.",
    bindTelegramFirst: "First, link your Telegram account:",
    joinGroupBtn: "Join Telegram Group",
    verifyJoinBtn: "I've joined — verify",
    verifying: "Verifying membership…",
    notConfirmed: "We couldn't confirm you joined the group yet. Join, then tap verify again.",
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
      electronics: "📱 Đồ Điện Tử Cao Cấp",
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
    earnMethod1: "Mời bạn đăng ký và xác minh Twitter → +1 Lượt",
    earnMethod2: "Số lần nhận airdrop đạt bội của 7 (7, 14, 21...) → +1 Lượt mỗi lần",
    earnMethod3: "Trở thành Influencer → Liên hệ admin để nhận spin độc quyền",
    shareBtn: "Chia sẻ",
    shareCopied: "Đã sao chép!",
    rewardInfo: "Thông Tin Thưởng",
    rewardUsdc: "USDC thưởng được chuyển thẳng vào số dư rút được",
    rewardBonus: "Bonus thưởng được thêm vào tiến trình mở khóa",
    freeSpinTitle: "Tham gia Telegram → Lượt quay miễn phí",
    freeSpinDesc: "Liên kết Telegram và tham gia nhóm chính thức để nhận 1 lượt quay miễn phí.",
    bindTelegramFirst: "Trước tiên, liên kết tài khoản Telegram của bạn:",
    joinGroupBtn: "Tham gia nhóm Telegram",
    verifyJoinBtn: "Tôi đã tham gia — xác minh",
    verifying: "Đang xác minh thành viên…",
    notConfirmed: "Chưa xác nhận được bạn đã vào nhóm. Hãy tham gia rồi nhấn xác minh lại.",
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
      electronics: "📱 Elektronik Premium",
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
    earnMethod1: "Undang teman yang mendaftar dan verifikasi Twitter → +1 Putaran",
    earnMethod2: "Klaim airdrop Anda mencapai kelipatan 7 (7, 14, 21...) → +1 Putaran",
    earnMethod3: "Jadi Influencer → Hubungi admin untuk bonus putaran eksklusif",
    shareBtn: "Bagikan",
    shareCopied: "Tersalin!",
    rewardInfo: "Info Hadiah",
    rewardUsdc: "Hadiah USDC langsung masuk saldo yang dapat ditarik",
    rewardBonus: "Hadiah bonus ditambahkan ke progres buka kunci",
    freeSpinTitle: "Gabung Telegram → Putaran Gratis",
    freeSpinDesc: "Tautkan Telegram dan gabung grup resmi untuk mendapat 1 putaran gratis.",
    bindTelegramFirst: "Pertama, tautkan akun Telegram Anda:",
    joinGroupBtn: "Gabung Grup Telegram",
    verifyJoinBtn: "Saya sudah gabung — verifikasi",
    verifying: "Memverifikasi keanggotaan…",
    notConfirmed: "Kami belum dapat memastikan Anda bergabung. Gabung lalu ketuk verifikasi lagi.",
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
      electronics: "📱 Électronique Premium",
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
    earnMethod1: "Invitez un ami qui s'inscrit et vérifie Twitter → +1 Tour",
    earnMethod2: "Vos réclamations d'airdrop atteignent un multiple de 7 (7, 14, 21...) → +1 Tour",
    earnMethod3: "Devenez Influencer → Contactez l'admin pour des tours exclusifs",
    shareBtn: "Partager",
    shareCopied: "Copié !",
    rewardInfo: "Info Récompenses",
    rewardUsdc: "Les récompenses USDC vont directement dans votre solde retirable",
    rewardBonus: "Les bonus sont ajoutés à votre progression de déverrouillage",
    freeSpinTitle: "Rejoignez notre Telegram → Tour gratuit",
    freeSpinDesc: "Liez votre Telegram et rejoignez le groupe officiel pour gagner 1 tour gratuit.",
    bindTelegramFirst: "D'abord, liez votre compte Telegram :",
    joinGroupBtn: "Rejoindre le groupe Telegram",
    verifyJoinBtn: "J'ai rejoint — vérifier",
    verifying: "Vérification de l'adhésion…",
    notConfirmed: "Nous n'avons pas pu confirmer votre adhésion. Rejoignez, puis appuyez à nouveau sur vérifier.",
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
  referralCode: string | null
  welcomeSpinEarned?: boolean
}

interface Membership {
  configured: boolean
  isMember: boolean
  inviteLink: string | null
  reason?: string
}

export default function TestLotteryPage() {
  const [locale, setLocale] = useState('en')
  const [spinData, setSpinData] = useState<SpinData | null>(null)
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')
  const [membership, setMembership] = useState<Membership | null>(null)
  const [verifying, setVerifying] = useState(false)
  // Set when a verify completes but the spin still wasn't granted (user not in
  // the group yet) — drives an explicit hint instead of silently looping.
  const [verifyFailed, setVerifyFailed] = useState(false)
  // Concurrency guard: ignore re-entrant verify calls (e.g. rapid tab focus
  // changes during the Telegram app-switch) while one is already in flight.
  const verifyingRef = useRef(false)

  // fetch with a hard timeout so a slow/hanging server call (check-spins does a
  // server-side Telegram getChatMember + several DB round-trips) can never wedge
  // the spinner.
  const fetchWithTimeout = useCallback(async (url: string, init?: RequestInit, ms = 12000) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ms)
    try {
      return await fetch(url, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }, [])

  const loadLottery = useCallback(async (): Promise<SpinData | null> => {
    try {
      const r = await fetchWithTimeout('/api/lottery')
      if (r.ok) {
        const d = (await r.json()) as SpinData
        setSpinData(d)
        return d
      }
    } catch {
      // silent
    }
    return null
  }, [fetchWithTimeout])

  const loadMembership = useCallback(async (): Promise<Membership | null> => {
    try {
      const r = await fetchWithTimeout('/api/telegram/check-membership')
      if (r.ok) {
        const m = (await r.json()) as Membership
        setMembership(m)
        return m
      }
    } catch {
      // silent
    }
    return null
  }, [fetchWithTimeout])

  // Re-evaluate the welcome spin: ask the server to grant any earned spins
  // (it calls Telegram getChatMember to confirm group membership), then resync
  // both the lottery state and membership flags. Guarded + timed so it can't
  // get stuck on the notoriously slow check-spins call.
  const verifyAndGrant = useCallback(async ({ manual = false } = {}) => {
    if (verifyingRef.current) return
    verifyingRef.current = true
    setVerifying(true)
    setVerifyFailed(false)
    try {
      try {
        await fetchWithTimeout('/api/lottery/check-spins', { method: 'POST' })
      } catch {
        // silent — fall through to resync, which reflects the real state
      }
      const [lottery] = await Promise.all([loadLottery(), loadMembership()])
      // Manual taps deserve explicit feedback: if the spin still wasn't granted,
      // the user almost certainly hasn't actually joined the group yet.
      if (manual && lottery && !lottery.welcomeSpinEarned) {
        setVerifyFailed(true)
      }
    } finally {
      verifyingRef.current = false
      setVerifying(false)
    }
  }, [fetchWithTimeout, loadLottery, loadMembership])

  useEffect(() => {
    setLocale(getLocale())
    loadLottery()
    loadMembership()
  }, [loadLottery, loadMembership])

  // Auto-verify on tab return ONLY when the user is already TG-bound and the
  // welcome spin isn't earned yet — i.e. they've gone off to join the group.
  // Never fire during the bind step, or it would hide the login button behind
  // the spinner (the original "stuck on verifying" bug).
  const boundAwaitingJoin =
    !!membership?.configured &&
    membership.reason !== 'no_telegram_id' &&
    !!spinData &&
    !spinData.welcomeSpinEarned
  useEffect(() => {
    if (!boundAwaitingJoin) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') verifyAndGrant()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [boundAwaitingJoin, verifyAndGrant])

  const t = translations[locale] || translations.en

  const progressPct = spinData ? (spinData.progressToNextSpin / 7) * 100 : 0

  const referralLink = spinData?.referralCode
    ? `https://polnation.com/register?ref=${spinData.referralCode}`
    : null

  const handleShare = async () => {
    if (!referralLink) return
    const shareText = `🚀 Join me on Polnation!\n\n👉 ${referralLink}`
    // Try native share sheet first (mobile)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Polnation', text: shareText, url: referralLink })
        return
      } catch {
        // user cancelled or share failed → fall through to clipboard
      }
    }
    // Clipboard fallback (desktop / unsupported browsers)
    try {
      await navigator.clipboard.writeText(referralLink)
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 1500)
    } catch {
      // ignore
    }
  }

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
        <EyebrowTag>Polnation · Lottery</EyebrowTag>
        <h1 className="mt-1.5 text-3xl font-semibold text-white tracking-tight">{t.pageTitle}</h1>
        <p className="mt-1 text-[13px] text-white/50">{t.pageDesc}</p>
      </div>

      {/* ─── How to Earn Spins ─── */}
      <div className="max-w-lg w-full mb-5">
        <BevelCard size="lg" pad={20}>
          <EyebrowTag className="inline-flex items-center gap-1.5 mb-4">
            <Info className="w-3 h-3" />
            {t.howToEarn}
          </EyebrowTag>

          <div className="space-y-2">
            {/* Invite a Friend — with Share button */}
            <div className="flex items-start gap-3 p-3 bg-white/[0.04] border border-white/[0.06]">
              <div className="w-8 h-8 flex items-center justify-center border border-white/15 shrink-0 text-sm">👥</div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium">Invite a Friend</p>
                <p className="text-white/45 text-xs mt-0.5">{t.earnMethod1}</p>
              </div>
              <button
                type="button"
                onClick={handleShare}
                disabled={!referralLink}
                className="shrink-0 self-center px-3 py-1.5 text-[10px] uppercase border border-white/15 bg-white/[0.04] text-white/85 hover:bg-white/[0.08] hover:border-white/25 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
                style={{ fontFamily: 'var(--poly-font-mono)', letterSpacing: '0.1em' }}
              >
                {shareState === 'copied' ? t.shareCopied : t.shareBtn}
              </button>
            </div>
            {/* Claim Airdrops + Become Influencer */}
            {[
              { label: 'Claim Airdrops',     desc: t.earnMethod2, icon: '✈️' },
              { label: 'Become Influencer',  desc: t.earnMethod3, icon: '⭐' },
            ].map((m) => (
              <div key={m.label} className="flex items-start gap-3 p-3 bg-white/[0.04] border border-white/[0.06]">
                <div className="w-8 h-8 flex items-center justify-center border border-white/15 shrink-0 text-sm">{m.icon}</div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium">{m.label}</p>
                  <p className="text-white/45 text-xs mt-0.5">{m.desc}</p>
                </div>
              </div>
            ))}
            {/* Live airdrop progress */}
            {spinData && spinData.progressToNextSpin >= 0 && (
              <div className="pt-1 px-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/45">{spinData.progressToNextSpin} / 7 claims</span>
                  <span style={{ color: 'var(--poly-purple)' }}>{spinData.selfAirdropCount} total</span>
                </div>
                <div className="h-1 bg-white/[0.06] overflow-hidden">
                  <div className="h-full bg-[var(--poly-purple)] transition-all duration-700" style={{ width: `${progressPct}%` }} />
                </div>
                {spinData.progressToNextSpin > 0 && (
                  <p className="text-[10px] text-[var(--poly-purple)]/70 mt-1">
                    {7 - spinData.progressToNextSpin} more → unlock 1 spin
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Spin count */}
          {spinData && (
            <div className="mt-4 flex items-center gap-4 pt-4 border-t border-white/[0.06]">
              <MonoStat value={String(spinData.remainingSpins)} size="main" />
              <div>
                <p className="text-[13px] font-semibold text-white">{t.remainingSpins}</p>
                <p className="text-[11px] text-white/45">{spinData.usedSpins} used · {spinData.totalSpins} total</p>
              </div>
            </div>
          )}
        </BevelCard>
      </div>

      {/* ─── Welcome task: join TG group → +1 free spin (one-time) ─── */}
      {/* Only shown when a required group is configured and the welcome spin
          hasn't been earned yet. Two steps: link Telegram → join group →
          server grants the spin via getChatMember verification. */}
      {membership?.configured && spinData && !spinData.welcomeSpinEarned && (
        <div className="max-w-lg w-full mb-5">
          <BevelCard
            size="lg"
            pad={20}
            bg="linear-gradient(135deg, rgba(124,58,237,0.18), rgba(6,182,212,0.08))"
            strokeColor="rgba(168,85,247,0.45)"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <EyebrowTag>Welcome</EyebrowTag>
                <p className="text-white text-[15px] font-semibold mt-1 leading-tight">
                  {t.freeSpinTitle}
                </p>
                <p className="text-white/55 text-xs mt-0.5">{t.freeSpinDesc}</p>
              </div>
              <span className="text-2xl shrink-0">🎁</span>
            </div>

            {verifying ? (
              <div className="flex items-center gap-2 p-2.5 bg-white/[0.04] border border-white/[0.10]">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--poly-purple)] border-t-transparent animate-spin shrink-0" />
                <p className="text-white/70 text-xs">{t.verifying}</p>
              </div>
            ) : membership.reason === 'no_telegram_id' ? (
              <div className="space-y-2">
                <p className="text-white/55 text-xs">{t.bindTelegramFirst}</p>
                <TelegramBindButton onBound={() => { void loadMembership() }} />
              </div>
            ) : (
              <div className="space-y-2">
                {!membership.isMember && membership.inviteLink && (
                  <a
                    href={membership.inviteLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center p-2.5 bg-[var(--poly-purple)] text-white text-sm font-semibold hover:bg-[var(--poly-purple-hover)] active:scale-[0.99] transition-colors"
                  >
                    {t.joinGroupBtn}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => { void verifyAndGrant({ manual: true }) }}
                  className="w-full p-2.5 bg-white/[0.06] border border-white/[0.12] text-white text-sm hover:bg-white/[0.10] active:scale-[0.99] transition-all"
                >
                  {t.verifyJoinBtn}
                </button>
                {verifyFailed && (
                  <p className="text-amber-300/90 text-xs leading-snug">{t.notConfirmed}</p>
                )}
              </div>
            )}
          </BevelCard>
        </div>
      )}

      {/* ─── Lottery Wheel ─── */}
      <BevelCard size="lg" pad={20} className="max-w-lg w-full">
        <LotteryWheel t={t} />
      </BevelCard>

      {/* ─── Reward info ─── */}
      <div className="mt-3 max-w-lg w-full flex gap-2">
        <div className="flex-1 flex items-center gap-2 p-2.5 bg-white/[0.04] border border-[var(--poly-emerald)]/20">
          <span className="text-base">💰</span>
          <p className="text-xs" style={{ color: 'var(--poly-emerald)' }}>{t.rewardUsdc}</p>
        </div>
        <div className="flex-1 flex items-center gap-2 p-2.5 bg-white/[0.04] border border-[var(--poly-purple)]/20">
          <span className="text-base">⭐</span>
          <p className="text-xs text-[var(--poly-purple)]">{t.rewardBonus}</p>
        </div>
      </div>

      {/* ─── Prize table ─── */}
      <div className="mt-3 max-w-lg w-full">
        <BevelCard size="lg" pad={20}>
          <EyebrowTag className="mb-3 block">Prize Odds</EyebrowTag>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: t.prizes.usdc_05,     chance: '15.45%', tone: 'var(--poly-emerald)' },
              { label: t.prizes.usdc_1,      chance: '7%',     tone: 'var(--poly-emerald)' },
              { label: t.prizes.usdc_5,      chance: '2.5%',   tone: 'var(--poly-emerald)' },
              { label: t.prizes.electronics, chance: '0.05%',  tone: 'var(--poly-grey-200)' },
              { label: t.prizes.bonus_1,     chance: '20%',    tone: 'var(--poly-purple)' },
              { label: t.prizes.bonus_2,     chance: '10%',    tone: 'var(--poly-purple)' },
              { label: t.prizes.bonus_3,     chance: '5%',     tone: 'var(--poly-purple)' },
              { label: t.prizes.thanks,      chance: '40%',    tone: 'var(--poly-grey-200)' },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-white/[0.04] border border-white/[0.05]">
                <span className="text-xs font-medium" style={{ color: p.tone }}>{p.label}</span>
                <span className="text-[10px] text-white/30 ml-1" style={{ fontFamily: 'var(--poly-font-mono)' }}>{p.chance}</span>
              </div>
            ))}
          </div>
        </BevelCard>
      </div>
    </div>
  )
}
