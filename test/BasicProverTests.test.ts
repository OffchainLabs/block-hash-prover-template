import hre from 'hardhat'
import {
  Address,
  createPublicClient,
  GetContractReturnType,
  Hash,
  http,
  PublicClient,
} from 'viem'
import {
  ChildToParentProverHelper,
  IProverHelper,
  ParentToChildProverHelper,
} from '../src/ts/'
import { expect } from 'chai'
import { IBlockHashProver$Type } from '../artifacts/broadcast-erc/contracts/standard/interfaces/IBlockHashProver.sol/IBlockHashProver'
import { reset } from '@nomicfoundation/hardhat-toolbox-viem/network-helpers'

type TestContext = {
  proverType: 'ChildToParentProver' | 'ParentToChildProver'
  proverContract: GetContractReturnType<
    IBlockHashProver$Type['abi'],
    PublicClient
  >
  forkBlockNumber: bigint
  proverHelper: IProverHelper
  expectedTargetBlockHash: Hash
  knownStorageSlotAccount: Address
  knownStorageSlot: bigint
  knownStorageSlotValue: Hash
}

const gasEstimates = {
  ParentToChildProver: {
    getTargetBlockHash: 0n,
    verifyTargetBlockHash: 0n,
    verifyStorageSlot: 0n,
  },
  ChildToParentProver: {
    getTargetBlockHash: 0n,
    verifyTargetBlockHash: 0n,
    verifyStorageSlot: 0n,
  },
}

let homeClient: PublicClient
let targetClient: PublicClient
describe('Basic Prover Tests', () => {
  describe('ChildToParentProver', () => {
    const testContext = {
      proverType: 'ChildToParentProver',
      forkBlockNumber: 136206737n,
      expectedTargetBlockHash:
        '0x32c888bd64a6afdefdc4cd21f8bfababffe5659f97c667412c0d1173b7468cfb',
      knownStorageSlotAccount: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
      knownStorageSlot: 0n,
      knownStorageSlotValue:
        '0x00010002d302d3010a0304760000000000004cd9b4161c447c909b096dff435f',
    } as unknown as TestContext

    before(async () => {
      const clients = await initialSetup(
        getEnv('CHILD_RPC_URL'),
        getEnv('PARENT_RPC_URL'),
        testContext.forkBlockNumber
      )
      homeClient = clients.homeClient
      targetClient = clients.targetClient

      testContext.proverContract = (await hre.viem.deployContract(
        'ChildToParentProver'
      )) as any

      testContext.proverHelper = new ChildToParentProverHelper(
        homeClient,
        targetClient
      )
    })

    runBasicTests(testContext)
  })

  describe('ParentToChildProver', () => {
    const testContext = {
      proverType: 'ParentToChildProver',
      forkBlockNumber: 22546304n,
      expectedTargetBlockHash:
        '0xec98a8261b7f7acc46b468859859ccf1c428d5b08d36c937878adc0b14055302',
      knownStorageSlotAccount: '0x1fb3cf6e48F1E7B10213E7b6d87D4c073C7Fdb7b',
      knownStorageSlot: 0n,
      knownStorageSlotValue:
        '0x00010007d007d002bc0304550000000000004cb938a915df69c703d09382b73e',
    } as unknown as TestContext

    before(async () => {
      const clients = await initialSetup(
        getEnv('PARENT_RPC_URL'),
        getEnv('CHILD_RPC_URL'),
        testContext.forkBlockNumber
      )
      homeClient = clients.homeClient
      targetClient = clients.targetClient

      testContext.proverContract = (await hre.viem.deployContract(
        'ParentToChildProver',
        ['0x1c68ECfbf9C8B1E6C0677965b3B9Ecf9A104305b']
      )) as any

      testContext.proverHelper = new ParentToChildProverHelper(
        homeClient,
        targetClient,
        testContext.proverContract.address
      )
    })

    runBasicTests(testContext)
  })

  after(() => {
    console.log('\nGas Estimates:', gasEstimates)
  })
})

async function initialSetup(
  homeUrl: string,
  targetUrl: string,
  forkBlockNumber: bigint
) {
  await reset(homeUrl, forkBlockNumber)
  const homeClient = await hre.viem.getPublicClient()
  patchHardhatClient(homeClient, homeUrl, forkBlockNumber)
  const targetClient = createPublicClient({
    transport: http(targetUrl),
  })
  return {
    homeClient,
    targetClient,
  }
}

