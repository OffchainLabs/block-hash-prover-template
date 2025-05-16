import hre from 'hardhat'
import { Address, GetContractReturnType, Hash, PublicClient } from 'viem'
import { IBlockHashProver$Type } from '../artifacts/broadcast-erc/contracts/standard/interfaces/IBlockHashProver.sol/IBlockHashProver'
import { IProverHelper } from '../src/ts/prover-helper/IProverHelper'
import { expect } from 'chai'

export function basicProverTests(
  getContext: () => {
    forkBlockNumber: bigint
    proverAddress: Address
    proverHelper: IProverHelper
    expectedTargetBlockHash: Hash
    knownStorageSlotAccount: Address
    knownStorageSlot: bigint
    knownStorageSlotValue: Hash
  }
) {
  describe('BasicTests', function () {
    let proverContract: GetContractReturnType<
      IBlockHashProver$Type['abi'],
      PublicClient
    >
    let ctx: ReturnType<typeof getContext>

    beforeEach(async () => {
      ctx = getContext()
      proverContract = await hre.viem.getContractAt(
        'IBlockHashProver',
        ctx.proverAddress
      )
    })

    it('getTargetBlockHash should return the correct block hash', async () => {
      const { input, targetBlockHash } =
        await ctx.proverHelper.buildInputForGetTargetBlockHash()
      expect(targetBlockHash).to.equal(ctx.expectedTargetBlockHash)
      expect(await proverContract.read.getTargetBlockHash([input])).to.equal(
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
        await proverContract.read.verifyTargetBlockHash([homeBlockHash, input])
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
      const [account, slot, value] =
        await proverContract.read.verifyStorageSlot([
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
  })
}
