# Nostra SDK Architecture

## 1. Overview

This document outlines the architectural decision for the location and structure of the Nostra SDK. The SDK's primary purpose is to provide a simple and reliable way for the frontend and backend services, which are both part of the private `nostra-server` monorepo, to interact with the deployed smart contracts from the `nostra-contracts` repository.

The SDK will contain:
- Deployed contract addresses for various networks (e.g., Polygon, Amoy, localhost).
- Contract ABIs (Application Binary Interfaces).
- TypeChain typings for full TypeScript support.
- Helper functions for common contract interactions.

## 2. Architectural Goal

The key goal is to ensure that the SDK is **always in sync** with the deployed smart contracts. A mismatch between the client-side SDK and the on-chain contracts is a common source of bugs, deployment failures, and wasted development time. The chosen architecture must minimize this risk.

## 3. Decision and Rationale

**We have chosen Option 2: Place the SDK inside the `nostra-contracts` repository as part of a monorepo.**

The benefit of **atomic updates** is the single most important factor. It completely eliminates the risk of the SDK and contracts becoming desynchronized. This is a common and battle-tested pattern in the Web3 ecosystem (e.g., Uniswap, Aave) for its reliability and simplicity.

The monorepo structure provides additional benefits:
- **Clear Separation**: Each sub-project has its own `package.json` and manages its own dependencies
- **Easy to Extend**: Adding new packages (like a subgraph, documentation site, or CLI tools) follows a standardized process
- **Simplified Dependency Management**: Single `yarn install` from root installs all dependencies
- **Seamless Cross-Package Linking**: Local packages can reference each other automatically

## 4. Implementation - Monorepo Structure

The project is now organized as a yarn workspace monorepo:

```
nostra-contracts/
├── packages/
│   ├── contracts/          <-- Smart contracts, tests, and Hardhat config
│   │   ├── contracts/
│   │   ├── test/
│   │   ├── scripts/
│   │   ├── hardhat.config.ts
│   │   └── package.json    (@nostra/contracts)
│   │
│   └── sdk/                <-- TypeScript SDK package
│       ├── src/
│       │   ├── generated/  <-- Auto-generated addresses & ABIs
│       │   ├── utils/      <-- Helper functions
│       │   └── index.ts
│       ├── package.json    (@nostra/sdk)
│       └── tsconfig.json
│
├── docs/                   <-- Documentation (shared)
├── package.json            <-- Root package.json for monorepo
└── yarn.lock               <-- Yarn lockfile
```

### 4.1 Packages

#### @nostra/contracts
- Contains all Solidity smart contracts
- Test suites (unit and integration)
- Deployment scripts
- Hardhat configuration
- **Private package** - not published to npm

#### @nostra/sdk
- TypeScript SDK for contract interactions
- Auto-generated contract addresses and ABIs
- Helper functions for common operations
- Type-safe contract interfaces
- **Publishable package** - can be published to npm

## 5. Workflow

### 5.1 Development

From the root directory:

```bash
# Install all dependencies for all packages
yarn install

# Compile contracts
yarn compile

# Run tests
yarn test

# Build SDK
yarn sdk:build

# Watch mode for SDK development
yarn sdk:dev
```

### 5.2 Deployment & SDK Update

1. **Deploy Contracts**: Smart contracts are deployed to a network (e.g., Polygon Mainnet)
2. **Update SDK**: Deployment script automatically updates `packages/sdk/src/generated/addresses.ts` with new addresses
3. **Generate ABIs**: Contract ABIs are extracted and copied to `packages/sdk/src/generated/abis.ts`
4. **Build SDK**: The SDK is built with the latest addresses and ABIs
5. **Publish SDK**: (Optional) The `@nostra/sdk` package is published to npm

This ensures that any service or developer using the SDK can simply update to the latest version to get all the necessary information for the latest contract deployment.

### 5.3 Adding New Packages

To add a new sub-project (e.g., subgraph, CLI tool, documentation site):

1. Create a new directory under `packages/`:
   ```bash
   mkdir -p packages/new-package
   ```

2. Add a `package.json`:
   ```json
   {
     "name": "@nostra/new-package",
     "version": "1.0.0",
     "scripts": {
       "build": "..."
     }
   }
   ```

3. The package is automatically included in the workspace

4. To use another package as a dependency:
   ```json
   {
     "dependencies": {
       "@nostra/sdk": "1.0.0"
     }
   }
   ```

5. Run `yarn install` from the root to link packages

## 6. Benefits of This Architecture

### 6.1 Atomic Updates
Contract code, deployment scripts, and SDK can all be updated in a single commit, guaranteeing synchronization.

### 6.2 Scalability
Easy to add new packages:
- `@nostra/subgraph` - The Graph subgraph for indexing events
- `@nostra/cli` - Command-line tools for market management
- `@nostra/docs` - Documentation website
- `@nostra/integration-tests` - End-to-end integration tests

### 6.3 Simplified CI/CD
Single pipeline can:
- Compile contracts
- Run tests
- Deploy contracts
- Update SDK
- Build and publish SDK
- Deploy subgraph
- All in a single workflow

### 6.4 Developer Experience
- Single `yarn install` for all dependencies
- Changes in SDK are instantly available to other local packages
- Consistent tooling and scripts across packages
- Type-safe cross-package imports

## 7. Migration from Flat Structure

The migration from the previous flat structure involved:

1. Adding `workspaces` field to root `package.json`
2. Moving contracts, tests, and scripts to `packages/contracts/`
3. Creating new SDK structure in `packages/sdk/`
4. Updating root scripts to use workspace commands
5. Preserving all existing functionality while enabling future extensibility

This migration maintains backward compatibility while providing a clean foundation for future growth.

## 8. Yarn Workspaces vs Alternatives

We chose Yarn Workspaces because:

1. **Native Support**: Built into Yarn, no extra tools needed
2. **Hoisting**: Common dependencies are hoisted to reduce duplication
3. **Linking**: Automatic symlinking between workspace packages
4. **Widely Adopted**: Used by many large projects (React, Babel, Jest)
5. **Compatible**: Works with all npm packages and registries

Alternative tools considered:
- **npm workspaces**: Similar features, but yarn has better performance
- **pnpm**: Faster and more efficient, but less widely adopted
- **Lerna**: Additional layer on top, adds complexity we don't need
