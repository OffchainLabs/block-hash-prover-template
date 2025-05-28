import dotenv from 'dotenv'
dotenv.config()
import type { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox-viem'

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      evmVersion: 'cancun',
    },
  },
  paths: {
    sources: './src/contracts',
  },
}

export default config
