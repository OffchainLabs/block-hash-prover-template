import {
  Address,
  decodeAbiParameters,
  encodeAbiParameters,
  getContract,
  Hash,
  Hex,
  PublicClient,
  zeroHash,
} from 'viem'
import {
  iAnchorStateRegistryAbi,
  iFaultDisputeGameAbi,
  parentToChildProverAbi,
} from '../../wagmi/abi'
import { BaseProverHelper } from './BaseProverHelper'
import { IProverHelper } from './IProverHelper'

const iExtendedFaultDisputeGameAbi = [
  ...iFaultDisputeGameAbi,
  {
    type: 'function',
    inputs: [],
    name: 'l2BlockNumber',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

export class ParentToChildProverHelper
  extends BaseProverHelper
  implements IProverHelper
{
  readonly ANCHOR_GAME_SLOT = 3n

  constructor(
    homeChainClient: PublicClient,
    targetChainClient: PublicClient,
    public readonly proverAddress: Address
  ) {
    super(homeChainClient, targetChainClient)
  }

  /**
   * @see IProverHelper.buildInputForGetTargetBlockHash
   */
  async buildInputForGetTargetBlockHash(): Promise<{
    input: Hex
    targetBlockHash: Hash
  }> {
    // find the anchor game to get the l2 block number and then root claim preimage
    const anchorGame = await this._anchorGameContract()
    const l2BlockNumber = await anchorGame.read.l2BlockNumber()
    const rootClaimPreimage = await this._buildRootClaimPreimage(l2BlockNumber)

    return {
      input: encodeAbiParameters(
        [
          { type: 'address' }, // anchorGame
          { type: 'bytes32' }, // rootClaimPreimage ...
          { type: 'bytes32' },
          { type: 'bytes32' },
          { type: 'bytes32' },
        ],
        [
          anchorGame.address,
          rootClaimPreimage.decoded.version,
          rootClaimPreimage.decoded.stateRoot,
          rootClaimPreimage.decoded.messagePasserStorageRoot,
          rootClaimPreimage.decoded.latestBlockhash,
        ]
      ),
      targetBlockHash: rootClaimPreimage.decoded.latestBlockhash,
    }
  }

  /**
   * @see IProverHelper.buildInputForVerifyTargetBlockHash
   */
  async buildInputForVerifyTargetBlockHash(
    homeBlockHash: Hash
  ): Promise<{ input: Hex; targetBlockHash: Hash }> {
    const asrContract = await this._anchorStateRegistryContract()

    const rlpBlockHeader = await this._getRlpBlockHeader('home', homeBlockHash)

    const {
      rlpAccountProof: asrAccountProof,
      rlpStorageProof: asrStorageProof,
      slotValue: anchorGameBytes32,
    } = await this._getRlpStorageAndAccountProof(
      'home',
      homeBlockHash,
      asrContract.address,
      this.ANCHOR_GAME_SLOT
    )

    const anchorGameAddress = decodeAbiParameters(
      [{ type: 'address' }],
      anchorGameBytes32
    )[0]
    const anchorGameContract = getContract({
      address: anchorGameAddress,
      abi: iExtendedFaultDisputeGameAbi,
      client: this.homeChainClient,
    })

    const { rlpAccountProof: gameProxyAccountProof } =
      await this._getRlpStorageAndAccountProof(
        'home',
        homeBlockHash,
        anchorGameAddress,
        0n
      )

    const gameProxyCode = await this.homeChainClient.getCode({
      address: anchorGameAddress,
    })

    if (gameProxyCode === undefined) {
      throw new Error('Undefined game proxy code')
    }

    const rootClaimPreimage = await this._buildRootClaimPreimage(
      await anchorGameContract.read.l2BlockNumber()
    )

    return {
      input: encodeAbiParameters(
        [
          { type: 'bytes' }, // rlpBlockHeader
          { type: 'bytes' }, // asrAccountProof
          { type: 'bytes' }, // asrStorageProof
          { type: 'bytes' }, // gameProxyAccountProof
          { type: 'bytes' }, // gameProxyCode
          { type: 'bytes32' }, // rootClaimPreimage ...
          { type: 'bytes32' },
          { type: 'bytes32' },
          { type: 'bytes32' },
        ],
        [
          rlpBlockHeader,
          asrAccountProof,
          asrStorageProof,
          gameProxyAccountProof,
          gameProxyCode,
          rootClaimPreimage.decoded.version,
          rootClaimPreimage.decoded.stateRoot,
          rootClaimPreimage.decoded.messagePasserStorageRoot,
          rootClaimPreimage.decoded.latestBlockhash,
        ]
      ),
      targetBlockHash: rootClaimPreimage.decoded.latestBlockhash,
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

  protected async _buildRootClaimPreimage(blockNumber: bigint) {
    const block = await this.targetChainClient.getBlock({
      blockNumber,
    })

    const proof = await this.targetChainClient.getProof({
      address: '0x4200000000000000000000000000000000000016',
      storageKeys: [zeroHash],
      blockNumber,
    })

    const decoded = {
      version: zeroHash,
      stateRoot: block.stateRoot,
      messagePasserStorageRoot: proof.storageHash,
      latestBlockhash: block.hash,
    }

    return {
      encoded: encodeAbiParameters(
        [
          { type: 'bytes32' }, // version
          { type: 'bytes32' }, // stateRoot
          { type: 'bytes32' }, // messagePasserStorageRoot
          { type: 'bytes32' }, // latestBlockhash
        ],
        [
          decoded.version,
          decoded.stateRoot,
          decoded.messagePasserStorageRoot,
          decoded.latestBlockhash,
        ]
      ),
      decoded,
    }
  }

  protected async _anchorGameContract() {
    return getContract({
      address: await (
        await this._anchorStateRegistryContract()
      ).read.anchorGame(),
      abi: iExtendedFaultDisputeGameAbi,
      client: this.homeChainClient,
    })
  }

  protected async _anchorStateRegistryContract() {
    return getContract({
      address: await this._proverContract().read.anchorStateRegistry(),
      abi: [
        ...iAnchorStateRegistryAbi,
        {
          type: 'function',
          inputs: [],
          name: 'anchorGame',
          outputs: [{ type: 'address' }],
          stateMutability: 'view',
        },
      ] as const,
      client: this.homeChainClient,
    })
  }

  protected _proverContract() {
    return getContract({
      address: this.proverAddress,
      abi: parentToChildProverAbi,
      client: this.homeChainClient,
    })
  }
}
