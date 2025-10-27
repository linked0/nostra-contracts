# Interaction Scripts

Scripts for interacting with deployed Nostra Prediction Market contracts.

## Overview

These scripts demonstrate the complete lifecycle of a prediction market:

1. **Create Market** - Create a new binary prediction market
2. **Place Bet** - Split collateral into outcome tokens (betting)
3. **Resolve Market** - Resolve the market outcome (resolver only)
4. **Redeem Tokens** - Claim winnings from resolved markets

## Prerequisites

- Deployed contracts (run deployment first)
- Testnet tokens (for testnets)
- PRIVATE_KEY in `.env`

## Quick Start

### Option 1: Sequential Test (Recommended)

Run all steps in sequence with clear separation and pauses:

```bash
# BSC Testnet
npx hardhat run scripts/interact/sequential-test.ts --network bscTestnet

# Localhost
npx hardhat run scripts/interact/sequential-test.ts --network localhost
```

**Features:**
- ✅ Clear step separation
- ✅ 3-second pause between steps
- ✅ Detailed logging for each action
- ✅ Shows balances before/after each step
- ✅ Perfect for learning and debugging

### Option 2: Full Demo (Fast)

Run the complete lifecycle in one script without pauses:

```bash
# BSC Testnet
npx hardhat run scripts/interact/full-demo.ts --network bscTestnet

# Localhost
npx hardhat run scripts/interact/full-demo.ts --network localhost
```

**Features:**
- ✅ Fast execution (~30 seconds)
- ✅ All steps automated
- ✅ Good for quick validation

Both scripts:
1. Create a market
2. Place a 100 USDC bet on YES
3. Resolve the market (YES wins)
4. Redeem tokens for profit

### Option 3: Step-by-Step (Manual)

Run each step individually for maximum control:

#### Step 1: Create Market

```bash
npx hardhat run scripts/interact/01-create-market.ts --network bscTestnet
```

**Output:**
```
Condition ID: 0xabc123...
YES Token ID: 12345...
NO Token ID: 67890...
```

**Save these values!** You'll need them for the next steps.

#### Step 2: Place Bet

```bash
# Set environment variables from Step 1
export CONDITION_ID="0xabc123..."
export YES_TOKEN_ID="12345..."
export NO_TOKEN_ID="67890..."

# Run betting script
npx hardhat run scripts/interact/02-place-bet.ts --network bscTestnet
```

**What happens:**
- Script checks your USDC balance
- Mints 1000 USDC if you have none
- Bets 100 USDC by splitting it into YES/NO tokens
- You now have 100 YES tokens and 100 NO tokens

#### Step 3: Resolve Market

```bash
# Use same CONDITION_ID from Step 1
export CONDITION_ID="0xabc123..."

# Run resolution script (resolver only!)
npx hardhat run scripts/interact/03-resolve-market.ts --network bscTestnet
```

**What happens:**
- Checks if you're a resolver
- Resolves the market to YES (can be changed in script)
- Market is now finalized

**Note:** Only resolvers can run this step!

#### Step 4: Redeem Tokens

```bash
# Use same CONDITION_ID
export CONDITION_ID="0xabc123..."

# Run redemption script
npx hardhat run scripts/interact/04-redeem-tokens.ts --network bscTestnet
```

**What happens:**
- Redeems your outcome tokens
- If you bet on the winning outcome, you get USDC back
- If you lost, your tokens are worthless

## Understanding the Scripts

### 01-create-market.ts

**Creates a binary prediction market**

Key parameters:
- `questionId` - Unique ID for the question
- `question` - Market question text
- `endTime` - When trading ends
- `resolutionTime` - When market can be resolved

Output:
- Condition ID (needed for other scripts)
- YES/NO Token IDs

### 02-place-bet.ts

**Places a bet by splitting collateral**

How it works:
1. Approves ConditionalTokens to spend USDC
2. Calls `splitPosition()` to convert USDC into outcome tokens
3. You receive equal amounts of YES and NO tokens

