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
├── ProverUtils.sol
├── BlockHashProverPointer.sol
├── ChildToParentProver.sol
└── ParentToChildProver.sol
```

**`src/contracts/ProverUtils.sol:ProverUtils`** contains a helper library for handling MPT proofs and RLP block headers. 

**`src/contracts/ChildToParentProver.sol:ChildToParentProver`** is a skeleton child to parent block hash prover contract whose home is the child chain and target is the parent chain. `verifyTargetBlockHash` and `getTargetBlockHash` must be implemented to fit your chain. `verifyStorageSlot` likely does not require modification if your target chain uses the standard Ethereum block header encoding scheme and MPT state trie. See [`IBlockHashProver`](https://github.com/OffchainLabs/broadcast-erc/blob/main/contracts/standard/interfaces/IBlockHashProver.sol) for details.

**`src/contracts/ParentToChildProver.sol:ParentToChildProver`** is the same as `ChildToParentProver`, but has the parent chain as its home and child chain as its target.

**`src/contracts/BlockHashProverPointer.sol:BlockHashProverPointer`** is a production ready ERC-7888 compliant `IBlockHashProverPointer` implementation. It has a single owner that can set the prover. This contract likely requires no modification.

### Typescript

```
src/ts
├── BaseProverHelper.ts
├── ChildToParentProverHelper.ts
├── index.ts
├── IProverHelper.ts
└── ParentToChildProverHelper.ts
```

**`src/ts/BaseProverHelper.ts:BaseProverHelper`** contains helper functions for generating proofs understood by the prover contracts. Both the `ChildToParentProverHelper` and `ParentToChildProverHelper` extend this class. Unless your home or target chain uses a non standard block header encoding scheme or a non MPT state trie, this contract likely requires no modification.

**`src/ts/ChildToParentProverHelper.ts:ChildToParentProverHelper`** is a skeleton helper class for producing inputs for the `ChildToParentProver` contract. This class must be fit to your `ChildToParentProver` implementation.

**`src/ts/ParentToChildProverHelper.ts:ParentToChildProverHelper`** is the same as the `ChildToParentProverHelper`, but is meant to fit to the `ParentToChildProver` contract.

**`src/ts/IProverHelper.ts:IProverHelper`** is the interface that both helpers must implement.

### Tests

```
test
├── BasicProverTests.test.ts
└── BlockHashProverPointer.test.ts
```

**`test/BasicProverTests.test.ts`** contains some basic tests for both provers. To configure them, populate the two `testContext` variables according to the code comments and set the RPC URL's in `.env`

**`test/BlockHashProverPointer.test.ts`** contains tests of the pointer contract.
