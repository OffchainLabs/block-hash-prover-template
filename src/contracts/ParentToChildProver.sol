// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ProverUtils} from "./ProverUtils.sol";
import {IBlockHashProver} from "broadcast-erc/contracts/standard/interfaces/IBlockHashProver.sol";
import {IOutbox} from "@arbitrum/nitro-contracts/src/bridge/IOutbox.sol";

/// @notice Skeleton implementation of a child to parent IBlockHashProver.
/// @dev    verifyTargetBlockHash and getTargetBlockHash are not implemented.
///         verifyStorageSlot is implemented to work against any target chain with a standard Ethereum block header and state trie.
contract ParentToChildProver is BaseProver, IBlockHashProver {
    address public immutable outbox;
    uint256 public immutable rootsSlot;

    constructor(address _outbox, uint256 _rootsSlot) {
        outbox = _outbox;
        rootsSlot = _rootsSlot;
    }

    /// @notice Verify a target chain block hash given a home chain block hash and a proof.
    /// @param  homeBlockHash The block hash of the home chain.
    /// @param  input ABI encoded (bytes blockHeader, bytes32 sendRoot, bytes accountProof, bytes storageProof)
    function verifyTargetBlockHash(bytes32 homeBlockHash, bytes calldata input)
        external
        view
        returns (bytes32 targetBlockHash)
    {
        // decode the input
        (bytes memory rlpBlockHeader, bytes32 sendRoot, bytes memory accountProof, bytes memory storageProof) =
            abi.decode(input, (bytes, bytes32, bytes, bytes));

        // calculate the slot based on the provided send root
        uint256 slot = uint256(keccak256(abi.encode(sendRoot, rootsSlot)));

        // verify proofs and get the block hash
        targetBlockHash =
            _getSlotFromBlockHeader(homeBlockHash, rlpBlockHeader, outbox, slot, accountProof, storageProof);
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
        value = ProverUtils.getSlotFromBlockHeader(targetBlockHash, rlpBlockHeader, account, slot, accountProof, storageProof);
    }

    /// @inheritdoc IBlockHashProver
    function version() external pure returns (uint256) {
        return 1;
    }
}
