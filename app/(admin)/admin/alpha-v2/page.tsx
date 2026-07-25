'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { polygon } from 'wagmi/chains'
import { maxUint256, type Address, type Hash } from 'viem'
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  FlaskConical,
  LogOut,
  RefreshCw,
  Shield,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Web3Provider } from '@/components/providers/Web3Provider'
import { USDC_ADDRESS } from '@/lib/web3-config'
import {
  ALPHA_LP_CONTROLLER_ABI,
  ALPHA_V2_MIN_DEPOSIT_USDC,
  ALPHA_V2_PLANS,
  ALPHA_V2_ROOT_USERNAME,
  ERC20_ABI,
  NFPM_POLYGON,
  NFPM_VIEW_ABI,
  POLNATION_ALPHA_V2_ABI,
  USDC_POLYGON,
  USDT_POLYGON,
  getAlphaLpControllerAddress,
  getAlphaV2LpTokenId,
  getPolnationAlphaV2Address,
  usdcFromUnits,
  usdcToUnits,
  type AlphaV2DepositRow,
} from '@/lib/polnation-alpha-v2'

const shortAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`
const usd = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
const explorer = (addr: string) => `https://polygonscan.com/address/${addr}`
const txUrl = (hash: string) => `https://polygonscan.com/tx/${hash}`

type ChainSnapshot = {
  v2Usdc: number
  v2Usdt: number
  nftOwner: string
  operatorOk: boolean
  liquidity: string
  tokensOwed0: string
  tokensOwed1: string
  ctrlOwner: string
  v2Owner: string
  paused: boolean
  registeredUsers: number
  activeUsers: number
}

