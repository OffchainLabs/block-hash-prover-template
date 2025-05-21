import { Address, Hash, Hex, PublicClient, toHex, toRlp } from 'viem'

export class BaseProverHelper {
  constructor(
    public readonly proverAddress: Address,
    readonly homeChainClient: PublicClient,
    readonly targetChainClient: PublicClient
  ) {}

  protected async _getRlpBlockHeader(
    chain: 'target' | 'home',
    blockHash: Hash
  ): Promise<Hex> {
    const client =
      chain === 'target' ? this.targetChainClient : this.homeChainClient
    const block: any = await client.transport.request({
      method: 'eth_getBlockByHash',
      params: [blockHash, false],
    })

    if (!block) {
      throw new Error('Block not found')
    }

    return this._convertToRlpBlock(block)
  }

  protected async _getRlpStorageAndAccountProof(
    chain: 'target' | 'home',
    blockHash: Hash,
    account: Address,
    slot: bigint
  ): Promise<{ rlpAccountProof: Hex; rlpStorageProof: Hex; slotValue: Hash }> {
    const client =
      chain === 'target' ? this.targetChainClient : this.homeChainClient
    const block = await client.getBlock({
      blockHash,
      includeTransactions: false,
    })

    if (!block) {
      throw new Error('Block not found')
    }

    const proof = await client.getProof({
      address: account,
      storageKeys: [toHex(slot, { size: 32 })],
      blockNumber: block.number,
    })

    const slotValue = toHex(proof.storageProof[0].value, { size: 32 })
    const rlpAccountProof = toRlp(proof.accountProof)
    const rlpStorageProof = toRlp(proof.storageProof[0].proof)

    return {
      rlpAccountProof,
      rlpStorageProof,
      slotValue,
    }
  }

  protected _convertToRlpBlock(rpcBlock: any): Hex {
    const encodeInt = (hex: string) => {
      const value = BigInt(hex)
      if (value === 0n) return '0x'
      return cleanHex(value.toString(16)) as Hex
    }

    const cleanHex = (hex: string) => {
      const clean = hex.replace(/^0x/, '')
      return `0x${clean.length % 2 === 0 ? clean : '0' + clean}` as Hex
    }

    const headerFields: Hex[] = [
      cleanHex(rpcBlock.parentHash),
      cleanHex(rpcBlock.sha3Uncles),
      cleanHex(rpcBlock.miner),
      cleanHex(rpcBlock.stateRoot),
      cleanHex(rpcBlock.transactionsRoot),
      cleanHex(rpcBlock.receiptsRoot),
      cleanHex(rpcBlock.logsBloom),
      encodeInt(rpcBlock.difficulty),
      encodeInt(rpcBlock.number),
      encodeInt(rpcBlock.gasLimit),
      encodeInt(rpcBlock.gasUsed),
      encodeInt(rpcBlock.timestamp),
      cleanHex(rpcBlock.extraData),
      cleanHex(rpcBlock.mixHash),
      cleanHex(rpcBlock.nonce),
    ]

    if (rpcBlock.baseFeePerGas)
      headerFields.push(encodeInt(rpcBlock.baseFeePerGas))
    if (rpcBlock.withdrawalsRoot)
      headerFields.push(cleanHex(rpcBlock.withdrawalsRoot))
    if (rpcBlock.blobGasUsed) headerFields.push(encodeInt(rpcBlock.blobGasUsed))
    if (rpcBlock.excessBlobGas)
      headerFields.push(encodeInt(rpcBlock.excessBlobGas))
    if (rpcBlock.parentBeaconBlockRoot)
      headerFields.push(cleanHex(rpcBlock.parentBeaconBlockRoot))
    if (rpcBlock.requestsHash)
      headerFields.push(cleanHex(rpcBlock.requestsHash))

    return toRlp(headerFields)
  }
}
