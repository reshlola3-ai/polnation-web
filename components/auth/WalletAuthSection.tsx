'use client'

// Lazy-loaded wallet auth section.
//
// Why a separate wrapper: @web3modal/ui injects a render-blocking
// `@import url('https://fonts.googleapis.com/css2?family=Inter…')` into the
// document the moment createWeb3Modal() runs (see node_modules/@web3modal/ui/
// dist/esm/src/utils/ThemeUtil.js). On mobile that single line was costing
// ~3.4s of LCP. Plus the whole wagmi + viem + WalletConnect stack is ~300KB
// gzip of JS to parse before TTI.
//
// By isolating the Web3Provider + WalletAuthFlow into this client component
// and loading it via next/dynamic({ ssr: false }) from /auth/page.tsx, the
// initial HTML/JS for /auth contains none of that — users who sign in with
// email or Telegram never download the Web3 bundle at all, and users who
// want wallet see the same UI a fraction of a second later but with FCP
// already painted.

import { Web3Provider } from '@/components/providers/Web3Provider'
import { WalletAuthFlow } from '@/components/auth/WalletAuthFlow'

interface Props {
  redirect?: string
  referrerId?: string | null
  autoRegister?: boolean
}

export default function WalletAuthSection(props: Props) {
  return (
    <Web3Provider>
      <WalletAuthFlow {...props} />
    </Web3Provider>
  )
}
