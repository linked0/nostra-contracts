# Test Analysis Guide - Recommended Order

**Strategy**: Start with integration test for big picture, then dive into unit tests for details

**Time estimate**: 2-3 hours for complete understanding

---

## Analysis Strategy

### Phase 1: Big Picture (30 minutes)
**File**: `packages/contracts/test/integration/ExchangeFlow.test.ts`

**Why start here**:
- ✅ Shows complete order lifecycle
- ✅ Demonstrates how all components work together
- ✅ Provides context before diving into details
- ✅ Easier to understand unit tests after seeing the full picture

### Phase 2: Deep Dive (1.5-2 hours)
**Files**: Unit test files (understand each component)

**Why go here next**:
- ✅ Understand validation logic in detail
- ✅ Learn what each component does
- ✅ See edge cases and security measures
- ✅ Build comprehensive understanding

---

## Phase 1: Integration Test Analysis

### File: `ExchangeFlow.test.ts`

**Run the test**:
```bash
npx hardhat test packages/contracts/test/integration/ExchangeFlow.test.ts
```

**Expected output**:
```
  CTFExchange - Integration Flow
    ✓ Should create, validate, and cancel an order (234ms)
    ✓ Should invalidate orders after nonce increment (198ms)
    ✓ Should manage orders for multiple users independently (276ms)
    ✓ Should reject expired orders (145ms)
    ✓ Should accept orders with future expiration (167ms)
    ✓ Should accept orders with no expiration (134ms)
    ✓ Should reject orders with excessive fees (123ms)
    ✓ Should accept orders with max fee (178ms)
    ✓ Should prevent trading when paused (189ms)
    ✓ Should enforce operator-only access for trading (156ms)
    ✓ Should handle complete order lifecycle from creation to cancellation (267ms)

  11 passing (2s)
```

### What to Look For

#### Test 1: "Should create, validate, and cancel an order"
**Location**: Line 121

**What it teaches**:
```typescript
// 1. Create market and register tokens
const { yesToken, noToken } = await createMarket();

// 2. Create order
const order = createOrder({
  tokenId: yesToken,
  makerAmount: parseUnits("100", 6),
  takerAmount: parseUnits("100", 6),
  side: Side.SELL
});

// 3. Sign order (EIP-712)
const signature = await signOrder(order, maker);

// 4. Validate order
await exchange.validateOrder({ ...order, signature });

// 5. Cancel order
await exchange.connect(maker).cancelOrder({ ...order, signature });

// 6. Verify cancellation event
expect(event).to.emit(exchange, "OrderCancelled");
```

**Key learnings**:
- Order creation process
- EIP-712 signing
- Order validation
- Cancellation mechanism
- Event emission

---

#### Test 2: "Should invalidate orders after nonce increment"
**Location**: Line 164

**What it teaches**:
```typescript
// Create 3 orders with same nonce
const order1 = createOrder({ nonce: 0 });
const order2 = createOrder({ nonce: 0 });
const order3 = createOrder({ nonce: 0 });

// Increment nonce (cancels all orders with nonce < new nonce)
await exchange.connect(maker).incrementNonce();

// All 3 orders now invalid
await expect(exchange.validateOrder(order1)).to.be.reverted;
await expect(exchange.validateOrder(order2)).to.be.reverted;
await expect(exchange.validateOrder(order3)).to.be.reverted;
```

**Key learnings**:
- Nonce-based cancellation
- Batch cancellation efficiency
- Replay attack prevention

---

#### Test 3: "Should manage orders for multiple users independently"
**Location**: Line 204

**What it teaches**:
```typescript
// User A creates order with nonce 0
const orderA = createOrder({ maker: userA, nonce: 0 });

// User B creates order with nonce 0 (independent)
const orderB = createOrder({ maker: userB, nonce: 0 });

// User A increments nonce
await exchange.connect(userA).incrementNonce();

// User A's order invalid
await expect(exchange.validateOrder(orderA)).to.be.reverted;

// User B's order still valid (independent nonces)
await expect(exchange.validateOrder(orderB)).to.not.be.reverted;
```

**Key learnings**:
- Per-user nonce tracking
- User isolation
- Independent order management

---

### Analysis Questions (Integration Test)

As you read `ExchangeFlow.test.ts`, answer these:

1. **Order Lifecycle**:
   - [ ] What are the steps in a complete order lifecycle?
   - [ ] How are orders created?
   - [ ] How are orders signed?
   - [ ] How are orders validated?
   - [ ] How are orders cancelled?

2. **Nonce Management**:
   - [ ] What is a nonce and why is it needed?
   - [ ] How does nonce increment work?
   - [ ] Can I cancel multiple orders at once?
   - [ ] Are nonces per-user or global?

3. **Time Management**:
   - [ ] What happens to expired orders?
   - [ ] Can orders have no expiration?
   - [ ] How far in the future can expiration be?

4. **Fee Management**:
   - [ ] What's the minimum fee?
   - [ ] What's the maximum fee?
   - [ ] What happens if fee is too high?

5. **Access Control**:
   - [ ] Who can create orders?
   - [ ] Who can cancel orders?
   - [ ] Who can execute trades?
   - [ ] What happens when paused?

