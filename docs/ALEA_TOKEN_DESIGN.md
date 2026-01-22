# Alea Token Design

## Overview

This document outlines the design decisions for the stable token used in the Nostra prediction market platform.

## Token Naming Decision

### Final Decision: **Alea**

| Attribute | Value |
|-----------|-------|
| **Name** | Alea |
| **Symbol** | ALEA |
| **Decimals** | 18 |
| **Pronunciation** | AH-lay-ah (Classical Latin) or AY-lee-uh (Anglicized) |
| **Meaning** | Latin for "dice", "chance", "risk" |
| **Famous Reference** | "Alea iacta est" (The die is cast) - Julius Caesar |

### Rationale

- **Prediction markets = calculated risk/chance** - Alea captures this perfectly
- **Classical feel** - Pairs well with "Veritas" reserved for Sapiens Media
- **Short & memorable** - Easy to type, pronounce, and remember
- **Unique in crypto** - Not overused, distinctive branding

### Name Allocation Across Projects

| Project | Token Name | Concept |
|---------|------------|---------|
| **Nostra** (Prediction Market) | Alea | Chance, risk, trading |
| **Sapiens Media** (AI News) | Veritas | Truth, unbiased reporting |

---

## Technical Specifications

### Contract: `AleaToken.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AleaToken is ERC20, Ownable {
    constructor() ERC20("Alea", "ALEA") Ownable(msg.sender) {
        // Initial supply or minting logic TBD
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
```

### Key Design Decisions

| Decision | Value | Rationale |
|----------|-------|-----------|
| **Decimals** | 18 | Standard ERC20 convention, matches ETH |
| **Mintable** | TBD | Depends on tokenomics design |
| **Burnable** | TBD | Depends on use case requirements |
| **Access Control** | Ownable | Simple admin control for initial deployment |

---

## SDK Integration

### Naming Convention

| Layer | Name | Notes |
|-------|------|-------|
| **Contract** | `AleaToken` | Solidity contract name |
| **SDK Export** | `StablePoint` | Generic reference for flexibility |
| **SDK Type** | `getStablePoint()` | Getter function |
| **User-facing** | Alea | Display name in UI |

### SDK Changes Required

```typescript
// packages/sdk/src/utils/contracts.ts

// Add AleaToken support
export function getStablePoint(network: Network, signer?: Signer): AleaToken {
  const address = getAddress(network, 'AleaToken');
  return AleaToken__factory.connect(address, signer ?? getProvider(network));
}
```

### Generated Types

After contract compilation, TypeChain will generate:
- `AleaToken.ts` - Contract type
- `AleaToken__factory.ts` - Factory for deployment/connection

---

## Implementation Scope

### 1. nostra-contracts (This Repo)

| Task | Location | Status |
|------|----------|--------|
| Create `AleaToken.sol` | `packages/contracts/contracts/mocks/` | DONE |
| Add interface `IAleaToken.sol` | `packages/contracts/contracts/interfaces/` | TODO |
| Write unit tests | `packages/contracts/test/unit/AleaToken.test.ts` | DONE |
| Update deployment script | `packages/contracts/scripts/deploy/` | TODO |
| Bump package.json patch version | `packages/contracts/package.json` | DONE (1.0.1) |
| Update SDK with StablePoint getter | `packages/sdk/src/utils/contracts.ts` | DONE |
| Add AleaToken to SDK types | `packages/sdk/src/types.ts` | TODO |
| Bump SDK package.json patch version | `packages/sdk/package.json` | DONE (0.9.4) |

### 2. nostra-server (Separate Repo)

| Task | Notes |
|------|-------|
| Update SDK dependency | After SDK is published with AleaToken |
| Update token references | Replace any MockUSDC/test token references |
| Update decimal handling | Ensure 18 decimal support (may already be standard) |
| Update display names | Show "Alea" in user-facing UI |
| Update API responses | Include token metadata (name, symbol, decimals) |

### 3. Decimal Change Summary

**Current State**: MockUSDC uses 6 decimals (USDC standard)

**New State**: Alea uses 18 decimals (ETH standard)

**Impact Areas in nostra-server**:
- [ ] Amount formatting/parsing utilities
- [ ] Database storage (if storing raw amounts)
- [ ] API request/response formatting
- [ ] Frontend display formatting
- [ ] Any hardcoded decimal assumptions

---

## Open Questions

1. **Minting Strategy**: Who can mint Alea? Admin only? Bridge contract?
2. **Initial Supply**: Fixed supply or unlimited minting?
3. **Integration with CTF**: How does Alea interact with ConditionalTokens for collateral?
4. **Migration Path**: How to transition from MockUSDC in tests/staging?

---

## Timeline

| Phase | Tasks | Dependency |
|-------|-------|------------|
| **Phase 1** | Finalize design decisions | This document |
| **Phase 2** | Implement AleaToken contract + tests | Phase 1 |
| **Phase 3** | Update SDK with StablePoint | Phase 2 |
| **Phase 4** | Deploy to testnet | Phase 3 |
| **Phase 5** | Update nostra-server | Phase 4 |

---

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2025-01-22 | Initial design document | - |
| 2025-01-22 | Implemented AleaToken contract, tests, SDK integration | - |