function AlphaV2AdminInner() {
  const router = useRouter()
  const { open: openWalletModal } = useWeb3Modal()
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()
  const { mutateAsync: writeContract } = useWriteContract()
  const publicClient = usePublicClient({ chainId: polygon.id })

  const v2 = getPolnationAlphaV2Address()
  const ctrl = getAlphaLpControllerAddress()
  const lpTokenId = getAlphaV2LpTokenId()

  const [authOk, setAuthOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState<Hash | undefined>()
  const [walletUsdc, setWalletUsdc] = useState(0)
  const [allowance, setAllowance] = useState(0)
  const [registered, setRegistered] = useState(false)
  const [username, setUsername] = useState('')
  const [onChainUsername, setOnChainUsername] = useState('')
  const [referrer, setReferrer] = useState(ALPHA_V2_ROOT_USERNAME)
  const [amount, setAmount] = useState('100')
  const [planId, setPlanId] = useState(0)
  const [claimAmount, setClaimAmount] = useState('')
  const [deposits, setDeposits] = useState<AlphaV2DepositRow[]>([])
  const [rewards, setRewards] = useState({
    totalAvailable: 0,
    maturedAvailable: 0,
    dailyReserve: 0,
    networkAvailable: 0,
  })
  const [snapshot, setSnapshot] = useState<ChainSnapshot | null>(null)
  const [userStats, setUserStats] = useState({
    totalActiveDeposit: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
  })

  const isWrongNetwork = isConnected && chain?.id !== polygon.id
  const isCtrlOwner = Boolean(
    address && snapshot?.ctrlOwner && address.toLowerCase() === snapshot.ctrlOwner.toLowerCase()
  )

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: polygon.id,
  })

  // Gate behind admin session
  useEffect(() => {
    ;(async () => {
      const res = await fetch('/api/admin/alphastake')
      if (res.status === 401) {
        router.push('/admin/login')
        return
      }
      setAuthOk(true)
    })()
  }, [router])

  const injected = useMemo(
    () => connectors.find(c => c.id === 'injected' || c.type === 'injected'),
    [connectors]
  )

  const refresh = useCallback(async () => {
    if (!publicClient || !v2 || !ctrl || lpTokenId === null) return
    setError('')
    try {
      const [
        v2UsdcRaw,
        v2UsdtRaw,
        nftOwner,
        operatorOk,
        pos,
        ctrlOwner,
        v2Owner,
        paused,
        stats,
      ] = await Promise.all([
        publicClient.readContract({
          address: USDC_POLYGON,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [v2],
        }),
        publicClient.readContract({
          address: USDT_POLYGON,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [v2],
        }),
        publicClient.readContract({
          address: NFPM_POLYGON,
          abi: NFPM_VIEW_ABI,
          functionName: 'ownerOf',
          args: [lpTokenId],
        }),
        publicClient.readContract({
          address: NFPM_POLYGON,
          abi: NFPM_VIEW_ABI,
          functionName: 'isApprovedForAll',
          args: [v2, ctrl],
        }),
        publicClient.readContract({
          address: NFPM_POLYGON,
          abi: NFPM_VIEW_ABI,
          functionName: 'positions',
          args: [lpTokenId],
        }),
        publicClient.readContract({
          address: ctrl,
          abi: ALPHA_LP_CONTROLLER_ABI,
          functionName: 'owner',
        }),
        publicClient.readContract({
          address: v2,
          abi: POLNATION_ALPHA_V2_ABI,
          functionName: 'owner',
        }),
        publicClient.readContract({
          address: v2,
          abi: POLNATION_ALPHA_V2_ABI,
          functionName: 'paused',
        }),
        publicClient.readContract({
          address: v2,
          abi: POLNATION_ALPHA_V2_ABI,
          functionName: 'getContractStats',
        }),
      ])

      setSnapshot({
        v2Usdc: usdcFromUnits(v2UsdcRaw),
        v2Usdt: usdcFromUnits(v2UsdtRaw),
        nftOwner,
        operatorOk,
        liquidity: pos[7].toString(),
        tokensOwed0: pos[10].toString(),
        tokensOwed1: pos[11].toString(),
        ctrlOwner,
        v2Owner,
        paused,
        registeredUsers: Number(stats[0]),
        activeUsers: Number(stats[1]),
      })

      if (address) {
        const [bal, allw, user, depCount, avail] = await Promise.all([
          publicClient.readContract({
            address: USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address as Address],
          }),
          publicClient.readContract({
            address: USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [address as Address, v2],
          }),
          publicClient.readContract({
            address: v2,
            abi: POLNATION_ALPHA_V2_ABI,
            functionName: 'users',
            args: [address as Address],
          }),
          publicClient.readContract({
            address: v2,
            abi: POLNATION_ALPHA_V2_ABI,
            functionName: 'getDepositCount',
            args: [address as Address],
          }),
          publicClient.readContract({
            address: v2,
            abi: POLNATION_ALPHA_V2_ABI,
            functionName: 'getAvailableRewards',
            args: [address as Address],
          }),
        ])

        setWalletUsdc(usdcFromUnits(bal))
        setAllowance(usdcFromUnits(allw))
        setRegistered(Boolean(user[2]))
        setOnChainUsername(user[1] || '')
        setUserStats({
          totalActiveDeposit: usdcFromUnits(user[4]),
          totalDeposited: usdcFromUnits(user[8]),
          totalWithdrawn: usdcFromUnits(user[9]),
        })
        setRewards({
          totalAvailable: usdcFromUnits(avail[0]),
          maturedAvailable: usdcFromUnits(avail[1]),
          dailyReserve: usdcFromUnits(avail[2]),
          networkAvailable: usdcFromUnits(avail[3]),
        })

        const count = Number(depCount)
        const rows: AlphaV2DepositRow[] = []
        for (let i = 0; i < count; i++) {
          const d = await publicClient.readContract({
            address: v2,
            abi: POLNATION_ALPHA_V2_ABI,
            functionName: 'getDepositInfo',
            args: [address as Address, BigInt(i)],
          })
          rows.push({
            index: i,
            amountUsdc: usdcFromUnits(d[0]),
            startTime: Number(d[1]),
            endTime: Number(d[2]),
            planId: Number(d[3]),
            claimed: d[4],
            matured: d[5],
            expectedRoiUsdc: usdcFromUnits(d[6]),
            generatedRoiUsdc: usdcFromUnits(d[7]),
          })
        }
        setDeposits(rows)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh chain state')
    }
  }, [publicClient, v2, ctrl, lpTokenId, address])

  useEffect(() => {
    if (authOk) refresh()
  }, [authOk, refresh])

  useEffect(() => {
    if (isConfirmed) {
      setStatus('Transaction confirmed')
      setBusy(false)
      refresh()
    }
  }, [isConfirmed, refresh])

  const ensureWallet = async () => {
    if (!isConnected || !address) {
      if (injected) {
        await connect({ connector: injected, chainId: polygon.id })
      } else {
        openWalletModal()
      }
      throw new Error('Connect wallet first')
    }
    if (isWrongNetwork) {
      await switchChainAsync({ chainId: polygon.id })
    }
  }

  const runTx = async (label: string, fn: () => Promise<Hash>) => {
    setBusy(true)
    setError('')
    setStatus(`${label}…`)
    setTxHash(undefined)
    try {
      await ensureWallet()
      const hash = await fn()
      setTxHash(hash)
      setStatus(`${label} submitted`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('Connect wallet first')) {
        setError(msg)
        setStatus('')
      }
      setBusy(false)
    }
  }

  const handleRegister = () =>
    runTx('Register', async () => {
      if (!v2) throw new Error('V2 address missing')
      const name = username.trim()
      if (name.length < 3) throw new Error('Username min 3 chars')
      return writeContract({
        address: v2,
        abi: POLNATION_ALPHA_V2_ABI,
        functionName: 'register',
        args: [name, referrer.trim() || ALPHA_V2_ROOT_USERNAME],
        chainId: polygon.id,
      })
    })

  const handleApprove = () =>
    runTx('Approve USDC', async () => {
      if (!v2) throw new Error('V2 address missing')
      return writeContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [v2, maxUint256],
        chainId: polygon.id,
      })
    })

  const handleDeposit = () =>
    runTx('Deposit (stake)', async () => {
      if (!v2) throw new Error('V2 address missing')
      const n = parseFloat(amount)
      if (!Number.isFinite(n) || n < ALPHA_V2_MIN_DEPOSIT_USDC) {
        throw new Error(`Min deposit $${ALPHA_V2_MIN_DEPOSIT_USDC}`)
      }
      return writeContract({
        address: v2,
        abi: POLNATION_ALPHA_V2_ABI,
        functionName: 'deposit',
        args: [usdcToUnits(n), planId],
        chainId: polygon.id,
      })
    })

  const handleClaim = () =>
    runTx('Claim rewards', async () => {
      if (!v2) throw new Error('V2 address missing')
      const n = claimAmount.trim() === '' ? 0 : parseFloat(claimAmount)
      if (!Number.isFinite(n) || n < 0) throw new Error('Invalid claim amount')
      // 0 = claim all available (contract semantics)
      return writeContract({
        address: v2,
        abi: POLNATION_ALPHA_V2_ABI,
        functionName: 'claimRewards',
        args: [usdcToUnits(n)],
        chainId: polygon.id,
      })
    })

  const handleCompound = () =>
    runTx('Compound', async () => {
      if (!v2) throw new Error('V2 address missing')
      const n = claimAmount.trim() === '' ? 0 : parseFloat(claimAmount)
      if (!Number.isFinite(n) || n < 0) throw new Error('Invalid amount')
      return writeContract({
        address: v2,
        abi: POLNATION_ALPHA_V2_ABI,
        functionName: 'compoundRewards',
        args: [usdcToUnits(n), planId],
        chainId: polygon.id,
      })
    })

  const handleEmergencyExit = () => {
    if (!isCtrlOwner) {
      setError('Connected wallet is not AlphaLpController owner')
      return
    }
    if (!window.confirm('Emergency exit will drain ALL LP liquidity to your wallet. Continue?')) {
      return
    }
    return runTx('Emergency exit', async () => {
      if (!ctrl || !address) throw new Error('Controller / wallet missing')
      return writeContract({
        address: ctrl,
        abi: ALPHA_LP_CONTROLLER_ABI,
        functionName: 'emergencyExit',
        args: [address as Address],
        chainId: polygon.id,
      })
    })
  }

  const handleReclaimNft = () => {
    if (!isCtrlOwner) {
      setError('Connected wallet is not AlphaLpController owner')
      return
    }
    if (!window.confirm('Reclaim LP NFT from V2 into the controller?')) return
    return runTx('Reclaim LP NFT', async () => {
      if (!ctrl) throw new Error('Controller missing')
      return writeContract({
        address: ctrl,
        abi: ALPHA_LP_CONTROLLER_ABI,
        functionName: 'reclaimLpNft',
        chainId: polygon.id,
      })
    })
  }

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  if (!authOk) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        Checking admin session…
      </div>
    )
  }

  if (!v2 || !ctrl || lpTokenId === null) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-8">
        <p className="text-red-400">
          Missing env: NEXT_PUBLIC_POLNATION_ALPHA_V2_ADDRESS / CONTROLLER / LP_TOKEN_ID
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white">
      <header className="border-b border-zinc-700 bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Alpha V2 Lab</h1>
              <p className="text-xs text-zinc-400">
                Stake → Uniswap LP · claim · controller emergencyExit
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/admin/alphastake">
              <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300">
                AlphaStake V1
              </Button>
            </Link>
            <Link href="/admin/users">
              <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300">
                Users
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh()}
              className="border-zinc-700 text-zinc-300"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${busy || isConfirming ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-zinc-700 text-zinc-300"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Contracts + custody proof */}
        <section className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" /> Custody proof
          </h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-zinc-500 text-xs mb-1">PolnationAlphaV2</p>
              <a href={explorer(v2)} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline inline-flex items-center gap-1 break-all">
                {v2} <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
              <p className="mt-2 text-zinc-400">
                Idle USDC on V2: <span className="text-white font-mono">{usd(snapshot?.v2Usdc ?? 0)}</span>
                {' · '}USDT: <span className="text-white font-mono">{usd(snapshot?.v2Usdt ?? 0)}</span>
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Deposit 后净额进 Uniswap；V2 余额应接近 0（手续费直转 root）。
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-zinc-500 text-xs mb-1">AlphaLpController (operator)</p>
              <a href={explorer(ctrl)} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline inline-flex items-center gap-1 break-all">
                {ctrl} <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
              <p className="mt-2 text-zinc-400">
                LP #{lpTokenId.toString()} owner:{' '}
                <span className="text-white font-mono">{snapshot ? shortAddr(snapshot.nftOwner) : '…'}</span>
                {snapshot?.nftOwner.toLowerCase() === v2.toLowerCase() ? (
                  <span className="ml-2 text-emerald-400 text-xs">(= V2)</span>
                ) : (
                  <span className="ml-2 text-amber-400 text-xs">(not V2!)</span>
                )}
              </p>
              <p className="text-zinc-400">
                isApprovedForAll:{' '}
                <span className={snapshot?.operatorOk ? 'text-emerald-400' : 'text-red-400'}>
                  {snapshot ? String(snapshot.operatorOk) : '…'}
                </span>
              </p>
              <p className="text-zinc-400">
                LP liquidity: <span className="text-white font-mono">{snapshot?.liquidity ?? '…'}</span>
              </p>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Users {snapshot?.registeredUsers ?? '—'} · Active {snapshot?.activeUsers ?? '—'} · V2
            paused {snapshot ? String(snapshot.paused) : '—'} · Ctrl owner{' '}
            {snapshot ? shortAddr(snapshot.ctrlOwner) : '—'}
          </p>
        </section>

        {/* Wallet */}
        <section className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Wallet
          </h2>
          {isConnected && address ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-mono text-emerald-300">{address}</span>
              {isWrongNetwork && (
                <span className="text-amber-400 text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Switch to Polygon
                </span>
              )}
              {isCtrlOwner && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Controller owner
                </span>
              )}
              <span className="text-zinc-400">USDC {usd(walletUsdc)}</span>
              <span className="text-zinc-400">Allowance {usd(allowance)}</span>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-300"
                onClick={() => disconnectAsync()}
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                disabled={isConnecting}
                onClick={() =>
                  injected
                    ? connect({ connector: injected, chainId: polygon.id })
                    : openWalletModal()
                }
              >
                Connect injected (MetaMask etc.)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-300"
                onClick={() => openWalletModal()}
              >
                Open wallet modal
              </Button>
            </div>
          )}
        </section>

        {/* Register + Stake */}
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-5 space-y-4">
            <h2 className="text-sm font-semibold">1. Register</h2>
            {registered ? (
              <p className="text-sm text-emerald-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Registered as <span className="font-mono">{onChainUsername}</span>
              </p>
            ) : (
              <>
                <label className="block text-xs text-zinc-400">
                  Username
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                    placeholder="admin1"
                  />
                </label>
                <label className="block text-xs text-zinc-400">
                  Referrer username
                  <input
                    value={referrer}
                    onChange={e => setReferrer(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                  />
                </label>
                <Button size="sm" disabled={busy || isConfirming} onClick={handleRegister}>
                  Register on-chain
                </Button>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-5 space-y-4">
            <h2 className="text-sm font-semibold">2. Stake (deposit → Uniswap)</h2>
            <p className="text-xs text-zinc-500">
              Min ${ALPHA_V2_MIN_DEPOSIT_USDC}. 7% fee → root；93% net → LP via increaseLiquidity.
            </p>
            <label className="block text-xs text-zinc-400">
              Amount USDC
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Plan
              <select
                value={planId}
                onChange={e => setPlanId(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
              >
                {ALPHA_V2_PLANS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-300"
                disabled={busy || isConfirming}
                onClick={handleApprove}
              >
                Approve USDC
              </Button>
              <Button size="sm" disabled={busy || isConfirming || !registered} onClick={handleDeposit}>
                Deposit / Stake
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              Your active {usd(userStats.totalActiveDeposit)} · deposited{' '}
              {usd(userStats.totalDeposited)} · withdrawn {usd(userStats.totalWithdrawn)}
            </p>
          </section>
        </div>

        {/* Claim / Compound */}
        <section className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-5 space-y-4">
          <h2 className="text-sm font-semibold">3. Claim / Compound（到期奖励，非提前 unstake）</h2>
          <p className="text-xs text-zinc-500">
            V2 无提前退出。claimRewards 从 Uniswap LP decreaseLiquidity 打到你钱包。金额留空 = 全部
            （合约 amount=0）。最低 claim $5。
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
            <span>Available {usd(rewards.totalAvailable)}</span>
            <span>Matured {usd(rewards.maturedAvailable)}</span>
            <span>Network {usd(rewards.networkAvailable)}</span>
          </div>
          <label className="block text-xs text-zinc-400 max-w-xs">
            Amount (blank = all)
            <input
              value={claimAmount}
              onChange={e => setClaimAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
              placeholder="0 = all"
            />
          </label>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" disabled={busy || isConfirming} onClick={handleClaim}>
              Claim (unstake matured)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 text-zinc-300"
              disabled={busy || isConfirming}
              onClick={handleCompound}
            >
              Compound into selected plan
            </Button>
          </div>

          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs text-left">
              <thead className="text-zinc-500 border-b border-zinc-800">
                <tr>
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Principal</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3">Ends</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">ROI gen</th>
                </tr>
              </thead>
              <tbody>
                {deposits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-3 text-zinc-500">
                      No deposits yet
                    </td>
                  </tr>
                ) : (
                  deposits.map(d => (
                    <tr key={d.index} className="border-b border-zinc-800/60">
                      <td className="py-2 pr-3">{d.index}</td>
                      <td className="py-2 pr-3 font-mono">{usd(d.amountUsdc)}</td>
                      <td className="py-2 pr-3">
                        {ALPHA_V2_PLANS[d.planId]?.label ?? d.planId}
                      </td>
                      <td className="py-2 pr-3">
                        {new Date(d.endTime * 1000).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3">
                        {d.claimed ? 'claimed' : d.matured ? 'matured' : 'locked'}
                      </td>
                      <td className="py-2 pr-3 font-mono">{usd(d.generatedRoiUsdc)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Emergency */}
        <section className="rounded-2xl border border-red-900/50 bg-red-950/20 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> 4. Controller · Emergency
          </h2>
          <p className="text-xs text-zinc-400">
            仅 Controller owner 可调。emergencyExit 清空 LP 流动性并 collect 到你的钱包（测「能抽走池子」）。
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-500 text-white"
              disabled={busy || isConfirming || !isCtrlOwner}
              onClick={handleEmergencyExit}
            >
              Emergency Exit (drain LP)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-red-800 text-red-300"
              disabled={busy || isConfirming || !isCtrlOwner}
              onClick={handleReclaimNft}
            >
              Reclaim LP NFT → Controller
            </Button>
          </div>
          {!isCtrlOwner && isConnected && (
            <p className="text-xs text-amber-400">
              当前钱包不是 controller owner（{snapshot ? shortAddr(snapshot.ctrlOwner) : '…'}）。
              用部署钱包连接才能测 emergencyExit。
            </p>
          )}
        </section>

        {(status || error || txHash) && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-4 text-sm space-y-1">
            {status && <p className="text-emerald-300">{status}{isConfirming ? ' (confirming…)' : ''}</p>}
            {error && <p className="text-red-400 break-all">{error}</p>}
            {txHash && (
              <a href={txUrl(txHash)} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline break-all">
                {txHash}
              </a>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default function AdminAlphaV2Page() {
  return (
    <Web3Provider>
      <AlphaV2AdminInner />
    </Web3Provider>
  )
}
