import { Address, encodeAbiParameters, getContract, Hash, Hex } from 'viem'
import { IProverHelper } from './IProverHelper'
import { BaseProverHelper } from './BaseProverHelper'
import { il1BlockAbi } from '../../wagmi/abi'

/**
 * ChildToParentProverHelper is a class that provides helper methods for interacting
 * with the child to parent IBlockHashProver contract.
 *
 * It extends the BaseProverHelper class and implements the IProverHelper interface.
 *
 * buildInputForGetTargetBlockHash and buildInputForVerifyTargetBlockHash methods
 * are currently not implemented and return a hardcoded block hash.
 *
 * buildInputForVerifyStorageSlot is fully implemented and requires no changes
 * unless the prover's verifyStorageSlot function is modified.
 */
export class ChildToParentProverHelper
  extends BaseProverHelper
  implements IProverHelper
{
  public readonly l1BlockPredeploy: Address =
    '0x4200000000000000000000000000000000000015'
  public readonly l1BlockHashSlot: bigint = 2n

  /**
   * @see IProverHelper.buildInputForGetTargetBlockHash
   */
  async buildInputForGetTargetBlockHash(): Promise<{
    input: Hex
    targetBlockHash: Hash
  }> {
    return {
      input: '0x',
      targetBlockHash: await this._l1BlockContract().read.hash(),
    }
  }

  /**
   * @see IProverHelper.buildInputForGetTargetBlockHash
   */
  async buildInputForVerifyTargetBlockHash(
    homeBlockHash: Hash
  ): Promise<{ input: Hex; targetBlockHash: Hash }> {
    const rlpBlockHeader = await this._getRlpBlockHeader('home', homeBlockHash)
    const { rlpAccountProof, rlpStorageProof, slotValue } =
      await this._getRlpStorageAndAccountProof(
        'home',
        homeBlockHash,
        this.l1BlockPredeploy,
        this.l1BlockHashSlot
      )

    const input = encodeAbiParameters(
      [
        { type: 'bytes' }, // block header
        { type: 'bytes' }, // account proof
        { type: 'bytes' }, // storage proof
      ],
      [rlpBlockHeader, rlpAccountProof, rlpStorageProof]
    )

    return {
      input,
      targetBlockHash: slotValue,
    }
  }

  /**
   * @see IProverHelper.buildInputForVerifyStorageSlot
   */
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

  _l1BlockContract() {
    return getContract({
      address: this.l1BlockPredeploy,
      abi: il1BlockAbi,
      client: this.homeChainClient,
    })
  }
}
