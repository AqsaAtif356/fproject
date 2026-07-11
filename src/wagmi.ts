import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { avalancheFuji, mainnet, sepolia } from 'wagmi/chains'

export const FUJI_CHAIN_ID = avalancheFuji.id

export const config = getDefaultConfig({
  appName: 'Donation Vault',
  projectId: '3a8170ab7e569169f1d8411a26a9b666',
  chains: [avalancheFuji, mainnet, sepolia],
  ssr: false,
})
