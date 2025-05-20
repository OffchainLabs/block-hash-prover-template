// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockProver {
    uint256 public immutable version;

    constructor(uint256 _version) {
        version = _version;
    }
}
