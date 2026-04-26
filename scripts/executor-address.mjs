import { privateKeyToAccount } from 'viem/accounts'
import { createPublicClient, http, formatUnits } from 'viem'
import { polygon } from 'viem/chains'

const key = process.env.EXECUTOR_PRIVATE_KEY
if (!key) {
  console.error('Set EXECUTOR_PRIVATE_KEY in env first')
  process.exit(1)
}

const pk = key.startsWith('0x') ? key : `0x${key}`
const account = privateKeyToAccount(pk)
console.log('Executor address:', account.address)

const client = createPublicClient({ chain: polygon, transport: http('https://polygon-rpc.com') })

const USDT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
const erc20 = [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }]

const [pol, usdt] = await Promise.all([
  client.getBalance({ address: account.address }),
  client.readContract({ address: USDT, abi: erc20, functionName: 'balanceOf', args: [account.address] }),
])

console.log('POL (gas):', formatUnits(pol, 18))
console.log('USDT:    ', formatUnits(usdt, 6))
