# CTF Exchange Testing Guide

Complete guide for testing the Nostra CTF Exchange functionality with detailed flow analysis.

## Table of Contents

- [Overview](#overview)
- [Exchange Architecture](#exchange-architecture)
- [Test Scenarios](#test-scenarios)
- [Running Tests](#running-tests)
- [Flow Analysis Steps](#flow-analysis-steps)
- [Understanding Each Component](#understanding-each-component)

## Overview

The CTF Exchange enables **decentralized trading** of conditional outcome tokens (YES/NO tokens from prediction markets). It implements an **orderbook-based trading system** similar to Polymarket.

### Key Features

1. **Order Matching**: Match buy and sell orders for outcome tokens
2. **Signature Verification**: EIP-712 signed orders for security
3. **Fee Management**: Configurable trading fees
4. **Nonce Management**: Prevent replay attacks
5. **Token Registry**: Register valid token pairs
6. **Pausability**: Emergency pause mechanism
7. **Asset Operations**: Split/merge positions with collateral

## Exchange Architecture

### Core Components

```
CTFExchange
├── Auth.sol           - Admin/operator access control
├── Assets.sol         - Collateral and CTF references
├── Fees.sol           - Trading fee configuration
├── Hashing.sol        - EIP-712 order hashing
├── Trading.sol        - Order matching and execution
├── Registry.sol       - Token pair registration
├── Pausable.sol       - Emergency pause mechanism
├── Signatures.sol     - Order signature verification
├── NonceManager.sol   - Nonce tracking for orders
└── AssetOperations.sol - Split/merge CTF positions
```

### Trading Flow

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

## Test Scenarios

### Scenario 1: Basic Buy Order
**Flow**: Maker wants to BUY YES tokens (bullish on outcome)

```typescript
Maker:  Deposits 100 USDC, wants YES tokens
Taker:  Has 100 YES tokens, wants USDC
Operator: Matches the trade

Result:
- Maker receives 100 YES tokens
- Taker receives 100 USDC (minus fees)
- Operator collects fee
```

**Use Case**: "I think Bitcoin will hit $100k, so I buy YES tokens"

---

### Scenario 2: Basic Sell Order
**Flow**: Maker wants to SELL YES tokens (bearish on outcome)

```typescript
Maker:  Has 100 YES tokens, wants USDC
Taker:  Has 100 USDC, wants YES tokens
Operator: Matches the trade

Result:
- Maker receives 100 USDC (minus fees)
- Taker receives 100 YES tokens
- Operator collects fee
```

**Use Case**: "I think Bitcoin won't hit $100k, so I sell my YES tokens"

---

### Scenario 3: Split Position Trading
**Flow**: User splits collateral into YES/NO, then sells unwanted outcome

```typescript
Step 1: User splits 100 USDC
  → Receives 100 YES + 100 NO tokens

Step 2: User sells NO tokens (keeps YES exposure)
  Maker:  Has 100 NO tokens, wants USDC
  Taker:  Has 100 USDC, wants NO tokens

Result:
- User keeps 100 YES tokens (full bullish exposure)
- User has ~100 USDC back (minus fees)
- Net cost: Just the trading fees
```

**Use Case**: "I want to bet YES for free by selling my NO tokens"

---

### Scenario 4: Market Making (Two-Sided Trading)
**Flow**: Maker provides liquidity on both sides

```typescript
Maker: Posts BUY order at $0.55 AND SELL order at $0.60
Taker 1: Sells at $0.55 (fills maker's buy)
Taker 2: Buys at $0.60 (fills maker's sell)

Result:
- Maker earns spread: $0.05 per token
- Takers get execution
- Market has liquidity
```

**Use Case**: Market maker profits from bid-ask spread

---

### Scenario 5: Order Matching Multiple Makers
**Flow**: One taker order matched against multiple maker orders

```typescript
Taker: Wants to buy 500 YES tokens

Maker 1: Sells 200 YES @ $0.55
Maker 2: Sells 200 YES @ $0.56
Maker 3: Sells 100 YES @ $0.57

Operator: Matches taker against all three makers

Result:
- Taker gets 500 YES tokens at weighted average price
- All makers get filled
- Operator collects fees from all trades
```

**Use Case**: Large order execution across multiple price levels

---

### Scenario 6: Failed Trades (Security)
**Flow**: Various failure modes that should be prevented

```typescript
Test Cases:
1. Invalid Signature
   └─→ Transaction reverts with "INVALID_SIGNATURE"

2. Expired Order
   └─→ Transaction reverts with "ORDER_EXPIRED"

3. Used Nonce (Replay Attack)
   └─→ Transaction reverts with "NONCE_ALREADY_USED"

4. Insufficient Balance
   └─→ Transaction reverts with "INSUFFICIENT_BALANCE"

5. Paused Exchange
   └─→ Transaction reverts with "TRADING_PAUSED"

6. Unauthorized Operator
   └─→ Transaction reverts with "NOT_OPERATOR"
```

**Use Case**: Security testing and attack prevention

---

### Scenario 7: Fee Collection
**Flow**: Trading fees are collected correctly

```typescript
Setup:
- Fee rate: 1% (100 bps)
- Trade amount: 100 USDC

Execution:
Maker sells 100 YES tokens @ 1 USDC each
Taker buys with 100 USDC

Result:
- Taker pays: 100 USDC
- Maker receives: 99 USDC (100 - 1% fee)
- Exchange collects: 1 USDC fee
- Taker receives: 100 YES tokens
```

**Use Case**: Exchange revenue and fee calculation

---

### Scenario 8: Complex Trading Strategy
**Flow**: User hedges position across multiple markets

```typescript
Market A: "BTC hits $100k by Dec 2024"
Market B: "BTC hits $90k by Nov 2024"

User Strategy:
1. Buy YES on Market B ($90k)
2. Sell NO on Market B (recover cost)
3. Buy YES on Market A ($100k)
4. Sell NO on Market A (recover cost)

If BTC hits $100k:
- Both markets resolve YES
- User profits on both

If BTC hits $95k:
- Market B resolves YES (profit)
- Market A resolves NO (loss)
- Net: Reduced risk
```

**Use Case**: Advanced trading strategies and hedging

## Running Tests

### Run All Exchange Tests

```bash
# From project root
yarn test

# Run only exchange unit tests
npx hardhat test packages/contracts/test/unit/exchange/*.test.ts

# Run only exchange integration tests
npx hardhat test packages/contracts/test/integration/ExchangeFlow.test.ts

# Run specific test file
npx hardhat test packages/contracts/test/unit/exchange/Trading.test.ts

# Run with gas reporting
REPORT_GAS=true yarn test
```

### Run Interactive Test Analysis

```bash
# Start hardhat console
npx hardhat console --network localhost

# Run step-by-step test (see below)
```

## Flow Analysis Steps

Follow these steps to **analyze and understand** each trading flow:

### Step 1: Deploy Exchange Environment

```bash
# Terminal 1: Start local node
npx hardhat node --config packages/contracts/hardhat.config.ts

# Terminal 2: Run deployment
yarn deploy:local
```

### Step 2: Run Visual Test Script

Create a visual test that logs each step:

```bash
npx hardhat run packages/contracts/scripts/exchange/visual-flow-test.ts --network localhost
```

This script will output:

```
═══════════════════════════════════════════════════════════
STEP 1: INITIAL SETUP
═══════════════════════════════════════════════════════════
✓ Exchange deployed at: 0x...
✓ Maker USDC balance: 10,000.00 USDC
✓ Taker USDC balance: 10,000.00 USDC

═══════════════════════════════════════════════════════════
STEP 2: CREATE MARKET & SPLIT POSITIONS
═══════════════════════════════════════════════════════════
✓ Market created: "Will BTC hit $100k?"
✓ Condition ID: 0xabc123...
✓ YES token ID: 12345...
✓ NO token ID: 67890...

Maker splits 100 USDC:
  ✓ YES tokens: 100.00
  ✓ NO tokens: 100.00
  ✓ USDC remaining: 9,900.00

═══════════════════════════════════════════════════════════
STEP 3: CREATE & SIGN ORDER
═══════════════════════════════════════════════════════════
Order Details:
  - Maker: 0xf39Fd... (Maker address)
  - Side: SELL
  - Token: YES (12345...)
  - Amount: 100.00 YES tokens
  - Price: 1.00 USDC per token
  - Total: 100.00 USDC

Order Hash: 0xdef456...
✓ Order signed by maker

═══════════════════════════════════════════════════════════
STEP 4: EXECUTE TRADE
═══════════════════════════════════════════════════════════
Before Trade:
  Maker: 100 YES, 9,900 USDC
  Taker: 0 YES, 10,000 USDC

Executing trade...
✓ Trade executed successfully
Gas used: 245,123

After Trade:
  Maker: 0 YES, 10,000 USDC ✓
  Taker: 100 YES, 9,900 USDC ✓

═══════════════════════════════════════════════════════════
STEP 5: VERIFY BALANCES
═══════════════════════════════════════════════════════════
✓ Maker received 100 USDC (sold YES tokens)
✓ Taker received 100 YES tokens (bought with USDC)
✓ Exchange fee: 0 USDC (0% fee rate)

🎉 TRADE FLOW COMPLETE
═══════════════════════════════════════════════════════════
```

### Step 3: Analyze Order Data

Run the order inspector script:

```bash
npx hardhat run packages/contracts/scripts/exchange/inspect-order.ts --network localhost
```

Output shows the complete order structure:

```typescript
Order Structure Breakdown:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. IDENTITY FIELDS
   salt: 1
     → Random number to make order unique
     → Prevents order hash collisions

   maker: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
     → Address creating the order
     → Must sign the order

   signer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
     → Address that signed the order (usually = maker)
     → Can be different for smart contract wallets

   taker: 0x0000000000000000000000000000000000000000
     → Address allowed to fill (0x0 = anyone)
     → Useful for private/OTC trades

2. TRADE PARAMETERS
   tokenId: 12345...
     → The outcome token being traded (YES token)
     → Must be registered in exchange

   makerAmount: 100000000 (100.00 tokens, 6 decimals)
     → Amount maker provides
     → For SELL: amount of outcome tokens
     → For BUY: amount of USDC

   takerAmount: 100000000 (100.00 USDC, 6 decimals)
     → Amount taker provides
     → For SELL: amount of USDC received
     → For BUY: amount of outcome tokens received

   side: 1 (SELL)
     → 0 = BUY (maker wants tokens)
     → 1 = SELL (maker has tokens)

3. VALIDITY FIELDS
   expiration: 1735689600 (Dec 31, 2024)
     → Unix timestamp when order expires
     → Prevents stale orders

   nonce: 0
     → Order sequence number
     → Incrementing nonce prevents replay

   feeRateBps: 0 (0.00%)
     → Trading fee in basis points (100 bps = 1%)
     → Collected by exchange

4. SIGNATURE
   signatureType: 0 (EOA)
     → 0 = EOA (Externally Owned Account)
     → 1 = POLY_PROXY (smart contract wallet)
     → 2 = POLY_GNOSIS_SAFE (Gnosis Safe wallet)

   signature: 0x1b2c3d...
     → EIP-712 signature proving order authenticity
     → 65 bytes: r (32) + s (32) + v (1)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Order Hash Calculation (EIP-712):
1. Compute struct hash
2. Combine with domain separator
3. Hash with keccak256
Result: 0xdef456... (unique order ID)

Signature Recovery:
1. Extract v, r, s from signature
2. Recover signer address from hash
3. Verify signer = order.signer
Result: ✓ Valid signature
```

### Step 4: Test Failure Scenarios

Run security tests to understand what SHOULD fail:

```bash
npx hardhat test packages/contracts/test/unit/exchange/Trading.test.ts --grep "should revert"
```

Expected failures:
```
✓ should revert on invalid signature
✓ should revert on expired order
✓ should revert on used nonce
✓ should revert on insufficient balance
✓ should revert when paused
✓ should revert for unauthorized operator
```

### Step 5: Analyze Gas Costs

Run with gas reporting:

```bash
REPORT_GAS=true npx hardhat test packages/contracts/test/integration/ExchangeFlow.test.ts
```

Typical gas costs:
```
┌─────────────────────┬─────────┬────────┬─────────┐
│ Method              │ Min     │ Max    │ Avg     │
├─────────────────────┼─────────┼────────┼─────────┤
│ fillOrder           │ 180,000 │ 250,000│ 215,000 │
│ fillOrders (batch)  │ 300,000 │ 800,000│ 550,000 │
│ matchOrders         │ 250,000 │ 500,000│ 375,000 │
│ registerToken       │  80,000 │  95,000│  87,500 │
└─────────────────────┴─────────┴────────┴─────────┘
```

### Step 6: Interactive Console Testing

```bash
npx hardhat console --network localhost
```

Inside console, step through a trade manually:

```javascript
// 1. Load contracts
const exchange = await ethers.getContractAt("CTFExchange", "0x...");
const usdc = await ethers.getContractAt("MockUSDC", "0x...");
const ct = await ethers.getContractAt("ConditionalTokens", "0x...");

// 2. Get signers
const [owner, maker, taker, operator] = await ethers.getSigners();

// 3. Check initial balances
const makerUSDC = await usdc.balanceOf(maker.address);
console.log("Maker USDC:", ethers.formatUnits(makerUSDC, 6));

// 4. Create and sign order
const order = {
  salt: 1n,
  maker: maker.address,
  signer: maker.address,
  taker: ethers.ZeroAddress,
  tokenId: token0,
  makerAmount: ethers.parseUnits("100", 6),
  takerAmount: ethers.parseUnits("100", 6),
  expiration: Math.floor(Date.now() / 1000) + 3600,
  nonce: 0n,
  feeRateBps: 0n,
  side: 1, // SELL
  signatureType: 0,
  signature: "0x"
};

// 5. Sign order (EIP-712)
const domain = {
  name: "Nostra CTF Exchange",
  version: "1",
  chainId: 31337,
  verifyingContract: await exchange.getAddress()
};

const types = {
  Order: [
    { name: "salt", type: "uint256" },
    { name: "maker", type: "address" },
    { name: "signer", type: "address" },
    { name: "taker", type: "address" },
    { name: "tokenId", type: "uint256" },
    { name: "makerAmount", type: "uint256" },
    { name: "takerAmount", type: "uint256" },
    { name: "expiration", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "feeRateBps", type: "uint256" },
    { name: "side", type: "uint8" },
    { name: "signatureType", type: "uint8" }
  ]
};

const signature = await maker.signTypedData(domain, types, order);
order.signature = signature;

// 6. Execute trade
const tx = await exchange.connect(operator).fillOrder(order, order.makerAmount);
await tx.wait();

console.log("✓ Trade executed!");

// 7. Verify balances changed
const makerUSDCAfter = await usdc.balanceOf(maker.address);
console.log("Maker USDC After:", ethers.formatUnits(makerUSDCAfter, 6));
```

## Understanding Each Component

### 1. Auth Mixin - Access Control

**Purpose**: Manages admin and operator permissions

**Key Functions**:
- `addAdmin()` - Add admin address
- `removeAdmin()` - Remove admin address
- `addOperator()` - Add operator (can execute trades)
- `removeOperator()` - Remove operator

**Access Levels**:
```
Admin:
  - Register tokens
  - Pause/unpause trading
  - Manage operators
  - Configure fees

Operator:
  - Execute fillOrder
  - Execute matchOrders
  - Match trades on behalf of users

Regular User:
  - Create and sign orders
  - Cannot directly call fillOrder (needs operator)
```

**Test**: `packages/contracts/test/unit/exchange/Auth.test.ts`

### 2. Assets Mixin - Token References

**Purpose**: Store collateral and CTF contract addresses

**Key State**:
```solidity
address public collateral;  // USDC address
address public ctf;          // ConditionalTokens address
```

**Why Important**: All trades involve these two contracts:
- Collateral (USDC) for payments
- CTF for outcome token transfers

### 3. Fees Mixin - Trading Fees

**Purpose**: Configure and enforce trading fees

**Key Functions**:
- `setFeeRate()` - Set global fee rate
- `getMaxFeeRate()` - Returns maximum allowed fee (10% = 1000 bps)

**Fee Calculation**:
```solidity
fee = (amount * feeRateBps) / 10000

Example:
amount = 100 USDC
feeRateBps = 100 (1%)
fee = (100 * 100) / 10000 = 1 USDC
```

**Test**: `packages/contracts/test/unit/exchange/Fees.test.ts`

### 4. Hashing Mixin - EIP-712 Order Hashing

**Purpose**: Create unique, verifiable order hashes

**EIP-712 Benefits**:
- Human-readable signatures (wallets show order details)
- Domain separation (can't replay on other exchanges)
- Type-safe (prevents parameter confusion)

**Hash Structure**:
```
Order Hash = keccak256(
  0x1901 ||                    // EIP-191 prefix
  domainSeparator ||           // Exchange identity
  structHash(order)            // Order data hash
)
```

**Test**: Covered in `Signatures.test.ts`

### 5. Trading Mixin - Order Execution Logic

**Purpose**: Core trading functionality

**Key Functions**:
- `fillOrder()` - Execute single order
- `fillOrders()` - Execute multiple orders
- `matchOrders()` - Match taker vs multiple makers

**Execution Flow**:
```
1. Validate order signature
2. Check order expiration
3. Validate nonce
4. Check token registration
5. Verify balances
6. Calculate fees
7. Execute transfers
8. Update filled amounts
9. Increment nonce
10. Emit OrderFilled event
```

**Test**: `packages/contracts/test/unit/exchange/Trading.test.ts`

### 6. Registry Mixin - Token Pair Management

**Purpose**: Register and validate token pairs

**Key State**:
```solidity
mapping(uint256 => bytes32) public registry;  // tokenId → conditionId
mapping(uint256 => uint256) public complement; // token0 → token1
```

**Why Important**:
- Only registered tokens can be traded
- Validates token0/token1 are complementary (YES/NO from same market)
- Links tokens to their condition for settlement

**Test**: `packages/contracts/test/unit/exchange/Registry.test.ts`

### 7. Pausable Mixin - Emergency Stop

**Purpose**: Pause trading in emergencies

**States**:
```
paused = false  → Trading allowed ✓
paused = true   → Trading blocked ✗
```

**Use Cases**:
- Security incident detected
- Exchange upgrade
- Market manipulation detected

**Test**: Covered in integration tests

### 8. Signatures Mixin - Order Verification

**Purpose**: Verify order signatures using EIP-712

**Signature Types**:
```solidity
enum SignatureType {
  EOA,           // Standard wallet (MetaMask, etc.)
  POLY_PROXY,    // Polymarket proxy wallet
  POLY_GNOSIS_SAFE  // Gnosis Safe multisig
}
```

**Verification Process**:
```
1. Compute order hash (EIP-712)
2. Recover signer from signature
3. Verify signer matches order.signer
4. Check signature format is valid
```

**Test**: `packages/contracts/test/unit/exchange/Signatures.test.ts`

### 9. NonceManager Mixin - Replay Protection

**Purpose**: Prevent order replay attacks

**Key State**:
```solidity
mapping(address => uint256) public nonces;  // user → current nonce
```

**How It Works**:
```
User creates order with nonce = 5
Exchange tracks: nonces[user] = 5

When order fills:
  require(order.nonce >= nonces[user])  // Must be current or future
  nonces[user] = order.nonce + 1        // Increment to invalidate replay

Any replay attempt with nonce <= 5 will fail
```

**Test**: `packages/contracts/test/unit/exchange/NonceManager.test.ts`

### 10. AssetOperations Mixin - Position Management

**Purpose**: Split collateral into outcome tokens and merge back

**Key Functions**:
- `_mint(conditionId, amount)` - Split collateral → outcome tokens
- `_merge(conditionId, amount)` - Merge outcome tokens → collateral
- `_transfer(from, to, tokenId, amount)` - Transfer outcome tokens

**Split Example**:
```solidity
User has 100 USDC
Calls: _mint(conditionId, 100)

Result:
- User USDC: 0
- User YES tokens: 100
- User NO tokens: 100
- Total value preserved: 100 YES + 100 NO = 100 USDC
```

**Merge Example**:
```solidity
User has 50 YES + 50 NO tokens
Calls: _merge(conditionId, 50)

Result:
- User YES: 0
- User NO: 0
- User USDC: 50
- Tokens burned, collateral returned
```

## Summary

### Complete Trading Flow Checklist

Use this to verify you understand each step:

- [ ] **Market Creation**: MarketFactory creates binary market
- [ ] **Token Registration**: Admin registers token pair on exchange
- [ ] **Position Setup**: Users split collateral into YES/NO tokens
- [ ] **Order Creation**: Maker creates and signs order (EIP-712)
- [ ] **Order Validation**: Exchange validates signature, expiration, nonce
- [ ] **Balance Check**: Verify maker has tokens/collateral
- [ ] **Trade Execution**: Operator calls fillOrder
- [ ] **Token Transfer**: YES/NO tokens and USDC exchange hands
- [ ] **Fee Collection**: Exchange collects trading fee
- [ ] **Event Emission**: OrderFilled event logged
- [ ] **Nonce Update**: Maker nonce incremented (prevents replay)

### Test File Reference

```
Unit Tests (Component Testing):
├── Auth.test.ts           - Access control
├── Fees.test.ts           - Fee calculation
├── NonceManager.test.ts   - Nonce management
├── Registry.test.ts       - Token registration
├── Signatures.test.ts     - Signature verification
└── Trading.test.ts        - Order execution

Integration Tests (End-to-End):
└── ExchangeFlow.test.ts   - Complete trading flows
```

### Next Steps for Analysis

1. **Read Unit Tests**: Understand each component in isolation
2. **Run Integration Tests**: See components work together
3. **Use Console**: Manually step through trades
4. **Create Visual Scripts**: Build logging scripts for clarity
5. **Experiment**: Modify parameters and observe results
6. **Document Findings**: Keep notes on interesting behaviors

---

**Questions or Issues?**

If you encounter issues while testing:
1. Check test output for specific error messages
2. Review the relevant mixin documentation
3. Use `console.log` in tests to trace execution
4. Run with `--verbose` flag for detailed logs
5. Consult `packages/contracts/test/README.md` for test utilities
