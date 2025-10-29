# Betting Guide - World Series MVP Markets

Quick guide for placing bets on the 3 Polymarket-style binary markets.

## Setup

### 1. Copy Environment Variables to .env

```bash
# Copy the template
cp .env.example .env

# Add your condition IDs (from market creation output)
nano .env
```

### 2. Add Market Data to .env

```bash
# Shohei Ohtani Market
SHOHEI_OHTANI_CONDITION_ID=0x5b5c81728c91b3d2f2d653d56c7a12d46e9c7c0eb6eea45bb858d4f4b39eb874
SHOHEI_OHTANI_YES_BET=100        # Amount to bet on YES (set to 0 to skip)
SHOHEI_OHTANI_NO_BET=0           # Amount to bet on NO (set to 0 to skip)

# Vladimir Guerrero Jr. Market
VLADIMIR_GUERRERO_JR_CONDITION_ID=0xf622d7355e4feda93cd57a0aff9f5205fc2b4042f05ca15bd4a3a18800e4c6c3
VLADIMIR_GUERRERO_JR_YES_BET=0   # Amount to bet on YES (set to 0 to skip)
VLADIMIR_GUERRERO_JR_NO_BET=50   # Amount to bet on NO (set to 0 to skip)

# Yoshinobu Yamamoto Market
YOSHINOBU_YAMAMOTO_CONDITION_ID=0x8ac519d4de866fa6d24634e5632dce8cfe0254c5291485aa8c9791407014bab3
YOSHINOBU_YAMAMOTO_YES_BET=0     # Amount to bet on YES (set to 0 to skip)
YOSHINOBU_YAMAMOTO_NO_BET=25     # Amount to bet on NO (set to 0 to skip)
```

**Note**: Token IDs are calculated automatically by the scripts - you don't need to specify them!

## Betting Options

### Option 1: Player-Specific Scripts (Recommended)

Use dedicated scripts for each player:

```bash
# Bet on Ohtani
yarn market:bet:ohtani

# Bet on Guerrero
yarn market:bet:guerrero

# Bet on Yamamoto
yarn market:bet:yamamoto
```

**Benefits**:
- ✅ Reads condition ID from .env automatically
- ✅ No need to set CONDITION_ID manually
- ✅ Less error-prone

### Option 2: Generic Script with Manual CONDITION_ID

Use the generic script with environment variable override:

```bash
# Bet on Ohtani
export CONDITION_ID="0x5b5c81728c91b3d2f2d653d56c7a12d46e9c7c0eb6eea45bb858d4f4b39eb874"
yarn market:bet

# Bet on Guerrero
export CONDITION_ID="0xf622d7355e4feda93cd57a0aff9f5205fc2b4042f05ca15bd4a3a18800e4c6c3"
yarn market:bet

# Bet on Yamamoto
export CONDITION_ID="0x8ac519d4de866fa6d24634e5632dce8cfe0254c5291485aa8c9791407014bab3"
yarn market:bet
```

## Betting Strategies

### Strategy 1: Pure Speculation (Bet YES on Favorite)

```bash
# In .env:
SHOHEI_OHTANI_YES_BET=100
SHOHEI_OHTANI_NO_BET=0

# Run:
yarn market:bet:ohtani
```

**Outcome**:
- Spend: 100 USDC
- Receive: 100 YES + 100 NO tokens
- Sell 100 NO tokens on exchange → Keep 100 YES tokens
- If Ohtani wins: Redeem 100 YES for 100 USDC → Break even at initial price
- If Ohtani loses: 100 YES tokens worth $0 → Lose 100 USDC

### Strategy 2: Hedging (Bet NO on Underdogs)

```bash
# In .env:
VLADIMIR_GUERRERO_JR_YES_BET=0
VLADIMIR_GUERRERO_JR_NO_BET=50

# Run:
yarn market:bet:guerrero
```

**Outcome**:
- Spend: 50 USDC
- Receive: 50 YES + 50 NO tokens
- Sell 50 YES tokens on exchange → Keep 50 NO tokens
- If Guerrero loses: Redeem 50 NO for 50 USDC → Break even
- If Guerrero wins: 50 NO tokens worth $0 → Lose 50 USDC

### Strategy 3: Multiple Positions (Spread Risk)

```bash
# In .env:
SHOHEI_OHTANI_YES_BET=100
SHOHEI_OHTANI_NO_BET=0

YOSHINOBU_YAMAMOTO_YES_BET=0
YOSHINOBU_YAMAMOTO_NO_BET=25

# Run:
yarn market:bet:ohtani
yarn market:bet:yamamoto

# Total risk: 125 USDC
# If Ohtani wins: +100 USDC (net: -25 USDC)
# If Yamamoto wins: +25 USDC (net: -100 USDC)
# If Guerrero wins: -125 USDC (total loss)
```

