# World Series MVP Prediction Markets - Polymarket Style

Complete workflow for creating, betting, resolving, and redeeming tokens in Polymarket-style grouped binary markets.

## Overview

This implementation creates **3 separate binary markets** (Polymarket-style), one for each player:

```
Market 1: "Will Shohei Ohtani win World Series MVP?"     → [YES, NO]
Market 2: "Will Vladimir Guerrero Jr. win MVP?"          → [YES, NO]
Market 3: "Will Yoshinobu Yamamoto win MVP?"             → [YES, NO]
```

**Why Polymarket-Style?**
- ✅ Each player has independent YES/NO tokens
- ✅ Direct hedging: Buy YES, later sell to NO (or vice versa)
- ✅ Can bet AGAINST any player by buying NO tokens
- ⚠️ Probabilities may sum to >100% (arbitrage opportunity)

**vs. Traditional Multi-Choice**
- ❌ Single market with 3 outcomes (Ohtani, Guerrero, Yamamoto)
- ❌ No direct YES/NO tokens per player
- ❌ Can't directly hedge on specific player

## Prerequisites

### 1. Environment Setup

Make sure your `.env` file has:

```bash
PRIVATE_KEY=0x...                                          # Your wallet private key
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
BSCSCAN_API_KEY=your_api_key                              # Optional
```

### 2. Deploy Contracts

Deploy contracts to BSC Testnet first:

```bash
yarn deploy:bsc-testnet
```

### 3. Get Test BNB

Get testnet BNB for gas fees from: https://testnet.bnbchain.org/faucet-smart

## Complete Workflow

### Step 1: Create Markets

Creates 3 binary markets, one for each player.

```bash
yarn market:create
```

**Custom resolution time:**
```bash
RESOLUTION_TIME="2025-11-01" yarn market:create
```

**Output Example:**
```
🎉 All World Series MVP Markets Created Successfully!
════════════════════════════════════════════════════════════════════════════════

[1] Shohei Ohtani
    Question: Will Shohei Ohtani win the World Series MVP award?
    Condition ID: 0xabc...
    YES Token ID: 12345...
    NO Token ID:  67890...

[2] Vladimir Guerrero Jr.
    Question: Will Vladimir Guerrero Jr. win the World Series MVP award?
    Condition ID: 0xdef...
    YES Token ID: 23456...
    NO Token ID:  78901...

[3] Yoshinobu Yamamoto
    Question: Will Yoshinobu Yamamoto win the World Series MVP award?
    Condition ID: 0xghi...
    YES Token ID: 34567...
    NO Token ID:  89012...
```

**Save the condition IDs:**
```bash
export SHOHEI_OHTANI_CONDITION_ID="0xabc..."
export VLADIMIR_GUERRERO_JR_CONDITION_ID="0xdef..."
export YOSHINOBU_YAMAMOTO_CONDITION_ID="0xghi..."
```

### Step 2: Place Bets

Bet YES or NO on any player's market.

**Example 1: Bet YES on Ohtani**
```bash
export CONDITION_ID="$SHOHEI_OHTANI_CONDITION_ID"
export BET_SIDE="YES"
export BET_AMOUNT="100"
yarn market:bet
```

**Example 2: Bet NO on Guerrero (hedge against him winning)**
```bash
export CONDITION_ID="$VLADIMIR_GUERRERO_JR_CONDITION_ID"
export BET_SIDE="NO"
export BET_AMOUNT="50"
yarn market:bet
```

**What Happens When You Bet:**

The script splits your USDC into BOTH YES and NO tokens:
```
You deposit: 100 USDC
You receive: 100 YES + 100 NO tokens
```

**In Production (with exchange):**
1. Split 100 USDC → Get 100 YES + 100 NO
2. Keep your desired side (e.g., YES)
3. Sell unwanted side (e.g., NO) on exchange for ~35 USDC
4. Net cost: 65 USDC for 100 YES tokens

**Trading Strategies:**

```bash
# Strategy 1: Pure speculation (bet YES on favorite)
export CONDITION_ID="$SHOHEI_OHTANI_CONDITION_ID"
export BET_SIDE="YES"
export BET_AMOUNT="100"
yarn market:bet

# Strategy 2: Hedging (buy NO on underdogs)
export CONDITION_ID="$VLADIMIR_GUERRERO_JR_CONDITION_ID"
export BET_SIDE="NO"
export BET_AMOUNT="50"
yarn market:bet

# Strategy 3: Arbitrage (if probabilities sum > 100%)
# Buy NO on all three players if sum < 100 USDC cost
```

### Step 3: Resolve Markets

After World Series ends, resolve all 3 markets at once.

