# Quick Publish Guide

Fast reference for publishing @nostra/sdk to npm.

## Prerequisites (One-time Setup)

```bash
# Login to npm
npm login

# Verify login
npm whoami
```

## Publishing Steps

### 1. Ensure Contracts Are Deployed

```bash
# From root - check deployments.json has addresses
cat deployments.json | grep -A 10 "bscTestnet"

# Should show contract addresses
# If empty, deploy first:
yarn deploy:bsc-testnet
```

### 2. Build SDK

```bash
cd packages/sdk

# Clean previous build
yarn clean

# Build (compiles TypeScript + copies deployments.json)
yarn build
```

### 3. Verify Package

```bash
# Run automated checks
yarn verify

# Should show all green checkmarks ✓
```

### 4. Update Version

```bash
# Patch version (1.0.0 -> 1.0.1)
npm version patch

# OR minor version (1.0.0 -> 1.1.0)
npm version minor

# OR major version (1.0.0 -> 2.0.0)
npm version major
```

### 5. Test Package (Dry Run)

```bash
# See what will be published
npm publish --dry-run

# Verify these are included:
# ✓ dist/
# ✓ deployments.json
# ✓ README.md
```

### 6. Publish

```bash
# Publish to npm
npm publish --access public

# For beta releases:
npm publish --tag beta --access public
```

### 7. Verify Publication

```bash
# Check it's live
npm view @nostra/sdk

# Test install in a new project
mkdir /tmp/test-install
cd /tmp/test-install
npm install @nostra/sdk
```

### 8. Tag Release (Optional)

```bash
# Get version
VERSION=$(node -p "require('./package.json').version")

# Tag in git
git tag v$VERSION
git push origin v$VERSION

# Create GitHub release
gh release create v$VERSION --title "v$VERSION" --notes "Release notes here"
```

## Common Issues

### ❌ "deployments.json not found"

**Solution:**
```bash
yarn build  # This copies deployments.json
```

### ❌ "Not logged into npm"

**Solution:**
```bash
npm login
```

### ❌ "Package already exists"

**Solution:**
```bash
# Change version number
npm version patch
```

### ❌ "403 Forbidden"

**Solution:**
- Verify email at https://www.npmjs.com
- Check package name isn't taken
- Verify you have publish rights

## One-Liner Publish

```bash
cd packages/sdk && \
  yarn clean && \
  yarn build && \
  yarn verify && \
  npm version patch && \
  npm publish --access public
```

## Rollback

```bash
# Deprecate bad version
npm deprecate @nostra/sdk@1.0.1 "Use v1.0.2 instead"

# Unpublish (only within 72 hours)
npm unpublish @nostra/sdk@1.0.1
```

## Full Documentation

See [PUBLISHING.md](./PUBLISHING.md) for complete documentation.