function runBasicTests(ctx: TestContext) {
  it('getTargetBlockHash should return the correct block hash', async () => {
    const { input, targetBlockHash } =
      await ctx.proverHelper.buildInputForGetTargetBlockHash()
    expect(targetBlockHash).to.equal(ctx.expectedTargetBlockHash)
    expect(await ctx.proverContract.read.getTargetBlockHash([input])).to.equal(
      ctx.expectedTargetBlockHash
    )

    gasEstimates[ctx.proverType].getTargetBlockHash =
      await homeClient.estimateContractGas({
        address: ctx.proverContract.address,
        abi: ctx.proverContract.abi,
        functionName: 'getTargetBlockHash',
        args: [input],
      })
  })

  it('verifyTargetBlockHash should return the correct block hash', async () => {
    const homeBlockHash = (
      await (
        await hre.viem.getPublicClient()
      ).getBlock({ blockNumber: ctx.forkBlockNumber })
    ).hash
    const { input, targetBlockHash } =
      await ctx.proverHelper.buildInputForVerifyTargetBlockHash(homeBlockHash)
    expect(targetBlockHash).to.equal(ctx.expectedTargetBlockHash)
    expect(
      await ctx.proverContract.read.verifyTargetBlockHash([
        homeBlockHash,
        input,
      ])
    ).to.equal(ctx.expectedTargetBlockHash)

    gasEstimates[ctx.proverType].verifyTargetBlockHash =
      await homeClient.estimateContractGas({
        address: ctx.proverContract.address,
        abi: ctx.proverContract.abi,
        functionName: 'verifyTargetBlockHash',
        args: [homeBlockHash, input],
      })
  })

  it('verifyStorageSlot should return the correct slot value', async () => {
    const { input, slotValue } =
      await ctx.proverHelper.buildInputForVerifyStorageSlot(
        ctx.expectedTargetBlockHash,
        ctx.knownStorageSlotAccount,
        ctx.knownStorageSlot
      )
    expect(slotValue).to.equal(
      ctx.knownStorageSlotValue,
      "buildInputForVerifyStorageSlot didn't return the expected slot value"
    )
    const [account, slot, value] =
      await ctx.proverContract.read.verifyStorageSlot([
        ctx.expectedTargetBlockHash,
        input,
      ])
    expect(account).to.equal(
      ctx.knownStorageSlotAccount,
      "verifyStorageSlot didn't return the expected account"
    )
    expect(slot).to.equal(
      ctx.knownStorageSlot,
      "verifyStorageSlot didn't return the expected slot"
    )
    expect(value).to.equal(
      ctx.knownStorageSlotValue,
      "verifyStorageSlot didn't return the expected slot value"
    )

    gasEstimates[ctx.proverType].verifyStorageSlot =
      await homeClient.estimateContractGas({
        address: ctx.proverContract.address,
        abi: ctx.proverContract.abi,
        functionName: 'verifyStorageSlot',
        args: [ctx.expectedTargetBlockHash, input],
      })
  })
}

function getEnv(key: string) {
  const value = process.env[key]
  if (value === undefined) {
    throw new Error(`Environment variable ${key} is not set`)
  }
  return value
}

// since the hardhat network does not support the `eth_getProof` method,
// we need to patch the client bypass the hardhat network to query the forked RPC directly
function patchHardhatClient(
  hardhatClient: PublicClient,
  forkUrl: string,
  forkBlock: bigint
) {
  const forkClient = createPublicClient({
    transport: http(forkUrl),
  })
  hardhatClient.getProof = async args => {
    // we need to cap the specified block at <= the fork block
    // since the two rpc's will have diverged at the fork block
    const blockTag = args.blockTag || args.blockNumber || forkBlock
    let blockNumber =
      typeof blockTag === 'bigint'
        ? blockTag
        : (await hardhatClient.getBlock({ blockTag })).number
    if (blockNumber === null) {
      throw new Error(`Block number ${blockTag} not found`)
    }

    blockNumber = blockNumber > forkBlock ? forkBlock : blockNumber

    return forkClient.getProof({
      ...args,
      blockTag: undefined,
      blockNumber,
    })
  }
}
