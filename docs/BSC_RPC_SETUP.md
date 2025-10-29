# BSC RPC Setup for Event Queries

## The Problem

The BSC public RPC endpoints (`https://data-seed-prebsc-1-s1.binance.org:8545`) have **extremely strict rate limits** that block almost all event queries via `eth_getLogs`. Even querying a single block will trigger `"limit exceeded"` errors.

This prevents the `market:prices` script from reading trade history from `OrderFilled` events.

## The Solution

Use **Alchemy** or **Infura** RPC endpoints, which provide much better rate limits for event queries.

### Option 1: Alchemy (Recommended)

1. **Sign up for Alchemy**:
   - Go to https://www.alchemy.com/
   - Create a free account
   - Create a new app and select "BNB Smart Chain Testnet"

2. **Get your API key**:
   - Copy the HTTPS endpoint from your app dashboard
   - Example: `https://bnb-testnet.g.alchemy.com/v2/YOUR_API_KEY`

3. **Update your .env file**:
   ```bash
   BSC_TESTNET_RPC_URL=https://bnb-testnet.g.alchemy.com/v2/YOUR_API_KEY
   ```

### Option 2: Infura

1. **Sign up for Infura**:
   - Go to https://www.infura.io/
   - Create a free account
   - Create a new project

2. **Get your API key**:
   - Enable "BNB Smart Chain" in project settings
   - Copy the BSC Testnet endpoint
   - Example: `https://bsc-testnet.infura.io/v3/YOUR_API_KEY`

3. **Update your .env file**:
   ```bash
   BSC_TESTNET_RPC_URL=https://bsc-testnet.infura.io/v3/YOUR_API_KEY
   ```

## Testing the Fix

After updating your `.env` file:

```bash
# Test that event queries work
yarn market:prices

# You should now see actual prices from your trades:
# YES: $0.48 (48%)  ← from last trade at $0.48
# NO:  $0.52 (52%)  ← complement price
```

## What About Production?

For **mainnet (BSC or Polygon)**, you MUST use Alchemy/Infura:

```bash
# .env for mainnet
BSC_RPC_URL=https://bnb-mainnet.g.alchemy.com/v2/YOUR_API_KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

## Technical Details

### Why Public RPCs Block Event Queries

- Event queries (`eth_getLogs`) are **expensive operations** for RPC providers
- They require scanning blockchain history across many blocks
- Public endpoints severely rate-limit or block these to prevent abuse
- Alchemy/Infura provide **much higher limits** for paid/registered users

### Rate Limit Comparison

| Provider | Max Block Range | Notes |
|----------|----------------|-------|
| BSC Public RPC | ~0-1 blocks | Effectively unusable for events |
| Alchemy Free | ~2000 blocks | Good for development |
| Infura Free | ~2000 blocks | Good for development |
| Alchemy/Infura Paid | ~10000+ blocks | Production-ready |

### Alternative: Use an Indexer

For production applications, consider using:
- **The Graph** (subgraphs for indexed events)
- **Moralis** (Web3 data indexer)
- **Covalent** (blockchain API)
- **Custom indexer** (listen to events and store in database)

These provide **instant queries** without scanning blockchain history.

## Troubleshooting

### Still seeing "limit exceeded"?

1. **Verify .env is loaded**:
   ```bash
   # From root directory
   cat .env | grep BSC_TESTNET_RPC_URL
   ```

2. **Check your API key**:
   - Make sure you copied the full URL including the API key
   - Try creating a new API key if the current one doesn't work

3. **Test RPC directly**:
   ```bash
   curl -X POST "YOUR_RPC_URL" \
     -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
   ```

### Trades not showing up?

The trades ARE on-chain! Check on BSCScan:
- Go to https://testnet.bscscan.com/
- Search for your CTFExchange address: `0x38BcD7680a2FDA57EfE6307dE28202D8Ea561D99`
- Look for recent transactions with `OrderFilled` events
- This confirms the trades executed successfully

## Summary

✅ **Trades executed successfully** - they're on-chain!
❌ **BSC public RPC** - blocks event queries
✅ **Alchemy/Infura** - provides working event queries
✅ **Updated .env** - solves the problem immediately
