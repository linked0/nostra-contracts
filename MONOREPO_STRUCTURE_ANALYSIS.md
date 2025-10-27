# Monorepo Structure Analysis & Recommendations

**Date**: 2025-10-22
**Purpose**: Determine optimal file placement for environment files, deployment configuration, and documentation in the Nostra monorepo

---

## Current Structure Analysis

### Current File Locations

```
nostra-contracts/                    # Root
├── .env                            # ✅ GOOD - Root level (shared across packages)
├── .env.example                    # ✅ GOOD - Root level
├── deployments.json                # ✅ GOOD - Root level (shared data)
├── package.json                    # ✅ Root workspace config
├── tsconfig.json                   # ❓ REVIEW - May need to move
├── docs/                           # ✅ GOOD - Root level (project-wide docs)
│   ├── CTF_EXCHANGE_TESTING_GUIDE.md
│   ├── MIGRATION_GUIDE.md
│   ├── MONOREPO_SETUP_COMPLETE.md
│   └── SDK_ARCHITECTURE.md
├── packages/
│   ├── contracts/                  # @nostra/contracts
│   │   ├── contracts/              # Solidity source
│   │   ├── test/                   # Tests
│   │   ├── scripts/                # Deployment scripts
│   │   ├── hardhat.config.ts       # ✅ Package-specific config
│   │   └── package.json
│   └── sdk/                        # @nostra/sdk → Should be @nostra/nostra-sdk
│       ├── src/
│       └── package.json
└── reference/                      # External reference code (Polymarket)
```

### How .env is Currently Loaded

From `packages/contracts/hardhat.config.ts` (line 10):
```typescript
// Load .env from root directory (monorepo)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
```

**Status**: ✅ **Already correctly configured** - Hardhat loads `.env` from root!

---

## Recommendations

### ✅ KEEP at Root Level (No Changes Needed)

These files should stay at root because they're **shared across multiple packages**:

| File/Folder | Current Location | Recommendation | Reason |
|-------------|------------------|----------------|--------|
| `.env` | `/` | ✅ **KEEP** | Shared secrets (contracts + SDK + future packages) |
| `.env.example` | `/` | ✅ **KEEP** | Template for all packages |
| `deployments.json` | `/` | ✅ **KEEP** | Shared deployment data (contracts write, SDK reads) |
| `docs/` | `/` | ✅ **KEEP** | Project-wide documentation |
| `package.json` | `/` | ✅ **KEEP** | Workspace orchestration |
| `README.md` | `/` | ✅ **KEEP** | Project overview |
| `CLAUDE.md` | `/` | ✅ **KEEP** | Development guidelines |

**Rationale**:
- `.env` is loaded by hardhat.config.ts from root (already configured)
- `deployments.json` is written by deployment scripts and read by SDK
- `docs/` contains project-wide documentation, not package-specific

---

### 🔄 CHANGES NEEDED

#### 1. Rename SDK Package

**Current**: `packages/sdk/` → `@nostra/sdk`
**Proposed**: `packages/nostra-sdk/` → `@nostra/nostra-sdk`

**Reason**:
- More descriptive package name
- Prevents naming conflicts with generic "sdk" packages
- Better for npm publishing (unique namespace)
- Matches industry standards (e.g., `@uniswap/uniswap-sdk`)

**Changes Required**:
```bash
# Rename directory
mv packages/sdk packages/nostra-sdk

# Update package.json
# packages/nostra-sdk/package.json:
{
  "name": "@nostra/nostra-sdk",  # Changed from @nostra/sdk
  ...
}

# Update root package.json scripts
{
  "scripts": {
    "sdk:build": "yarn workspace @nostra/nostra-sdk build",
    "sdk:dev": "yarn workspace @nostra/nostra-sdk dev"
  }
}
```

---

#### 2. tsconfig.json Placement

**Current**: `/tsconfig.json` (root)
**Analysis**: Need to check if this is for workspace or just SDK

**Options**:
- **Option A**: Keep at root if it's a shared config for all TypeScript packages
- **Option B**: Move to `packages/nostra-sdk/tsconfig.json` if SDK-specific
- **Option C**: Have both - root extends, packages override

