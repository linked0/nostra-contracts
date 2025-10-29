/**
 * SDK Address Validation Script
 *
 * Verifies that addresses returned by the SDK match those in deployments.json
 * This ensures the SDK is correctly reading and exposing deployment addresses.
 */

import { readDeployments } from './deployment-manager';
import { Network, getContractAddress, getNetworkAddresses, hasDeployments } from '@nostra-dev/sdk';

interface ValidationResult {
  network: string;
  chainId: number;
  contracts: {
    [contractName: string]: {
      expected: string | undefined;
      actual: string | undefined;
      match: boolean;
    };
  };
  success: boolean;
}

/**
 * Validate SDK addresses against deployments.json
 */
function validateSDKAddresses(): ValidationResult[] {
  console.log('🔍 Validating SDK Addresses Against deployments.json\n');
  console.log('═'.repeat(80));

  const deploymentsFile = readDeployments();
  const results: ValidationResult[] = [];
  let totalMismatches = 0;
  let totalValidated = 0;

  // Network name mapping (deployments.json -> SDK Network enum)
  const networkMapping: { [key: string]: Network } = {
    'localhost': Network.LOCALHOST,
    'polygon': Network.POLYGON,
    'polygonAmoy': Network.POLYGON_AMOY,
    'bsc': Network.BSC,
    'bscTestnet': Network.BSC_TESTNET,
  };

  // Validate each network
  for (const [networkName, deployment] of Object.entries(deploymentsFile)) {
    const network = networkMapping[networkName];

    if (!network) {
      console.log(`⚠️  Unknown network: ${networkName} (skipping)`);
      continue;
    }

    console.log(`\n📡 Network: ${networkName} (Chain ID: ${deployment.chainId})`);
    console.log('─'.repeat(80));

    const result: ValidationResult = {
      network: networkName,
      chainId: deployment.chainId,
      contracts: {},
      success: true,
    };

    // Contract names to validate
    const contractNames: Array<'ConditionalTokens' | 'MarketFactory' | 'CTFExchange' | 'ResolutionOracle' | 'MockUSDC'> = [
      'ConditionalTokens',
      'MarketFactory',
      'CTFExchange',
      'ResolutionOracle',
      'MockUSDC',
    ];

    // Validate each contract
    for (const contractName of contractNames) {
      const expected = deployment.contracts[contractName];
      const actual = getContractAddress(network, contractName);

      // Normalize empty strings to undefined for comparison
      const normalizedExpected = expected === '' ? undefined : expected;
      const normalizedActual = actual === '' ? undefined : actual;

      const match = normalizedExpected === normalizedActual;
      result.contracts[contractName] = { expected: normalizedExpected, actual: normalizedActual, match };

      if (normalizedExpected || normalizedActual) {
        totalValidated++;

        if (match) {
          console.log(`✅ ${contractName.padEnd(20)} ${normalizedExpected || 'not deployed'}`);
        } else {
          console.log(`❌ ${contractName.padEnd(20)} MISMATCH!`);
          console.log(`   Expected: ${normalizedExpected || 'undefined'}`);
          console.log(`   SDK Got:  ${normalizedActual || 'undefined'}`);
          result.success = false;
          totalMismatches++;
        }
      }
    }

    // Validate hasDeployments() function
    const sdkHasDeployments = hasDeployments(network);
    const shouldHaveDeployments = !!(
      deployment.contracts.ConditionalTokens && deployment.contracts.ConditionalTokens !== '' &&
      deployment.contracts.MarketFactory && deployment.contracts.MarketFactory !== '' &&
      deployment.contracts.CTFExchange && deployment.contracts.CTFExchange !== '' &&
      deployment.contracts.ResolutionOracle && deployment.contracts.ResolutionOracle !== ''
    );

    if (sdkHasDeployments !== shouldHaveDeployments) {
      console.log(`❌ hasDeployments() returned ${sdkHasDeployments}, expected ${shouldHaveDeployments}`);
      result.success = false;
      totalMismatches++;
    }

    // Validate getNetworkAddresses() function
    const networkAddresses = getNetworkAddresses(network);
    if (networkAddresses) {
      let addressMismatch = false;

      for (const contractName of contractNames) {
        const expected = deployment.contracts[contractName];
        const actual = networkAddresses[contractName]?.address;

        // Normalize empty strings to undefined for comparison
        const normalizedExpected = expected === '' ? undefined : expected;
        const normalizedActual = actual === '' ? undefined : actual;

        if (normalizedExpected !== normalizedActual) {
          addressMismatch = true;
          console.log(`   Mismatch in ${contractName}: expected ${normalizedExpected}, got ${normalizedActual}`);
        }
      }

      if (addressMismatch) {
        console.log(`❌ getNetworkAddresses() returned incorrect addresses`);
        result.success = false;
        totalMismatches++;
      }
    }

    results.push(result);
  }

  // Summary
  console.log('\n═'.repeat(80));
  console.log('📊 VALIDATION SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total Networks:    ${results.length}`);
  console.log(`Total Contracts:   ${totalValidated}`);
  console.log(`Mismatches Found:  ${totalMismatches}`);

  const successfulNetworks = results.filter(r => r.success).length;
  console.log(`\n${successfulNetworks === results.length ? '✅' : '❌'} ${successfulNetworks}/${results.length} networks passed validation`);

  if (totalMismatches === 0) {
    console.log('\n🎉 All SDK addresses match deployments.json!');
  } else {
    console.log('\n⚠️  SDK addresses do NOT match deployments.json!');
    console.log('   Please rebuild the SDK with: yarn sdk:build');
  }

  console.log('═'.repeat(80));

  return results;
}

/**
 * Main execution
 */
async function main() {
  try {
    const results = validateSDKAddresses();

    // Exit with error if validation failed
    const allValid = results.every(r => r.success);
    if (!allValid) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Validation Error:', error);
    process.exit(1);
  }
}

main();
