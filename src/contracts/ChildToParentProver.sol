// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ProverUtils} from "./ProverUtils.sol";
import {IBlockHashProver} from "broadcast-erc/contracts/standard/interfaces/IBlockHashProver.sol";

interface IL1Block {
    function hash() external view returns (bytes32);
}

/// @notice Contract to store L1 block hashes for later retrieval.
contract L1BlockHistory {
    event BlockHashStored(bytes32 indexed blockHash);

    address public constant l1BlockPredeploy = 0x4200000000000000000000000000000000000015;
    mapping(bytes32 => bool) public isKnownHash;

    function storeHash() external {
        bytes32 blockHash = IL1Block(l1BlockPredeploy).hash();
        isKnownHash[blockHash] = true;
        emit BlockHashStored(blockHash);
    }
}

/// @notice OP-stack implementation of a child to parent IBlockHashProver.
/// @dev    verifyTargetBlockHash and getTargetBlockHash get block hashes from the L1Block predeploy.
///         verifyStorageSlot is implemented to work against any target chain with a standard Ethereum block header and state trie.
contract ChildToParentProver is IBlockHashProver {
    address public constant l1BlockPredeploy = 0x4200000000000000000000000000000000000015;
    uint256 public constant l1BlockHashSlot = 2;
    L1BlockHistory public immutable l1BlockHistory = new L1BlockHistory();

    /// @notice Verify the latest available target block hash given a home chain block hash and a storage proof of the L1Block predeploy.
    /// @param  homeBlockHash The block hash of the home chain.
    /// @param  input ABI encoded (bytes blockHeader, bytes accountProof, bytes storageProof)
    function verifyTargetBlockHash(bytes32 homeBlockHash, bytes calldata input)
        external
        pure
        returns (bytes32 targetBlockHash)
    {
        // decode the input
        bytes memory rlpBlockHeader;
        bytes memory accountProof;
        bytes memory storageProof;
        (rlpBlockHeader, accountProof, storageProof) = abi.decode(input, (bytes, bytes, bytes));

        // verify proofs and get the value
        targetBlockHash = ProverUtils.getSlotFromBlockHeader(
            homeBlockHash, rlpBlockHeader, l1BlockPredeploy, l1BlockHashSlot, accountProof, storageProof
        );
    }

    /// @notice Get the latest parent chain block hash from the L1Block predeploy. Alternatively, an L1BlockHistory contract can be used to fetch an old block hash.
    /// @dev    A fallback L1BlockHistory contract is available in case the L1Block predeploy is updating too frequently.
    ///         Call `storeHash` on the L1BlockHistory contract to store the latest block hash.
    ///         Leave the bytes input empty to use the latest block hash from the L1Block predeploy.
    ///         If a specific block hash is needed, pass the block hash as bytes input.
    /// @param  input ABI encoded bytes (empty or bytes32 blockHash)
    function getTargetBlockHash(bytes calldata input) external view returns (bytes32 targetBlockHash) {
        if (input.length == 0) {
            // use the latest block hash from the L1Block predeploy
            return IL1Block(l1BlockPredeploy).hash();
        }
        targetBlockHash = abi.decode(input, (bytes32));
        require(l1BlockHistory.isKnownHash(targetBlockHash), "Invalid input: must be a known block hash or empty");
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
        value = ProverUtils.getSlotFromBlockHeader(
            targetBlockHash, rlpBlockHeader, account, slot, accountProof, storageProof
        );
    }

    /// @inheritdoc IBlockHashProver
    function version() external pure returns (uint256) {
        return 1;
    }
}
