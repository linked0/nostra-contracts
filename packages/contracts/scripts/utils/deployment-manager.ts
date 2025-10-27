/**
 * Deployment Manager
 *
 * Handles reading and writing contract addresses to deployments.json
 * Separates deployment artifacts from secrets (.env)
 */

import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';

export interface NetworkDeployment {
  chainId: number;
  contracts: {
    ConditionalTokens: string;
    MarketFactory: string;
    CTFExchange?: string;
    ResolutionOracle: string;
    MockUSDC?: string;
  };
}

export interface DeploymentsFile {
  [network: string]: NetworkDeployment;
}

export interface DeployedContracts {
  ConditionalTokens: string;
  MarketFactory: string;
  CTFExchange?: string;
  ResolutionOracle: string;
  MockUSDC?: string;
}

/**
 * Path to deployments.json in project root
 */
function getDeploymentsPath(): string {
  return path.join(__dirname, '../../../../deployments.json');
}

/**
 * Read all deployments from deployments.json
 */
export function readDeployments(): DeploymentsFile {
  const deploymentsPath = getDeploymentsPath();

  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(`deployments.json not found at ${deploymentsPath}`);
  }

  const content = fs.readFileSync(deploymentsPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Read deployments for a specific network
 */
export function readNetworkDeployment(network: string): NetworkDeployment | undefined {
  const deployments = readDeployments();
  return deployments[network];
}

/**
 * Write deployment addresses for a network
 */
export function writeDeployment(
  network: string,
  chainId: number,
  contracts: DeployedContracts
): void {
  const deploymentsPath = getDeploymentsPath();

  // Read existing deployments
  let deployments: DeploymentsFile = {};
  if (fs.existsSync(deploymentsPath)) {
    const content = fs.readFileSync(deploymentsPath, 'utf-8');
    deployments = JSON.parse(content);
  }

  // Update network deployment
  deployments[network] = {
    chainId,
    contracts: {
      ConditionalTokens: contracts.ConditionalTokens,
      MarketFactory: contracts.MarketFactory,
      ResolutionOracle: contracts.ResolutionOracle,
      ...(contracts.CTFExchange && contracts.CTFExchange !== ethers.ZeroAddress && { CTFExchange: contracts.CTFExchange }),
      ...(contracts.MockUSDC && { MockUSDC: contracts.MockUSDC }),
    },
  };

  // Write back to file with pretty formatting
  fs.writeFileSync(
    deploymentsPath,
    JSON.stringify(deployments, null, 2) + '\n'
  );

  console.log(`\n✅ Updated deployments.json with ${network} contract addresses`);
  console.log(`📁 Location: ${deploymentsPath}`);
}

/**
 * Display deployed contract addresses
 */
export function displayDeployment(network: string, contracts: DeployedContracts): void {
  console.log(`\n🚀 Deployment complete on ${network}!`);
  console.log('\n📋 Contract Addresses:');
  console.log('─'.repeat(80));
  console.log(`ConditionalTokens: ${contracts.ConditionalTokens}`);
  console.log(`MarketFactory:     ${contracts.MarketFactory}`);
  if (contracts.CTFExchange && contracts.CTFExchange !== ethers.ZeroAddress) {
    console.log(`CTFExchange:       ${contracts.CTFExchange}`);
  }
  console.log(`ResolutionOracle:  ${contracts.ResolutionOracle}`);
  if (contracts.MockUSDC) {
    console.log(`MockUSDC:          ${contracts.MockUSDC}`);
  }
  console.log('─'.repeat(80));
}

/**
 * Verify all required contracts are deployed
 */
export function verifyDeployment(contracts: DeployedContracts): boolean {
  const required = ['ConditionalTokens', 'MarketFactory', 'ResolutionOracle'];

  for (const contract of required) {
    const address = contracts[contract as keyof DeployedContracts];
    if (!address || address === '') {
      console.error(`❌ Missing deployment for ${contract}`);
      return false;
    }
  }

  return true;
}
