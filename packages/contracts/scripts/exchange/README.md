# CTF Exchange Scripts

Interactive scripts for understanding and testing the CTF Exchange functionality.

## Overview

These scripts help you **analyze and understand** how the Nostra CTF Exchange works through detailed logging and step-by-step execution.

## Scripts

### 1. Visual Flow Test (`visual-flow-test.ts`)

**Purpose**: Complete trading flow with detailed logging

**What it does**:
1. Creates a prediction market
2. Registers tokens on exchange
3. Maker splits collateral into YES/NO tokens
4. Maker creates and signs SELL order
5. Operator executes trade
6. Verifies all balances and state changes

**Usage**:
```bash
# From project root
npx hardhat run packages/contracts/scripts/exchange/visual-flow-test.ts --network localhost
```

**When to use**:
- First time understanding exchange flow
- Debugging trade execution
- Demonstrating exchange to team
- Verifying deployment works correctly

**Output**:
- Step-by-step execution log
- Balance changes before/after
- Trade verification
- Gas costs
- Educational insights

---

### 2. Order Inspector (`inspect-order.ts`)

**Purpose**: Detailed explanation of order structure and EIP-712 signing

**What it explains**:
1. Every field in an order (13 fields)
2. Purpose and type of each field
3. EIP-712 signing process
4. Hash calculation
5. Signature verification
6. Validation checks
7. Execution flow

**Usage**:
```bash
# From project root
npx hardhat run packages/contracts/scripts/exchange/inspect-order.ts --network localhost
```

**When to use**:
- Learning order structure
- Understanding EIP-712 signatures
- Debugging signature issues
- Teaching team about orders
- Implementing frontend order creation

**Output**:
- Field-by-field breakdown
- Type explanations
- EIP-712 details
- Validation logic
- Quick reference table

---

## Running the Scripts

### Prerequisites

1. **Deploy contracts** (if not already deployed):
```bash
# Terminal 1: Start local node
npx hardhat node --config packages/contracts/hardhat.config.ts

# Terminal 2: Deploy
yarn deploy:local
```

2. **Verify deployment**:
```bash
cat deployments.json
# Should show localhost deployment with CTFExchange
```

### Execute Scripts

```bash
# Run visual flow test
npx hardhat run packages/contracts/scripts/exchange/visual-flow-test.ts --network localhost

# Run order inspector
npx hardhat run packages/contracts/scripts/exchange/inspect-order.ts --network localhost
```

### On Testnets

```bash
# BSC Testnet
npx hardhat run packages/contracts/scripts/exchange/visual-flow-test.ts --network bscTestnet

# Polygon Amoy
npx hardhat run packages/contracts/scripts/exchange/visual-flow-test.ts --network polygonAmoy
```

## Expected Output

### Visual Flow Test Output

```
═══════════════════════════════════════════════════════════════════
CTF EXCHANGE - VISUAL FLOW TEST
═══════════════════════════════════════════════════════════════════
Network: localhost
Chain ID: 31337

Participants:
  Owner:    0xf39Fd...
  Maker:    0x70997...
  Taker:    0x3C447...
  Operator: 0x90F79...

Contracts:
  Exchange:           0x5FbDB...
  MarketFactory:      0xe7f1...
  ConditionalTokens:  0x9fE4...
  MockUSDC:           0xCf7E...

═══════════════════════════════════════════════════════════════════
STEP 1: INITIAL SETUP & BALANCES
═══════════════════════════════════════════════════════════════════

✓ USDC minted and approvals granted
  Maker USDC: 10000.0 USDC
  Taker USDC: 10000.0 USDC

[... continues with 6 steps ...]

═══════════════════════════════════════════════════════════════════
🎉 TRADE FLOW COMPLETE - SUMMARY
═══════════════════════════════════════════════════════════════════

What Happened:
  1. ✓ Market created for "Will BTC hit $100k?"
  2. ✓ Tokens registered on exchange (YES/NO)
  3. ✓ Maker split 100 USDC → 100 YES + 100 NO tokens
  4. ✓ Maker created SELL order for 100 YES @ 1.00 USDC each
  5. ✓ Maker signed order with EIP-712
  6. ✓ Operator executed trade (matched with Taker)
  7. ✓ 100 YES tokens transferred: Maker → Taker
  8. ✓ 100 USDC transferred: Taker → Maker
  9. ✓ Nonce incremented (prevents replay)
```

