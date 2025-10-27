# Where to Find Trade Flow Examples

**Quick Reference**: Understanding where to look for different types of exchange functionality

---

## TL;DR

- ✅ **Want to see a complete trade?** → Run `visual-flow-test.ts` script
- ✅ **Want to understand validation?** → Read `Trading.test.ts` unit tests
- ✅ **Want to see order structure?** → Run `inspect-order.ts` script

---

## Complete Trade Flow Examples

### 1. Visual Flow Test Script ⭐ PRIMARY RESOURCE

**File**: `packages/contracts/scripts/exchange/visual-flow-test.ts`

**What it shows**:
- ✅ Complete 6-step trading flow
- ✅ Market creation
- ✅ Token splitting (USDC → YES/NO)
- ✅ Order creation and signing
- ✅ Trade execution via fillOrder()
- ✅ Balance verification

**How to run**:
```bash
# Terminal 1: Local node
npx hardhat node --config packages/contracts/hardhat.config.ts

# Terminal 2: Deploy
yarn deploy:local

# Terminal 3: Run flow test
npx hardhat run packages/contracts/scripts/exchange/visual-flow-test.ts --network localhost
```

**Output**: Detailed step-by-step logging with balance changes and gas costs

---

### 2. Order Inspector Script

**File**: `packages/contracts/scripts/exchange/inspect-order.ts`

**What it shows**:
- ✅ All 13 order fields explained
- ✅ EIP-712 signing process
- ✅ Field purposes and validation

**How to run**:
```bash
npx hardhat run packages/contracts/scripts/exchange/inspect-order.ts --network localhost
```

**Output**: Educational breakdown of order structure

---

## Unit Tests (Validation & Access Control)

### Trading.test.ts

**File**: `packages/contracts/test/unit/exchange/Trading.test.ts`

**What it tests**:
- ✅ Order validation (expiration, fees, nonces)
- ✅ Access control (only operator can trade)
- ✅ Order cancellation
- ✅ Order status tracking
- ✅ Pause functionality

**Key tests**:
```typescript
"Should validate a valid order"
"Should reject order with expired timestamp"
"Should reject order with fee too high"
"Should only allow operator to call fillOrder"
"Should not allow trading when paused"
"Should allow maker to cancel their own order"
```

**How to run**:
```bash
npx hardhat test packages/contracts/test/unit/exchange/Trading.test.ts
```

**What it does NOT show**: Complete trade execution with balance changes

---

### Other Unit Tests

**Auth.test.ts**:
- Admin/operator role management
- Access control enforcement

**Fees.test.ts**:
- Fee calculation formulas
- Fee limits (0% to 10%)

**NonceManager.test.ts**:
- Nonce increment for cancellation
- Replay attack prevention

**Registry.test.ts**:
- Token pair registration
- Complement token tracking

**Signatures.test.ts**:
- EIP-712 signature validation
- Different signature types (EOA, Proxy, Gnosis Safe)

---

## Integration Tests

### ExchangeFlow.test.ts

**File**: `packages/contracts/test/integration/ExchangeFlow.test.ts`

**What it tests**:
- ✅ Complete order lifecycle
- ✅ Multi-user order management
- ✅ Order expiration scenarios
- ✅ Fee validation edge cases
- ✅ Pause/unpause flows

**How to run**:
```bash
npx hardhat test packages/contracts/test/integration/ExchangeFlow.test.ts
```

**What it does NOT show**: Actual trade execution (focuses on order management)

---

## Why Unit Tests Don't Show Complete Trades

**Design Philosophy**:
- Unit tests focus on **validation logic** and **access control**
- They verify that **rules are enforced** (signatures, permissions, nonces)
- They **don't execute real trades** because that requires:
  - Market creation
  - Token splitting
  - Full EIP-712 signing
  - Multiple contract interactions
  - Balance verification

**Solution**: Use scripts for **demonstration**, tests for **validation**

