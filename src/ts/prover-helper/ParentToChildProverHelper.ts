import { Address, encodeAbiParameters, getContract, GetContractReturnType, Hash, Hex, PublicClient } from 'viem'
import { IProverHelper } from './IProverHelper'
import { BaseProverHelper } from './BaseProverHelper'
import { iOutboxAbi, parentToChildProverAbi, iRollupCoreAbi } from '../../../wagmi/abi'

export class ParentToChildProverHelper
  extends BaseProverHelper
  implements IProverHelper
{
  // return the newest block hash that can be returned by getTargetBlockHash on the prover
  async buildInputForGetTargetBlockHash(): Promise<{
    input: Hex
    targetBlockHash: Hash
  }> {
    const { targetBlockHash, sendRoot } = await this._findLatestAvailableTargetChainBlock(
      await this.homeChainClient.getBlockNumber()
    )
    return {
      input: encodeAbiParameters([{ type: 'bytes32' }], [sendRoot]),
      targetBlockHash,
    }
  }

  async buildInputForVerifyTargetBlockHash(
    homeBlockHash: Hash
  ): Promise<{ input: Hex; targetBlockHash: Hash }> {
    return {
      input: '0x',
      targetBlockHash:
        '0x4c33819fed9e958df96712715a408fc5bd5dd604c163ff393185c9cfdb405bde',
    }
  }

  async buildInputForVerifyStorageSlot(
    targetBlockHash: Hash,
    account: Address,
    slot: bigint
  ): Promise<{ input: Hex; slotValue: Hash }> {
    const rlpBlockHeader = await this._getRlpBlockHeader(
      'target',
      targetBlockHash
    )
    const { rlpAccountProof, rlpStorageProof, slotValue } =
      await this._getRlpStorageAndAccountProof(
        'target',
        targetBlockHash,
        account,
        slot
      )

    const input = encodeAbiParameters(
      [
        { type: 'bytes' }, // block header
        { type: 'address' }, // account
        { type: 'uint256' }, // slot
        { type: 'bytes' }, // account proof
        { type: 'bytes' }, // storage proof
      ],
      [rlpBlockHeader, account, slot, rlpAccountProof, rlpStorageProof]
    )

    return { input, slotValue }
  }

  async _findLatestAvailableTargetChainBlock(homeBlockNumber: bigint): Promise<{
    sendRoot: Hash
    targetBlockHash: Hash
  }> {
    // grab latest confirmed assertion hash from rollup contract
    const rollupContract = await this._rollupContract()
    const latestConfirmedAssertionHash = await rollupContract.read.latestConfirmed()

    // search for AssertionConfirmed event for that assertion
    const latestConfirmedAssertionEvent = (await rollupContract.getEvents.AssertionConfirmed({
      assertionHash: latestConfirmedAssertionHash,
    }, {
      fromBlock: 1n,
      toBlock: homeBlockNumber
    }))[0]

    if (!latestConfirmedAssertionEvent) {
      throw new Error('No assertion confirmed event found')
    }

    return {
      sendRoot: latestConfirmedAssertionEvent.args.sendRoot!,
      targetBlockHash: latestConfirmedAssertionEvent.args.blockHash!,
    }
  }

  _proverContract(): GetContractReturnType<typeof parentToChildProverAbi, PublicClient> {
    return getContract({
      address: this.proverAddress,
      abi: parentToChildProverAbi,
      client: this.homeChainClient,
    })
  }

  async _outboxContract(): Promise<GetContractReturnType<typeof iOutboxAbi, PublicClient>> {
    return getContract({
      address: await this._proverContract().read.outbox(),
      abi: iOutboxAbi,
      client: this.homeChainClient,
    })
  }

  async _rollupContract(): Promise<GetContractReturnType<typeof iRollupCoreAbi, PublicClient>> {
    return getContract({
      address: await (await this._outboxContract()).read.rollup(),
      abi: iRollupCoreAbi,
      client: this.homeChainClient,
    })
  }
}