### Order Inspector Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CTF EXCHANGE - ORDER STRUCTURE INSPECTOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Example Order (SELL 100 YES tokens for 100 USDC):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. IDENTITY FIELDS - Who created this order?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 salt: 1
   Purpose: Makes the order unique (prevents hash collisions)
   Type: Random uint256
   Why: Two identical orders with same params need different hashes
   Example: If you want to create same order twice, change salt

[... detailed field explanations ...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 SUMMARY - Quick Reference
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Order Components at a Glance:

┌─────────────────┬────────────────────────────────────────────┐
│ Field           │ Purpose                                    │
├─────────────────┼────────────────────────────────────────────┤
│ salt            │ Uniqueness                                 │
│ maker           │ Order creator                              │
│ signer          │ Signature authority                        │
│ taker           │ Who can fill (0x0 = anyone)               │
│ tokenId         │ Which outcome token                        │
│ makerAmount     │ Maker's contribution                       │
│ takerAmount     │ Taker's contribution                       │
│ side            │ BUY or SELL                                │
│ expiration      │ Order deadline                             │
│ nonce           │ Replay protection                          │
│ feeRateBps      │ Trading fee                                │
│ signatureType   │ Wallet type                                │
│ signature       │ Cryptographic proof                        │
└─────────────────┴────────────────────────────────────────────┘
```

## Understanding the Flow

### Trading Flow Sequence

```
1. Market Creation (MarketFactory)
   └─→ Creates YES/NO tokens via ConditionalTokens

2. Token Registration (CTFExchange)
   └─→ Admin registers token pair with condition ID

3. Position Creation (Users)
   └─→ Users split collateral → get YES/NO tokens

4. Order Creation (Maker)
   └─→ Creates order (price, amount, side)
   └─→ Signs order with EIP-712

5. Order Execution (Operator)
   └─→ Validates signature
   └─→ Checks balances and allowances
   └─→ Transfers tokens
   └─→ Collects fees

6. Position Settlement (After Market Resolution)
   └─→ Winners redeem tokens for collateral
```

### Key Concepts

**Order Types**:
- **BUY**: Maker wants to buy outcome tokens (pays USDC)
- **SELL**: Maker wants to sell outcome tokens (receives USDC)

**Roles**:
- **Maker**: Creates and signs the order
- **Taker**: Fills the order (provides other side)
- **Operator**: Executes the trade (matches maker/taker)

**Security**:
- **EIP-712**: Human-readable signatures
- **Nonce**: Prevents replay attacks
- **Expiration**: Prevents stale orders
- **Signature**: Proves maker authorized trade

## Troubleshooting

### Script Fails: "No deployment found"

**Solution**:
```bash
# Make sure contracts are deployed
yarn deploy:local
```

### Script Fails: "insufficient funds for gas"

**Solution**:
```bash
# Use account with ETH/BNB
# Or get testnet funds from faucet
```

### Order Signature Invalid

**Issue**: Signature verification fails

**Common causes**:
1. Wrong chain ID
2. Wrong contract address
3. Order fields don't match signed data
4. Signer doesn't match order.signer

**Debug**:
```bash
# Check chain ID
npx hardhat console --network localhost
> (await ethers.provider.getNetwork()).chainId

# Verify contract address
> await exchange.getAddress()
```

### Trade Reverts

**Common reasons**:
1. Insufficient balance
2. No token approval
3. Order expired
4. Nonce already used
5. Invalid signature

**Check balances**:
```javascript
// In hardhat console
const usdc = await ethers.getContractAt("MockUSDC", "0x...");
const balance = await usdc.balanceOf(maker.address);
console.log("Balance:", ethers.formatUnits(balance, 6));
```

## Next Steps

1. **Read the tests**: `packages/contracts/test/unit/exchange/*.test.ts`
2. **Run integration tests**: `npx hardhat test packages/contracts/test/integration/ExchangeFlow.test.ts`
3. **Experiment in console**: `npx hardhat console --network localhost`
4. **Review documentation**: `docs/CTF_EXCHANGE_TESTING_GUIDE.md`

## Related Files

- **Testing Guide**: `docs/CTF_EXCHANGE_TESTING_GUIDE.md`
- **Unit Tests**: `packages/contracts/test/unit/exchange/`
- **Integration Tests**: `packages/contracts/test/integration/ExchangeFlow.test.ts`
- **Contracts**: `packages/contracts/contracts/exchange/`

---

**Questions or Issues?**

Consult the main testing guide: `docs/CTF_EXCHANGE_TESTING_GUIDE.md`
