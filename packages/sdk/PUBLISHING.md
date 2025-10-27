# Publishing @nostra-dev/sdk to npm

Complete guide for publishing the Nostra SDK package to npm.

## Prerequisites

### 1. npm Account Setup
```bash
# Create account at https://www.npmjs.com/signup
# Or login if you already have one
npm login

# Verify you're logged in
npm whoami
```

### 2. Organization Setup (Optional)
If publishing under `@nostra` scope:
```bash
# Create organization at: https://www.npmjs.com/org/create
# Add team members if needed
```

### 3. Package Access
```bash
# For scoped packages, set access level
# Public (free) or Private (requires paid plan)
npm access public @nostra-dev/sdk
```

## Pre-Publishing Checklist

### ✅ Step 1: Ensure Contracts Are Deployed

The SDK needs deployed contract addresses to work:

```bash
# Check deployments.json has addresses
cat deployments.json

# Should show addresses for networks you want to support
# Example:
# {
#   "bscTestnet": {
#     "chainId": 97,
#     "contracts": {
#       "ConditionalTokens": "0x...",
#       "MarketFactory": "0x...",
#       "CTFExchange": "0x...",  # Make sure this exists!
#       "ResolutionOracle": "0x..."
#     }
#   }
# }
```

⚠️ **Important**: The SDK will fail at runtime if `deployments.json` is missing or empty!

### ✅ Step 2: Compile Contracts (Generate ABIs)

```bash
# From root directory
yarn compile

# This generates typechain-types/ which the SDK needs
```

### ✅ Step 3: Update Version Number

```bash
cd packages/sdk

# Option A: Manual edit
vim package.json  # Update "version": "1.0.0" to next version

# Option B: Use npm version (recommended)
npm version patch   # 1.0.0 -> 1.0.1 (bug fixes)
npm version minor   # 1.0.0 -> 1.1.0 (new features)
npm version major   # 1.0.0 -> 2.0.0 (breaking changes)
```

**Semantic Versioning Guidelines:**
- **Patch** (1.0.x): Bug fixes, no API changes
- **Minor** (1.x.0): New features, backward compatible
- **Major** (x.0.0): Breaking changes

### ✅ Step 4: Update Metadata (if needed)

Edit `packages/sdk/package.json`:

```json
{
  "name": "@nostra-dev/sdk",
  "version": "1.0.0",
  "description": "TypeScript SDK for interacting with Nostra Prediction Market contracts",
  "author": "Your Name or Organization",
  "homepage": "https://nostra.market",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/nostra-contracts"
  },
  "license": "MIT"
}
```

### ✅ Step 5: Build the SDK

```bash
cd packages/sdk

# Clean previous build
yarn clean

# Build TypeScript
yarn build

# Verify build output
ls -la dist/
# Should see: index.js, index.d.ts, generated/, utils/, types.js, types.d.ts
```

### ✅ Step 6: Test the Build Locally

```bash
# From packages/sdk directory

# Check what will be published
npm pack --dry-run

# This shows:
# - Package size
# - Files that will be included
# - Files that will be excluded

# Create actual tarball for testing (optional)
npm pack
# Creates: nostra-sdk-1.0.0.tgz

# Test in another project (optional)
cd /path/to/test-project
npm install /path/to/nostra-contracts/packages/sdk/nostra-sdk-1.0.0.tgz
```

### ✅ Step 7: Verify Package Contents

**Critical Check:** Make sure these files are included:

```bash
npm pack --dry-run | grep -E "(deployments.json|dist/)"

# MUST include:
# ✅ dist/                    (compiled TypeScript)
# ✅ README.md                (documentation)
# ✅ deployments.json         (contract addresses)

# Should NOT include:
# ❌ src/                     (source TypeScript)
# ❌ node_modules/            (dependencies)
# ❌ tsconfig.json            (build config)
```

## Publishing Steps

### Option A: Publish to Public npm Registry

```bash
cd packages/sdk

# Dry run (test without publishing)
npm publish --dry-run

# Publish for real
npm publish --access public

# For scoped packages (@nostra-dev/sdk), --access public is required
```

### Option B: Publish with Tag

```bash
# Publish as beta/alpha/next
npm publish --tag beta --access public

# Users install with:
# npm install @nostra-dev/sdk@beta

# Later, promote to latest:
npm dist-tag add @nostra-dev/sdk@1.0.1 latest
```

### Option C: Publish from Yarn Workspace (Recommended)

