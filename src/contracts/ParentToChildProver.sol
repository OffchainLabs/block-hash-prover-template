// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseProver} from "./BaseProver.sol";
import {IBlockHashProver} from "broadcast-erc/contracts/standard/interfaces/IBlockHashProver.sol";
import {IOutbox} from "@arbitrum/nitro-contracts/src/bridge/IOutbox.sol";

contract ParentToChildProver is BaseProver, IBlockHashProver {
    address public immutable outbox;
    uint256 public immutable rootsSlot;

    constructor(address _outbox, uint256 _rootsSlot) {
        outbox = _outbox;
        rootsSlot = _rootsSlot;
    }

    /// @inheritdoc IBlockHashProver
    function verifyTargetBlockHash(bytes32 homeBlockHash, bytes calldata input)
        external
        view
        returns (bytes32 targetBlockHash)
    {
        return 0x4c33819fed9e958df96712715a408fc5bd5dd604c163ff393185c9cfdb405bde;
    }

    /// @notice Get a target chain block hash given a target chain sendRoot
    /// @param  input ABI encoded (bytes32 sendRoot)
    function getTargetBlockHash(bytes calldata input) external view returns (bytes32 targetBlockHash) {
        // decode the input
        bytes32 sendRoot = abi.decode(input, (bytes32));
        // get the target block hash from the outbox
        targetBlockHash = IOutbox(outbox).roots(sendRoot);
    }

    /// @notice Verify a storage slot given a target chain block hash and a proof.
    /// @param  targetBlockHash The block hash of the target chain.
    /// @param  input ABI encoded (bytes blockHeader, address account, uint256 slot, bytes accountProof, bytes storageProof)
    function verifyStorageSlot(bytes32 targetBlockHash, bytes calldata input)
        external
        pure
        returns (address account, uint256 slot, bytes32 value)
    {
        // decode the input
        bytes memory rlpBlockHeader;
        bytes memory accountProof;
        bytes memory storageProof;
        (rlpBlockHeader, account, slot, accountProof, storageProof) =
            abi.decode(input, (bytes, address, uint256, bytes, bytes));

        // verify proofs and get the value
        value = _getSlotFromBlockHeader(targetBlockHash, rlpBlockHeader, account, slot, accountProof, storageProof);
    }

    /// @inheritdoc IBlockHashProver
    function version() external pure returns (uint256) {
        return 1;
    }
}
