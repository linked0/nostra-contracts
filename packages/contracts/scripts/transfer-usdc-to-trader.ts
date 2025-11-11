#!/usr/bin/env ts-node
/**
 * Transfer USDC from Deployer to Trader
 *
 * Transfers test USDC from the deployer wallet to the trader wallet.
 * Useful for funding test accounts.
 *
 * Usage:
 *   npx ts-node scripts/transfer-usdc-to-trader.ts [amount]
 *   yarn transfer:trader [amount]
 *
 * Default amount: 10000 USDC
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

interface Deployments {
  bscTestnet?: {
    chainId: number;
    contracts: {
      MockUSDC?: string;
    };
  };
}

async function main() {
  console.log(`\n${COLORS.bright}${COLORS.cyan}💸 Transfer USDC to Trader${COLORS.reset}\n`);

  // Get amount from command line or use default
  const amount = process.argv[2] ? parseFloat(process.argv[2]) : 10000;

  // Validate environment variables
  const traderPrivateKey = process.env.TRADER_PRIVATE_KEY || process.env.TRADER_1_PRIVATE_KEY;

  if (!traderPrivateKey) {
    console.error(`${COLORS.red}❌ Error: TRADER_PRIVATE_KEY or TRADER_1_PRIVATE_KEY not set in .env${COLORS.reset}`);
    process.exit(1);
  }

  // Get deployer wallet (first signer from Hardhat)
  const [deployer] = await ethers.getSigners();

  // Create trader wallet
  const traderWallet = new ethers.Wallet(traderPrivateKey);

  console.log(`${COLORS.cyan}From (Deployer):${COLORS.reset} ${deployer.address}`);
  console.log(`${COLORS.cyan}To (Trader):${COLORS.reset}     ${traderWallet.address}`);
  console.log(`${COLORS.cyan}Amount:${COLORS.reset}          ${amount} USDC\n`);

  // Load MockUSDC address from deployments.json
  const deploymentsPath = path.join(__dirname, '../../../deployments.json');

  if (!fs.existsSync(deploymentsPath)) {
    console.error(`${COLORS.red}❌ Error: deployments.json not found${COLORS.reset}`);
    console.error(`  Expected at: ${deploymentsPath}`);
    process.exit(1);
  }

  const deploymentsData: Deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf-8'));
  const mockUSDCAddress = deploymentsData.bscTestnet?.contracts?.MockUSDC;

  if (!mockUSDCAddress) {
    console.error(`${COLORS.red}❌ Error: MockUSDC address not found in deployments.json${COLORS.reset}`);
    process.exit(1);
  }

  console.log(`${COLORS.cyan}MockUSDC:${COLORS.reset}        ${mockUSDCAddress}\n`);

  // Get MockUSDC contract
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(mockUSDCAddress);

  // Get decimals and symbol
  const decimals = await mockUSDC.decimals();
  const symbol = await mockUSDC.symbol();

  console.log(`${COLORS.cyan}Token:${COLORS.reset}           ${symbol} (${decimals} decimals)\n`);

  // Check balances before transfer
  console.log(`${COLORS.bright}Balances Before Transfer:${COLORS.reset}`);

  const deployerBalanceBefore = await mockUSDC.balanceOf(deployer.address);
  const traderBalanceBefore = await mockUSDC.balanceOf(traderWallet.address);

  console.log(`  Deployer: ${ethers.formatUnits(deployerBalanceBefore, decimals)} ${symbol}`);
  console.log(`  Trader:   ${ethers.formatUnits(traderBalanceBefore, decimals)} ${symbol}\n`);

  // Calculate transfer amount
  const transferAmount = ethers.parseUnits(amount.toString(), decimals);

  // Check if deployer has enough balance
  if (deployerBalanceBefore < transferAmount) {
    console.error(`${COLORS.red}❌ Error: Insufficient balance!${COLORS.reset}`);
    console.error(`  Required: ${amount} ${symbol}`);
    console.error(`  Available: ${ethers.formatUnits(deployerBalanceBefore, decimals)} ${symbol}`);
    process.exit(1);
  }

  // Execute transfer
  console.log(`${COLORS.bright}Executing transfer...${COLORS.reset}`);

  try {
    const tx = await mockUSDC.transfer(traderWallet.address, transferAmount);
    console.log(`  Transaction hash: ${tx.hash}`);

    console.log(`  Waiting for confirmation...`);
    const receipt = await tx.wait();

    if (receipt?.status === 1) {
      console.log(`${COLORS.green}✅ Transfer successful!${COLORS.reset}\n`);
    } else {
      console.log(`${COLORS.red}❌ Transfer failed!${COLORS.reset}\n`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`${COLORS.red}❌ Transfer failed:${COLORS.reset}`, error.message);
    process.exit(1);
  }

  // Check balances after transfer
  console.log(`${COLORS.bright}Balances After Transfer:${COLORS.reset}`);

  const deployerBalanceAfter = await mockUSDC.balanceOf(deployer.address);
  const traderBalanceAfter = await mockUSDC.balanceOf(traderWallet.address);

  console.log(`  Deployer: ${ethers.formatUnits(deployerBalanceAfter, decimals)} ${symbol}`);
  console.log(`  Trader:   ${ethers.formatUnits(traderBalanceAfter, decimals)} ${symbol}\n`);

  // Show changes
  const deployerChange = deployerBalanceAfter - deployerBalanceBefore;
  const traderChange = traderBalanceAfter - traderBalanceBefore;

  console.log(`${COLORS.bright}Changes:${COLORS.reset}`);
  console.log(`  Deployer: ${deployerChange < 0n ? '' : '+'}${ethers.formatUnits(deployerChange, decimals)} ${symbol}`);
  console.log(`  Trader:   ${traderChange < 0n ? '' : '+'}${ethers.formatUnits(traderChange, decimals)} ${symbol}\n`);

  console.log(`${COLORS.green}✓ Transfer complete!${COLORS.reset}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`\n${COLORS.red}❌ Error:${COLORS.reset}`, error.message);
    process.exit(1);
  });
