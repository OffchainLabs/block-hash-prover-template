# Block Hash Prover Development Template

This project provides starter code for developing [ERC-7888](https://github.com/ethereum/ERCs/pull/897) `IBlockHashProver` contracts and tooling.

Each rollup stack will have a unique implementation of these prover contracts and tooling. Customized forks of rollup stacks may have their own distinct implementations as well.

The project includes:

- A pair of skeleton prover contracts - one for parent chain -> child chain, and another for child chain -> parent chain.
- Skeleton typescript helpers for producing input for the prover contracts. This code is exported as a module.
- Helpers for producing and verifying MPT proofs.
- Basic tests for the prover contracts and helpers.

## Project Structure

### Contracts

```
src/contracts
├── BaseProver.sol
├── BlockHashProverPointer.sol
├── ChildToParentProver.sol
└── ParentToChildProver.sol
```

**`src/contracts/BaseProver.sol:BaseProver`** contains internal helper functions for verifying MPT proofs of storage slots given an RLP block header. Both the `ChildToParentProver` and `ParentToChildProver` contracts inherit the `BaseProver`. Unless your home or target chain uses a non standard block header encoding scheme or a non MPT state trie, this contract likely requires no modification.

**`src/contracts/BlockHashProverPointer.sol:BlockHashProverPointer`** is a production ready ERC-7888 compliant `IBlockHashProverPointer` implementation. It has a single owner that can set the prover. This contract likely requires no modification.

**`src/contracts/ChildToParentProver.sol:ChildToParentProver`** is a skeleton child to parent block hash prover contract. `verifyTargetBlockHash` and `getTargetBlockHash` must be implemented to fit your chain. `verifyStorageSlot` likely does not require modification if your target chain uses the standard Ethereum block header encoding scheme and MPT state trie. See [`IBlockHashProver`](https://github.com/OffchainLabs/broadcast-erc/blob/main/contracts/standard/interfaces/IBlockHashProver.sol) for details.

**`src/contracts/ParentToChildProver.sol:ParentToChildProver`** is a skeleton parent to child block hash prover contract. `verifyTargetBlockHash` and `getTargetBlockHash` must be implemented to fit your chain. `verifyStorageSlot` likely does not require modification if your target chain uses the standard Ethereum block header encoding scheme and MPT state trie. See [`IBlockHashProver`](https://github.com/OffchainLabs/broadcast-erc/blob/main/contracts/standard/interfaces/IBlockHashProver.sol) for details.

### Typescript

this repo should be a starting point for development of BHP's for the broadcaster.

each rollup stack will have a pair of BHP's and a typescript module for interacting with them / verifying instances.

It will include:

- a skeleton pair of BHP's
- a production BHPPointer implementation
- some MPT contracts library
- a skeleton typescript module
  - the typescript module will be exported for use in things like OIF
  - produce proofs for the BHP
  - verify BHP's and provide the immutables they were constructed with
  - verify BHPPointer and ensure constructor doesn't have a storage backdoor
- a basic test harness for BHP's and their typescript module (i believe this can be built in a chain agnostic way, just given a parent/child rpc)

It will NOT include:

- code to interact with the `Receiver`