---

## Learning Path

### Beginner (Start Here)

1. ✅ Run `visual-flow-test.ts` (30 min)
   - See complete trade flow
   - Understand all 6 steps
   - Watch balance changes

2. ✅ Run `inspect-order.ts` (15 min)
   - Learn order structure
   - Understand each field

3. ✅ Read `Trading.test.ts` (20 min)
   - Understand validation rules
   - See access control

### Intermediate

4. ✅ Read integration tests (30 min)
   - Order lifecycle management
   - Multi-user scenarios

5. ✅ Read other unit tests (1 hour)
   - Auth, Fees, Nonces, Registry, Signatures
   - Comprehensive validation coverage

### Advanced

6. ✅ Read contract source (2 hours)
   - `CTFExchange.sol`
   - All 10 mixins
   - Understand implementation

7. ✅ Interactive console (1 hour)
   - Manual trade execution
   - Experiment with parameters

---

## Quick Command Reference

```bash
# Complete trade flow (RECOMMENDED START)
npx hardhat run packages/contracts/scripts/exchange/visual-flow-test.ts --network localhost

# Order structure explanation
npx hardhat run packages/contracts/scripts/exchange/inspect-order.ts --network localhost

# Validation tests
npx hardhat test packages/contracts/test/unit/exchange/Trading.test.ts

# All exchange tests
npx hardhat test packages/contracts/test/unit/exchange/*.test.ts

# Integration tests
npx hardhat test packages/contracts/test/integration/ExchangeFlow.test.ts

# All tests
yarn test
```

---

## Common Misconceptions

### ❌ Misconception 1
"I should read Trading.test.ts to understand how trades work"

### ✅ Reality
Trading.test.ts tests **validation**, not complete flows. Read **visual-flow-test.ts** instead.

---

### ❌ Misconception 2
"The tests will show me balance changes and token transfers"

### ✅ Reality
Tests verify **logic** (signatures, access control, nonces). Scripts show **flows** (balance changes, execution).

---

### ❌ Misconception 3
"There must be a test called 'should fill a sell order'"

### ✅ Reality
No such test exists. The visual flow script demonstrates this instead.

---

## File Organization

```
packages/contracts/
├── scripts/exchange/              # 👈 COMPLETE FLOW DEMONSTRATIONS
│   ├── visual-flow-test.ts       # Complete 6-step trade
│   ├── inspect-order.ts           # Order structure breakdown
│   └── README.md                  # Scripts documentation
│
├── test/unit/exchange/            # 👈 VALIDATION & ACCESS CONTROL
│   ├── Auth.test.ts              # Role management
│   ├── Fees.test.ts              # Fee calculations
│   ├── NonceManager.test.ts      # Nonce logic
│   ├── Registry.test.ts          # Token registration
│   ├── Signatures.test.ts        # EIP-712 validation
│   └── Trading.test.ts           # Order validation
│
└── test/integration/              # 👈 LIFECYCLE & MULTI-USER
    └── ExchangeFlow.test.ts      # Complete order lifecycle
```

---

## Summary

| Goal | Where to Look | Command |
|------|---------------|---------|
| **See complete trade** | `visual-flow-test.ts` | `npx hardhat run packages/contracts/scripts/exchange/visual-flow-test.ts --network localhost` |
| **Understand order fields** | `inspect-order.ts` | `npx hardhat run packages/contracts/scripts/exchange/inspect-order.ts --network localhost` |
| **Learn validation rules** | `Trading.test.ts` | `npx hardhat test packages/contracts/test/unit/exchange/Trading.test.ts` |
| **See order lifecycle** | `ExchangeFlow.test.ts` | `npx hardhat test packages/contracts/test/integration/ExchangeFlow.test.ts` |
| **Run all tests** | All test files | `yarn test` |

**Start with visual-flow-test.ts** - it's the best entry point! 🚀
