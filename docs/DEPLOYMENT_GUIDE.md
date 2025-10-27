# Deployment Guide

Complete guide for deploying Nostra Prediction Market contracts.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [File Structure](#file-structure)
- [Local Development](#local-development)
- [Testnet Deployment](#testnet-deployment)
- [Mainnet Deployment](#mainnet-deployment)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)

## Overview

The Nostra deployment system uses two separate files:

### `.env` - Secrets Only
Contains private keys, RPC URLs, and API keys. **Never commit this file!**

```bash
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGONSCAN_API_KEY=YOUR_API_KEY
```

### `deployments.json` - Public Addresses
Contains deployed contract addresses. **This file should be committed!**

```json
{
  "polygon": {
    "chainId": 137,
    "contracts": {
      "ConditionalTokens": "0x...",
      "MarketFactory": "0x...",
      "CTFExchange": "0x...",
      "ResolutionOracle": "0x..."
    }
  }
}
```

## Prerequisites

### Required Tools

- Node.js 18+
- Yarn 1.22+
- Git

### Required Accounts

1. **Deployer Wallet**: Funded wallet for paying gas fees
2. **Block Explorer API Keys**: For contract verification
   - Polygonscan API key (for Polygon)
   - BSCScan API key (for BSC)

## File Structure

```
nostra-contracts/
├── .env                           # Secrets (gitignored)
├── .env.example                   # Template
├── deployments.json               # Contract addresses (committed)
├── packages/
│   ├── contracts/
│   │   └── scripts/
│   │       ├── deploy/
│   │       │   ├── deploy-local.ts    # Local deployment
│   │       │   └── deploy.ts          # Network deployment
│   │       └── utils/
│   │           └── deployment-manager.ts  # Helper functions
│   └── sdk/
│       └── src/
│           └── generated/
│               └── addresses.ts       # Reads deployments.json
```

## Local Development

### 1. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# For localhost, use Hardhat's test account (optional)
# PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 2. Start Local Node

```bash
# Terminal 1: Start Hardhat node
npx hardhat node
```

### 3. Deploy Locally

```bash
# Terminal 2: Deploy contracts
yarn deploy:local

# Or using npx
npx hardhat run packages/contracts/scripts/deploy/deploy-local.ts --network localhost
```

### 4. Verify Deployment

Check `deployments.json` - it should be updated with localhost addresses:

```json
{
  "localhost": {
    "chainId": 31337,
    "contracts": {
      "ConditionalTokens": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      "MarketFactory": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      ...
    }
  }
}
```

## Testnet Deployment

### Supported Testnets

- **Polygon Amoy** (Chain ID: 80002)
- **BSC Testnet** (Chain ID: 97)

### 1. Get Testnet Funds

**Polygon Amoy:**
- Faucet: https://faucet.polygon.technology/
- Request MATIC tokens

**BSC Testnet:**
- Faucet: https://testnet.bnbchain.org/faucet-smart
- Request tBNB tokens

### 2. Configure Environment

```bash
# Edit .env file
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
```

### 3. Deploy to Testnet

```bash
# Polygon Amoy
npx hardhat run packages/contracts/scripts/deploy/deploy.ts --network polygonAmoy

# BSC Testnet
npx hardhat run packages/contracts/scripts/deploy/deploy.ts --network bscTestnet
```

### 4. What Gets Deployed (Testnet)

- ConditionalTokens
- **MockUSDC** (testnet only)
- ResolutionOracle
- MarketFactory
- CTFExchange

## Mainnet Deployment

### Supported Mainnets

- **Polygon** (Chain ID: 137)
- **BSC** (Chain ID: 56)

### 1. Configure Environment

```bash
# Edit .env file
PRIVATE_KEY=0xYOUR_PRIVATE_KEY

# RPC URLs
POLYGON_RPC_URL=https://polygon-rpc.com
BSC_RPC_URL=https://bsc-dataseed.binance.org

# API Keys (for verification)
POLYGONSCAN_API_KEY=YOUR_API_KEY
BSCSCAN_API_KEY=YOUR_API_KEY
```

### 2. Fund Deployer Wallet

Ensure your wallet has enough native tokens for gas:
- **Polygon**: ~5-10 MATIC
- **BSC**: ~0.1-0.2 BNB

### 3. Deploy to Mainnet

```bash
# Polygon Mainnet
npx hardhat run packages/contracts/scripts/deploy/deploy.ts --network polygon

# BSC Mainnet
npx hardhat run packages/contracts/scripts/deploy/deploy.ts --network bsc
```

### 4. What Gets Deployed (Mainnet)

- ConditionalTokens
- ResolutionOracle (references real USDC)
- MarketFactory (references real USDC)
- CTFExchange (references real USDC)

**Note:** Mainnet deployments use real USDC:
- Polygon: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
- BSC: `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`

## Post-Deployment

### 1. Verify Contracts

The deployment script will output verification commands. Run them:

```bash
# Example for Polygon
npx hardhat verify --network polygon 0xCONTRACT_ADDRESS <CONSTRUCTOR_ARGS>
```

### 2. Commit Deployments

```bash
# Add deployments.json to git
git add deployments.json

# Commit with descriptive message
git commit -m "Deploy contracts to Polygon mainnet"

# Push to repository
git push origin main
```

### 3. Update SDK

If publishing the SDK to npm:

```bash
cd packages/sdk
yarn build
npm publish
```

The SDK will automatically include the updated `deployments.json`.

## Deployment Manager API

The deployment scripts use `deployment-manager.ts` for consistency:

### Writing Deployments

```typescript
import { writeDeployment, DeployedContracts } from '../utils/deployment-manager';

const contracts: DeployedContracts = {
  ConditionalTokens: '0x...',
  MarketFactory: '0x...',
  CTFExchange: '0x...',
  ResolutionOracle: '0x...',
  MockUSDC: '0x...' // Optional
};

// Automatically updates deployments.json
writeDeployment('polygon', 137, contracts);
```

### Reading Deployments

```typescript
import { readNetworkDeployment } from '../utils/deployment-manager';

const deployment = readNetworkDeployment('polygon');
console.log(deployment.contracts.MarketFactory); // '0x...'
```

### Display Helper

```typescript
import { displayDeployment } from '../utils/deployment-manager';

// Pretty-prints deployment info
displayDeployment('polygon', contracts);
```

## Troubleshooting

### "deployments.json not found"

**Solution:** The file should exist in project root. Create it if missing:

```bash
# From project root
echo '{}' > deployments.json
```

### "Insufficient funds for gas"

**Solution:** Fund your deployer wallet with native tokens:
- Get testnet funds from faucets
- Buy mainnet tokens from exchanges

### "Network not configured"

**Solution:** Check `hardhat.config.ts` has the network defined:

```typescript
networks: {
  polygon: {
    url: process.env.POLYGON_RPC_URL,
    accounts: [process.env.PRIVATE_KEY],
    chainId: 137
  }
}
```

### "SDK not reading new addresses"

**Solution:**
1. Verify `deployments.json` is updated
2. Rebuild SDK: `yarn workspace @nostra/sdk build`
3. If using published SDK, republish with new deployments.json

### "Contract verification failed"

**Solution:**
1. Verify API key is correct in `.env`
2. Wait 30 seconds after deployment before verifying
3. Ensure constructor arguments match exactly

## Security Best Practices

### ✅ DO

- Keep `.env` file gitignored
- Use hardware wallet for mainnet deployments
- Verify constructor arguments carefully
- Test on testnet before mainnet
- Commit `deployments.json` to version control
- Use API keys with IP restrictions

### ❌ DON'T

- Never commit `.env` file
- Never use the same private key across networks
- Never share private keys
- Never skip testnet testing
- Never deploy without sufficient gas buffer

## Network Information

| Network | Chain ID | RPC URL | Explorer | Native Token |
|---------|----------|---------|----------|--------------|
| Localhost | 31337 | http://127.0.0.1:8545 | - | ETH |
| Polygon | 137 | https://polygon-rpc.com | polygonscan.com | MATIC |
| Polygon Amoy | 80002 | https://rpc-amoy.polygon.technology | amoy.polygonscan.com | MATIC |
| BSC | 56 | https://bsc-dataseed.binance.org | bscscan.com | BNB |
| BSC Testnet | 97 | https://data-seed-prebsc-1-s1.binance.org:8545 | testnet.bscscan.com | tBNB |

## Support

For issues or questions:
- Open an issue on GitHub
- Check existing documentation
- Review deployment logs for errors
