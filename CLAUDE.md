# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nostra is a decentralized prediction market platform built on the Conditional Tokens Framework (CTF), implementing the Polymarket CTF Exchange architecture. This is a **yarn workspace monorepo** containing smart contracts and a TypeScript SDK.

## Monorepo Structure

```
nostra-contracts/
├── packages/
│   ├── contracts/          # @nostra/contracts (private)
│   │   ├── contracts/      # Solidity source
│   │   │   ├── core/       # MarketFactory (market creation/management)
│   │   │   ├── oracle/     # ResolutionOracle (outcome resolution)
│   │   │   ├── interfaces/ # Contract interfaces
│   │   │   ├── mocks/      # ConditionalTokens, MockUSDC
│   │   │   └── libraries/  # Shared utilities
│   │   ├── test/
│   │   │   ├── unit/       # Contract unit tests
│   │   │   └── integration/# End-to-end market flow tests
│   │   └── scripts/deploy/ # Network-specific deployment scripts
│   │
│   └── sdk/                # @nostra/sdk (publishable)
│       ├── src/generated/  # Auto-generated addresses & ABIs
│       ├── src/utils/      # Helper functions
│       └── src/types.ts    # TypeScript types
│
├── deployments.json        # Contract addresses per network (committed)
├── .env                    # Secrets and private keys (never commit!)
└── docs/                   # Documentation
```

## Key Architectural Patterns

### Deployment Architecture
- **Atomic Updates**: Contracts and SDK live in the same repo to guarantee synchronization
- **Separation of Concerns**: `.env` contains secrets (gitignored), `deployments.json` contains public addresses (committed)
- **Multi-Network Support**: Localhost (31337), Polygon (137), Polygon Amoy (80002), BSC (56), BSC Testnet (97)

### Contract Organization
- **ConditionalTokens**: ERC1155-based outcome tokens (CTF standard, from Gnosis)
- **MarketFactory**: Creates binary and multi-choice markets, manages lifecycle
- **ResolutionOracle**: Handles market resolution, dispute period, and outcome reporting
- **CTFExchange**: Trading engine for outcome tokens (based on Polymarket implementation)

## Development Commands

### Essential Commands (from root)
```bash
# Setup
yarn install                    # Install all workspace dependencies

# Compilation
yarn compile                    # Compile contracts (generates typechain-types/)

# Testing
yarn test                       # Run all tests (77 tests total)
yarn test:unit                  # Unit tests only
yarn test:integration           # Integration tests (MarketFlow.test.ts)

# Coverage
yarn workspace @nostra/contracts coverage

# Build SDK
yarn sdk:build                  # Compile TypeScript SDK
yarn sdk:dev                    # Watch mode for SDK development

# Validation
yarn validate:sdk               # Verify SDK addresses match deployments.json

# SDK Package Inspection
cd packages/sdk
yarn list:addresses             # List all addresses stored in the SDK package

# Clean
yarn clean                      # Remove all build artifacts
```

### Deployment Commands
```bash
# Local Development
npx hardhat node                              # Start local node (terminal 1)
yarn deploy:local                             # Deploy to localhost (terminal 2)

# Testnet Deployment
yarn deploy:polygon-amoy                      # Polygon Amoy testnet
yarn deploy:bsc-testnet                       # BSC testnet

# Mainnet Deployment
yarn deploy:polygon                           # Polygon mainnet
yarn deploy:bsc                               # BSC mainnet

# Contract Verification (after mainnet deployment)
npx hardhat verify --network polygon <ADDRESS> <CONSTRUCTOR_ARGS>
```

### Running Specific Tests
```bash
# Single test file
npx hardhat test packages/contracts/test/unit/MarketFactory.test.ts

# Single test suite within a file
npx hardhat test --grep "MarketFactory"

# Single test case
npx hardhat test --grep "should create a binary market"

# With gas reporting
REPORT_GAS=true yarn test
```

## Hardhat Configuration

**Location**: `packages/contracts/hardhat.config.ts`

**Important Settings**:
- **Solidity**: 0.8.20 with optimizer (200 runs)
- **Test timeout**: 40 seconds (for complex integration tests)
- **Environment**: Loads `.env` from root directory (not packages/contracts/)
- **Typechain**: Generates ethers-v6 types to `typechain-types/`

**Network Chain IDs**:
- localhost: 31337
- polygon: 137
- polygonAmoy: 80002
- bsc: 56
- bscTestnet: 97

## Testing Architecture

### Integration Test: MarketFlow.test.ts
This test simulates the **complete prediction market lifecycle**:

1. **Market Creation** → Creator deploys a binary or multi-choice market
2. **Trading Simulation** → Users split collateral into outcome tokens
3. **Market Resolution** → Oracle resolves the market with winning outcome
4. **Token Redemption** → Winners redeem tokens for profit

**Test Scenarios**:
- Basic binary market (Bitcoin $100k)
- Multi-choice markets (6-outcome Fed rate decision)
- Sports markets with hedging strategies
- Polymarket-style grouped binary markets
- Dispute resolution flow
- Market cancellation flow

### Unit Tests
- `MarketFactory.test.ts`: Market creation, validation, lifecycle
- `ResolutionOracle.test.ts`: Resolution mechanics, dispute handling
- Contract-specific logic and edge cases

## Environment Configuration

### .env (Root Directory - NEVER COMMIT)
```bash
NETWORK=localhost
PRIVATE_KEY=0x...                              # Deployer private key
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
BSC_RPC_URL=https://bsc-dataseed.binance.org
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
POLYGONSCAN_API_KEY=                           # For verification
BSCSCAN_API_KEY=                               # For verification
REPORT_GAS=false                               # Enable gas reporting
```

