# Market Flow - Simple Guide

Complete lifecycle of a prediction market from creation to redemption.

---

## 🔄 The Four Stages

```
1. CREATE    →  2. TRADE    →  3. RESOLVE    →  4. REDEEM
   Market         Tokens         Outcome         Winnings
```

---

## 1️⃣ CREATE - Make a New Market

**Who**: Admin or authorized creator
**Cost**: Only gas fees (~$0.50)
**No funding needed**: Users bring their own USDC

### Create Binary Market (Yes/No)

```typescript
await marketFactory.createBinaryMarket(
  questionId,
  "Will Bitcoin reach $100k in 2024?",
  description,
  "Crypto",
  endTime,        // When trading stops
  resolutionTime  // When resolution can happen
);
```

**Output**:
- `conditionId` - Market identifier
- `yesTokenId` - Token ID for YES
- `noTokenId` - Token ID for NO

### Create Multi-Choice Market

```typescript
await marketFactory.createMultipleChoiceMarket(
  questionId,
  "Who will win MVP?",
  description,
  "Sports",
  3,              // Number of outcomes
  endTime,
  resolutionTime
);
```

**Output**:
- `conditionId` - Market identifier
- `tokenIds[]` - Array of token IDs for each outcome

### Polymarket-Style Grouped Binary Markets

Instead of one multi-choice market, create **multiple binary markets** (one per outcome):

```typescript
// Create 3 separate binary markets
const ohtaniMarket = await marketFactory.createBinaryMarket(
  questionId1,
  "Will Ohtani win MVP?",
  description,
  "Sports",
  endTime,
  resolutionTime
);

const guerreroMarket = await marketFactory.createBinaryMarket(
  questionId2,
  "Will Guerrero win MVP?",
  description,
  "Sports",
  endTime,
  resolutionTime
);

const yamamotoMarket = await marketFactory.createBinaryMarket(
  questionId3,
  "Will Yamamoto win MVP?",
  description,
  "Sports",
  endTime,
  resolutionTime
);
```

**Benefits**:
- ✅ Each outcome gets independent YES/NO tokens
- ✅ Direct hedging: Can buy YES then sell to NO
- ✅ Can bet AGAINST any outcome (buy NO tokens)
- ⚠️ Probabilities may sum >100% (arbitrage opportunity)

**Use case**: Sports predictions, elections, any multi-choice where users want YES/NO per option

---

## 2️⃣ TRADE - Users Bet on Outcomes

**Who**: Anyone with USDC
**How**: Split USDC into outcome tokens

### Binary Market (Yes/No)

```typescript
// Split 100 USDC
await conditionalTokens.splitPosition(
  usdcAddress,
  ethers.ZeroHash,
  conditionId,
  [1, 2],         // Both YES and NO
  100_000000      // 100 USDC (6 decimals)
);

// User receives:
// - 100 YES tokens
// - 100 NO tokens
```

**Then sell the unwanted side**:
- Want YES? → Sell NO tokens on exchange
- Want NO? → Sell YES tokens on exchange

### Multi-Choice Market

```typescript
// Bet on outcome 0 (e.g., Player A)
await conditionalTokens.splitPosition(
  usdcAddress,
  ethers.ZeroHash,
  conditionId,
  [1 << 0],       // Only outcome 0
  100_000000      // 100 USDC
);

// User receives:
// - 100 tokens for outcome 0 only
```

---

## 3️⃣ RESOLVE - Determine Winner

**Who**: Authorized resolver
**When**: After `resolutionTime`

### Step 1: Propose Resolution

```typescript
// Binary: YES wins
await resolutionOracle.proposeResolution(
  conditionId,
  0  // 0 = YES wins, 1 = NO wins
);

// Multi-choice: Outcome 2 wins
await resolutionOracle.proposeResolution(
  conditionId,
  2  // Outcome index that won
);

// Polymarket-style grouped binary: Ohtani wins
// Winner's market → YES, losers' markets → NO
await resolutionOracle.proposeResolution(ohtaniConditionId, 0);    // YES
await resolutionOracle.proposeResolution(guerreroConditionId, 1);  // NO
await resolutionOracle.proposeResolution(yamamotoConditionId, 1);  // NO
```

**What happens**:
- Starts 7-day dispute period
- Other resolvers can dispute if wrong
- Resolution status: PROPOSED

### Step 2: Wait for Dispute Period

**Duration**: 7 days (configurable)

**During this time**:
- Anyone can review the resolution
- Other resolvers can dispute if incorrect
- Admin can override if needed

### Step 3: Finalize

```typescript
// After dispute period ends, anyone can finalize
await marketFactory.resolveMarket(conditionId);
```

**What happens**:
- Resolution is locked in
- Market status: RESOLVED
- Winners can redeem tokens

---

## 4️⃣ REDEEM - Winners Get Paid

**Who**: Token holders
**What**: Exchange winning tokens for USDC (1:1)

### Binary Market

```typescript
// If YES won and you hold YES tokens
await conditionalTokens.redeemPositions(
  usdcAddress,
  ethers.ZeroHash,
  conditionId,
  [1]  // indexSet for YES
);

// 100 YES tokens → 100 USDC
// YES tokens are burned
```

### Multi-Choice Market

