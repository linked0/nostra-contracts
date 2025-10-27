# Testing Guide - Deployed Contracts

Step-by-step guide for testing your deployed Nostra Prediction Market contracts.

> **Note:** This is a monorepo project. All commands should be run from the **project root** directory unless otherwise specified. The `.env` file and `deployments.json` are located at the root level.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [BSC Testnet Testing](#bsc-testnet-testing)
- [Localhost Testing](#localhost-testing)
- [Step-by-Step Testing](#step-by-step-testing)
- [Verification Checklist](#verification-checklist)
- [Troubleshooting](#troubleshooting)

## Overview

This guide walks you through testing all major functionality of your deployed contracts:

1. ✅ Market Creation
2. ✅ Betting/Position Splitting
3. ✅ Market Resolution
4. ✅ Token Redemption

## Prerequisites

### Required

- ✅ Contracts deployed to target network
- ✅ `.env` file configured with `PRIVATE_KEY`
- ✅ Network RPC URL configured
- ✅ Test funds (for testnet: testnet BNB)

### Check Deployment Status

```bash
# View deployed addresses
cat deployments.json

# Should see your network with contract addresses
# Example for BSC Testnet:
{
  "bscTestnet": {
    "chainId": 97,
    "contracts": {
      "ConditionalTokens": "0x4f4F70fCa7405f0272ff3F30b3188f67Add14d14",
      "MarketFactory": "0x14faCA215eb6Ae1F92DC0850EfbEB983419472Da",
      "ResolutionOracle": "0x697752AB1804974DcFB6623C28b9B2ac2130ebd2",
      "MockUSDC": "0x091e6a020985FBE1D61f965cD4B4058509f613Fd"
    }
  }
}
```

## BSC Testnet Testing

### Step 0: Setup

```bash
# 1. Navigate to project root (if not already there)
cd nostra-contracts

# 2. Check your .env file
cat .env | grep PRIVATE_KEY
# Should output: PRIVATE_KEY=0x...

# 3. Get testnet BNB (if needed)
# Visit: https://testnet.bnbchain.org/faucet-smart
# Enter your wallet address
```

### Step 1: Run Full Demo (Quick Test)

**Purpose:** Verify all contracts work together in one automated flow.

```bash
# Run from project root
npx hardhat run packages/contracts/scripts/interact/full-demo.ts --network bscTestnet
```

**Expected Output:**
```
🎬 Starting Full Market Lifecycle Demo
════════════════════════════════════════════════════════════
Network: bscTestnet
Chain ID: 97
════════════════════════════════════════════════════════════
Account: 0xYourAddress...

📊 STEP 1: Creating Market
────────────────────────────────────────────────────────────
Question: Will BNB reach $1000 by end of 2025?
Creating market...
✅ Market created!
Condition ID: 0xabc123...
YES Token: 12345...
NO Token: 67890...

💰 STEP 2: Placing Bet
────────────────────────────────────────────────────────────
USDC Balance: 10000.0 USDC
Betting 100.0 USDC on YES
✅ Bet placed!
YES Tokens: 100.0
NO Tokens: 100.0

⚖️  STEP 3: Resolving Market
────────────────────────────────────────────────────────────
You are a resolver ✅
Resolving to YES (outcome 1)...
✅ Market resolved!

💸 STEP 4: Redeeming Tokens
────────────────────────────────────────────────────────────
USDC Before: 9900.0 USDC
Redeeming tokens...
✅ Redeemed!
USDC After: 10000.0 USDC
USDC Gained: 100.0 USDC

🎉 DEMO COMPLETE!
════════════════════════════════════════════════════════════
🏆 Final Balance: 10000.0 USDC
✅ All steps completed successfully!
```

**✅ PASS Criteria:**
- Market created without errors
- Bet placed successfully (got YES/NO tokens)
- Market resolved (you're a resolver)
- Tokens redeemed (got USDC back)

**❌ FAIL Indicators:**
- "No deployment found" → Deploy contracts first
- "Not a resolver" → Expected, continue to manual steps
- "Insufficient balance" → Get testnet BNB
- "Transaction reverted" → Check error message

### Step 2: Test Individual Steps

If full demo works, your contracts are functional! For detailed testing, run individual scripts:

#### Test 1: Market Creation

```bash
npx hardhat run packages/contracts/scripts/interact/01-create-market.ts --network bscTestnet
```

**What to Check:**
- ✅ Transaction succeeds
- ✅ Condition ID returned
- ✅ YES/NO token IDs returned
- ✅ Market appears in MarketFactory

**Save the Output:**
```bash
# Copy these values from output
export CONDITION_ID="0xabc123..."
export YES_TOKEN_ID="12345..."
export NO_TOKEN_ID="67890..."
```

#### Test 2: Placing Bets

```bash
npx hardhat run packages/contracts/scripts/interact/02-place-bet.ts --network bscTestnet
```

**What to Check:**
- ✅ USDC balance shown (or minted)
- ✅ USDC approved successfully
- ✅ Position split successfully
- ✅ Received equal YES/NO tokens
- ✅ Token balances match bet amount

**Verify On-Chain:**
```bash
# Check your outcome token balances
npx hardhat console --network bscTestnet
```

In console:
```javascript
const ct = await ethers.getContractAt("ConditionalTokens", "0x4f4F70fCa7405f0272ff3F30b3188f67Add14d14");
const [signer] = await ethers.getSigners();
const yesBalance = await ct.balanceOf(signer.address, process.env.YES_TOKEN_ID);
console.log("YES Balance:", ethers.formatUnits(yesBalance, 6));
```

#### Test 3: Market Resolution

```bash
npx hardhat run packages/contracts/scripts/interact/03-resolve-market.ts --network bscTestnet
```

**What to Check:**
- ✅ You are confirmed as resolver
- ✅ Market details displayed
- ✅ Resolution transaction succeeds
- ✅ Payout structure set correctly

**Verify Resolution:**
```bash
npx hardhat console --network bscTestnet
```

In console:
```javascript
const ct = await ethers.getContractAt("ConditionalTokens", "0x4f4F70fCa7405f0272ff3F30b3188f67Add14d14");
const denominator = await ct.payoutDenominator(process.env.CONDITION_ID);
console.log("Payout Denominator:", denominator.toString());
// Should be > 0 if resolved
```

#### Test 4: Token Redemption

```bash
npx hardhat run packages/contracts/scripts/interact/04-redeem-tokens.ts --network bscTestnet
```

**What to Check:**
- ✅ Market is resolved
- ✅ Token balances shown
- ✅ USDC balance before shown
- ✅ Redemption succeeds
- ✅ USDC balance increased
- ✅ Correct payout amount

**Calculate Expected Payout:**
```
If market resolves to YES:
- YES tokens worth: 100 USDC
- NO tokens worth: 0 USDC
- Total payout: 100 USDC

If market resolves to NO:
- YES tokens worth: 0 USDC
- NO tokens worth: 100 USDC
- Total payout: 100 USDC
```

## Localhost Testing

### Step 0: Setup Local Environment

```bash
# Terminal 1: Start Hardhat node
cd nostra-contracts
npx hardhat node --config packages/contracts/hardhat.config.ts

# Keep this running...
```

```bash
# Terminal 2: Deploy contracts (from project root)
cd nostra-contracts
yarn deploy:local

# Output shows deployed addresses
# These are saved to deployments.json automatically
```

### Step 1: Run Full Demo

```bash
# In Terminal 2 (from project root)
npx hardhat run packages/contracts/scripts/interact/full-demo.ts --network localhost
```

**Expected:** Same output as BSC testnet demo.

### Step 2: Advanced Testing

With localhost, you can test edge cases:

#### Test Multiple Markets

```bash
# Run create-market multiple times (from project root)
npx hardhat run packages/contracts/scripts/interact/01-create-market.ts --network localhost
# Each run creates a new market with different question ID
```

#### Test Multiple Users

```bash
# Hardhat provides 20 test accounts
npx hardhat console --network localhost
```

In console:
```javascript
const signers = await ethers.getSigners();
console.log("Account 1:", signers[0].address);
console.log("Account 2:", signers[1].address);

// Test with account 2
const marketFactory = await ethers.getContractAt("MarketFactory", "0x...");
const tx = await marketFactory.connect(signers[1]).createBinaryMarket(...);
```

#### Test Market Cancellation

In console:
```javascript
const marketFactory = await ethers.getContractAt("MarketFactory", "0x...");
await marketFactory.cancelMarket(conditionId);
```

## Step-by-Step Testing

### Complete Manual Test Flow

Follow these steps to thoroughly test your deployment:

#### 1. Pre-Testing Checks

```bash
# ✅ Check deployment file exists (from project root)
cat deployments.json

# ✅ Check you have testnet BNB
# Visit BSCScan testnet and check your address

# ✅ Verify .env has PRIVATE_KEY
cat .env | grep PRIVATE_KEY
```

#### 2. Create First Market

```bash
npx hardhat run packages/contracts/scripts/interact/01-create-market.ts --network bscTestnet

# ✅ SAVE THESE VALUES:
# Condition ID: 0xabc123...
# YES Token ID: 12345...
# NO Token ID: 67890...
```

**Verification:**
- Transaction confirmed on BSCScan
- Gas used: ~300,000-500,000
- Market event emitted

#### 3. Place First Bet

```bash
# Set environment variables from Step 2
export CONDITION_ID="0xabc123..."
export YES_TOKEN_ID="12345..."
export NO_TOKEN_ID="67890..."

# Place bet (from project root)
npx hardhat run packages/contracts/scripts/interact/02-place-bet.ts --network bscTestnet
```

**Verification:**
- USDC approved (check BSCScan for approval tx)
- Position split (check for splitPosition tx)
- You have outcome tokens (check balances)

#### 4. Verify Token Balances

```bash
npx hardhat console --network bscTestnet
```

```javascript
// In console
const ct = await ethers.getContractAt("ConditionalTokens", "YOUR_CT_ADDRESS");
const [signer] = await ethers.getSigners();

// Check YES tokens
const yesBalance = await ct.balanceOf(signer.address, "YES_TOKEN_ID");
console.log("YES:", ethers.formatUnits(yesBalance, 6));

// Check NO tokens
const noBalance = await ct.balanceOf(signer.address, "NO_TOKEN_ID");
console.log("NO:", ethers.formatUnits(noBalance, 6));

// Should both be 100.0
```

#### 5. Resolve Market

```bash
npx hardhat run packages/contracts/scripts/interact/03-resolve-market.ts --network bscTestnet
```

**Verification:**
- Resolution transaction confirmed
- Payout denominator set (check on-chain)
- Market status updated

#### 6. Verify Resolution

```bash
npx hardhat console --network bscTestnet
```

```javascript
const ct = await ethers.getContractAt("ConditionalTokens", "YOUR_CT_ADDRESS");

// Check payout denominator
const denom = await ct.payoutDenominator("CONDITION_ID");
console.log("Denominator:", denom.toString());
// Should be > 0

// Check payout for outcome 0 (NO)
const payout0 = await ct.payoutNumerators("CONDITION_ID", 0);
console.log("NO payout:", payout0.toString());

// Check payout for outcome 1 (YES)
const payout1 = await ct.payoutNumerators("CONDITION_ID", 1);
console.log("YES payout:", payout1.toString());

// If YES won: payout0=0, payout1=1
// If NO won: payout0=1, payout1=0
```

#### 7. Redeem Tokens

```bash
npx hardhat run packages/contracts/scripts/interact/04-redeem-tokens.ts --network bscTestnet
```

**Verification:**
- USDC balance increased
- Outcome tokens burned
- Correct payout amount received

#### 8. Verify Final State

```bash
npx hardhat console --network bscTestnet
```

```javascript
const usdc = await ethers.getContractAt("MockUSDC", "YOUR_USDC_ADDRESS");
const [signer] = await ethers.getSigners();

// Check final USDC balance
const balance = await usdc.balanceOf(signer.address);
console.log("Final USDC:", ethers.formatUnits(balance, 6));

// Check outcome tokens are zero
const ct = await ethers.getContractAt("ConditionalTokens", "YOUR_CT_ADDRESS");
const yesBalance = await ct.balanceOf(signer.address, "YES_TOKEN_ID");
const noBalance = await ct.balanceOf(signer.address, "NO_TOKEN_ID");
console.log("YES tokens left:", ethers.formatUnits(yesBalance, 6)); // Should be 0
console.log("NO tokens left:", ethers.formatUnits(noBalance, 6)); // Should be 0
```

## Verification Checklist

Use this checklist to verify your deployment:

### ✅ Contract Deployment

- [ ] All contracts deployed successfully
- [ ] Addresses saved in `deployments.json`
- [ ] Contracts verified on block explorer (mainnet only)
- [ ] Deployer added as resolver (testnet)

### ✅ Market Creation

- [ ] `createBinaryMarket()` succeeds
- [ ] MarketCreated event emitted
- [ ] Condition ID generated
- [ ] Token IDs calculated correctly
- [ ] Market registered in CTF

### ✅ Position Splitting (Betting)

- [ ] USDC approval works
- [ ] `splitPosition()` succeeds
- [ ] Correct token amounts minted
- [ ] Both YES and NO tokens received
- [ ] USDC balance decreased by bet amount

### ✅ Market Resolution

- [ ] Only resolvers can resolve
- [ ] `resolveCondition()` succeeds
- [ ] Payout numerators set correctly
- [ ] Payout denominator > 0
- [ ] Market status updated

### ✅ Token Redemption

- [ ] `redeemPositions()` succeeds
- [ ] Correct USDC payout
- [ ] Outcome tokens burned
- [ ] Winners get collateral back
- [ ] Losers get nothing

### ✅ Integration

- [ ] Complete flow works end-to-end
- [ ] No transaction reversions
- [ ] Gas costs reasonable
- [ ] Events emitted correctly

## Troubleshooting

### Common Issues

#### Issue: "No deployment found for network"

**Cause:** Contracts not deployed on this network

**Fix:**
```bash
# Deploy first
yarn deploy:bsc-testnet
# or
yarn deploy:local
```

#### Issue: "Cannot read properties of undefined (reading 'address')"

**Cause:** No PRIVATE_KEY in .env

**Fix:**
```bash
echo "PRIVATE_KEY=0xYourPrivateKeyHere" >> .env
```

#### Issue: "insufficient funds for gas"

**Cause:** No testnet BNB

**Fix:**
- Get testnet BNB from faucet
- BSC Testnet: https://testnet.bnbchain.org/faucet-smart

#### Issue: "You are not a resolver"

**Cause:** Your account is not added as resolver

**Fix:**
- **Testnet:** Deployer is auto-added during deployment
- **Check:** Run `npx hardhat console --network bscTestnet`
  ```javascript
  const oracle = await ethers.getContractAt("ResolutionOracle", "ADDRESS");
  const [signer] = await ethers.getSigners();
  const isResolver = await oracle.isResolver(signer.address);
  console.log("Is resolver:", isResolver);
  ```

#### Issue: "Market not resolved yet"

**Cause:** Trying to redeem before resolution

**Fix:**
```bash
# Resolve first
npx hardhat run packages/contracts/scripts/interact/03-resolve-market.ts --network bscTestnet

# Then redeem
npx hardhat run packages/contracts/scripts/interact/04-redeem-tokens.ts --network bscTestnet
```

#### Issue: "Transaction reverted without a reason"

**Cause:** Various (check specific transaction)

**Debug:**
```bash
# Run with verbose errors
npx hardhat run packages/contracts/scripts/interact/full-demo.ts --network bscTestnet --verbose

# Or check on block explorer
# BSC Testnet: https://testnet.bscscan.com/tx/YOUR_TX_HASH
```

### Getting Help

If you're stuck:

1. **Check logs:** Look for specific error messages
2. **Verify deployment:** `cat deployments.json`
3. **Check balances:** Use Hardhat console
4. **Review transactions:** Use block explorer
5. **Read documentation:** See `scripts/interact/README.md`

## Next Steps

After successful testing:

1. **Deploy to mainnet** (when ready)
2. **Build frontend** - Use SDK to interact
3. **Add more markets** - Create different market types
4. **Implement trading** - Add CTFExchange functionality
5. **Set up automation** - Auto-resolve markets

## Testing Best Practices

### For Development

- ✅ Test on localhost first
- ✅ Use small amounts
- ✅ Test all edge cases
- ✅ Verify events emitted
- ✅ Check gas costs

### For Testnet

- ✅ Test complete flow
- ✅ Test with multiple accounts
- ✅ Verify on block explorer
- ✅ Document any issues
- ✅ Test for 24+ hours

### For Mainnet

- ✅ Audit contracts first
- ✅ Use small amounts initially
- ✅ Monitor closely
- ✅ Have rollback plan
- ✅ Verify contracts immediately

## Summary

You've successfully tested your deployment if:

- ✅ All scripts run without errors
- ✅ Markets can be created
- ✅ Bets can be placed
- ✅ Markets can be resolved
- ✅ Tokens can be redeemed
- ✅ Balances are correct
- ✅ Events are emitted
- ✅ Transactions confirm

Your Nostra Prediction Market is ready to use! 🎉
