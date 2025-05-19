import { defineConfig } from '@wagmi/cli'
import { hardhat } from '@wagmi/cli/plugins'

export default defineConfig({
  plugins: [
    hardhat({
      project: '.',
    }),
  ],
  contracts: [
    {
      name: 'IRollupCore',
      abi: require('@arbitrum/nitro-contracts/build/contracts/src/rollup/IRollupCore.sol/IRollupCore.json').abi
    }
  ],
  out: 'wagmi/abi.ts',
})