```typescript
// If outcome 2 won and you hold outcome 2 tokens
const indexSet = 1 << 2;  // Outcome 2
await conditionalTokens.redeemPositions(
  usdcAddress,
  ethers.ZeroHash,
  conditionId,
  [indexSet]
);

// 100 outcome-2 tokens → 100 USDC
```

### Polymarket-Style Grouped Binary

**If you bet YES on winner (Ohtani):**
```typescript
await conditionalTokens.redeemPositions(
  usdcAddress,
  ethers.ZeroHash,
  ohtaniConditionId,
  [1]  // YES indexSet
);
// 100 Ohtani YES → 100 USDC ✅
```

**If you bet NO on loser (Guerrero):**
```typescript
await conditionalTokens.redeemPositions(
  usdcAddress,
  ethers.ZeroHash,
  guerreroConditionId,
  [2]  // NO indexSet
);
// 50 Guerrero NO → 50 USDC ✅
```

**Key insight**: Winner's market pays YES holders, losers' markets pay NO holders!

---

## 📊 Example Timeline

```
Day 0:   Create market
         "Will Bitcoin reach $100k in 2024?"

Day 1-30: Trading period
         - Alice bets 100 USDC on YES
         - Bob bets 50 USDC on NO

Day 31:  Trading ends (endTime reached)

Day 37:  Resolution time starts
         Resolver checks: Bitcoin = $95k (didn't hit $100k)
         Proposes: NO wins

Day 37-44: Dispute period (7 days)
         No disputes filed

Day 44:  Finalize resolution
         Market resolved: NO wins

Day 45:  Bob redeems
         50 NO tokens → 50 USDC

         Alice loses
         100 YES tokens → Worthless
```

---

## 💰 Money Flow Example

### Setup
```
Alice: 100 USDC
Bob:   50 USDC
Total in market: 150 USDC locked
```

### Trading
```
Alice splits 100 USDC:
├─ Gets 100 YES + 100 NO
└─ Sells 100 NO → Gets 35 USDC back
Net: Paid 65 USDC for YES bet

Bob splits 50 USDC:
├─ Gets 50 YES + 50 NO
└─ Sells 50 YES → Gets 32 USDC back
Net: Paid 18 USDC for NO bet
```

### Resolution: NO wins
```
Bob (winner):
├─ 50 NO tokens → Redeems → 50 USDC
└─ Profit: 50 - 18 = 32 USDC (178% return!)

Alice (loser):
├─ 100 YES tokens → Worthless
└─ Loss: 65 USDC
```

---

## 🎯 Key Concepts

### 1. Split = Create Tokens

**Binary markets**: 1 USDC → 1 YES + 1 NO
**Multi-choice**: 1 USDC → 1 token of chosen outcome

### 2. No Admin Funding Needed

Markets are **self-funded**:
- Admin creates market (gas only)
- Users deposit USDC to create tokens
- Collateral locked in contract

### 3. Conservation Property

```
Binary: 1 YES + 1 NO = 1 USDC (always!)
Multi-choice: All outcomes sum to 1 USDC
```

### 4. Winners Take All

```
Total USDC in market = 150 USDC
Winner gets: Their token amount in USDC
Losers get: Nothing (tokens worthless)
```

### 5. Merge = Reverse Split

Can always exit by merging:
```
100 YES + 100 NO → Merge → 100 USDC back
```

---

## 📁 Related Files

**Scripts**:
- `scripts/interact/world-series-mvp/01-create-market.ts`
- `scripts/interact/world-series-mvp/02-place-bet.ts`
- `scripts/interact/world-series-mvp/03-resolve-market.ts`
- `scripts/interact/world-series-mvp/04-redeem-tokens.ts`

**Documentation**:
- `docs/COMPLETE_WORKFLOW.md` - Detailed technical guide
- `docs/SMART_CONTRACTS_DESIGN.md` - Contract architecture
- `scripts/interact/world-series-mvp/README.md` - Step-by-step example

**Tests**:
- `test/integration/MarketFlow.test.ts` - Complete flow test

---

## 🚀 Quick Start

```bash
# 1. Create market
yarn market:create

# 2. Place bet
export CONDITION_ID="0x..."
export OUTCOME_INDEX="0"
export BET_AMOUNT="100"
yarn market:bet

# 3. Resolve market (after event ends)
export WINNING_OUTCOME="0"
yarn market:resolve

# 4. Redeem winnings
yarn market:redeem
```

**Using different network:**
```bash
# Default is bscTestnet
# To use other networks, use npx directly:
npx hardhat run packages/contracts/scripts/interact/world-series-mvp/01-create-market.ts --network polygon
```

---

## ❓ Common Questions

**Q: Do I need to fund the market when creating it?**
A: No! Users bring their own USDC. Admin only pays gas fees.

**Q: How do users "bet" on an outcome?**
A: Split USDC into tokens, then sell the unwanted outcome.

**Q: Can I exit before resolution?**
A: Yes! Merge your tokens back to USDC or sell on exchange.

**Q: What if the resolver is wrong?**
A: 7-day dispute period allows other resolvers to challenge.

**Q: How do winners get paid?**
A: Call `redeemPositions()` to exchange winning tokens for USDC.
