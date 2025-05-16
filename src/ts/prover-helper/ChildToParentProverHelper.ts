import {
  Address,
  BlockTag,
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
import { childToParentProverAbi, iBufferAbi } from '../../../wagmi/abi'

export class ChildToParentProverHelper
  extends BaseProverHelper
  implements IProverHelper
{
  readonly bufferAddress: Address = '0x0000000048C4Ed10cF14A02B9E0AbDDA5227b071'
  readonly blockHashMappingSlot: bigint = 51n

  // return the newest block hash that can be returned by getTargetBlockHash on the prover
  async buildInputForGetTargetBlockHash(): Promise<{
    input: Hex
    targetBlockHash: Hash
  }> {
    const { targetBlockHash, targetBlockNumber } =
      await this._findLatestAvailableTargetChainBlock(
        await this.homeChainClient.getBlockNumber()
      )
    return {
      input: encodeAbiParameters([{ type: 'uint256' }], [targetBlockNumber]),
      targetBlockHash,
    }
  }

  async buildInputForVerifyTargetBlockHash(
    homeBlockHash: Hash
  ): Promise<{ input: Hex; targetBlockHash: Hash }> {
    const homeBlockNumber = (
      await this.homeChainClient.getBlock({ blockHash: homeBlockHash })
    ).number
    const { targetBlockHash, targetBlockNumber } =
      await this._findLatestAvailableTargetChainBlock(homeBlockNumber)

    const slot = hexToBigInt(
      keccak256(
        encodeAbiParameters(
          [{ type: 'uint256' }, { type: 'uint256' }],
          [targetBlockNumber, this.blockHashMappingSlot]
        )
      )
    )

    const rlpBlockHeader = await this._getRlpBlockHeader('home', homeBlockHash)
    const { rlpAccountProof, rlpStorageProof, slotValue } =
      await this._getRlpStorageAndAccountProof(
        'home',
        homeBlockHash,
        this.bufferAddress,
        slot
      )

    console.log('slotValue', slotValue)
    console.log('targetBlockHash', targetBlockHash)

    /// @param  input ABI encoded (bytes blockHeader, uint256 targetBlockNumber, bytes accountProof, bytes storageProof)

    const input = encodeAbiParameters(
      [
        { type: 'bytes' }, // block header
        { type: 'uint256' }, // target block number
        { type: 'bytes' }, // account proof
        { type: 'bytes' }, // storage proof
      ],
      [rlpBlockHeader, targetBlockNumber, rlpAccountProof, rlpStorageProof]
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
    targetBlockNumber: bigint
    targetBlockHash: Hash
  }> {
    const bufferContract = this._bufferContract()
    const targetBlockNumber = await bufferContract.read.newestBlockNumber({
      blockNumber: homeBlockNumber,
    })
    const targetBlockHash = await bufferContract.read.parentChainBlockHash(
      [targetBlockNumber],
      { blockNumber: homeBlockNumber }
    )

    return {
      targetBlockNumber,
      targetBlockHash,
    }
  }

  _proverContract(): GetContractReturnType<
    typeof childToParentProverAbi,
    PublicClient
  > {
    return getContract({
      address: this.proverAddress,
      abi: childToParentProverAbi,
      client: this.homeChainClient,
    })
  }

  _bufferContract(): GetContractReturnType<typeof iBufferAbi, PublicClient> {
    return getContract({
      address: this.bufferAddress,
      abi: iBufferAbi,
      client: this.homeChainClient,
    })
  }
}