```bash
# From root directory
yarn workspace @nostra-dev/sdk publish --access public

# With version bump
yarn workspace @nostra-dev/sdk version patch
yarn workspace @nostra-dev/sdk publish --access public
```

## Post-Publishing Steps

### ✅ Step 1: Verify Publication

```bash
# Check on npm
npm view @nostra-dev/sdk

# Should show:
# - Latest version
# - Description
# - Dependencies
# - Published time

# Visit package page
open https://www.npmjs.com/package/@nostra-dev/sdk
```

### ✅ Step 2: Test Installation

```bash
# In a new directory
mkdir test-install
cd test-install
npm init -y
npm install @nostra-dev/sdk

# Verify it works
node -e "const sdk = require('@nostra-dev/sdk'); console.log(sdk);"
```

### ✅ Step 3: Update Documentation

```bash
# Update main README with installation instructions
# Update CHANGELOG.md with version changes
# Tag release in git

git tag v1.0.0
git push origin v1.0.0
```

### ✅ Step 4: Create GitHub Release (Optional)

```bash
# Using GitHub CLI
gh release create v1.0.0 \
  --title "v1.0.0 - Initial Release" \
  --notes "First stable release of @nostra-dev/sdk"

# Or manually at: https://github.com/your-org/nostra-contracts/releases/new
```

## Common Issues & Solutions

### ❌ Issue: "deployments.json not found"

**Problem**: SDK can't find contract addresses at runtime

**Solution**: Add to `package.json`:
```json
{
  "files": [
    "dist",
    "README.md",
    "deployments.json"  // Add this!
  ]
}
```

### ❌ Issue: "Module not found: typechain-types"

**Problem**: ABIs not generated

**Solution**:
```bash
yarn compile  # From root
yarn sdk:build
```

### ❌ Issue: "403 Forbidden - you must verify your email"

**Problem**: npm account email not verified

**Solution**: Check email and verify, then try again

### ❌ Issue: "Package name already exists"

**Problem**: `@nostra-dev/sdk` already taken

**Solution**:
- Use different scope: `@yourorg/sdk`
- Or request ownership transfer from current owner

### ❌ Issue: Package size too large

**Problem**: Publishing large files

**Solution**: Check `.npmignore` and `package.json` "files" field
```bash
npm pack --dry-run  # See what's included
```

## Automated Publishing with CI/CD

### GitHub Actions Workflow

Create `.github/workflows/publish-sdk.yml`:

```yaml
name: Publish SDK

on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to publish (e.g., 1.0.0)'
        required: true

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: yarn install

      - name: Compile contracts
        run: yarn compile

      - name: Build SDK
        run: yarn sdk:build

      - name: Publish to npm
        run: yarn workspace @nostra-dev/sdk publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Setup NPM_TOKEN:**
1. Generate token at: https://www.npmjs.com/settings/your-username/tokens
2. Add to GitHub: Settings → Secrets → Actions → New repository secret
3. Name: `NPM_TOKEN`, Value: `npm_xxx...`

## Version Strategy

### Development Workflow

```bash
# Feature development
1.0.0-beta.1
1.0.0-beta.2
1.0.0-rc.1

# Stable release
1.0.0

# Bug fix
1.0.1

# New feature
1.1.0

# Breaking change
2.0.0
```

### Recommended Versioning

**Tied to Contract Deployments:**
- SDK version should match contract deployment cycles
- Major version bump when contracts have breaking changes
- Minor version for new contract features
- Patch for SDK-only fixes

Example:
```
Contracts v1.0.0 deployed → SDK v1.0.0
SDK bug fix → SDK v1.0.1
New market type added → Contracts v1.1.0 → SDK v1.1.0
Breaking CTF change → Contracts v2.0.0 → SDK v2.0.0
```

## Quick Reference

```bash
# Full publishing workflow
cd packages/sdk
yarn clean
yarn build
npm version patch
npm publish --access public --dry-run  # Test first
npm publish --access public             # Real publish
git tag v$(node -p "require('./package.json').version")
git push --tags
```

## Rollback / Unpublish

```bash
# Unpublish specific version (within 72 hours)
npm unpublish @nostra-dev/sdk@1.0.1

# Deprecate version (preferred over unpublish)
npm deprecate @nostra-dev/sdk@1.0.1 "Please use v1.0.2 instead"

# Revert to previous version as latest
npm dist-tag add @nostra-dev/sdk@1.0.0 latest
```

## Support

- npm docs: https://docs.npmjs.com/
- Semantic Versioning: https://semver.org/
- npm package best practices: https://docs.npmjs.com/packages-and-modules
