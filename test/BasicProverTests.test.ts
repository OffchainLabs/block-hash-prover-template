import hre from 'hardhat'
import {
  Address,
  createPublicClient,
  GetContractReturnType,
  Hash,
  http,
  PublicClient,
} from 'viem'
import { ChildToParentProverHelper, IProverHelper, ParentToChildProverHelper } from '../src/ts/'
import { expect } from 'chai'
import { IBlockHashProver$Type } from '../artifacts/broadcast-erc/contracts/standard/interfaces/IBlockHashProver.sol/IBlockHashProver'
import { reset } from '@nomicfoundation/hardhat-toolbox-viem/network-helpers'

type TestContext = {
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

describe('Basic Prover Tests', () => {
  describe('ChildToParentProver', () => {
    const testContext = {forkBlockNumber: 154627620n,
      expectedTargetBlockHash:
        '0x9aa793347b6915ff7869da6d155e9d3d7365ee5f3d34671f71bee6491730bec9',
      knownStorageSlotAccount:
        '0x38f918D0E9F1b721EDaA41302E399fa1B79333a9',
      knownStorageSlot: 10n,
      knownStorageSlotValue:
        '0x000000000000000000000000000000000000000000000000000000000927c06d',
    } as unknown as TestContext

    before(async () => {
      const { homeClient, targetClient } = await initialSetup(
        getEnv('CHILD_RPC_URL'),
        getEnv('PARENT_RPC_URL'),
        testContext.forkBlockNumber
      )

      testContext.proverContract = await hre.viem.deployContract('ChildToParentProver') as any

      testContext.proverHelper = new ChildToParentProverHelper(
        testContext.proverContract.address,
        homeClient,
        targetClient
      )
    })

    runBasicTests(testContext)
  })

  describe('ParentToChildProver', () => {
    // constructor arguments for the Arbitrum Sepolia prover
    const OUTBOX = '0x65f07C7D521164a4d5DaC6eB8Fac8DA067A3B78F'
    const ROOTS_SLOT = 3n

    const testContext = {
      forkBlockNumber: 8361791n,
      expectedTargetBlockHash:
        '0x4c33819fed9e958df96712715a408fc5bd5dd604c163ff393185c9cfdb405bde',
      knownStorageSlotAccount:
        '0x0000000048C4Ed10cF14A02B9E0AbDDA5227b071',
      knownStorageSlot: 50n,
      knownStorageSlotValue:
        '0x000000000000000000000000000000000000000000000000000000007f43ba00',
    } as unknown as TestContext

    before(async () => {
      const { homeClient, targetClient } = await initialSetup(
        getEnv('PARENT_RPC_URL'),
        getEnv('CHILD_RPC_URL'),
        testContext.forkBlockNumber
      )

      testContext.proverContract = await hre.viem.deployContract('ParentToChildProver', [
      OUTBOX,
      ROOTS_SLOT,
    ]) as any

      testContext.proverHelper = new ParentToChildProverHelper(
        testContext.proverContract.address,
        homeClient,
        targetClient
      )
    })

    runBasicTests(testContext)
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

function runBasicTests(
  ctx: TestContext
) {
  it('getTargetBlockHash should return the correct block hash', async () => {
    const { input, targetBlockHash } =
      await ctx.proverHelper.buildInputForGetTargetBlockHash()
    expect(targetBlockHash).to.equal(ctx.expectedTargetBlockHash)
    expect(await ctx.proverContract.read.getTargetBlockHash([input])).to.equal(
      ctx.expectedTargetBlockHash
    )
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
    const [account, slot, value] = await ctx.proverContract.read.verifyStorageSlot([
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
