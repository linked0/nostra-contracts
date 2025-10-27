# Nostra Prediction Market

A decentralized prediction market platform based on the Polymarket CTF Exchange implementation.

## Overview

This project implements a prediction market system using the Conditional Tokens Framework (CTF), allowing users to create and trade on binary and multiple-choice prediction markets. The system is built on top of the proven Polymarket CTF Exchange architecture.

**This is a monorepo** containing both the smart contracts and the TypeScript SDK for easy integration.

## Features

- **Binary Markets**: Yes/No prediction markets
- **Multiple Choice Markets**: Markets with 3+ possible outcomes
- **Non-Custodial Trading**: Users maintain control of their funds
- **CTF Integration**: Built on the Conditional Tokens Framework
- **Resolution Oracle**: Decentralized market resolution system
- **Gas Optimized**: Efficient smart contract design
- **TypeScript SDK**: Type-safe SDK for contract interactions

## Project Structure

This repository is organized as a **yarn workspace monorepo**:

```
nostra-contracts/
├── packages/
│   ├── contracts/          # Smart contracts package (@nostra/contracts)
│   │   ├── contracts/      # Solidity contracts
│   │   │   ├── core/       # Core business logic
│   │   │   ├── oracle/     # Resolution system
│   │   │   ├── interfaces/ # Contract interfaces
│   │   │   └── mocks/      # Test contracts
│   │   ├── test/           # Test suites
│   │   │   ├── unit/       # Unit tests
│   │   │   └── integration/ # Integration tests
│   │   ├── scripts/        # Deployment scripts
│   │   └── package.json
│   │
│   └── sdk/                # TypeScript SDK package (@nostra/sdk)
│       ├── src/
│       │   ├── generated/  # Auto-generated addresses & ABIs
│       │   ├── utils/      # Helper functions
│       │   └── index.ts
│       └── package.json
│
├── docs/                   # Documentation
├── package.json            # Root package.json (with workspaces)
└── yarn.lock               # Yarn lockfile
```

### Packages

- **@nostra/contracts** - Smart contracts, tests, and deployment scripts (private)
- **@nostra/sdk** - TypeScript SDK for contract interactions (publishable to npm)

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn 1.22+ (recommended) or npm
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd nostra-contracts
```

2. Install dependencies:
```bash
yarn install
```

3. Set up environment variables:
```bash
# Copy the example .env file
cp .env.example .env

# Edit .env and add your configuration
# For local development, you can leave the contract addresses empty
# They will be automatically filled when you deploy
```

4. Compile contracts:
```bash
yarn compile
```

### Development Commands

From the root directory:

```bash
# Compile smart contracts
yarn compile

# Run all tests
yarn test

# Run unit tests only
yarn test:unit

# Run integration tests
yarn test:integration

# Build SDK
yarn sdk:build

# Watch mode for SDK development
yarn sdk:dev

# Deploy to local network
yarn deploy:local

# Clean build artifacts
yarn clean
```

### Package-Specific Commands

You can also run commands in specific packages:

```bash
# Run tests in contracts package
yarn workspace @nostra/contracts test

# Build SDK package
yarn workspace @nostra/sdk build
```

## Testing

### Integration Test: Complete Market Flow

The integration test (`packages/contracts/test/integration/MarketFlow.test.ts`) simulates a **complete prediction market lifecycle** to verify the entire system works correctly.

**🔄 Complete Market Flow:**
1. **Market Creation** - Creator creates a binary prediction market
2. **Trading Simulation** - Traders split collateral into YES/NO tokens
3. **Market Resolution** - Oracle resolves the market outcome
4. **Token Redemption** - Winners redeem their tokens for profit

**📊 Test Scenarios Include:**
- Basic market flow (Binary: Bitcoin $100k)
- Multiple choice markets (Fed rate decisions with 6 outcomes)
- Sports markets (4 outcomes with hedging strategies)
- **Polymarket-style grouped markets** (4 separate binary markets)

**🧪 What the Tests Verify:**
- ✅ Market creation and token generation
- ✅ Token trading and position splitting
- ✅ Resolution process with dispute period
- ✅ Winner rewards and loser penalties
- ✅ Complete token redemption
- ✅ Market cancellation flow
- ✅ Dispute resolution flow
- ✅ Cross-market hedging strategies

Run the integration tests:
```bash
yarn test:integration
```

## Using the SDK

### Installation

```bash
npm install @nostra/sdk
# or
yarn add @nostra/sdk
```

### Basic Usage

```typescript
import { ethers } from 'ethers';
import {
  Network,
  getMarketFactory,
  getConditionalTokens,
} from '@nostra/sdk';

// Connect to a provider
const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
const signer = new ethers.Wallet('PRIVATE_KEY', provider);

