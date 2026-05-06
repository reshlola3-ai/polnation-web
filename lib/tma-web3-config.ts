import { createConfig, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { polygon } from 'wagmi/chains'

const projectId = 'ea97927d76764f8d29ee2f8787bc5d7c'

const metadata = {
  name: 'Polnation',
  description: 'Community Dividend Platform on Polygon',
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
    [polygon.id]: http(),
  },
})
