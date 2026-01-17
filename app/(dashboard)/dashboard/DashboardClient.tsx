'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { User, Users, ArrowRight, Copy, Check } from 'lucide-react'
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConnectWallet />
        {!isLoadingBoundStatus && showPermitSigner && <PermitSigner />}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <Link href="/profile" className="group">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100 hover:border-emerald-200 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                  <User className="w-6 h-6 text-zinc-600 group-hover:text-emerald-600 transition-colors" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900">Your Profile</h3>
                  <p className="text-sm text-zinc-500">Manage your account settings</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-zinc-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </Link>

        {/* Referral Card */}
        <Link href="/referral" className="group">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100 hover:border-emerald-200 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                  <Users className="w-6 h-6 text-zinc-600 group-hover:text-emerald-600 transition-colors" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900">Referral Network</h3>
                  <p className="text-sm text-zinc-500">View your team and referrals</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-zinc-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </Link>
      </div>

      {/* Referral Link */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
        <h3 className="text-lg font-semibold mb-2">Share Your Referral Link</h3>
        <p className="text-emerald-100 text-sm mb-4">
          Invite friends and grow your network
        </p>
        <div className="bg-white/20 backdrop-blur rounded-xl p-3 flex items-center justify-between gap-2">
          <code className="text-sm truncate flex-1">
            {referralLink}
          </code>
          <button 
            onClick={copyLink}
            className="flex items-center gap-1 px-3 py-1 bg-white text-emerald-600 rounded-lg text-sm font-medium hover:bg-emerald-50 transition-colors shrink-0"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </>
  )
}
