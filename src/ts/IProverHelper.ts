import { Address, Hash, Hex } from 'viem'

export interface IProverHelper {
  // return the newest block hash that can be returned by getTargetBlockHash on the prover
  buildInputForGetTargetBlockHash(): Promise<{
    input: Hex
    targetBlockHash: Hash
  }>

  // return the input for verifyTargetBlockHash
  buildInputForVerifyTargetBlockHash(
    homeBlockHash: Hash
  ): Promise<{ input: Hex; targetBlockHash: Hash }>

  buildInputForVerifyStorageSlot(
    targetBlockHash: Hash,
    account: Address,
    slot: bigint
  ): Promise<{ input: Hex; slotValue: Hash }>
}