Why both tokens?
- You can sell the one you don't want
- Or keep both and profit from price movements
- CTF always gives you all outcome tokens when splitting

### 03-resolve-market.ts

**Resolves market to final outcome**

Requirements:
- Must be a resolver
- Market must be past endTime

Payout array:
- `[1, 0]` = NO wins (NO gets 1, YES gets 0)
- `[0, 1]` = YES wins (NO gets 0, YES gets 1)

### 04-redeem-tokens.ts

**Redeems tokens for collateral**

How it works:
1. Checks if market is resolved
2. Calls `redeemPositions()` with your tokens
3. Winning tokens → USDC
4. Losing tokens → nothing

Example:
- You have 100 YES and 100 NO tokens
- Market resolves YES
- You redeem → get 100 USDC (from YES tokens)
- NO tokens are burned (worthless)

## Contract Addresses

Scripts automatically read from `deployments.json`:

```json
{
  "bscTestnet": {
    "chainId": 97,
    "contracts": {
      "ConditionalTokens": "0x...",
      "MarketFactory": "0x...",
      "ResolutionOracle": "0x...",
      "MockUSDC": "0x..."
    }
  }
}
```

No need to hardcode addresses!

## Testnet Testing

### BSC Testnet Setup

1. Get testnet BNB:
   ```
   https://testnet.bnbchain.org/faucet-smart
   ```

2. Deploy contracts:
   ```bash
   yarn deploy:bsc-testnet
   ```

3. Run scripts:
   ```bash
   npx hardhat run scripts/interact/full-demo.ts --network bscTestnet
   ```

### Localhost Testing

1. Start Hardhat node:
   ```bash
   npx hardhat node
   ```

2. Deploy (in another terminal):
   ```bash
   yarn deploy:local
   ```

3. Run scripts:
   ```bash
   npx hardhat run scripts/interact/full-demo.ts --network localhost
   ```

## Troubleshooting

### "No accounts available"

**Problem:** PRIVATE_KEY not set

**Solution:**
```bash
echo "PRIVATE_KEY=0xYourKeyHere" >> .env
```

### "Not a resolver"

**Problem:** Your account can't resolve markets

**Solution:**
- For testnet: Deployer is added as resolver automatically
- For mainnet: Contact protocol admin to add you as resolver

### "Market not resolved yet"

**Problem:** Trying to redeem before resolution

**Solution:**
- Run `03-resolve-market.ts` first
- Or wait for official resolver to resolve

### "No deployment found"

**Problem:** Contracts not deployed on this network

**Solution:**
```bash
# Deploy first
yarn deploy:bsc-testnet
# or
yarn deploy:local
```

### "Insufficient balance"

**Problem:** Not enough USDC

**Solution:**
- Testnet: Script auto-mints USDC
- Mainnet: Get real USDC first

## Customization

### Change bet amount

Edit `02-place-bet.ts`:
```typescript
const betAmount = ethers.parseUnits("100", 6); // Change 100 to your amount
```

### Change resolution outcome

Edit `03-resolve-market.ts`:
```typescript
const winningOutcome = 1; // 0 = NO, 1 = YES
```

### Create multiple choice market

Modify `01-create-market.ts`:
```typescript
// Instead of createBinaryMarket, use:
await marketFactory.createMultipleChoiceMarket(
  questionId,
  question,
  description,
  category,
  4, // Number of outcomes
  endTime,
  resolutionTime
);
```

## Next Steps

After running these scripts, you can:

1. **Build a frontend** - Use the SDK to interact from web app
2. **Create more markets** - Run create-market multiple times
3. **Implement trading** - Add exchange functionality (CTFExchange)
4. **Add automation** - Auto-resolve markets with oracles

## Support

Issues? Check:
- Deployment was successful
- Network is correct
- PRIVATE_KEY is set
- You have testnet tokens

For more help, see main README.md or open an issue on GitHub.
