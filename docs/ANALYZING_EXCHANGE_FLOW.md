# Analyzing CTF Exchange Flow with Test Code

**Purpose**: Step-by-step guide to understand how the CTF Exchange works by running and analyzing test code.

**Audience**: Developers learning the exchange architecture and trading flow

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Understanding the Test Structure](#understanding-the-test-structure)
3. [Step-by-Step Flow Analysis](#step-by-step-flow-analysis)
4. [Running Specific Tests](#running-specific-tests)
5. [Understanding Test Output](#understanding-test-output)
6. [Key Flows to Study](#key-flows-to-study)
7. [Interactive Analysis with Console](#interactive-analysis-with-console)
8. [Common Patterns in Tests](#common-patterns-in-tests)

---

## Quick Start

### 1. Run All Exchange Tests

```bash
# From project root
cd nostra-contracts

# Run all exchange tests (67 tests)
npx hardhat test packages/contracts/test/unit/exchange/*.test.ts

# Expected output: 67 tests passing
```

### 2. Run Visual Flow Script

```bash
# Start local node (Terminal 1)
npx hardhat node --config packages/contracts/hardhat.config.ts

# Deploy contracts (Terminal 2)
yarn deploy:local

# Run visual flow test
npx hardhat run packages/contracts/scripts/exchange/visual-flow-test.ts --network localhost
```

### 3. Run Order Inspector

```bash
npx hardhat run packages/contracts/scripts/exchange/inspect-order.ts --network localhost
```

---

## Understanding the Test Structure

### Test Organization

```
packages/contracts/test/
├── unit/exchange/           # Component tests (67 tests)
│   ├── Auth.test.ts         # Access control (18 tests)
│   ├── Fees.test.ts         # Fee calculations (11 tests)
│   ├── NonceManager.test.ts # Nonce management (16 tests)
│   ├── Registry.test.ts     # Token registration (16 tests)
│   ├── Signatures.test.ts   # EIP-712 signing (24 tests)
│   └── Trading.test.ts      # Order execution (24 tests)
│
└── integration/
    └── ExchangeFlow.test.ts # End-to-end flows (11 tests)
```

### Test Categories

| Category | What It Tests | Learn About |
|----------|---------------|-------------|
| **Auth** | Role-based access control | Who can call which functions |
| **Fees** | Trading fee calculations | How fees are computed and collected |
| **NonceManager** | Order cancellation | How nonces prevent replay attacks |
| **Registry** | Token pair registration | How markets are registered on exchange |
| **Signatures** | EIP-712 signing | How orders are cryptographically signed |
| **Trading** | Order execution | How trades are settled on-chain |
| **ExchangeFlow** | Complete flows | End-to-end user journeys |

---

## Step-by-Step Flow Analysis

### Flow 1: Basic Trade Execution

**Script File**: `packages/contracts/scripts/exchange/visual-flow-test.ts`

**Purpose**: Complete trading flow demonstration with detailed logging

#### Step 1: Run the Visual Flow Test

```bash
# Terminal 1: Start local node
npx hardhat node --config packages/contracts/hardhat.config.ts

# Terminal 2: Deploy contracts
yarn deploy:local

# Terminal 3: Run visual flow test
npx hardhat run packages/contracts/scripts/exchange/visual-flow-test.ts --network localhost
```

**Note**: The unit tests in `Trading.test.ts` focus on validation and access control, not complete trade flows. For complete flow analysis, use the `visual-flow-test.ts` script.

#### Step 2: Understand the Script Structure

The `visual-flow-test.ts` script demonstrates a complete 6-step trading flow:

```typescript
async function main() {
  // STEP 1: INITIAL SETUP & BALANCES
  // - Mint USDC to maker and taker
  // - Approve exchange to spend USDC
  // - Approve exchange to transfer outcome tokens

  // STEP 2: CREATE MARKET & REGISTER TOKENS
  // - Create binary market via MarketFactory
  // - Register YES/NO tokens on exchange

  // STEP 3: MAKER SPLITS COLLATERAL
  // - Maker splits 100 USDC into 100 YES + 100 NO tokens
  // - Now maker has outcome tokens to sell

  // STEP 4: CREATE & SIGN ORDER
  const order = {
    salt: 1n,
    maker: maker.address,
    signer: maker.address,
    taker: ethers.ZeroAddress,  // Anyone can fill
    tokenId: yesToken,
    makerAmount: parseUnits("100", 6),  // Selling 100 YES
    takerAmount: parseUnits("100", 6),  // For 100 USDC
    expiration: BigInt(Math.floor(Date.now() / 1000) + 3600),
    nonce: 0n,
    feeRateBps: 100n,  // 1%
    side: Side.SELL,
    signatureType: SignatureType.EOA,
    signature: "0x"
  };

  // Sign with EIP-712
  const signature = await maker.signTypedData(domain, types, order);
  order.signature = signature;

  // STEP 5: EXECUTE TRADE
  // - Operator calls fillOrder()
  // - 100 YES tokens: maker → taker
  // - 99 USDC: taker → maker (after 1% fee)
  // - 1 USDC: fee collected by operator
  await exchange.connect(operator).fillOrder(order, parseUnits("100", 6));

  // STEP 6: VERIFY BALANCES
  // - Check maker sold all YES tokens
  // - Check maker received USDC (minus fee)
  // - Check taker received YES tokens
  // - Check taker paid USDC
}
```

#### Step 3: Trace the Execution Flow

The script automatically outputs detailed logs showing each step:

```bash
# Output shows:
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
```

**What happens internally**:

```
1. Test Setup
   └─→ createAndRegisterMarket()
       ├─→ MarketFactory.createBinaryMarket()
       │   └─→ ConditionalTokens.prepareCondition()
       └─→ Exchange.registerToken()

2. Maker Preparation
   └─→ ConditionalTokens.splitPosition()
       ├─→ Transfer 100 USDC from maker to ConditionalTokens
       └─→ Mint 100 YES + 100 NO tokens to maker

3. Order Creation (Off-chain)
   └─→ Order struct created in memory
       └─→ EIP-712 signature generated

4. Order Execution (On-chain)
   └─→ Exchange.fillOrder()
       └─→ Trading._fillOrder()
           ├─→ _performOrderChecks()
           │   ├─→ Validate signature
           │   ├─→ Check expiration
           │   └─→ Check nonce
           ├─→ Calculate fees
           ├─→ Transfer USDC: operator → maker (100 - 1% fee)
           ├─→ Transfer YES tokens: maker → operator (100)
           └─→ Emit OrderFilled event

5. Verification
   └─→ Check final balances
       ├─→ Maker: -100 YES, +99 USDC
       ├─→ Operator: +100 YES, -100 USDC
       └─→ Fee: 1 USDC (kept by operator)
```

---

### Flow 2: Multi-Order Matching

**Test File**: `packages/contracts/test/integration/ExchangeFlow.test.ts`

**Test Name**: `"should match taker order against multiple makers"`

#### Read the Test

```bash
npx hardhat test packages/contracts/test/integration/ExchangeFlow.test.ts --grep "multiple makers"
```

#### Understanding the Flow

```typescript
it("should match taker order against multiple makers", async function () {
  // SCENARIO: Large buy order matched against 3 smaller sell orders

  // 1. Three makers each create SELL orders
  const maker1Order = createOrder(maker1, 50 YES @ 0.60 USDC);
  const maker2Order = createOrder(maker2, 30 YES @ 0.65 USDC);
  const maker3Order = createOrder(maker3, 20 YES @ 0.70 USDC);

  // 2. Taker creates BUY order for 100 YES
  const takerOrder = createOrder(taker, BUY 100 YES);

  // 3. Operator matches orders
  await exchange.matchOrders(
    takerOrder,
    [maker1Order, maker2Order, maker3Order],
    100,  // Taker fill amount
    [50, 30, 20]  // Maker fill amounts
  );

  // 4. Result:
  //    Taker: +100 YES, -63 USDC (weighted average price)
  //    Maker1: -50 YES, +30 USDC (50 * 0.60)
  //    Maker2: -30 YES, +19.5 USDC (30 * 0.65)
  //    Maker3: -20 YES, +14 USDC (20 * 0.70)
});
```

**Key Learning**: Order matching aggregates liquidity across multiple price levels.

---

## Running Specific Tests

### By Test File

```bash
# Run all Auth tests (18 tests)
npx hardhat test packages/contracts/test/unit/exchange/Auth.test.ts

# Run all Trading tests (24 tests)
npx hardhat test packages/contracts/test/unit/exchange/Trading.test.ts

# Run integration tests (11 tests)
npx hardhat test packages/contracts/test/integration/ExchangeFlow.test.ts
```

### By Test Name Pattern

```bash
# Run all tests with "sell order" in name
npx hardhat test --grep "sell order"

# Run all tests with "signature" in name
npx hardhat test --grep "signature"

# Run all fee-related tests
npx hardhat test --grep "fee"

# Run all cancellation tests
npx hardhat test --grep "cancel"
```

### By Test Suite

```bash
# Run only "Trading" describe block
npx hardhat test --grep "Trading"

# Run only "Order Execution" describe block
npx hardhat test --grep "Order Execution"
```

### With Gas Reporting

```bash
# See gas costs for each operation
REPORT_GAS=true npx hardhat test packages/contracts/test/unit/exchange/Trading.test.ts
```

---

## Understanding Test Output

### Successful Test Output

```
  Trading
    Order Execution
      ✓ should fill a sell order (234ms)
      ✓ should fill a buy order (198ms)
      ✓ should fill multiple orders (312ms)
      ✓ should match orders (276ms)

  4 passing (1s)
```

**What this means**:
- ✓ = Test passed
- (234ms) = Execution time
- All critical flows working correctly

### Failed Test Output

```
  Trading
    Order Execution
      1) should fill a sell order

  0 passing (456ms)
  1 failing

  1) Trading
       Order Execution
         should fill a sell order:

     AssertionError: Expected "0" to equal "100000000"
      at Context.<anonymous> (test/unit/exchange/Trading.test.ts:145:28)
```

**What this means**:
- Test failed at line 145
- Expected balance was 100 USDC (100000000 wei)
- Actual balance was 0
- Indicates tokens didn't transfer correctly

### Gas Report Output

```
·-----------------------------------------|---------------------------|-------------|-----------------------------·
|   Solc version: 0.8.20                  ·  Optimizer enabled: true  ·  Runs: 200  ·  Block limit: 30000000 gas  │
··········································|···························|·············|······························
|  Methods                                                                                                        │
·················|························|·············|·············|·············|···············|··············
|  Contract      ·  Method                ·  Min        ·  Max        ·  Avg        ·  # calls      ·  usd (avg)  │
·················|························|·············|·············|·············|···············|··············
|  CTFExchange   ·  fillOrder             ·      86420  ·     103582  ·      94501  ·           24  ·          -  │
·················|························|·············|·············|·············|···············|··············
|  CTFExchange   ·  matchOrders           ·     187234  ·     312456  ·     249845  ·            8  ·          -  │
·················|························|·············|·············|·············|···············|··············
```

**What this means**:
- `fillOrder`: Average gas cost is 94,501
- `matchOrders`: Average gas cost is 249,845
- Higher gas = more expensive operation

---

## Key Flows to Study

### Flow 1: Basic SELL Order ⭐ START HERE

**File**: `packages/contracts/test/unit/exchange/Trading.test.ts`
**Test**: `"should fill a sell order"`

**Why study this**:
- Simplest complete flow
- Shows all essential components
- Foundation for understanding complex flows

**What you'll learn**:
1. How markets are created and registered
2. How users get outcome tokens (split position)
3. How orders are created and signed (EIP-712)
4. How trades are executed on-chain
5. How balances change after settlement

**Time to understand**: 30 minutes

---

### Flow 2: Basic BUY Order

**File**: `packages/contracts/test/unit/exchange/Trading.test.ts`
**Test**: `"should fill a buy order"`

**Why study this**:
- Opposite direction from SELL
- Shows how taker provides tokens instead of collateral
- Demonstrates BUY vs SELL logic

**What you'll learn**:
1. Difference between BUY and SELL orders
2. How operator must have outcome tokens for BUY orders
3. Fee calculation for different order sides

**Time to understand**: 15 minutes (after Flow 1)

---

### Flow 3: Order Matching

**File**: `packages/contracts/test/integration/ExchangeFlow.test.ts`
**Test**: `"should match taker order against multiple makers"`

**Why study this**:
- Shows real orderbook matching
- Multiple price levels
- Liquidity aggregation

**What you'll learn**:
1. How `matchOrders()` differs from `fillOrder()`
2. How operator matches taker vs multiple makers
3. Price calculation across multiple orders
4. Gas efficiency of batch operations

**Time to understand**: 20 minutes

---

### Flow 4: EIP-712 Signatures

**File**: `packages/contracts/test/unit/exchange/Signatures.test.ts`
**Test**: `"should validate EOA signatures"`

**Why study this**:
- Critical for security
- Shows how off-chain orders work
- Demonstrates signature verification

**What you'll learn**:
1. EIP-712 domain separator construction
2. Order hashing process
3. Signature generation and verification
4. Why signatures prevent order tampering

**Time to understand**: 25 minutes

---

### Flow 5: Nonce Management

**File**: `packages/contracts/test/unit/exchange/NonceManager.test.ts`
**Test**: `"should cancel order by incrementing nonce"`

**Why study this**:
- Shows replay attack prevention
- Order cancellation mechanism
- State management

**What you'll learn**:
1. How nonces prevent order replay
2. How to cancel orders efficiently
3. Why nonces must increment sequentially
4. Batch cancellation optimization

**Time to understand**: 15 minutes

---

### Flow 6: Fee Collection

**File**: `packages/contracts/test/unit/exchange/Fees.test.ts`
**Test**: `"should calculate correct fee for sell order"`

**Why study this**:
- Shows fee mechanics
- Revenue collection
- Operator incentives

**What you'll learn**:
1. Fee calculation formula (basis points)
2. Who pays fees (always in collateral)
3. How operator collects fees implicitly
4. Maximum fee limits (10%)

**Time to understand**: 10 minutes

---

## Interactive Analysis with Console

### Start Hardhat Console

```bash
# Terminal 1: Start local node
npx hardhat node --config packages/contracts/hardhat.config.ts

# Terminal 2: Start console
npx hardhat console --network localhost
```

### Load Contracts

```javascript
// Get deployed contract addresses
const deployments = require('../deployments.json');
const localhost = deployments.networks.find(n => n.chainId === 31337);

// Get contract instances
const CTFExchange = await ethers.getContractFactory("CTFExchange");
const exchange = CTFExchange.attach(localhost.contracts.CTFExchange);

const ConditionalTokens = await ethers.getContractFactory("ConditionalTokens");
const ctf = ConditionalTokens.attach(localhost.contracts.ConditionalTokens);

const MockUSDC = await ethers.getContractFactory("MockUSDC");
const usdc = MockUSDC.attach(localhost.contracts.MockUSDC);

// Get signers
const [owner, maker, taker, operator] = await ethers.getSigners();

console.log("Exchange:", await exchange.getAddress());
console.log("CTF:", await ctf.getAddress());
console.log("USDC:", await usdc.getAddress());
```

### Create a Market

```javascript
// 1. Prepare condition
const questionId = ethers.id("Will BTC hit $100k?");
const outcomeSlotCount = 2;  // Binary market (YES/NO)

await ctf.connect(owner).prepareCondition(
  owner.address,  // oracle
  questionId,
  outcomeSlotCount
);

// Get condition ID
const conditionId = await ctf.getConditionId(
  owner.address,
  questionId,
  outcomeSlotCount
);

console.log("Condition ID:", conditionId);

// 2. Calculate token IDs
const collectionIdYes = await ctf.getCollectionId(
  ethers.ZeroHash,
  conditionId,
  1  // YES (index 0)
);
const yesToken = await ctf.getPositionId(usdc.target, collectionIdYes);

const collectionIdNo = await ctf.getCollectionId(
  ethers.ZeroHash,
  conditionId,
  2  // NO (index 1)
);
const noToken = await ctf.getPositionId(usdc.target, collectionIdNo);

console.log("YES Token:", yesToken);
console.log("NO Token:", noToken);

// 3. Register on exchange
await exchange.connect(owner).registerToken(
  yesToken,
  noToken,
  conditionId
);

console.log("✓ Market registered on exchange");
```

### Execute a Complete Trade

```javascript
// 1. Mint USDC to maker and operator
await usdc.mint(maker.address, ethers.parseUnits("1000", 6));
await usdc.mint(operator.address, ethers.parseUnits("1000", 6));

// 2. Approve CTF to spend USDC
await usdc.connect(maker).approve(ctf.target, ethers.MaxUint256);
await usdc.connect(operator).approve(ctf.target, ethers.MaxUint256);

// 3. Maker splits position (get YES/NO tokens)
await ctf.connect(maker).splitPosition(
  usdc.target,
  ethers.ZeroHash,  // parent collection
  conditionId,
  [1, 2],  // partition (YES and NO)
  ethers.parseUnits("100", 6)
);

console.log("Maker YES balance:",
  await ctf.balanceOf(maker.address, yesToken));
console.log("Maker NO balance:",
  await ctf.balanceOf(maker.address, noToken));

// 4. Approve exchange to transfer tokens
await ctf.connect(maker).setApprovalForAll(exchange.target, true);
await ctf.connect(operator).setApprovalForAll(exchange.target, true);

// 5. Create order
const order = {
  salt: 1n,
  maker: maker.address,
  signer: maker.address,
  taker: ethers.ZeroAddress,
  tokenId: yesToken,
  makerAmount: ethers.parseUnits("100", 6),  // 100 YES
  takerAmount: ethers.parseUnits("100", 6),  // 100 USDC
  expiration: BigInt(Math.floor(Date.now() / 1000) + 3600),
  nonce: 0n,
  feeRateBps: 100n,  // 1%
  side: 1,  // SELL
  signatureType: 0,  // EOA
  signature: "0x"
};

// 6. Sign order (EIP-712)
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

console.log("✓ Order signed");

// 7. Execute trade
const tx = await exchange.connect(operator).fillOrder(
  order,
  ethers.parseUnits("100", 6)
);

const receipt = await tx.wait();
console.log("✓ Trade executed!");
console.log("Gas used:", receipt.gasUsed.toString());

// 8. Check final balances
console.log("\n=== Final Balances ===");
console.log("Maker YES:", await ctf.balanceOf(maker.address, yesToken));
console.log("Maker USDC:", await usdc.balanceOf(maker.address));
console.log("Operator YES:", await ctf.balanceOf(operator.address, yesToken));
console.log("Operator USDC:", await usdc.balanceOf(operator.address));
```

### Query Order Status

```javascript
// Get order hash
const orderHash = await exchange.hashOrder(order);
console.log("Order hash:", orderHash);

// Check if filled
const status = await exchange.getOrderStatus(orderHash);
console.log("Order status:", status);

// Check maker's current nonce
const nonce = await exchange.nonces(maker.address);
console.log("Maker nonce:", nonce);
```

---

## Common Patterns in Tests

### Pattern 1: Test Setup (Fixtures)

Most tests use fixtures for consistent setup:

```typescript
// Define fixture
async function deployExchangeFixture() {
  const [owner, maker, taker, operator] = await ethers.getSigners();

  // Deploy contracts
  const usdc = await deployMockUSDC();
  const ctf = await deployConditionalTokens();
  const exchange = await deployCTFExchange(usdc, ctf);

  // Setup roles
  await exchange.addOperator(operator.address);

  return { exchange, ctf, usdc, owner, maker, taker, operator };
}

// Use fixture in test
it("should fill order", async function () {
  const { exchange, maker, operator } = await loadFixture(deployExchangeFixture);
  // Test code...
});
```

**Why**: Ensures clean state for each test, improves speed with snapshots.

---

### Pattern 2: Order Creation Helper

Tests use helper functions to create orders:

```typescript
function createOrder(maker, tokenId, makerAmount, takerAmount, side) {
  return {
    salt: BigInt(Date.now()),
    maker: maker.address,
    signer: maker.address,
    taker: ethers.ZeroAddress,
    tokenId,
    makerAmount,
    takerAmount,
    expiration: BigInt(Math.floor(Date.now() / 1000) + 3600),
    nonce: 0n,
    feeRateBps: 100n,
    side,
    signatureType: 0,
    signature: "0x"
  };
}

// Usage
const order = createOrder(
  maker,
  yesToken,
  parseUnits("100", 6),
  parseUnits("60", 6),
  Side.SELL
);
```

**Why**: Reduces code duplication, easier to modify test orders.

---

### Pattern 3: Signature Helper

Tests use helper to sign orders:

```typescript
async function signOrder(signer, exchange, order) {
  const domain = {
    name: "Nostra CTF Exchange",
    version: "1",
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: await exchange.getAddress()
  };

  const types = {
    Order: [
      { name: "salt", type: "uint256" },
      // ... all fields except signature
    ]
  };

  return await signer.signTypedData(domain, types, order);
}

// Usage
const signature = await signOrder(maker, exchange, order);
order.signature = signature;
```

**Why**: EIP-712 signing is complex, helper ensures consistency.

---

### Pattern 4: Balance Checking

Tests verify balances before/after:

```typescript
// Before trade
const makerYesBefore = await ctf.balanceOf(maker.address, yesToken);
const makerUsdcBefore = await usdc.balanceOf(maker.address);

// Execute trade
await exchange.connect(operator).fillOrder(order, fillAmount);

// After trade
const makerYesAfter = await ctf.balanceOf(maker.address, yesToken);
const makerUsdcAfter = await usdc.balanceOf(maker.address);

// Verify changes
expect(makerYesBefore - makerYesAfter).to.equal(parseUnits("100", 6));
expect(makerUsdcAfter - makerUsdcBefore).to.equal(parseUnits("99", 6)); // After 1% fee
```

**Why**: Ensures tokens moved correctly, catches transfer bugs.

---

### Pattern 5: Event Checking

Tests verify events were emitted:

```typescript
await expect(
  exchange.connect(operator).fillOrder(order, fillAmount)
)
  .to.emit(exchange, "OrderFilled")
  .withArgs(
    orderHash,
    maker.address,
    operator.address,
    yesToken,
    usdcToken,
    parseUnits("100", 6),  // makerAmount
    parseUnits("100", 6),  // takerAmount
    parseUnits("1", 6)     // fee
  );
```

**Why**: Events are critical for indexing, must verify they fire correctly.

---

## Debugging Test Failures

### Add Console Logs

```typescript
it("should fill order", async function () {
  const balanceBefore = await usdc.balanceOf(maker.address);
  console.log("Balance before:", ethers.formatUnits(balanceBefore, 6));

  await exchange.connect(operator).fillOrder(order, fillAmount);

  const balanceAfter = await usdc.balanceOf(maker.address);
  console.log("Balance after:", ethers.formatUnits(balanceAfter, 6));

  expect(balanceAfter).to.be.gt(balanceBefore);
});
```

### Use Hardhat's `--trace`

```bash
# Show detailed trace of failed transaction
npx hardhat test --trace --grep "should fill order"
```

### Check Revert Reasons

```typescript
// Test that transaction reverts with specific message
await expect(
  exchange.connect(maker).fillOrder(order, fillAmount)
).to.be.revertedWith("OnlyOperator");

// Or use custom error
await expect(
  exchange.connect(maker).fillOrder(order, fillAmount)
).to.be.revertedWithCustomError(exchange, "OnlyOperator");
```

---

## Next Steps

### Beginner Path (4-6 hours)

1. ✅ Run all exchange tests (30 min)
2. ✅ Run visual flow script (15 min)
3. ✅ Study Flow 1: Basic SELL order (30 min)
4. ✅ Study Flow 2: Basic BUY order (15 min)
5. ✅ Study Flow 4: EIP-712 signatures (25 min)
6. ✅ Interactive console practice (1 hour)
7. ✅ Read CTF_EXCHANGE_TESTING_GUIDE.md (1 hour)

### Intermediate Path (8-10 hours)

After beginner path:
1. ✅ Study Flow 3: Order matching (20 min)
2. ✅ Study Flow 5: Nonce management (15 min)
3. ✅ Study Flow 6: Fee collection (10 min)
4. ✅ Read all unit test files (2 hours)
5. ✅ Read integration test file (1 hour)
6. ✅ Experiment with modifying orders in console (2 hours)
7. ✅ Try breaking tests to understand validation (1 hour)

### Advanced Path (15-20 hours)

After intermediate path:
1. ✅ Read all mixin contract source code (4 hours)
2. ✅ Understand EIP-712 specification (2 hours)
3. ✅ Study gas optimization techniques (2 hours)
4. ✅ Write custom test scenarios (3 hours)
5. ✅ Integrate with frontend (4 hours)
6. ✅ Security audit practice (2 hours)

---

## Resources

### Documentation
- **CTF Exchange Testing Guide**: `docs/CTF_EXCHANGE_TESTING_GUIDE.md`
- **Exchange Implementation Plan**: `docs/EXCHANGE_IMPLEMENTATION_PLAN.md`
- **Exchange Final Report**: `docs/EXCHANGE_FINAL_REPORT.md`
- **Scripts README**: `packages/contracts/scripts/exchange/README.md`

### Scripts
- **Visual Flow Test**: `packages/contracts/scripts/exchange/visual-flow-test.ts`
- **Order Inspector**: `packages/contracts/scripts/exchange/inspect-order.ts`

### Tests
- **Unit Tests**: `packages/contracts/test/unit/exchange/`
- **Integration Tests**: `packages/contracts/test/integration/ExchangeFlow.test.ts`

### Contracts
- **Main Contract**: `packages/contracts/contracts/exchange/CTFExchange.sol`
- **Mixins**: `packages/contracts/contracts/exchange/mixins/`
- **Interfaces**: `packages/contracts/contracts/interfaces/`

### External Resources
- **EIP-712**: https://eips.ethereum.org/EIPS/eip-712
- **Polymarket Docs**: https://docs.polymarket.com/
- **ConditionalTokens**: https://docs.gnosis.io/conditionaltokens/

---

## Questions?

If you have questions while analyzing the flow:

1. **Check the docs**: Read the testing guide and implementation plan
2. **Run the tests**: See actual execution in action
3. **Use the console**: Interactive exploration helps understanding
4. **Read the code**: Contract source is well-commented
5. **Ask the team**: Share findings and questions

Happy analyzing! 🚀