### Strategy 4: Balanced Portfolio (Bet on Multiple)

```bash
# In .env - Allocate based on your probabilities:
SHOHEI_OHTANI_YES_BET=60          # 60% confidence
SHOHEI_OHTANI_NO_BET=0

VLADIMIR_GUERRERO_JR_YES_BET=30  # 30% confidence
VLADIMIR_GUERRERO_JR_NO_BET=0

YOSHINOBU_YAMAMOTO_YES_BET=10    # 10% confidence
YOSHINOBU_YAMAMOTO_NO_BET=0

# Total: 100 USDC across all positions
# Guaranteed: One outcome wins
# Max profit: 100 USDC (if your smallest bet wins)
# Max loss: Depends on which outcome wins
```

## Environment Variable Reference

### Required per Script

| Script | Required Variables |
|--------|-------------------|
| `yarn market:bet:ohtani` | `SHOHEI_OHTANI_CONDITION_ID` + YES/NO bet amounts |
| `yarn market:bet:guerrero` | `VLADIMIR_GUERRERO_JR_CONDITION_ID` + YES/NO bet amounts |
| `yarn market:bet:yamamoto` | `YOSHINOBU_YAMAMOTO_CONDITION_ID` + YES/NO bet amounts |
| `yarn market:bet` | `CONDITION_ID` (manual) + `BET_SIDE` + `BET_AMOUNT` |

### Bet Amount Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SHOHEI_OHTANI_YES_BET` | `0` | USDC to bet on Ohtani YES (0 = skip) |
| `SHOHEI_OHTANI_NO_BET` | `0` | USDC to bet on Ohtani NO (0 = skip) |
| `VLADIMIR_GUERRERO_JR_YES_BET` | `0` | USDC to bet on Guerrero YES (0 = skip) |
| `VLADIMIR_GUERRERO_JR_NO_BET` | `0` | USDC to bet on Guerrero NO (0 = skip) |
| `YOSHINOBU_YAMAMOTO_YES_BET` | `0` | USDC to bet on Yamamoto YES (0 = skip) |
| `YOSHINOBU_YAMAMOTO_NO_BET` | `0` | USDC to bet on Yamamoto NO (0 = skip) |

### Legacy Variables (Generic Script Only)

| Variable | Default | Description |
|----------|---------|-------------|
| `BET_SIDE` | `YES` | YES or NO |
| `BET_AMOUNT` | `100` | USDC amount (no decimals) |

## Examples

### Example 1: Bet 100 USDC on Ohtani YES

```bash
# In .env:
SHOHEI_OHTANI_YES_BET=100
SHOHEI_OHTANI_NO_BET=0

# Run:
yarn market:bet:ohtani
```

**Output**:
```
💚 PLACING YES BET: 100 USDC
✅ Transaction confirmed!

🎉 BETTING COMPLETE - Shohei Ohtani
💼 Your Final Token Holdings:
  YES tokens: 100.00
  NO tokens:  100.00

💡 Trading Strategy:
  You bet on YES (Ohtani wins)
  You received 100 YES + 100 NO tokens from splitting
  → Sell 100 NO tokens on exchange to keep pure YES position
```

### Example 2: Bet 50 USDC on Guerrero NO

```bash
# In .env:
VLADIMIR_GUERRERO_JR_YES_BET=0
VLADIMIR_GUERRERO_JR_NO_BET=50

# Run:
yarn market:bet:guerrero
```

### Example 3: Bet on Multiple Markets

```bash
# In .env:
SHOHEI_OHTANI_YES_BET=100
SHOHEI_OHTANI_NO_BET=0

VLADIMIR_GUERRERO_JR_YES_BET=0
VLADIMIR_GUERRERO_JR_NO_BET=50

YOSHINOBU_YAMAMOTO_YES_BET=0
YOSHINOBU_YAMAMOTO_NO_BET=25

# Run all:
yarn market:bet:ohtani
yarn market:bet:guerrero
yarn market:bet:yamamoto
```

### Example 4: Bet on Both Sides (Liquidity Provision)

```bash
# In .env:
SHOHEI_OHTANI_YES_BET=100
SHOHEI_OHTANI_NO_BET=50

# Run:
yarn market:bet:ohtani
```

