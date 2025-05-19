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
const FORK_TEST_BLOCK = 8361791n

// replace this with the most recent target block hash available in the target chain's state
// this is used to test the prover's ability to prove a block
const MOST_RECENT_TARGET_CHAIN_BLOCK_HASH: Hash =
  '0x4c33819fed9e958df96712715a408fc5bd5dd604c163ff393185c9cfdb405bde'

// replace this with a known storage slot value at the specified target chain block hash
// for example a token account balance
const KNOWN_STORAGE_SLOT_ACCOUNT: Address =
  '0x0000000048C4Ed10cF14A02B9E0AbDDA5227b071' // Block hash buffer
const KNOWN_STORAGE_SLOT: bigint = 50n // newestBlockNumber
const KNOWN_STORAGE_SLOT_VALUE: Hash =
  '0x000000000000000000000000000000000000000000000000000000007f43ba00'

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
