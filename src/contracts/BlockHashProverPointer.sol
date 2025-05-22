// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IBlockHashProverPointer} from "broadcast-erc/contracts/standard/interfaces/IBlockHashProverPointer.sol";
import {IBlockHashProver} from "broadcast-erc/contracts/standard/interfaces/IBlockHashProver.sol";

/// @notice Production ready implementation of the BlockHashProverPointer contract.
contract BlockHashProverPointer is IBlockHashProverPointer, Ownable {
    /// @notice Thrown when the version of the new prover is less than or equal to the current one.
    error NonIncreasingVersion(uint256 previousVersion, uint256 newVersion);

    /// @dev The slot where the code hash is stored.
    uint256 public constant BLOCK_HASH_PROVER_POINTER_SLOT = uint256(keccak256("eip7888.pointer.slot")) - 1;

    /// @dev Implementation Address does not need to be stored in a specific slot.
    address public implementationAddress;

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Privileged function to update the BHP.
    function setBHP(address bhp) external onlyOwner {
        if (implementationAddress != address(0)) {
            uint256 oldVersion = IBlockHashProver(implementationAddress).version();
            uint256 newVersion = IBlockHashProver(bhp).version();
            if (newVersion <= oldVersion) {
                revert NonIncreasingVersion(oldVersion, newVersion);
            }
        }
        implementationAddress = bhp;
        _storeCodeHash(bhp.codehash);
    }

    /// @dev Return the code hash stored in BLOCK_HASH_PROVER_POINTER_SLOT.
    function implementationCodeHash() external view override returns (bytes32 codeHash) {
        uint256 slot = BLOCK_HASH_PROVER_POINTER_SLOT;
        assembly {
            codeHash := sload(slot)
        }
    }

    /// @dev Store the code hash in BLOCK_HASH_PROVER_POINTER_SLOT.
    function _storeCodeHash(bytes32 codeHash) internal {
        uint256 slot = BLOCK_HASH_PROVER_POINTER_SLOT;
        assembly {
            sstore(slot, codeHash)
        }
    }
}
