// given a pointer:
// 1. verify the pointer's deployment bytecode
// 2. get all previously pointed to provers, ensure versions are ascending
// 3. verify the current prover's deployment bytecode
// 4. return the pointer's owner and the current prover's constructor arguments

import { AbiConstructor, ExtractAbiFunction } from 'abitype'
import {
  Abi,
  Address,
  decodeAbiParameters,
  DecodeAbiParametersReturnType,
  Hex,
  PublicClient,
} from 'viem'

// todo: note that this function only works if the contract is deployed without a factory
function verifyContract<T extends AbiConstructor>(
  contractAddress: string,
  constructorAbi: T,
  compiledBytecode: string,
  publicClient: PublicClient
): DecodeAbiParametersReturnType<T['inputs']> {
  throw new Error('Function not implemented.')
}

async function findContractCreationBlock(
  contractAddress: Address,
  publicClient: PublicClient
): Promise<bigint> {
  let left = 1n
  let right = await publicClient.getBlockNumber()

  while (left < right) {
    const mid = (left + right) / 2n
    const code = await publicClient.getCode({
      address: contractAddress,
      blockNumber: mid,
    })
    if (code != undefined && code.length > 0) {
      right = mid
    } else {
      left = mid + 1n
    }
  }

  if (left > right) {
    throw new Error(`Contract ${contractAddress} not found`)
  }

  return left
}
