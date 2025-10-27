# @nostra-dev/sdk

TypeScript SDK for interacting with Nostra Prediction Market smart contracts.

## Installation

```bash
npm install @nostra-dev/sdk
# or
yarn add @nostra-dev/sdk
# or
pnpm add @nostra-dev/sdk
```

## Configuration

The SDK reads contract addresses from `deployments.json` automatically. **No configuration needed!**

The SDK includes a `deployments.json` file in the package that contains all deployed contract addresses:

```json
{
  "localhost": {
    "chainId": 31337,
    "contracts": {
      "ConditionalTokens": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      "MarketFactory": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      "CTFExchange": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
      "ResolutionOracle": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
    }
  },
  "polygon": { ... },
  "bsc": { ... }
}
```

**For Published Package:**
- The SDK reads from the bundled `deployments.json`
- Always contains the latest official deployment addresses
- Updated automatically with each new deployment

**For Monorepo Development:**
- The SDK reads from the root `deployments.json`
- Shared between contracts package (writes) and SDK (reads)
- Always in sync after local deployments

## Usage

### Basic Usage

```typescript
import { ethers } from 'ethers';
import {
  Network,
  getMarketFactory,
  getConditionalTokens,
  getContractAddress
} from '@nostra-dev/sdk';

// Connect to a provider
const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
const signer = new ethers.Wallet('PRIVATE_KEY', provider);

// Get contract instances
const marketFactory = getMarketFactory(Network.POLYGON, signer);
const conditionalTokens = getConditionalTokens(Network.POLYGON, signer);

// Create a binary market
const tx = await marketFactory.createBinaryMarket(
  questionId,
  'Will Bitcoin reach $100k in 2024?',
  'A prediction market on Bitcoin\'s price',
  'Crypto',
  endTime,
  resolutionTime
);
await tx.wait();
```

### Getting Contract Addresses

```typescript
import { Network, getContractAddress, getNetworkAddresses } from '@nostra-dev/sdk';

// Get a specific contract address
const factoryAddress = getContractAddress(Network.POLYGON, 'MarketFactory');

// Get all contract addresses for a network
const addresses = getNetworkAddresses(Network.POLYGON);
console.log(addresses);
```

### Working with ABIs

```typescript
import { getContractABI } from '@nostra-dev/sdk';

const marketFactoryABI = getContractABI('MarketFactory');
```

## Supported Networks

- `Network.LOCALHOST` - Local Hardhat network (chain ID: 31337)
- `Network.POLYGON` - Polygon Mainnet (chain ID: 137)
- `Network.POLYGON_AMOY` - Polygon Amoy Testnet (chain ID: 80002)
- `Network.BSC` - Binance Smart Chain Mainnet (chain ID: 56)
- `Network.BSC_TESTNET` - BSC Testnet (chain ID: 97)

## Contract Interfaces

The SDK provides access to the following contracts:

- **ConditionalTokens** - Core CTF implementation for outcome tokens
- **MarketFactory** - Factory for creating prediction markets
- **CTFExchange** - Exchange for trading outcome tokens
- **ResolutionOracle** - Oracle for resolving market outcomes
- **MockUSDC** - Mock USDC token (test networks only)

## Publishing

### Method 1: Local Development with yalc (Recommended for Development)

Use `yalc` to test the SDK locally in other projects without publishing to npm.

#### One-Time Setup
```bash
# Install yalc globally
yarn global add yalc

# Ensure yalc is in PATH (add to ~/.zshrc or ~/.bashrc)
export PATH="$HOME/.yarn/bin:$PATH"

# Reload shell
source ~/.zshrc  # or source ~/.bashrc
```

#### Publishing Workflow
```bash
# 1. Build and publish to local yalc store
cd /path/to/nostra-contracts/packages/sdk
yarn yalc:publish
# Or manually: yarn build && yalc publish

# 2. In your consuming project (e.g., nostra-server)
cd /path/to/nostra-server
yalc add @nostra-dev/sdk
yarn install

# 3. After making changes to SDK
cd /path/to/nostra-contracts/packages/sdk
yarn yalc:push  # Auto-updates all projects using this package
# Or manually: yarn build && yalc push

# 4. To remove yalc link (switch back to npm version)
cd /path/to/nostra-server
yalc remove @nostra-dev/sdk
yarn install
```

