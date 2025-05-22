import {
  Address,
  encodeAbiParameters,
  getContract,
  GetContractReturnType,
  Hash,
  Hex,
  hexToBigInt,
  keccak256,
  PublicClient,
} from 'viem'
import { IProverHelper } from './IProverHelper'
import { BaseProverHelper } from './BaseProverHelper'
import {
  iOutboxAbi,
  parentToChildProverAbi,
  iRollupCoreAbi,
} from '../../wagmi/abi'

export class ParentToChildProverHelper
  extends BaseProverHelper
  implements IProverHelper
{
  async buildInputForGetTargetBlockHash(): Promise<{
    input: Hex
    targetBlockHash: Hash
  }> {
    const { targetBlockHash, sendRoot } =
      await this._findLatestAvailableTargetChainBlock(
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
    const { targetBlockHash, sendRoot } =
      await this._findLatestAvailableTargetChainBlock(
        (await this.homeChainClient.getBlock({ blockHash: homeBlockHash }))
          .number
      )

    const slot = hexToBigInt(
      keccak256(
        encodeAbiParameters(
          [{ type: 'bytes32' }, { type: 'uint256' }],
          [sendRoot, await this._proverContract().read.rootsSlot()]
        )
      )
    )

    const rlpBlockHeader = await this._getRlpBlockHeader('home', homeBlockHash)
    const { rlpAccountProof, rlpStorageProof } =
      await this._getRlpStorageAndAccountProof(
        'home',
        homeBlockHash,
        await this._proverContract().read.outbox(),
        slot
      )

    const input = encodeAbiParameters(
      [
        { type: 'bytes' }, // block header
        { type: 'bytes32' }, // send root
        { type: 'bytes' }, // account proof
        { type: 'bytes' }, // storage proof
      ],
      [rlpBlockHeader, sendRoot, rlpAccountProof, rlpStorageProof]
    )

    return {
      input,
      targetBlockHash,
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
    const latestConfirmedAssertionHash =
      await rollupContract.read.latestConfirmed()

    // search for AssertionConfirmed event for that assertion
    const latestConfirmedAssertionEvent = (
      await rollupContract.getEvents.AssertionConfirmed(
        {
          assertionHash: latestConfirmedAssertionHash,
        },
        {
          fromBlock: 1n, // todo: write a utility function to split into chunks. not all RPC's can handle big block ranges
          toBlock: homeBlockNumber,
        }
      )
    )[0]

    if (!latestConfirmedAssertionEvent) {
      throw new Error('No assertion confirmed event found')
    }

    return {
      sendRoot: latestConfirmedAssertionEvent.args.sendRoot!,
      targetBlockHash: latestConfirmedAssertionEvent.args.blockHash!,
    }
  }

  _proverContract(): GetContractReturnType<
    typeof parentToChildProverAbi,
    PublicClient
  > {
    return getContract({
      address: this.proverAddress,
      abi: parentToChildProverAbi,
      client: this.homeChainClient,
    })
  }

  async _outboxContract(): Promise<
    GetContractReturnType<typeof iOutboxAbi, PublicClient>
  > {
    return getContract({
      address: await this._proverContract().read.outbox(),
      abi: iOutboxAbi,
      client: this.homeChainClient,
    })
  }

  async _rollupContract(): Promise<
    GetContractReturnType<typeof iRollupCoreAbi, PublicClient>
  > {
    return getContract({
      address: await (await this._outboxContract()).read.rollup(),
      abi: iRollupCoreAbi,
      client: this.homeChainClient,
    })
  }
}
