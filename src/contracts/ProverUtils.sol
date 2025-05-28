// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Lib_SecureMerkleTrie} from "@eth-optimism/contracts/libraries/trie/Lib_SecureMerkleTrie.sol";
import {Lib_RLPReader} from "@eth-optimism/contracts/libraries/rlp/Lib_RLPReader.sol";

/// @notice Base contract for IBlockHashProver contracts. Contains helpers for verifying block headers and MPT proofs.
library ProverUtils {
    using Lib_RLPReader for Lib_RLPReader.RLPItem;

    /// @dev Given a block hash, RLP encoded block header, account address, storage slot, and the corresponding proofs,
    ///      verifies and returns the value of the storage slot at that block.
    ///      Reverts if the block hash does not match the block header, or if the MPT proofs are invalid.
    /// @param blockHash The hash of the block.
    /// @param rlpBlockHeader The RLP encoded block header.
    /// @param account The account to get the storage slot for.
    /// @param slot The storage slot to get.
    /// @param rlpAccountProof The RLP encoded proof for the account.
    /// @param rlpStorageProof The RLP encoded proof for the storage slot.
    /// @return value The value of the storage slot at the given block.
    function getSlotFromBlockHeader(
        bytes32 blockHash,
        bytes memory rlpBlockHeader,
        address account,
        uint256 slot,
        bytes memory rlpAccountProof,
        bytes memory rlpStorageProof
    ) internal pure returns (bytes32 value) {
        // verify the block header
        require(blockHash == keccak256(rlpBlockHeader), "Block hash does not match");

        // extract the state root from the block header
        bytes32 stateRoot = extractStateRootFromBlockHeader(rlpBlockHeader);

        // verify the account and storage proofs
        value = getStorageSlotFromStateRoot(stateRoot, rlpAccountProof, rlpStorageProof, account, slot);
    }

    /// @dev Extracts the state root from the RLP encoded block header.
    ///      Assumes the state root is the fourth item in the block header.
    /// @param rlpBlockHeader The RLP encoded block header.
    /// @return stateRoot The state root of the block.
    function extractStateRootFromBlockHeader(bytes memory rlpBlockHeader) internal pure returns (bytes32 stateRoot) {
        // extract the state root from the block header
        stateRoot = Lib_RLPReader.toRLPItem(rlpBlockHeader).readList()[3].readBytes32();
    }

    /// @dev Given a state root, RLP encoded account proof, RLP encoded storage proof, account address, and storage slot,
    ///      verifies and returns the value of the storage slot at that state root.
    ///      Reverts if the account does not exist or if the MPT proofs are invalid.
    ///      Will return 0 if the slot does not exist.
    /// @param stateRoot The state root of the block.
    /// @param rlpAccountProof The RLP encoded proof for the account.
    /// @param rlpStorageProof The RLP encoded proof for the storage slot.
    /// @param account The account to get the storage slot for.
    /// @param slot The storage slot to get.
    /// @return value The value of the storage slot at the given state root.
    function getStorageSlotFromStateRoot(
        bytes32 stateRoot,
        bytes memory rlpAccountProof,
        bytes memory rlpStorageProof,
        address account,
        uint256 slot
    ) internal pure returns (bytes32 value) {
        // verify the proof
        (bool accountExists, bytes memory accountValue) =
            Lib_SecureMerkleTrie.get(abi.encodePacked(account), rlpAccountProof, stateRoot);

        require(accountExists, "Account does not exist");

        bytes32 storageRoot = Lib_RLPReader.toRLPItem(accountValue).readList()[2].readBytes32();

        (bool slotExists, bytes memory slotValue) =
            Lib_SecureMerkleTrie.get(abi.encode(slot), rlpStorageProof, storageRoot);

        // decode the slot value
        if (slotExists) value = Lib_RLPReader.readBytes32(slotValue);
    }
}
