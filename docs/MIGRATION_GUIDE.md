# Migration Guide: Flat Structure → Monorepo

This guide explains the migration from the previous flat structure to the new monorepo architecture.

## What Changed

### Before (Flat Structure)
```
nostra-contracts/
├── contracts/
├── test/
├── scripts/
├── hardhat.config.ts
└── package.json
```

### After (Monorepo)
```
nostra-contracts/
├── packages/
│   ├── contracts/        # All contract-related files moved here
│   │   ├── contracts/
│   │   ├── test/
│   │   ├── scripts/
│   │   ├── hardhat.config.ts
│   │   └── package.json
│   └── sdk/              # New SDK package
│       ├── src/
│       └── package.json
├── package.json          # Root package.json for workspace
└── yarn.lock             # Yarn lockfile
```

## Migration Steps

If you have an existing clone of the repository, follow these steps:

### 1. Clean Up Old Dependencies

```bash
# Remove old node_modules and lock files
rm -rf node_modules
rm yarn.lock package-lock.json  # Remove existing lockfiles
```

### 2. Pull Latest Changes

```bash
git pull origin main
```

### 3. Install Dependencies

```bash
# From the root directory
yarn install
```

This will install dependencies for all packages in the workspace.

### 4. Update Your Workflow

#### Old Commands → New Commands

| Old Command | New Command | What It Does |
|------------|-------------|--------------|
| `yarn compile` | `yarn compile` | Compile contracts |
| `yarn test` | `yarn test` | Run all tests |
| `yarn test:unit` | `yarn test:unit` | Run unit tests |
| `yarn test:integration` | `yarn test:integration` | Run integration tests |
| `yarn deploy:local` | `yarn deploy:local` | Deploy to local network |
| N/A | `yarn sdk:build` | Build SDK |
| N/A | `yarn sdk:dev` | Watch mode for SDK |

#### Package-Specific Commands

You can also run commands in specific packages:

```bash
# Run tests in contracts package only
yarn workspace @nostra/contracts test

# Build SDK package only
yarn workspace @nostra/sdk build
```

## For Developers

### Importing the SDK

If you were previously importing from the contracts directly, you'll now use the SDK:

**Before:**
```typescript
// Manual import from artifacts
import MarketFactoryArtifact from './artifacts/contracts/core/MarketFactory.sol/MarketFactory.json';
```

**After:**
```typescript
// Clean SDK import
import { getMarketFactory, Network } from '@nostra/sdk';

const marketFactory = getMarketFactory(Network.POLYGON, signer);
```

### Running Tests

Tests are now located in `packages/contracts/test/`:

```bash
# Run all tests
yarn test

# Run specific test file
yarn workspace @nostra/contracts test test/unit/MarketFactory.test.ts
```

### Working with Hardhat

Hardhat configuration is now in `packages/contracts/hardhat.config.ts`:

```bash
# Run hardhat commands from root
yarn workspace @nostra/contracts hardhat <command>

# Or navigate to the contracts package
cd packages/contracts
npx hardhat <command>
```

## Benefits of the New Structure

1. **Clear Separation**: Each sub-project has its own dependencies
2. **SDK Integration**: Type-safe SDK for contract interactions
3. **Scalability**: Easy to add new packages (subgraph, CLI, etc.)
4. **Atomic Updates**: Contracts and SDK always in sync
5. **Better DX**: Consistent tooling and scripts across packages

## Adding New Packages

To add a new sub-project:

```bash
# Create package directory
mkdir -p packages/new-package

# Create package.json
cat > packages/new-package/package.json <<EOF
{
  "name": "@nostra/new-package",
  "version": "1.0.0",
  "dependencies": {
    "@nostra/sdk": "1.0.0"
  }
}
EOF

# Install dependencies
yarn install
```

## Troubleshooting

### Issue: Yarn version too old

**Solution:** Update yarn:
```bash
npm install -g yarn
# Or using corepack (Node 16+)
corepack enable
```

### Issue: Dependencies not resolving

**Solution:** Clear cache and reinstall:
```bash
rm -rf node_modules
rm -rf packages/*/node_modules
rm yarn.lock
yarn install
```

### Issue: Hardhat commands not working

**Solution:** Make sure you're using the correct workspace command:
```bash
yarn workspace @nostra/contracts compile
```

Or navigate to the contracts package:
```bash
cd packages/contracts
npx hardhat compile
```

### Issue: Tests failing with import errors

**Solution:** Rebuild everything:
```bash
yarn clean
yarn compile
yarn test
```

### Issue: "Cannot find module '@nostra/sdk'"

**Solution:** Yarn workspaces automatically links packages. Make sure you've run:
```bash
yarn install
```

## CI/CD Updates

If you have CI/CD pipelines, they should continue to work with yarn:

**Example:**
```yaml
- run: yarn install
- run: yarn compile
- run: yarn test
```

## Yarn Workspaces Features

### Hoisting
Common dependencies are automatically hoisted to the root `node_modules`, reducing duplication.

### Linking
Local packages are automatically symlinked, so changes in `@nostra/sdk` are instantly available to other packages.

### Running Scripts
```bash
# Run a script in all workspaces
yarn workspaces run build

# Run a script in a specific workspace
yarn workspace @nostra/contracts test
```

## Questions?

For questions or issues with the migration, please:
1. Check this guide thoroughly
2. Review the updated README.md
3. Open an issue on GitHub with the "migration" label