**Recommendation**: **Option C** - Root config that packages extend

```
/tsconfig.json                    # Shared base config
/packages/nostra-sdk/tsconfig.json # Extends root, SDK-specific
/packages/contracts/tsconfig.json  # If contracts need TS (for scripts/tests)
```

---

### 📁 Proposed Final Structure

```
nostra-contracts/                          # Monorepo root
│
├── .env                                  # ✅ Shared environment (gitignored)
├── .env.example                          # ✅ Template
├── deployments.json                      # ✅ Deployment addresses (committed)
├── package.json                          # ✅ Workspace config
├── tsconfig.json                         # ✅ Shared TypeScript config (base)
├── yarn.lock                             # ✅ Dependency lock
├── README.md                             # ✅ Project overview
├── CLAUDE.md                             # ✅ Development guide
│
├── docs/                                 # ✅ Project-wide documentation
│   ├── ANALYZING_EXCHANGE_FLOW.md
│   ├── CTF_EXCHANGE_TESTING_GUIDE.md
│   ├── EXCHANGE_FINAL_REPORT.md
│   ├── EXCHANGE_IMPLEMENTATION_PLAN.md
│   ├── MIGRATION_GUIDE.md
│   ├── MONOREPO_SETUP_COMPLETE.md
│   ├── SDK_ARCHITECTURE.md
│   └── TESTING_GUIDE.md
│
├── packages/
│   ├── contracts/                        # @nostra/contracts
│   │   ├── contracts/                    # Solidity source
│   │   ├── test/                         # Contract tests
│   │   ├── scripts/                      # Deployment/interaction scripts
│   │   ├── hardhat.config.ts             # Hardhat config (loads root .env)
│   │   ├── package.json                  # Package config
│   │   └── tsconfig.json                 # (Optional) Extends root
│   │
│   └── nostra-sdk/                       # @nostra/nostra-sdk (RENAMED)
│       ├── src/
│       │   ├── generated/                # Auto-generated from deployments.json
│       │   ├── utils/
│       │   ├── types.ts
│       │   └── index.ts
│       ├── dist/                         # Build output
│       ├── package.json                  # Package config
│       ├── tsconfig.json                 # Extends root tsconfig.json
│       └── README.md                     # SDK-specific docs
│
└── reference/                            # External reference (Polymarket)
    └── ctf-exchange/
```

---

## Why This Structure Works

### 1. Environment Variables (`.env`)

**Location**: `/` (root)

**Why Root**:
- ✅ Hardhat already configured to load from root (line 10 of hardhat.config.ts)
- ✅ SDK can also load from root for testing/development
- ✅ Future packages (frontend, backend) can use same .env
- ✅ Single source of truth for all secrets

**What Goes Here**:
```bash
# Network configuration
PRIVATE_KEY=0x...
POLYGON_RPC_URL=https://polygon-rpc.com
BSC_RPC_URL=https://bsc-dataseed.binance.org

# API keys for verification
POLYGONSCAN_API_KEY=...
BSCSCAN_API_KEY=...

# Development settings
REPORT_GAS=false
```

---

### 2. Deployment Data (`deployments.json`)

**Location**: `/` (root)

**Why Root**:
- ✅ Written by contracts deployment scripts
- ✅ Read by SDK to get contract addresses
- ✅ Shared across packages
- ✅ Committed to git (public data, not secrets)
- ✅ Single source of truth for all networks

**Data Flow**:
```
Deployment Script → Write → /deployments.json → Read → SDK
```

**Example**:
```json
{
  "networks": [
    {
      "name": "localhost",
      "chainId": 31337,
      "contracts": {
        "CTFExchange": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        "ConditionalTokens": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
        "MarketFactory": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
        "MockUSDC": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
      }
    }
  ]
}
```

---

### 3. Documentation (`docs/`)

**Location**: `/docs/` (root)

