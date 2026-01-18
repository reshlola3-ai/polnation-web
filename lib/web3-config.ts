import { defaultWagmiConfig } from '@web3modal/wagmi'
import { polygon } from 'wagmi/chains'

// WalletConnect Project ID
export const projectId = 'ea97927d76764f8d29ee2f8787bc5d7c'

// 平台钱包地址 (Permit Spender) - EOA
// 合约地址（备份）: 0x1f6Ab0b72CB8969fa137E47c98F689329f0B919a
export const PLATFORM_WALLET = '0x6c4C745d909B13528e638C7Aa63ABA9406fA8c63' as `0x${string}`

// 元数据
const metadata = {
  name: 'Polnation',
  description: 'Soft Staking Demonstration Platform',
  url: 'https://www.polnation.com',
  icons: ['https://www.polnation.com/favicon.ico']
}

// 只支持 Polygon 网络
export const chains = [polygon] as const

// Wagmi 配置
export const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  enableWalletConnect: true,
  enableInjected: true,
  enableEIP6963: true,
  enableCoinbase: false,
})

// USDC 合约地址 (Polygon)
export const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as const

// USDC ABI (只需要用到的函数)
export const USDC_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'nonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'DOMAIN_SEPARATOR',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  // Permit function (EIP-2612)
  {
    name: 'permit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

// EIP-2612 Permit 类型 (用于签名)
export const PERMIT_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const
