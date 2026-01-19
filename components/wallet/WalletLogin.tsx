'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount, useDisconnect } from 'wagmi'
import { Button } from '@/components/ui/Button'
import { Wallet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface WalletLoginProps {
  redirect?: string
}

export function WalletLogin({ redirect = '/dashboard' }: WalletLoginProps) {
  const router = useRouter()
  const { open } = useWeb3Modal()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const supabase = createClient()

  const [status, setStatus] = useState<'idle' | 'connecting' | 'checking' | 'logging_in' | 'success' | 'error' | 'not_found'>('idle')
  const [error, setError] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)

  // When wallet connects, attempt login
  useEffect(() => {
    if (isConnected && address && !isProcessing) {
      handleWalletLogin(address)
    }
  }, [isConnected, address])

  const handleWalletLogin = async (walletAddress: string) => {
    if (isProcessing) return
    setIsProcessing(true)
    setStatus('checking')
    setError('')

    try {
      // Call API to find account by wallet
      const response = await fetch('/api/auth/wallet-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.needsRegistration) {
          setStatus('not_found')
          setError('No account found for this wallet. Please register first or login with email.')
        } else {
          setStatus('error')
          setError(data.error || 'Login failed')
        }
        return
      }

      // Got magic link, now verify it
      setStatus('logging_in')

      if (data.magicLink) {
        // Extract token from magic link and verify
        const url = new URL(data.magicLink)
        const token = url.searchParams.get('token')
        const type = url.searchParams.get('type') || 'magiclink'

        if (token) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as 'magiclink'
          })

          if (verifyError) {
            console.error('OTP verify error:', verifyError)
            // Try alternative: direct redirect
            window.location.href = data.magicLink
            return
          }

          setStatus('success')
          setTimeout(() => {
            router.push(redirect)
            router.refresh()
          }, 500)
        } else {
          // Fallback: redirect to magic link
          window.location.href = data.magicLink
        }
      }

    } catch (err) {
      console.error('Wallet login error:', err)
      setStatus('error')
      setError('Network error. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConnect = async () => {
    setStatus('connecting')
    setError('')
    try {
      await open()
    } catch (err) {
      console.error('Connect error:', err)
      setStatus('error')
      setError('Failed to open wallet')
    }
  }

  const handleDisconnect = () => {
    disconnect()
    setStatus('idle')
    setError('')
    setIsProcessing(false)
  }

  // Render based on status
  if (status === 'success') {
    return (
      <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-green-400" />
        <span className="text-green-300 text-sm">Login successful! Redirecting...</span>
      </div>
    )
  }

  if (status === 'not_found') {
    return (
      <div className="space-y-3">
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 text-sm font-medium">Wallet not registered</p>
              <p className="text-amber-400/70 text-xs mt-1">
                Address: {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
              <p className="text-amber-400/70 text-xs mt-1">
                Please register an account first, or login with email if you have one.
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          className="w-full"
        >
          Try another wallet
        </Button>
      </div>
    )
  }

  if (isConnected && (status === 'checking' || status === 'logging_in')) {
    return (
      <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
          <div>
            <p className="text-purple-300 text-sm font-medium">
              {status === 'checking' ? 'Finding your account...' : 'Logging in...'}
            </p>
            <p className="text-purple-400/70 text-xs mt-1">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 py-3 border-purple-500/30 hover:bg-purple-500/10 hover:border-purple-500/50"
        onClick={handleConnect}
        disabled={status === 'connecting'}
      >
        {status === 'connecting' ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Wallet className="w-5 h-5" />
        )}
        {status === 'connecting' ? 'Connecting...' : 'Login with Wallet'}
      </Button>

      <p className="text-center text-xs text-zinc-500">
        For DApp browser users (Trust, SafePal, etc.)
      </p>
    </div>
  )
}
