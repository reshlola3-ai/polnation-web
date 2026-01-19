'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount, useDisconnect } from 'wagmi'
import { Button } from '@/components/ui/Button'
import { Wallet, AlertCircle, CheckCircle, Loader2, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface WalletLoginProps {
  redirect?: string
  autoRegister?: boolean // If true, automatically create account for new wallets
}

// Detect if user is in a DApp browser (WebView)
export function isDAppBrowser(): boolean {
  if (typeof window === 'undefined') return false
  
  const ua = navigator.userAgent.toLowerCase()
  
  // Common DApp browser indicators
  const dappIndicators = [
    'trustwallet',
    'trust/',
    'tokenpocket',
    'imtoken',
    'metamask',
    'safepal',
    'bitget',
    'coinbase',
    'rainbow',
    'phantom',
    'okex',
    'okx',
    'huobi',
    'math wallet',
    'alphawallet',
    'status',
    'brave',
    'opera',
    'dapp'
  ]
  
  // Check user agent
  if (dappIndicators.some(indicator => ua.includes(indicator))) {
    return true
  }
  
  // Check for injected ethereum object (common in DApp browsers)
  if (typeof window !== 'undefined' && (window as unknown as { ethereum?: unknown }).ethereum) {
    return true
  }
  
  // Check if in WebView
  const isWebView = ua.includes('wv') || 
                    (ua.includes('android') && ua.includes('version/')) ||
                    (ua.includes('iphone') && !ua.includes('safari'))
  
  return isWebView
}

export function WalletLogin({ redirect = '/dashboard', autoRegister = true }: WalletLoginProps) {
  const router = useRouter()
  const { open } = useWeb3Modal()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const supabase = createClient()

  const [status, setStatus] = useState<'idle' | 'connecting' | 'checking' | 'creating' | 'logging_in' | 'success' | 'error' | 'not_found'>('idle')
  const [error, setError] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)

  // When wallet connects, attempt login
  useEffect(() => {
    if (isConnected && address && !isProcessing) {
      handleWalletLogin(address)
    }
  }, [isConnected, address])

  const handleWalletLogin = async (walletAddress: string, shouldAutoRegister = autoRegister) => {
    if (isProcessing) return
    setIsProcessing(true)
    setStatus('checking')
    setError('')

    try {
      // Call API to find/create account by wallet
      const response = await fetch('/api/auth/wallet-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletAddress,
          autoRegister: shouldAutoRegister 
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.needsRegistration && !shouldAutoRegister) {
          setStatus('not_found')
          setError('No account found for this wallet.')
        } else {
          setStatus('error')
          setError(data.error || 'Login failed')
        }
        return
      }

      // Check if this is a new user
      if (data.isNewUser) {
        setIsNewUser(true)
        setStatus('creating')
      } else {
        setStatus('logging_in')
      }

      // Got magic link, now verify it
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

  const handleRegisterWithWallet = () => {
    if (address) {
      handleWalletLogin(address, true)
    }
  }

  const handleDisconnect = () => {
    disconnect()
    setStatus('idle')
    setError('')
    setIsProcessing(false)
    setIsNewUser(false)
  }

  // Render based on status
  if (status === 'success') {
    return (
      <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-green-400" />
        <div>
          <span className="text-green-300 text-sm font-medium">
            {isNewUser ? 'Account created!' : 'Login successful!'}
          </span>
          <p className="text-green-400/70 text-xs">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  if (status === 'not_found') {
    return (
      <div className="space-y-3">
        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <div className="flex items-start gap-2">
            <Wallet className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-purple-300 text-sm font-medium">New wallet detected</p>
              <p className="text-purple-400/70 text-xs mt-1">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
              <p className="text-zinc-400 text-xs mt-2">
                Create an account with this wallet?
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleRegisterWithWallet}
            className="flex-1 gap-1"
          >
            <UserPlus className="w-4 h-4" />
            Create Account
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  if (isConnected && (status === 'checking' || status === 'logging_in' || status === 'creating')) {
    return (
      <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
          <div>
            <p className="text-purple-300 text-sm font-medium">
              {status === 'checking' && 'Finding your account...'}
              {status === 'creating' && 'Creating your account...'}
              {status === 'logging_in' && 'Logging in...'}
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
        {status === 'connecting' ? 'Connecting...' : 'Continue with Wallet'}
      </Button>

      <p className="text-center text-xs text-zinc-500">
        For DApp browser users • Auto-creates account
      </p>
    </div>
  )
}