---

## Phase 2: Unit Test Analysis

### Recommended Order

```
1. Trading.test.ts      (30 min) - Core validation logic
2. Signatures.test.ts   (25 min) - EIP-712 signing
3. NonceManager.test.ts (15 min) - Nonce mechanics
4. Auth.test.ts         (15 min) - Access control
5. Fees.test.ts         (10 min) - Fee calculations
6. Registry.test.ts     (15 min) - Token registration
```

---

### 1. Trading.test.ts (30 minutes)

**Run**:
```bash
npx hardhat test packages/contracts/test/unit/exchange/Trading.test.ts
```

**What to focus on**:

#### Order Validation Section
```typescript
describe("Order Validation", function () {
  it("Should validate a valid order")           // ← How validation works
  it("Should reject order with expired timestamp") // ← Time checks
  it("Should reject order with fee too high")      // ← Fee limits
  it("Should reject order with unregistered token") // ← Token checks
  it("Should reject order with invalid nonce")     // ← Nonce validation
  it("Should reject order with invalid signature") // ← Signature checks
});
```

#### Order Cancellation Section
```typescript
describe("Order Cancellation", function () {
  it("Should allow maker to cancel their own order")      // ← Who can cancel
  it("Should not allow non-maker to cancel order")        // ← Access control
  it("Should not allow cancelling already cancelled order") // ← State tracking
  it("Should allow bulk order cancellation")              // ← Batch operations
});
```

#### Access Control Section
```typescript
describe("Access Control", function () {
  it("Should only allow operator to call fillOrder")   // ← Trading permission
  it("Should only allow operator to call matchOrders") // ← Matching permission
  it("Should not allow trading when paused")          // ← Pause mechanism
});
```

**Key questions**:
- [ ] What makes an order valid?
- [ ] What validations happen before execution?
- [ ] Who can cancel orders?
- [ ] What's the difference between cancel and nonce increment?
- [ ] Who can execute trades?

---

### 2. Signatures.test.ts (25 minutes)

**Run**:
```bash
npx hardhat test packages/contracts/test/unit/exchange/Signatures.test.ts
```

**What to focus on**:

#### EIP-712 Domain Separator
```typescript
it("Should compute correct domain separator", async function () {
  const domain = {
    name: "Nostra CTF Exchange",
    version: "1",
    chainId: 31337,
    verifyingContract: await exchange.getAddress()
  };

  const separator = await exchange.domainSeparator();
  expect(separator).to.equal(computedSeparator);
});
```

**Key learnings**:
- What is EIP-712?
- What's a domain separator?
- Why is chain ID important?

#### Order Hashing
```typescript
it("Should hash order correctly", async function () {
  const order = createOrder({ ... });
  const hash = await exchange.hashOrder(order);

  // Hash is deterministic
  const hash2 = await exchange.hashOrder(order);
  expect(hash).to.equal(hash2);
});
```

**Key learnings**:
- How are orders hashed?
- Is hashing deterministic?
- What fields are included in hash?

#### Signature Validation
```typescript
it("Should validate EOA signatures", async function () {
  const order = createOrder({ signatureType: SignatureType.EOA });
  const signature = await maker.signTypedData(domain, types, order);

  const isValid = await exchange.validateOrderSignature(
    { ...order, signature }
  );
  expect(isValid).to.be.true;
});
```

**Key questions**:
- [ ] How is EIP-712 signature created?
- [ ] What signature types are supported?
- [ ] How is signature verified?
- [ ] What happens if signature is invalid?

---

### 3. NonceManager.test.ts (15 minutes)

**Run**:
```bash
npx hardhat test packages/contracts/test/unit/exchange/NonceManager.test.ts
```

**What to focus on**:

#### Nonce Increment
```typescript
it("Should increment nonce", async function () {
  const nonceBefore = await exchange.nonces(maker.address);

  await exchange.connect(maker).incrementNonce();

  const nonceAfter = await exchange.nonces(maker.address);
  expect(nonceAfter).to.equal(nonceBefore + 1n);
});
```

#### Nonce Validation
```typescript
it("Should reject orders with nonce below current", async function () {
  // Current nonce is 5
  await exchange.connect(maker).incrementNonce(); // nonce = 1

  // Order with nonce 0 is invalid
  const order = createOrder({ nonce: 0 });
  await expect(exchange.validateOrder(order)).to.be.reverted;
});
```

**Key questions**:
- [ ] What is a nonce?
- [ ] How does incrementing nonce cancel orders?
- [ ] Can I use future nonces?
- [ ] Are nonces per-user?

---

### 4. Auth.test.ts (15 minutes)

**Run**:
```bash
npx hardhat test packages/contracts/test/unit/exchange/Auth.test.ts
```

**What to focus on**:

#### Role Management
```typescript
it("Should add operator", async function () {
  await exchange.connect(admin).addOperator(operator.address);

  const isOperator = await exchange.isOperator(operator.address);
  expect(isOperator).to.be.true;
});

it("Should remove operator", async function () {
  await exchange.connect(admin).removeOperator(operator.address);

  const isOperator = await exchange.isOperator(operator.address);
  expect(isOperator).to.be.false;
});
```

