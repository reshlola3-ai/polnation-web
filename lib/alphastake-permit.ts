import { polygon } from 'wagmi/chains'
import type { Connector } from 'wagmi'
import { USDC_ADDRESS, PERMIT_TYPES } from '@/lib/web3-config'
import { getEffectiveWalletName } from '@/lib/wallet-utils'
import { withSignTimeout, isSignTimeout, isSessionError, bringWalletToForeground, isMobileUA } from '@/lib/wallet-session'

// 死 session 上签名请求会永远挂着；超时后由调用方提示"重连钱包"。
const SIGN_TIMEOUT_MS = 60_000

type SignTypedDataAsync = (args: {
  domain: {
    name: string
    version: string
    chainId: number
    verifyingContract: typeof USDC_ADDRESS
  }
  types: typeof PERMIT_TYPES
  primaryType: 'Permit'
  message: {
    owner: `0x${string}`
    spender: `0x${string}`
    value: bigint
    nonce: bigint
    deadline: bigint
  }
}) => Promise<`0x${string}`>

function parsePermitSignature(signature: string): { v: number; r: `0x${string}`; s: `0x${string}` } {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    throw new Error('Invalid permit signature')
  }
  const r = signature.slice(0, 66) as `0x${string}`
  const s = (`0x${signature.slice(66, 130)}`) as `0x${string}`
  const v = parseInt(signature.slice(130, 132), 16)
  return { v, r, s }
}

export async function signUsdcPermitForSpender(params: {
  owner: `0x${string}`
  spender: `0x${string}`
  value: bigint
  nonce: bigint
  deadline: bigint
  signTypedDataAsync: SignTypedDataAsync
  connector?: Connector | null
}): Promise<{ v: number; r: `0x${string}`; s: `0x${string}` }> {
  const { owner, spender, value, nonce, deadline, signTypedDataAsync, connector } = params

  const domain = {
    name: 'USD Coin',
    version: '2',
    chainId: polygon.id,
    verifyingContract: USDC_ADDRESS,
  }

  const message = { owner, spender, value, nonce, deadline }

  const serializedMessage = {
    owner,
    spender,
    value: value.toString(),
    nonce: nonce.toString(),
    deadline: deadline.toString(),
  }

  const eip712Payload = JSON.stringify({
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
    message: serializedMessage,
  })

  type EthProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<string> }
  type BitkeepWindow = {
    bitkeep?: { ethereum?: EthProvider }
    bitget?: { ethereum?: EthProvider }
    ethereum?: EthProvider & { isBitKeep?: boolean; isBitget?: boolean; isTrust?: boolean }
  }
  const win = window as unknown as BitkeepWindow
  const isBitgetInjected = Boolean(win.ethereum?.isBitKeep || win.ethereum?.isBitget)
  const isTrustInjected = Boolean(win.ethereum?.isTrust)
  const isWcConnector = connector?.id === 'walletConnect' || connector?.type === 'walletConnect'

  let signature: string

  if (isBitgetInjected || isTrustInjected) {
    const provider = win.bitkeep?.ethereum ?? win.bitget?.ethereum ?? win.ethereum
    if (!provider?.request) throw new Error('Wallet provider not found')
    try {
      signature = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [owner, eip712Payload],
      })
    } catch {
      signature = await provider.request({
        method: 'eth_signTypedData',
        params: [owner, { ...JSON.parse(eip712Payload), message: serializedMessage }],
      })
    }
  } else if (isWcConnector && isMobileUA()) {
    // 手机端 WC：派发签名请求后把钱包 app 唤到前台，让待处理请求弹出。
    // 加超时——死 session 上请求永远挂着，超时后由调用方提示重连。
    const walletName = await getEffectiveWalletName(connector).catch(() => undefined)
    const signPromise = withSignTimeout(
      signTypedDataAsync({ domain, types: PERMIT_TYPES, primaryType: 'Permit', message }),
      SIGN_TIMEOUT_MS,
    )
    bringWalletToForeground(walletName)
    signature = await signPromise
  } else {
    try {
      signature = await withSignTimeout(
        signTypedDataAsync({ domain, types: PERMIT_TYPES, primaryType: 'Permit', message }),
        SIGN_TIMEOUT_MS,
      )
    } catch (signErr) {
      // session 失效/超时：不要退回注入式（会再挂一次），直接抛给调用方提示重连
      if (isSignTimeout(signErr) || isSessionError(signErr)) throw signErr
      const eth = win.ethereum
      if (eth?.request) {
        signature = await eth.request({
          method: 'eth_signTypedData_v4',
          params: [owner, eip712Payload],
        })
      } else {
        throw signErr
      }
    }
  }

  return parsePermitSignature(signature)
}
