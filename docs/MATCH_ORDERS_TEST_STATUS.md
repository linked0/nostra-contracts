# matchOrders Integration Test Status

**File**: `packages/contracts/test/integration/MatchOrders.test.ts`

**Status**: ⚠️ Partially Complete (3/5 tests passing)

---

## Test Results

### ✅ Passing Tests (3)

1. **Should fail matchOrders if taker order is invalid**
   - Validates that invalid taker nonce causes revert
   - Error: `InvalidNonce`

2. **Should fail matchOrders if any maker order is invalid**
   - Validates that expired maker order causes revert
   - Error: `OrderExpired`

3. **Should fail matchOrders when called by non-operator**
   - Validates access control (only operator can call)
   - Error: `NotOperator`

### ❌ Failing Tests (2)

4. **Should successfully match a taker order with a single maker order**
   - **Issue**: `ERC1155InsufficientBalance` - maker doesn't have tokens
   - **Root cause**: Token ID mismatch between test and CTF system
   - **What's wrong**: Using `ethers.id("YES_TOKEN")` but CTF uses `getPositionId(collateral, collectionId)`

5. **Should successfully match a taker order with multiple maker orders**
   - **Issue**: Same as above
   - **Root cause**: Token ID calculation doesn't match CTF system

---

## The Token ID Problem

### What We're Doing (Wrong)
```typescript
const token0 = BigInt(ethers.id("YES_TOKEN"));  // ❌ Not how CTF works

// Later in test
const makerOrder = createOrder({
  tokenId: token0,  // ❌ Wrong tokenId
  ...
});
```

### What We Should Do (Correct)
```typescript
// After splitPosition, get the actual tokenIds created
const positionId = await conditionalTokens.getPositionId(
  await collateralToken.getAddress(),
  await conditionalTokens.getCollectionId(ethers.ZeroHash, conditionId, 1)
);

// Use the actual positionId as tokenId
const makerOrder = createOrder({
  tokenId: positionId,  // ✅ Correct tokenId
  ...
});
```

---

## Why This Is Complex

The Conditional Tokens Framework (CTF) has a specific way of calculating token IDs:

1. **Condition prepared** → conditionId = keccak256(oracle, questionId, outcomeSlotCount)
2. **Position split** → collectionId = keccak256(parentCollectionId, conditionId, indexSet)
3. **Token ID** → positionId = keccak256(collateralToken, collectionId)

Our test needs to:
1. Split USDC into YES/NO tokens
2. Get the actual positionIds created
3. Use those positionIds in orders
4. Register those token pairs in the exchange

---

## Next Steps to Fix

### Option 1: Fix the Test (Recommended)
Update `MatchOrders.test.ts` to properly calculate token IDs:

```typescript
// After splitPosition
const yesCollectionId = await conditionalTokens.getCollectionId(
  ethers.ZeroHash,
  conditionId,
  1  // YES outcome (index set bit 1)
);

const noCollectionId = await conditionalTokens.getCollectionId(
  ethers.ZeroHash,
  conditionId,
  2  // NO outcome (index set bit 2)
);

const yesTokenId = await conditionalTokens.getPositionId(
  await collateralToken.getAddress(),
  yesCollectionId
);

const noTokenId = await conditionalTokens.getPositionId(
  await collateralToken.getAddress(),
  noCollectionId
);

// Register the actual token pair
await exchange.registerToken(yesTokenId, noTokenId, conditionId);

// Use yesTokenId in orders
const makerOrder = createOrder({
  tokenId: yesTokenId,  // ✅ Now correct!
  ...
});
```

### Option 2: Simplify the Test
Focus on validation tests (which all pass) and document successful flow separately:

- Keep: Access control tests ✅
- Keep: Invalid order tests ✅
- Remove: Complex successful flow tests with token transfers
- Document: Flow in a script like `visual-flow-test.ts`

---

## Current Test File Location

**Path**: `packages/contracts/test/integration/MatchOrders.test.ts`

**How to run**:
```bash
yarn workspace @nostra/contracts test test/integration/MatchOrders.test.ts
```

**Current results**:
```
✔ Should fail matchOrders if taker order is invalid
✔ Should fail matchOrders if any maker order is invalid
✔ Should fail matchOrders when called by non-operator
✗ Should successfully match a taker order with a single maker order
✗ Should successfully match a taker order with multiple maker orders

3 passing (256ms)
2 failing
```

---

## Summary

**What works**: ✅ Validation and access control tests
**What doesn't**: ❌ Successful flow tests (token ID mismatch)
**Why**: CTF token ID calculation is complex and requires proper setup
**Fix needed**: Calculate actual positionIds after splitPosition and use those in orders

**Recommendation**: Either fix the token ID calculation (Option 1) or simplify to validation-only tests (Option 2) and demonstrate successful flows in a separate script.