**Ohtani wins:**
```bash
export WINNER="OHTANI"
export OHTANI_CONDITION_ID="$SHOHEI_OHTANI_CONDITION_ID"
export GUERRERO_CONDITION_ID="$VLADIMIR_GUERRERO_JR_CONDITION_ID"
export YAMAMOTO_CONDITION_ID="$YOSHINOBU_YAMAMOTO_CONDITION_ID"
yarn market:resolve
```

**What Happens:**
- Ohtani's market → Resolves to YES (outcome 0)
- Guerrero's market → Resolves to NO (outcome 1)
- Yamamoto's market → Resolves to NO (outcome 1)

**Resolution Output:**
```
Resolution Summary:
  🏆 Shohei Ohtani              → YES
  ❌ Vladimir Guerrero Jr.      → NO
  ❌ Yoshinobu Yamamoto         → NO
```

### Step 4: Redeem Tokens

Redeem your winning tokens for USDC.

**If you bet YES on Ohtani (winner):**
```bash
export CONDITION_ID="$SHOHEI_OHTANI_CONDITION_ID"
export REDEEM_SIDE="YES"
yarn market:redeem
```

**If you bet NO on Guerrero (loser):**
```bash
export CONDITION_ID="$VLADIMIR_GUERRERO_JR_CONDITION_ID"
export REDEEM_SIDE="NO"
yarn market:redeem
```

**Redemption Logic:**
- Winner's market: YES tokens → 1 USDC each, NO tokens → worthless
- Loser's market: NO tokens → 1 USDC each, YES tokens → worthless

## Complete Example Workflow

```bash
# Step 1: Create all 3 markets
yarn market:create
# Save condition IDs from output

# Step 2a: Bet 100 USDC on Ohtani YES
export CONDITION_ID="0xabc..."  # Ohtani market
export BET_SIDE="YES"
export BET_AMOUNT="100"
yarn market:bet

# Step 2b: Hedge with 50 USDC on Guerrero NO
export CONDITION_ID="0xdef..."  # Guerrero market
export BET_SIDE="NO"
export BET_AMOUNT="50"
yarn market:bet

# Step 3: Wait for World Series to end...

# Step 4: Ohtani wins! Resolve all markets
export WINNER="OHTANI"
export OHTANI_CONDITION_ID="0xabc..."
export GUERRERO_CONDITION_ID="0xdef..."
export YAMAMOTO_CONDITION_ID="0xghi..."
yarn market:resolve

# Step 5a: Redeem YES from Ohtani market (you win!)
export CONDITION_ID="0xabc..."
export REDEEM_SIDE="YES"
yarn market:redeem
# Get: 100 USDC

# Step 5b: Redeem NO from Guerrero market (hedge paid off!)
export CONDITION_ID="0xdef..."
export REDEEM_SIDE="NO"
yarn market:redeem
# Get: 50 USDC

# Total received: 150 USDC from 150 USDC invested = Break even + hedge
```

## Market Structure

### Binary Market Tokens

Each market has 2 ERC1155 token IDs in ConditionalTokens:

```
Ohtani Market (conditionId: 0xabc...):
  ├─ YES token (outcome 0, indexSet 1)
  └─ NO token  (outcome 1, indexSet 2)

Guerrero Market (conditionId: 0xdef...):
  ├─ YES token (outcome 0, indexSet 1)
  └─ NO token  (outcome 1, indexSet 2)

Yamamoto Market (conditionId: 0xghi...):
  ├─ YES token (outcome 0, indexSet 1)
  └─ NO token  (outcome 1, indexSet 2)
```

### Splitting Mechanics

When you split 100 USDC:
```typescript
await conditionalTokens.splitPosition(
  usdcAddress,
  ethers.ZeroHash,
  conditionId,
  [1, 2],  // Partition for BOTH outcomes
  100_000000
);
```

Result: 100 YES + 100 NO tokens (CTF framework guarantees 1 YES + 1 NO = 1 USDC)

### Resolution Mechanics

**Winner's Market (Ohtani):**
```typescript
await resolutionOracle.proposeResolution(ohtaniConditionId, 0);  // YES wins
// YES tokens = 1 USDC, NO tokens = worthless
```

**Loser's Markets (Guerrero, Yamamoto):**
```typescript
await resolutionOracle.proposeResolution(guerreroConditionId, 1);  // NO wins
await resolutionOracle.proposeResolution(yamamotoConditionId, 1);  // NO wins
// NO tokens = 1 USDC, YES tokens = worthless
```

## Timeline

