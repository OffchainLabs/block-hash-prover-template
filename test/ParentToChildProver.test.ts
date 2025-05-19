import { reset } from '@nomicfoundation/hardhat-toolbox-viem/network-helpers'
import hre from 'hardhat'
import {
  Address,
  createPublicClient,
  GetContractReturnType,
  Hash,
  http,
  PublicClient,
} from 'viem'
import { getEnv } from '../src/ts/util'
import { ParentToChildProverHelper } from '../src/ts/prover-helper/ParentToChildProverHelper'
import { ParentToChildProver$Type } from '../artifacts/src/contracts/ParentToChildProver.sol/ParentToChildProver'
import { basicProverTests } from './basicProverTests'
import { patchHardhatClient } from './patchHardhatClient'

// replace this with the block number of the home chain fork test block
const FORK_TEST_BLOCK = 8340534n

// replace this with the most recent target block hash available in the target chain's state
// this is used to test the prover's ability to prove a block
const MOST_RECENT_TARGET_CHAIN_BLOCK_HASH: Hash =
  '0x9aa793347b6915ff7869da6d155e9d3d7365ee5f3d34671f71bee6491730bec9'

// replace this with a known storage slot value at the specified target chain block hash
// for example a token account balance
const KNOWN_STORAGE_SLOT_ACCOUNT: Address =
  '0x38f918D0E9F1b721EDaA41302E399fa1B79333a9' // Arbitrum sepolia bridge
const KNOWN_STORAGE_SLOT: bigint = 10n // sequencerReportedSubMessageCount
const KNOWN_STORAGE_SLOT_VALUE: Hash =
  '0x000000000000000000000000000000000000000000000000000000000927de3b'

describe('ParentToChildProver', function () {
  let prover: GetContractReturnType<
    ParentToChildProver$Type['abi'],
    PublicClient
  >
  let targetClient: PublicClient
  let helper: ParentToChildProverHelper

  beforeEach(async () => {
    await reset(getEnv('PARENT_RPC_URL'), FORK_TEST_BLOCK)

    const homeClient = await hre.viem.getPublicClient()
    patchHardhatClient(homeClient, getEnv('PARENT_RPC_URL'), FORK_TEST_BLOCK)
    targetClient = createPublicClient({
      transport: http(getEnv('CHILD_RPC_URL')),
    })

    prover = await hre.viem.deployContract('ParentToChildProver')

    helper = new ParentToChildProverHelper(
      prover.address,
      homeClient,
      targetClient
    )
  })

  basicProverTests(() => {
    return {
      forkBlockNumber: FORK_TEST_BLOCK,
      proverAddress: prover.address,
      proverHelper: helper,
      expectedTargetBlockHash: MOST_RECENT_TARGET_CHAIN_BLOCK_HASH,
      knownStorageSlotAccount: KNOWN_STORAGE_SLOT_ACCOUNT,
      knownStorageSlot: KNOWN_STORAGE_SLOT,
      knownStorageSlotValue: KNOWN_STORAGE_SLOT_VALUE,
    }
  })
})