#### Advantages of yalc
- ✅ No symlink issues (unlike `yarn link`)
- ✅ Works perfectly with monorepos
- ✅ Handles peer dependencies correctly
- ✅ Easy updates with `yalc push`
- ✅ Multiple projects can use the same yalc package

### Method 2: Publishing to npm Registry (Production)

Publish the SDK to npm for production use and team collaboration.

#### Prerequisites
```bash
# 1. Ensure you're logged in to npm
npm login

# 2. Verify organization access
npm org ls nostra-dev
# Should list your username

# 3. Verify package.json settings
# - name: "@nostra-dev/sdk"
# - version: Update according to semver
# - files: ["dist", "README.md", "deployments.json"]
```

#### Publishing Workflow with npm (Alternative)
```bash
cd /path/to/nostra-contracts/packages/sdk

# Manual workflow using npm commands directly
npm version patch  # Update version: 1.0.0 -> 1.0.1
yarn build         # Build the package
npm publish --access public  # Publish to npm

# For private packages (requires paid plan)
npm publish --access restricted

# Verify publication
yarn info @nostra-dev/sdk
```

#### Publishing Workflow with yarn
```bash
cd /path/to/nostra-contracts/packages/sdk

# Quick release (recommended - combines version, build, publish)
yarn release:patch  # 1.0.0 -> 1.0.1 (bug fixes)
yarn release:minor  # 1.0.0 -> 1.1.0 (new features)
yarn release:major  # 1.0.0 -> 2.0.0 (breaking changes)

# Manual workflow (step-by-step)
yarn version --patch  # Update version
yarn build            # Build the package
yarn publish --access public  # Publish to npm

# For private packages (requires paid plan)
yarn publish --access restricted

# Verify publication
yarn info @nostra-dev/sdk
```

#### Inspecting Package Before Publishing
```bash
# View what files will be included (dry run - no tarball created)
npm pack --dry-run  # yarn doesn't have dry-run for pack

# Create actual tarball for inspection
yarn pack  # Creates nostra-dev-sdk-v1.0.0.tgz
tar -tzf *.tgz  # List contents of tarball

# Test publish without actually publishing
npm publish --dry-run  # yarn doesn't support --dry-run
```

#### Post-Publication
```bash
# View published package info
yarn info @nostra-dev/sdk

# View all published versions
yarn info @nostra-dev/sdk versions

# Package will be available at:
# https://www.npmjs.com/package/@nostra-dev/sdk

# Users can install with:
yarn add @nostra-dev/sdk
```

#### Version Guidelines
Follow [Semantic Versioning](https://semver.org/):
- **PATCH** (1.0.x): Bug fixes, documentation updates
- **MINOR** (1.x.0): New features, backward compatible
- **MAJOR** (x.0.0): Breaking changes, API changes

## Development Workflow

### For Monorepo Development
```bash
# Build SDK after contract changes
yarn compile  # Compiles contracts and updates typechain-types
yarn sdk:build  # Builds SDK with latest ABIs

# Validate SDK addresses
yarn validate:sdk  # Ensures SDK reads correct addresses from deployments.json
```

### For External Project Development (yalc)
```bash
# In nostra-contracts
cd packages/sdk
yarn build && yalc push

# Changes automatically propagate to all yalc-linked projects
```

### Verifying SDK Package Addresses
```bash
# List all addresses stored in the SDK
cd packages/sdk
yarn list:addresses

# This shows:
# - All networks and their chain IDs
# - Contract addresses for each network
# - Networks with deployments vs empty networks
# - Summary statistics
```

This SDK is automatically generated and published as part of the contract deployment process. The ABIs and contract addresses are always in sync with the deployed contracts.

## License

MIT
