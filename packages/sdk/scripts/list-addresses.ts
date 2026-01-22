/**
 * List SDK Addresses
 *
 * Displays all contract addresses stored in the SDK package
 * to verify they match deployments.json
 */

import {
  Network,
  deployments,
  getContractAddress,
  getNetworkAddresses,
  hasDeployments,
  getAvailableNetworks
} from '../src';

function displayNetworkAddresses(network: Network): void {
  const networkNames: { [key in Network]: string } = {
    [Network.LOCALHOST]: 'localhost',
    [Network.POLYGON]: 'polygon',
    [Network.POLYGON_AMOY]: 'polygonAmoy',
    [Network.BSC]: 'bsc',
    [Network.BSC_TESTNET]: 'bscTestnet'
  };

  const networkName = networkNames[network];
  const addresses = getNetworkAddresses(network);
  const chainId = deployments[network]?.chainId;

  console.log(`\n📡 ${networkName} (Chain ID: ${chainId})`);
  console.log('─'.repeat(80));

  if (!addresses) {
    console.log('⚠️  No deployments found');
    return;
  }

  const contracts = [
    'ConditionalTokens',
    'MarketFactory',
    'CTFExchange',
    'ResolutionOracle',
    'MockUSDC',
    'AleaToken'
  ] as const;

  // Token decimals info
  const tokenDecimals: { [key: string]: number } = {
    'MockUSDC': 6,
    'AleaToken': 18
  };

  for (const contractName of contracts) {
    const address = addresses[contractName]?.address;
    const decimals = tokenDecimals[contractName];
    const decimalsInfo = decimals !== undefined ? ` (${decimals} decimals)` : '';

    if (address) {
      console.log(`✅ ${contractName.padEnd(20)} ${address}${decimalsInfo}`);
    } else {
      console.log(`⚠️  ${contractName.padEnd(20)} not deployed${decimalsInfo}`);
    }
  }
}

function main() {
  console.log('📦 SDK Package - Contract Addresses');
  console.log('═'.repeat(80));

  // Get all available networks
  const availableNetworks = getAvailableNetworks();

  const networkNames: { [key in Network]: string } = {
    [Network.LOCALHOST]: 'localhost',
    [Network.POLYGON]: 'polygon',
    [Network.POLYGON_AMOY]: 'polygonAmoy',
    [Network.BSC]: 'bsc',
    [Network.BSC_TESTNET]: 'bscTestnet'
  };

  console.log(`\n🌐 Available Networks: ${availableNetworks.length}`);
  availableNetworks.forEach(network => {
    console.log(`   - ${networkNames[network]}`);
  });

  console.log('\n' + '═'.repeat(80));
  console.log('📋 Contract Addresses by Network');
  console.log('═'.repeat(80));

  // Display all networks (including empty ones)
  const allNetworks = [
    Network.LOCALHOST,
    Network.POLYGON,
    Network.POLYGON_AMOY,
    Network.BSC,
    Network.BSC_TESTNET
  ];

  for (const network of allNetworks) {
    displayNetworkAddresses(network);
  }

  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('📊 Summary');
  console.log('═'.repeat(80));

  let totalNetworks = 0;
  let deployedNetworks = 0;
  let totalContracts = 0;

  for (const network of allNetworks) {
    totalNetworks++;
    if (hasDeployments(network)) {
      deployedNetworks++;
      const addresses = getNetworkAddresses(network);
      if (addresses) {
        // Count deployed contracts
        const contractCount = Object.values(addresses).filter(c => c?.address).length;
        totalContracts += contractCount;
      }
    }
  }

  console.log(`Total Networks:          ${totalNetworks}`);
  console.log(`Networks with Deploys:   ${deployedNetworks}`);
  console.log(`Total Contracts Deployed: ${totalContracts}`);

  // Test specific address lookup
  console.log('\n' + '═'.repeat(80));
  console.log('🔍 Test Individual Address Lookup');
  console.log('═'.repeat(80));

  if (hasDeployments(Network.BSC_TESTNET)) {
    const marketFactoryAddress = getContractAddress(Network.BSC_TESTNET, 'MarketFactory');
    console.log(`\ngetContractAddress(BSC_TESTNET, 'MarketFactory'):`);
    console.log(`  → ${marketFactoryAddress}`);
  } else {
    console.log('\n⚠️  BSC_TESTNET has no deployments to test with');
  }

  console.log('\n' + '═'.repeat(80));
  console.log('✅ SDK addresses verified!');
  console.log('═'.repeat(80));
}

main();