### deployments.json (Root Directory - COMMIT THIS)
Contains deployed contract addresses for each network. Updated automatically by deployment scripts.

## SDK Usage Pattern

The SDK is designed for the **private nostra-server monorepo** (frontend + backend):

```typescript
import { Network, getMarketFactory, getConditionalTokens } from '@nostra/sdk';

// SDK automatically reads addresses from deployments.json
const marketFactory = getMarketFactory(Network.POLYGON, signer);
const conditionalTokens = getConditionalTokens(Network.POLYGON, signer);

// Create a market
await marketFactory.createBinaryMarket(
  questionId,
  'Will Bitcoin reach $100k?',
  'Crypto prediction market',
  'Crypto',
  endTime,
  resolutionTime
);
```

## SDK Publishing

### Local Development with yalc (Recommended)

For testing the SDK in `nostra-server` or other projects without publishing to npm:

```bash
# One-time setup
yarn global add yalc
# Ensure ~/.yarn/bin is in PATH (already configured)

# Publish SDK locally (from nostra-contracts root)
cd packages/sdk
yarn yalc:publish  # Builds and publishes to local yalc store

# In nostra-server (or other consuming project)
cd /path/to/nostra-server
yalc add @nostra-dev/sdk
yarn install

# After SDK changes (from packages/sdk)
yarn yalc:push  # Auto-updates all yalc-linked projects

# To remove yalc link
cd /path/to/nostra-server
yalc remove @nostra-dev/sdk
yarn install
```

### Publishing to npm Registry

For production releases and team distribution:

#### Quick Release (Recommended - Yarn)
```bash
cd packages/sdk

# One command - version, build, and publish
yarn release:patch  # 1.0.0 -> 1.0.1 (bug fixes)
yarn release:minor  # 1.0.0 -> 1.1.0 (new features)
yarn release:major  # 1.0.0 -> 2.0.0 (breaking changes)

# Verify
yarn info @nostra-dev/sdk
```

#### Manual Workflow
```bash
cd packages/sdk

# Step-by-step with yarn
yarn version --patch  # Update version
yarn build            # Build package
yarn publish --access public  # Publish

# Alternative: Mix npm version with yarn
npm version patch && yarn build && yarn publish --access public

# Verify
yarn info @nostra-dev/sdk
```

**Prerequisites for npm publishing:**
- Logged in: `npm login`
- Organization access: `npm org ls nostra-dev`
- Package name: `@nostra-dev/sdk` (already configured)

**Inspecting package before publishing:**
```bash
cd packages/sdk

# View files that will be included (yarn doesn't have dry-run)
npm pack --dry-run

# Test publish (yarn doesn't support --dry-run)
npm publish --dry-run

# Create tarball for inspection
yarn pack
```

**Viewing published package info:**
```bash
yarn info @nostra-dev/sdk           # All package metadata
yarn info @nostra-dev/sdk versions  # List all versions
```

## Workflow Patterns

### Adding a New Contract
1. Create contract in `packages/contracts/contracts/<directory>/`
2. Add interface to `packages/contracts/contracts/interfaces/`
3. Write unit tests in `packages/contracts/test/unit/`
4. Update deployment script in `packages/contracts/scripts/deploy/`
5. Compile: `yarn compile` (generates typechain types)
6. Test: `yarn test`
7. Update SDK types if needed in `packages/sdk/src/`

### Deployment Workflow
1. Set environment variables in `.env`
2. Run deployment command for target network
3. Deployment script automatically updates `deployments.json`
4. Commit `deployments.json` to repository
5. SDK automatically picks up new addresses on next build
6. For mainnets: Verify contracts with `npx hardhat verify`

### Adding a New Network
1. Add network config to `packages/contracts/hardhat.config.ts`
2. Add network entry to `deployments.json`
3. Create deployment script in `packages/contracts/scripts/deploy/`
4. Add network constant to `packages/sdk/src/types.ts`
5. Update README with new network details

## Important Constraints

### Smart Contract Requirements
- **Solidity 0.8.20**: All contracts must use this version
- **Gas Optimization**: Optimizer enabled with 200 runs
- **OpenZeppelin**: Version 5.0.1 for standard implementations
- **Reentrancy Protection**: Required for all external calls
- **Access Control**: Use OpenZeppelin's AccessControl pattern

### Testing Requirements
- **All tests must pass**: 77/77 tests passing is baseline
- **Integration tests required**: For any market flow changes
- **Mock contracts**: Use existing mocks (MockUSDC, ConditionalTokens)
- **Test timeout**: 40 seconds max per test

### Monorepo Conventions
- **Workspace references**: Use `@nostra/contracts` and `@nostra/sdk` for cross-package imports
- **Root-level operations**: Run compilation and tests from root directory
- **Environment loading**: `.env` lives at root, not in packages
- **Build artifacts**: Each package manages its own artifacts, cache, and typechain-types

## Contract Inheritance Patterns

- **MarketFactory**: Inherits from `Ownable` for admin controls
- **ResolutionOracle**: Inherits from `Ownable` for resolver management
- **ConditionalTokens**: Standard ERC1155 implementation from Gnosis
- All contracts use OpenZeppelin's ReentrancyGuard where applicable

## Security Considerations

- Based on audited Polymarket CTF Exchange implementation
- Reentrancy protection on all external calls
- Input validation on all public/external functions
- Access control via OpenZeppelin's patterns
- Test coverage includes edge cases and attack vectors