**Output**:
```
💚 PLACING YES BET: 100 USDC
✅ Transaction confirmed!

🔴 PLACING NO BET: 50 USDC
✅ Transaction confirmed!

🎉 BETTING COMPLETE - Shohei Ohtani
💼 Your Final Token Holdings:
  YES tokens: 100.00
  NO tokens:  150.00

💡 Trading Strategy:
  You bet on BOTH sides
  This strategy is used for:
  • Providing liquidity (earn trading fees)
  • Arbitrage opportunities
  • Hedging other positions
```

## What Happens When You Bet

### Understanding the CTF Split Mechanism

**CRITICAL CONCEPT**: In Conditional Tokens Framework (CTF), you ALWAYS receive BOTH YES and NO tokens when you split collateral. There's no way to get only YES or only NO directly from splitting.

### Scenario 1: Bet 100 USDC on YES Only

```bash
# In .env:
SHOHEI_OHTANI_YES_BET=100
SHOHEI_OHTANI_NO_BET=0

# Run:
yarn market:bet:ohtani
```

**What Happens**:
1. ✅ Script validates and checks USDC balance
2. ✅ Mints USDC if needed (testnet only)
3. ✅ Approves ConditionalTokens to spend 100 USDC
4. ✅ **Splits 100 USDC** → You receive:
   - **100 YES tokens** (what you want to keep)
   - **100 NO tokens** (you'll sell these)
5. ✅ Shows final balances: YES=100, NO=100

**Next Steps**:
- Sell 100 NO tokens on exchange for ~50 USDC (at 50% price)
- Net cost: 100 USDC spent - 50 USDC received = **50 USDC**
- Final position: **100 YES tokens for 50 USDC**

**If Ohtani Wins**: Redeem 100 YES for 100 USDC → **Profit: 50 USDC**

### Scenario 2: Bet 50 USDC on NO Only

```bash
# In .env:
VLADIMIR_GUERRERO_JR_YES_BET=0
VLADIMIR_GUERRERO_JR_NO_BET=50

# Run:
yarn market:bet:guerrero
```

**What Happens**:
1. ✅ Script validates and checks USDC balance
2. ✅ Mints USDC if needed
3. ✅ Approves ConditionalTokens to spend 50 USDC
4. ✅ **Splits 50 USDC** → You receive:
   - **50 YES tokens** (you'll sell these)
   - **50 NO tokens** (what you want to keep)
5. ✅ Shows final balances: YES=50, NO=50

**Next Steps**:
- Sell 50 YES tokens on exchange for ~25 USDC (at 50% price)
- Net cost: 50 USDC spent - 25 USDC received = **25 USDC**
- Final position: **50 NO tokens for 25 USDC**

**If Guerrero Loses**: Redeem 50 NO for 50 USDC → **Profit: 25 USDC**

### Scenario 3: Bet on BOTH YES and NO

```bash
# In .env:
SHOHEI_OHTANI_YES_BET=100
SHOHEI_OHTANI_NO_BET=50

# Run:
yarn market:bet:ohtani
```

**What Happens**:
1. ✅ **First split (YES bet)**: 100 USDC → 100 YES + 100 NO
2. ✅ **Second split (NO bet)**: 50 USDC → 50 YES + 50 NO
3. ✅ **Total tokens received**:
   - **150 YES tokens** (100 from first + 50 from second)
   - **150 NO tokens** (100 from first + 50 from second)
4. ✅ Total cost: 150 USDC

**Strategy Options**:
- **Liquidity provision**: Keep all tokens, earn trading fees
- **Partial hedge**: Sell 50 YES + 100 NO → Keep 100 YES + 50 NO
- **Arbitrage**: If prices shift, profit from imbalance

### Key Takeaway

**The bet amount variables control HOW MUCH you split, not which tokens you receive.**

- `YES_BET=100` means: Split 100 USDC, intend to keep YES tokens
- `NO_BET=50` means: Split 50 USDC, intend to keep NO tokens

**You ALWAYS get both tokens**. The exchange is where you convert to your desired position by selling the unwanted side.

### Quick Reference: Pure YES/NO Bet Math

| Bet Config | Split Amount | Tokens Received | Sell on Exchange | Keep | Net Cost | Win Payout | Profit |
|------------|--------------|-----------------|------------------|------|----------|------------|--------|
| YES=100, NO=0 | 100 USDC | 100 YES + 100 NO | Sell 100 NO @ $0.50 | 100 YES | 50 USDC | 100 USDC | 50 USDC |
| YES=0, NO=50 | 50 USDC | 50 YES + 50 NO | Sell 50 YES @ $0.50 | 50 NO | 25 USDC | 50 USDC | 25 USDC |
| YES=100, NO=50 | 150 USDC | 150 YES + 150 NO | Strategy-dependent | Varies | Varies | Varies | Varies |

**Note**: Exchange prices shown at initial 50% probability. Actual sale price depends on market conditions.

## Token IDs (For Reference)

The **YES_TOKEN** and **NO_TOKEN** values in .env are **optional**. The scripts calculate them automatically. They're useful for:
- Manually checking token balances
- Trading on the exchange (future)
- Advanced operations

## Troubleshooting

### "CONDITION_ID environment variable is required"
- Make sure the condition ID is in your `.env` file
- Check that .env is in the project root (not packages/contracts/)

### "Insufficient USDC balance"
- The script auto-mints on testnet
- If it fails, check your BNB balance for gas fees

### "Market is not Active"
- Market may have ended or been resolved
- Check market status with market creation output

## Checking Market Status

View current market information and your positions:

```bash
yarn market:prices
```

This displays:
- ✅ Market details for all 3 players
- ✅ Current token prices (YES/NO)
- ✅ Your token holdings and values
- ✅ Total position values
- ✅ P&L calculation

**Example Output**:
```
┌─ SHOHEI OHTANI
│
│ 📝 Question: Will Shohei Ohtani win World Series MVP?
│ 📊 Status: Active
│ ⏰ End Time: 10/31/2025, 11:59:59 PM
│
│ 💹 Current Prices (Implied Probability):
│   YES: $0.50 (50%)
│   NO:  $0.50 (50%)
│
│ 💼 Your Holdings:
│   YES: 100.00 tokens × $0.50 = $50.00
│   NO:  100.00 tokens × $0.50 = $50.00
│
│ 💰 Total Position Value: $100.00
│ 📊 Cost Basis (from splitting): $100.00
│ 💵 Current P&L: $0.00
```

**Price Information**:
- **Initial Phase**: YES = $0.50, NO = $0.50 (50% probability each)
- **After Trading**: Prices shift based on executed trades
  - Example: YES rises to $0.65 (65%), NO falls to $0.35 (35%)
  - Prices always sum to $1.00
  - Prices are calculated from the last `OrderFilled` event on CTFExchange
- **Profit Calculation**: If your outcome wins, redeem tokens for $1.00 each
  - Holding 100 YES tokens → Win scenario pays $100.00
  - Cost was $50.00 (if bought at $0.50) → Profit: $50.00

## Simulating Trading Activity

### Basic Trading Simulation

Simulate market activity with mixed price movements:

```bash
yarn market:simulate-trading
```

**What it does:**
- Creates 3 trades with bullish trend: $0.52 → $0.55 → $0.58
- Executes trades through CTFExchange to simulate market activity
- Updates the onchain trade history with `OrderFilled` events
- Uses only 30 YES tokens (3 trades × 10 tokens)

### Continuous Buying Pressure

Simulate sustained demand with steady price increases:

```bash
yarn market:buy-pressure
```

**What it does:**
- Creates 6 trades with continuous accumulation: $0.52 → $0.54 → $0.56 → $0.58 → $0.60 → $0.62
- Demonstrates sustained market demand with +$0.02 incremental increases
- Shows Ohtani's odds moving upward continuously
- Uses 60 YES tokens (6 trades × 10 tokens)

**Requirements:**
- You must have YES/NO tokens from splitting collateral
- You need operator role on CTFExchange to execute trades
- Need separate trader account (TRADER_PRIVATE_KEY in .env)
- Run `yarn market:bet:ohtani` first to get tokens

**Example workflow:**
```bash
# 1. Get tokens (100 YES + 100 NO)
yarn market:bet:ohtani

# 2. Check initial prices (50/50)
yarn market:prices

# 3. Simulate continuous buying pressure
yarn market:buy-pressure

# 4. Check updated prices
yarn market:prices
# Now shows: YES: $0.62 (62%), NO: $0.38 (38%)
# Strong upward momentum - sustained buying pressure!
```

**How prices update:**
1. Script creates SELL orders with EIP-712 signatures (deployer sells YES tokens)
2. Trader account fills orders by calling `fillOrder()` at increasing prices
3. Emits `OrderFilled` events with trade prices
4. `market:prices` reads these events and displays last traded price

**Note:** This is for testing/demonstration purposes. In production, real users would create orders through an offchain operator API, and the exchange would match and execute them.

## Next Steps

After placing bets:

1. **Check positions**: `yarn market:prices`
2. **Wait** for the World Series to end
3. **Resolve** markets: `yarn market:resolve`
4. **Redeem** winnings: `yarn market:redeem`

See `docs/MARKET_FLOW.md` for the complete workflow.