**Key questions**:
- [ ] What roles exist? (Admin, Operator)
- [ ] Who can add/remove operators?
- [ ] What can operators do?
- [ ] What can only admin do?

---

### 5. Fees.test.ts (10 minutes)

**Run**:
```bash
npx hardhat test packages/contracts/test/unit/exchange/Fees.test.ts
```

**What to focus on**:

#### Fee Calculation
```typescript
it("Should calculate fee correctly", async function () {
  const amount = parseUnits("100", 6);
  const feeRateBps = 100n; // 1%

  const fee = await exchange.calculateFee(amount, feeRateBps);

  expect(fee).to.equal(parseUnits("1", 6)); // 1% of 100 = 1
});
```

#### Fee Limits
```typescript
it("Should enforce max fee of 10%", async function () {
  const order = createOrder({ feeRateBps: 1001n }); // 10.01%

  await expect(exchange.validateOrder(order))
    .to.be.revertedWithCustomError(exchange, "FeeTooHigh");
});
```

**Key questions**:
- [ ] How are fees calculated?
- [ ] What's the max fee? (10%)
- [ ] Who receives fees? (Operator)
- [ ] Are fees in collateral or tokens?

---

### 6. Registry.test.ts (15 minutes)

**Run**:
```bash
npx hardhat test packages/contracts/test/unit/exchange/Registry.test.ts
```

**What to focus on**:

#### Token Registration
```typescript
it("Should register token pair", async function () {
  await exchange.registerToken(
    yesToken,
    noToken,
    conditionId
  );

  const complement = await exchange.getComplement(yesToken);
  expect(complement).to.equal(noToken);
});
```

**Key questions**:
- [ ] Why register tokens?
- [ ] What's a complement token?
- [ ] Who can register tokens?
- [ ] What happens if token not registered?

---

## Analysis Workflow

### Step 1: Run Integration Test
```bash
npx hardhat test packages/contracts/test/integration/ExchangeFlow.test.ts
```

**Action**: Read the test file while tests are running

**Note**: Write down questions as you read

---

### Step 2: Run All Unit Tests Together
```bash
npx hardhat test packages/contracts/test/unit/exchange/*.test.ts
```

**Action**: Watch which tests pass/fail

**Note**: All should pass (67 tests)

---

### Step 3: Analyze Each Unit Test File

For each file:
1. **Read the test code**
2. **Run the specific test**:
   ```bash
   npx hardhat test packages/contracts/test/unit/exchange/[FILE].test.ts
   ```
3. **Answer the key questions** (listed above for each file)
4. **Note interesting patterns**

---

### Step 4: Cross-Reference with Contracts

After understanding tests, read the actual implementation:

```bash
# Read the contract that each test validates
code packages/contracts/contracts/exchange/mixins/Trading.sol
code packages/contracts/contracts/exchange/mixins/Signatures.sol
code packages/contracts/contracts/exchange/mixins/NonceManager.sol
# etc.
```

---

## Summary Checklist

After completing analysis, you should be able to answer:

### Order Lifecycle
- [ ] How is an order created?
- [ ] How is an order signed?
- [ ] How is an order validated?
- [ ] How is an order executed?
- [ ] How is an order cancelled?

### Security
- [ ] How are signatures verified?
- [ ] How are replay attacks prevented?
- [ ] How is access controlled?
- [ ] What validations occur?

### Components
- [ ] What does Trading mixin do?
- [ ] What does Signatures mixin do?
- [ ] What does NonceManager mixin do?
- [ ] What does Auth mixin do?
- [ ] What does Fees mixin do?
- [ ] What does Registry mixin do?

### Edge Cases
- [ ] What happens with expired orders?
- [ ] What happens with excessive fees?
- [ ] What happens when paused?
- [ ] What happens with invalid signatures?
- [ ] What happens with wrong nonces?

---

## Quick Command Reference

```bash
# Integration test (start here)
npx hardhat test packages/contracts/test/integration/ExchangeFlow.test.ts

# All unit tests together
npx hardhat test packages/contracts/test/unit/exchange/*.test.ts

# Individual unit tests
npx hardhat test packages/contracts/test/unit/exchange/Trading.test.ts
npx hardhat test packages/contracts/test/unit/exchange/Signatures.test.ts
npx hardhat test packages/contracts/test/unit/exchange/NonceManager.test.ts
npx hardhat test packages/contracts/test/unit/exchange/Auth.test.ts
npx hardhat test packages/contracts/test/unit/exchange/Fees.test.ts
npx hardhat test packages/contracts/test/unit/exchange/Registry.test.ts

# Run specific test by name
npx hardhat test --grep "Should validate a valid order"

# Run with gas reporting
REPORT_GAS=true npx hardhat test packages/contracts/test/unit/exchange/Trading.test.ts
```

---

**Time to complete**: 2-3 hours for thorough understanding

**Ready to start?** Run the integration test first! 🚀

```bash
npx hardhat test packages/contracts/test/integration/ExchangeFlow.test.ts
```