// Get contract instances
const marketFactory = getMarketFactory(Network.POLYGON, signer);
const conditionalTokens = getConditionalTokens(Network.POLYGON, signer);

// Create a market
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

See `packages/sdk/README.md` for full SDK documentation.

## Architecture

### Core Contracts

- **MarketFactory**: Creates and manages prediction markets
- **ResolutionOracle**: Handles market resolution and dispute resolution
- **CTFExchange**: Facilitates trading of outcome tokens (based on Polymarket)
- **ConditionalTokens**: ERC1155-based conditional tokens (CTF standard)

### Monorepo Benefits

- **Atomic Updates**: Contracts and SDK always in sync
- **Easy to Extend**: Add new packages (subgraph, CLI, docs) easily
- **Simplified CI/CD**: Single deployment pipeline
- **Type Safety**: Full TypeScript support across packages

See `SDK_ARCHITECTURE.md` for detailed architecture documentation.

## Adding New Packages

To add a new sub-project (e.g., subgraph, CLI, documentation):

```bash
# Create package directory
mkdir -p packages/new-package

# Create package.json
cat > packages/new-package/package.json <<EOF
{
  "name": "@nostra/new-package",
  "version": "1.0.0",
  "dependencies": {
    "@nostra/sdk": "workspace:*"
  }
}
EOF
```

The package is automatically included in the workspace and can use other packages via `workspace:*` protocol.

## Local Development

### Environment Variables & Deployment Tracking

The project uses **separate files** for secrets and deployment artifacts:

#### `.env` - Secrets & Configuration Only
```bash
# Private keys, RPC URLs, API keys
NETWORK=localhost
PRIVATE_KEY=0x...
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGONSCAN_API_KEY=your_api_key
BSCSCAN_API_KEY=your_api_key
```

#### `deployments.json` - Contract Addresses
```json
{
  "localhost": {
    "chainId": 31337,
    "contracts": {
      "ConditionalTokens": "0x5FbDB...",
      "MarketFactory": "0xe7f17...",
      "CTFExchange": "0x9fE46...",
      "ResolutionOracle": "0xCf7Ed...",
      "MockUSDC": "0xDc64a..."
    }
  },
  "polygon": { ... },
  "bsc": { ... }
}
```

**Why separate files?**
- `.env` contains **secrets** (never commit!)
- `deployments.json` contains **public addresses** (can be committed)
- Clean separation of concerns
- Follows industry best practices

**Supported Networks:**
- Localhost (Hardhat) - Chain ID: 31337
- Polygon Mainnet - Chain ID: 137
- Polygon Amoy Testnet - Chain ID: 80002
- BSC Mainnet - Chain ID: 56
- BSC Testnet - Chain ID: 97

**How it works:**
1. Deploy contracts using deployment scripts
2. Addresses are automatically saved to `deployments.json`
3. SDK reads addresses from `deployments.json` at runtime
4. Always in sync! ✅

### Deployment Workflow

#### Local Development

1. Start local Hardhat network:
```bash
npx hardhat node
```

2. Deploy contracts locally:
```bash
yarn deploy:local
# or
npx hardhat run packages/contracts/scripts/deploy/deploy-local.ts --network localhost
```

3. Addresses are automatically written to `deployments.json`
4. SDK automatically reads from `deployments.json` - no manual updates needed!

#### Testnet/Mainnet Deployment

1. Configure your `.env` file:
```bash
cp .env.example .env
# Add your PRIVATE_KEY and API keys
```

2. Deploy to target network:
```bash
# Polygon Amoy Testnet
yarn deploy:polygon-amoy

# Polygon Mainnet
yarn deploy:polygon

# BSC Testnet
yarn deploy:bsc-testnet

# BSC Mainnet
yarn deploy:bsc
```

Or using npx directly:
```bash
npx hardhat run packages/contracts/scripts/deploy/deploy.ts --network polygonAmoy
npx hardhat run packages/contracts/scripts/deploy/deploy.ts --network polygon
npx hardhat run packages/contracts/scripts/deploy/deploy-bsc-testnet.ts --network bscTestnet
npx hardhat run packages/contracts/scripts/deploy/deploy-bsc.ts --network bsc
```

3. Verify contracts (mainnets only):
```bash
# Follow the verification commands shown after deployment
npx hardhat verify --network polygon <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

4. Commit `deployments.json` to your repository:
```bash
git add deployments.json
git commit -m "Deploy contracts to <network>"
```

## Security

- **Audited Code**: Based on audited Polymarket implementation
- **Reentrancy Protection**: All external calls protected
- **Access Control**: Proper role-based permissions
- **Input Validation**: Comprehensive parameter validation

## Reference Implementations

This project is based on:

1. **Polymarket CTF Exchange** - Production-ready exchange implementation
2. **Conditional Tokens Framework** - Standard for outcome tokens

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Support

For questions and support, please open an issue on GitHub.
