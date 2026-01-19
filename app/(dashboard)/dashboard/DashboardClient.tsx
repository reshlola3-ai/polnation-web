'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { User, Users, ArrowRight, Copy, Check, Sparkles } from 'lucide-react'
import { ConnectWallet } from '@/components/wallet/ConnectWallet'
import { PermitSigner } from '@/components/wallet/PermitSigner'
import { useAccount } from 'wagmi'
import { createClient } from '@/lib/supabase'

interface DashboardClientProps {
  userId: string
}

export function DashboardClient({ userId }: DashboardClientProps) {
  const { isConnected } = useAccount()
  const [copied, setCopied] = useState(false)
  const [hasBoundWallet, setHasBoundWallet] = useState(false)
  const [isLoadingBoundStatus, setIsLoadingBoundStatus] = useState(true)

  // 检查是否已绑定钱包
  useEffect(() => {
    async function checkBoundWallet() {
      try {
        const supabase = createClient()
        if (!supabase) {
          setIsLoadingBoundStatus(false)
          return
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsLoadingBoundStatus(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('id', user.id)
          .single()

        setHasBoundWallet(!!profile?.wallet_address)
      } catch (err) {
        console.error('Error checking bound wallet:', err)
      } finally {
        setIsLoadingBoundStatus(false)
      }
    }

    checkBoundWallet()
  }, [])

  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/register?ref=${userId}`
    : `https://polnation.com/register?ref=${userId}`

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 是否显示 PermitSigner（已连接或已绑定钱包）
  const showPermitSigner = isConnected || hasBoundWallet

  return (
    <>
      {/* Wallet & Staking Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <ConnectWallet />
        {!isLoadingBoundStatus && showPermitSigner && <PermitSigner />}
      </div>

      {/* Quick Actions - Hidden on mobile (use bottom nav instead) */}
      <div className="hidden md:grid grid-cols-2 gap-4">
        {/* Profile Card */}
        <Link href="/profile" className="group">
          <div className="glass-card-solid p-5 hover:border-purple-500/50 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                  <User className="w-6 h-6 text-zinc-400 group-hover:text-purple-400 transition-colors" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Your Profile</h3>
                  <p className="text-sm text-zinc-500">Manage your account settings</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </Link>

        {/* Referral Card */}
        <Link href="/referral" className="group">
          <div className="glass-card-solid p-5 hover:border-purple-500/50 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                  <Users className="w-6 h-6 text-zinc-400 group-hover:text-purple-400 transition-colors" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Referral Network</h3>
                  <p className="text-sm text-zinc-500">View your team and referrals</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </Link>
      </div>

      {/* Referral Link - Mobile optimized */}
      <div className="relative overflow-hidden rounded-xl md:rounded-2xl p-4 md:p-6 bg-gradient-to-r from-purple-600 to-purple-800">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-20 md:w-24 h-20 md:h-24 bg-cyan-400/10 rounded-full blur-2xl" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-purple-200" />
            <h3 className="text-base md:text-lg font-semibold text-white">Share Your Referral Link</h3>
          </div>
          <p className="text-purple-200 text-xs md:text-sm mb-3 md:mb-4">
            Invite friends and grow your network
          </p>
          <div className="bg-white/10 backdrop-blur rounded-xl p-2 md:p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border border-white/10">
            <code className="text-xs md:text-sm text-white/90 truncate flex-1 px-2 py-1.5 sm:py-0">
              {referralLink}
            </code>
            <button 
              onClick={copyLink}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-50 transition-colors shrink-0 active:scale-95"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