**Why Root**:
- ✅ Documentation is project-wide, not package-specific
- ✅ Easy to find (conventional location)
- ✅ Accessible to all contributors
- ✅ Can include docs for contracts, SDK, and future packages

**Organization**:
```
docs/
├── contracts/                    # Contract-specific docs (if needed)
│   └── exchange/
│       ├── ANALYZING_EXCHANGE_FLOW.md
│       └── CTF_EXCHANGE_TESTING_GUIDE.md
├── sdk/                          # SDK-specific docs (if needed)
│   └── SDK_ARCHITECTURE.md
└── general/                      # Project-wide docs
    ├── MIGRATION_GUIDE.md
    └── MONOREPO_SETUP_COMPLETE.md
```

**Current flat structure is fine for now**. Consider organizing by category if docs grow beyond 15-20 files.

---

### 4. Package-Specific Configs

**Location**: `packages/[package-name]/`

Each package should have:
- ✅ `package.json` - Package dependencies and scripts
- ✅ `tsconfig.json` - Package-specific TypeScript config (extends root)
- ✅ `README.md` - Package-specific usage documentation (optional)

**Example**: `packages/nostra-sdk/tsconfig.json`
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Migration Plan

### Phase 1: Rename SDK Package ✅

```bash
# 1. Rename directory
mv packages/sdk packages/nostra-sdk

# 2. Update package.json name
# Edit packages/nostra-sdk/package.json:
# "name": "@nostra/nostra-sdk"

# 3. Update root package.json scripts
# Edit package.json:
# "sdk:build": "yarn workspace @nostra/nostra-sdk build"
# "sdk:dev": "yarn workspace @nostra/nostra-sdk dev"

# 4. Reinstall dependencies
yarn install

# 5. Test
yarn sdk:build
```

### Phase 2: Verify File Locations ✅

**No changes needed** - current structure is optimal!

```bash
# Verify .env loading
grep -n "dotenv.config" packages/contracts/hardhat.config.ts
# Should show: path.resolve(__dirname, "../../.env")

# Verify deployments.json exists at root
ls -la deployments.json

# Verify docs at root
ls -la docs/
```

### Phase 3: Update Documentation References

Update any documentation that references old SDK path:
- `README.md`
- `CLAUDE.md`
- `docs/SDK_ARCHITECTURE.md`
- Any other files mentioning `@nostra/sdk`

---

## Best Practices Going Forward

### 1. Environment Files

**Never commit**:
- ❌ `.env` - Contains secrets
- ❌ Any file with `PRIVATE_KEY`

**Always commit**:
- ✅ `.env.example` - Template without secrets
- ✅ `deployments.json` - Public contract addresses

### 2. Adding New Packages

When adding a new package (e.g., `@nostra/frontend`):

```bash
# Create package directory
mkdir packages/frontend

# Create package.json
cd packages/frontend
yarn init -p

# Update name
# package.json: "name": "@nostra/frontend"

# Create tsconfig.json (extend root)
echo '{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}' > tsconfig.json

# Package can load root .env
# src/config.ts:
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
```

### 3. Documentation Organization

As project grows:
- **Keep root docs flat** until you have 15+ files
- **Then organize by category**: `docs/contracts/`, `docs/sdk/`, `docs/api/`
- **Put package-specific docs** in package README when appropriate

---

## Summary

### ✅ Files Already in Correct Location

- `.env` → Root (loaded by hardhat from `../../.env`)
- `.env.example` → Root
- `deployments.json` → Root (shared data)
- `docs/` → Root (project-wide)
- `package.json` → Root (workspace)

### 🔄 Changes Needed

1. **Rename SDK package**:
   - `packages/sdk/` → `packages/nostra-sdk/`
   - `@nostra/sdk` → `@nostra/nostra-sdk`

2. **Update references**:
   - Root `package.json` workspace scripts
   - Documentation mentioning SDK
   - Import statements in future code

### ❌ No Changes Needed

- `.env` location
- `deployments.json` location
- `docs/` location
- Hardhat config .env loading

**Current structure is already well-designed for a monorepo!** 🎉

The only change needed is renaming the SDK package for better clarity and npm publishing.
