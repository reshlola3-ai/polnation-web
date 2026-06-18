import { createConfig, http } from 'wagmi'
import { fallback } from 'viem'
import { injected, walletConnect } from 'wagmi/connectors'
import { polygon } from 'wagmi/chains'

// Alchemy 优先（默认 polygon-rpc.com 在部分地区被污染/限速），挂掉退回链默认节点。
const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_POLYGON_URL

const projectId = 'ea97927d76764f8d29ee2f8787bc5d7c'

const metadata = {
  name: 'Polnation',
  description: 'Agentic AI Earning on Polygon',
  url: 'https://www.polnation.com',
  icons: ['https://www.polnation.com/favicon.ico'],
}

export const tmaWagmiConfig = createConfig({
  chains: [polygon],
  connectors: typeof window === 'undefined'
    ? []
    : [
        injected({ shimDisconnect: true }),
        walletConnect({
          projectId,
          metadata,
          showQrModal: false,
        }),
      ],
  transports: {
    [polygon.id]: alchemyUrl
      ? fallback([http(alchemyUrl), http()])
      : http(),
  },
})
