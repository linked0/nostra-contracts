# Quick Test Reference

Fast reference for testing deployed contracts.

## 🚀 Quick Start

### Option 1: Sequential Test (Recommended - 2 Minutes)
```bash
cd packages/contracts
npx hardhat run scripts/interact/sequential-test.ts --network bscTestnet
```

**Best for:** Seeing each step clearly with 3-second pauses between steps.

### Option 2: Full Demo (Fast - 30 Seconds)
```bash
npx hardhat run scripts/interact/full-demo.ts --network bscTestnet
```

**Best for:** Quick validation that everything works.

---

## 📋 Step-by-Step (5 Minutes)

### 1. Create Market
```bash
npx hardhat run scripts/interact/01-create-market.ts --network bscTestnet
```
**Save output:**
```bash
export CONDITION_ID="0xabc..."
export YES_TOKEN_ID="123..."
export NO_TOKEN_ID="456..."
```

### 2. Place Bet
```bash
npx hardhat run scripts/interact/02-place-bet.ts --network bscTestnet
```

### 3. Resolve Market
```bash
npx hardhat run scripts/interact/03-resolve-market.ts --network bscTestnet
```

### 4. Redeem Tokens
```bash
npx hardhat run scripts/interact/04-redeem-tokens.ts --network bscTestnet
```

---

## 🔍 Verify On-Chain

```bash
npx hardhat console --network bscTestnet
```

**Check token balances:**
```javascript
const ct = await ethers.getContractAt("ConditionalTokens", "0x4f4F70fCa7405f0272ff3F30b3188f67Add14d14");
const [signer] = await ethers.getSigners();
const balance = await ct.balanceOf(signer.address, "TOKEN_ID");
console.log(ethers.formatUnits(balance, 6));
```

**Check USDC balance:**
```javascript
const usdc = await ethers.getContractAt("MockUSDC", "0x091e6a020985FBE1D61f965cD4B4058509f613Fd");
const [signer] = await ethers.getSigners();
const balance = await usdc.balanceOf(signer.address);
console.log(ethers.formatUnits(balance, 6));
```

**Check resolution:**
```javascript
const ct = await ethers.getContractAt("ConditionalTokens", "0x4f4F70fCa7405f0272ff3F30b3188f67Add14d14");
const denom = await ct.payoutDenominator("CONDITION_ID");
console.log("Resolved:", denom > 0n);
```

---

## 🌐 Networks

### BSC Testnet
```bash
--network bscTestnet
```
- Faucet: https://testnet.bnbchain.org/faucet-smart
- Explorer: https://testnet.bscscan.com

### Localhost
```bash
# Terminal 1
npx hardhat node

# Terminal 2
yarn deploy:local
--network localhost
```

---

## ⚠️ Troubleshooting

| Error | Fix |
|-------|-----|
| No deployment found | Run `yarn deploy:bsc-testnet` |
| No PRIVATE_KEY | Add to `.env` file |
| Insufficient funds | Get testnet BNB from faucet |
| Not a resolver | Use deployer account |
| Market not resolved | Run step 3 first |

---

## 📊 Your Deployed Addresses

**BSC Testnet:**
```
ConditionalTokens: 0x4f4F70fCa7405f0272ff3F30b3188f67Add14d14
MarketFactory:     0x14faCA215eb6Ae1F92DC0850EfbEB983419472Da
ResolutionOracle:  0x697752AB1804974DcFB6623C28b9B2ac2130ebd2
MockUSDC:          0x091e6a020985FBE1D61f965cD4B4058509f613Fd
```

*(Check `deployments.json` for other networks)*

---

## ✅ Success Checklist

- [ ] Full demo runs without errors
- [ ] Market created
- [ ] Bet placed (got tokens)
- [ ] Market resolved
- [ ] Tokens redeemed (got USDC)

**All checked?** Your deployment works! 🎉

---

## 📚 More Info

- Full guide: `docs/TESTING_GUIDE.md`
- Script docs: `packages/contracts/scripts/interact/README.md`
- Deployment: `docs/DEPLOYMENT_GUIDE.md`
