# BSC Deployment Guide

Quick reference for deploying Nostra Prediction Market to Binance Smart Chain (BSC).

## Quick Start

### BSC Testnet

```bash
# 1. Get testnet BNB
# Visit: https://testnet.bnbchain.org/faucet-smart

# 2. Configure .env
echo "PRIVATE_KEY=0xYOUR_PRIVATE_KEY" >> .env

# 3. Deploy
yarn deploy:bsc-testnet

# 4. Test your deployment
# Your deployer account will have 10,000 test USDC automatically minted
```

### BSC Mainnet

```bash
# 1. Fund your wallet with BNB (0.1-0.2 BNB for gas)

# 2. Configure .env
cat >> .env << EOF
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
BSCSCAN_API_KEY=YOUR_API_KEY
EOF

# 3. Deploy
yarn deploy:bsc

# 4. Verify contracts (commands shown after deployment)
npx hardhat verify --network bsc <ADDRESS> <CONSTRUCTOR_ARGS>
```

## Network Information

### BSC Mainnet

- **Chain ID**: 56
- **RPC URL**: https://bsc-dataseed.binance.org
- **Explorer**: https://bscscan.com
- **Native Token**: BNB
- **USDC Address**: `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`

### BSC Testnet

- **Chain ID**: 97
- **RPC URL**: https://data-seed-prebsc-1-s1.binance.org:8545
- **Explorer**: https://testnet.bscscan.com
- **Native Token**: tBNB
- **Faucet**: https://testnet.bnbchain.org/faucet-smart

## Deployment Scripts

### BSC Testnet (`deploy-bsc-testnet.ts`)

**What it deploys:**
- ✅ ConditionalTokens
- ✅ MockUSDC (testnet only)
- ✅ ResolutionOracle
- ✅ MarketFactory
- ✅ CTFExchange

**Additional setup:**
- Adds deployer as test resolver
- Mints 10,000 test USDC to deployer
- No verification needed (testnet)

**Gas Cost:** ~0.01-0.02 tBNB

### BSC Mainnet (`deploy-bsc.ts`)

**What it deploys:**
- ✅ ConditionalTokens
- ✅ ResolutionOracle (uses real USDC)
- ✅ MarketFactory (uses real USDC)
- ✅ CTFExchange (uses real USDC)

**No MockUSDC** - uses real USDC at `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`

**Gas Cost:** ~0.05-0.1 BNB

**Requires verification** - API key needed

## Contract Verification

After mainnet deployment, verify all contracts:

```bash
# Get verification commands from deployment output
# They will look like this:

npx hardhat verify --network bsc 0xCONTRACTADDRESS
npx hardhat verify --network bsc 0xCONTRACTADDRESS "0xCONSTRUCTOR_ARG"
```

**Requirements:**
- BSCScan API key in `.env`
- Wait 30-60 seconds after deployment before verifying

## Post-Deployment Checklist

### For Testnet:

- [ ] Check deployment in `deployments.json`
- [ ] Verify you have test USDC (should be 10,000)
- [ ] Create a test market
- [ ] Test trading functionality
- [ ] Test market resolution

### For Mainnet:

- [ ] Verify all contracts on BSCScan
- [ ] Add trusted resolvers to ResolutionOracle
- [ ] Test with small amounts first
- [ ] Update frontend configuration
- [ ] Commit `deployments.json` to git
- [ ] Announce deployment

## Common Issues

### "Insufficient funds for gas"

**Testnet:**
- Get more tBNB from faucet: https://testnet.bnbchain.org/faucet-smart

**Mainnet:**
- Buy BNB on exchange
- Send 0.1-0.2 BNB to deployer wallet

### "Wrong network"

The deployment scripts validate chain ID. Make sure:
- BSC Testnet = Chain ID 97
- BSC Mainnet = Chain ID 56

Check with:
```bash
npx hardhat run --network bscTestnet <(echo "async function main() { console.log(await ethers.provider.getNetwork()); } main();")
```

### "Contract verification failed"

Common causes:
1. **No API key** - Add `BSCSCAN_API_KEY` to `.env`
2. **Too fast** - Wait 30-60 seconds after deployment
3. **Wrong args** - Copy exact args from deployment output
4. **Contract not deployed** - Check transaction on BSCScan

### "MockUSDC not deployed on mainnet"

This is correct! Mainnet uses real USDC, not MockUSDC.

Real USDC address on BSC: `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`

## Gas Optimization Tips

### Reduce Gas Costs:

1. **Deploy during low traffic** - Weekends, late night UTC
2. **Monitor gas prices** - Use https://bscscan.com/gastracker
3. **Set gas price manually** (if needed):
   ```typescript
   // In deployment script
   const tx = await contract.deploy({ gasPrice: ethers.parseUnits('5', 'gwei') });
   ```

### Typical Gas Usage (BSC Mainnet):

| Contract | Gas Used | Cost @ 5 gwei |
|----------|----------|---------------|
| ConditionalTokens | ~2.5M | ~0.0125 BNB |
| ResolutionOracle | ~1.2M | ~0.006 BNB |
| MarketFactory | ~2.8M | ~0.014 BNB |
| CTFExchange | ~3.5M | ~0.0175 BNB |
| **Total** | **~10M** | **~0.05 BNB** |

## Testing Your Deployment

### Testnet Testing Flow:

```bash
# 1. Deploy
yarn deploy:bsc-testnet

# 2. Get contract addresses from deployments.json
cat deployments.json | grep bscTestnet -A 10

# 3. Interact via Hardhat console
npx hardhat console --network bscTestnet

# 4. In console:
const factory = await ethers.getContractAt(
  "MarketFactory",
  "0xYOUR_FACTORY_ADDRESS"
);

// Create test market
const tx = await factory.createBinaryMarket(...);
```

## Security Checklist

Before mainnet deployment:

- [ ] Audit deployment scripts
- [ ] Test on testnet first
- [ ] Use hardware wallet for mainnet
- [ ] Verify constructor arguments
- [ ] Check USDC address is correct
- [ ] Have emergency pause mechanisms ready
- [ ] Monitor first transactions closely

## Resources

- **BSC Documentation**: https://docs.bnbchain.org
- **BSCScan**: https://bscscan.com
- **BSC Testnet Faucet**: https://testnet.bnbchain.org/faucet-smart
- **Hardhat BSC Guide**: https://hardhat.org/hardhat-runner/docs/guides/deploying
- **Gas Tracker**: https://bscscan.com/gastracker

## Support

Issues? Check:
1. This guide first
2. Main `DEPLOYMENT_GUIDE.md`
3. Open GitHub issue
4. BSC Developer Discord

---

**Remember:** Always test on testnet before deploying to mainnet!