```
Day 0:   Create 3 binary markets
         - Ohtani: "Will he win MVP?"
         - Guerrero: "Will he win MVP?"
         - Yamamoto: "Will he win MVP?"

Day 1-30: Trading period
         - Alice: 100 USDC on Ohtani YES
         - Bob: 50 USDC on Guerrero NO (hedge)
         - Carol: 75 USDC on Yamamoto YES

Day 31:  Trading ends (endTime reached)

Day 37:  Resolution time starts
         Ohtani wins MVP!

         Resolve all markets:
         - Ohtani market → YES
         - Guerrero market → NO
         - Yamamoto market → NO

Day 37-44: Dispute period (7 days)
         No disputes filed

Day 44:  Finalize all resolutions

Day 45:  Redemptions
         - Alice redeems 100 Ohtani YES → 100 USDC ✅
         - Bob redeems 50 Guerrero NO → 50 USDC ✅
         - Carol: 75 Yamamoto YES → Worthless ❌
```

## Polymarket-Style Benefits

### ✅ Advantages

1. **Independent YES/NO Markets**
   - Each player has own YES/NO tokens
   - Direct hedging possible

2. **Flexible Betting**
   - Bet FOR any player (buy YES)
   - Bet AGAINST any player (buy NO)
   - Combine strategies

3. **Liquidity Concentration**
   - Each binary market gets focused liquidity
   - Easier price discovery per player

4. **User-Friendly**
   - Simple YES/NO questions
   - Familiar to prediction market users

### ⚠️ Trade-offs

1. **Probability Sum > 100%**
   - Three independent markets may sum to >100%
   - Creates arbitrage opportunities
   - Example: 40% + 35% + 30% = 105%

2. **More Markets to Manage**
   - 3 separate markets vs 1 multi-choice
   - 3 resolution transactions needed
   - Higher total gas fees

3. **Capital Inefficiency**
   - Users need more capital to cover multiple markets
   - Can't guarantee mutual exclusivity on-chain

## Advanced Scenarios

### Arbitrage Example

If probabilities don't sum correctly:
```
Ohtani YES: 60¢ (40% implied)
Guerrero YES: 55¢ (45% implied)
Yamamoto YES: 50¢ (50% implied)
Total: 135% (opportunity!)

Arbitrage Strategy:
1. Buy NO on all three: (40¢ + 45¢ + 50¢) = 135¢
2. Guaranteed return: One NO wins → 100¢
3. Loss: 135¢ - 100¢ = 35¢ loss (no arbitrage this way)

Better strategy:
1. Buy YES on underpriced: Yamamoto YES at 50¢ (should be 33¢)
2. Wait for price correction or resolution
```

### Multi-Market Hedging

```bash
# Bet on favorite with hedge on underdog
export CONDITION_ID="$OHTANI_CONDITION_ID"
export BET_SIDE="YES"
export BET_AMOUNT="100"
yarn market:bet

export CONDITION_ID="$YAMAMOTO_CONDITION_ID"
export BET_SIDE="YES"
export BET_AMOUNT="30"
yarn market:bet

# If Ohtani wins: +100 USDC
# If Yamamoto wins: +30 USDC
# If Guerrero wins: -130 USDC
```

## Contract Addresses

All contract addresses are automatically read from `deployments.json`:
- ConditionalTokens
- MarketFactory
- ResolutionOracle
- MockUSDC
- CTFExchange

## Troubleshooting

### "No deployment found for network"
Make sure you've deployed contracts first:
```bash
yarn deploy:bsc-testnet
```

### "Insufficient USDC balance"
The script automatically mints USDC if needed. If it fails, manually mint:
```bash
npx hardhat console --network bscTestnet
> const usdc = await ethers.getContractAt("MockUSDC", "ADDRESS")
> await usdc.mint(YOUR_ADDRESS, ethers.parseUnits("1000", 6))
```

### "Cannot resolve yet"
Wait until the resolution time has passed. Check the market end time from Step 1 output.

### "Market is not resolved yet"
Run Step 3 (yarn market:resolve) first before redeeming tokens.

### "You don't have any [SIDE] tokens to redeem"
You either:
1. Didn't bet on this market
2. Trying to redeem the wrong side (YES vs NO)
3. Already redeemed these tokens

## Resources

- [Conditional Tokens Framework](https://docs.gnosis.io/conditionaltokens/)
- [Polymarket Documentation](https://docs.polymarket.com/)
- [BSC Testnet Faucet](https://testnet.bnbchain.org/faucet-smart)
- [BSC Testnet Explorer](https://testnet.bscscan.com/)

## Next Steps

- Integrate with CTFExchange for order book trading
- Add AMM (Automated Market Maker) for liquidity
- Create frontend UI for easier interaction
- Implement real-time price feeds
- Add more sports events (Super Bowl, NBA Finals, etc.)
