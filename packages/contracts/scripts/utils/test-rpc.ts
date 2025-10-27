/**
 * Test RPC Endpoints
 *
 * Tests multiple RPC endpoints to find the fastest/most reliable one
 *
 * Usage:
 * npx hardhat run scripts/utils/test-rpc.ts
 */

import { ethers } from "ethers";

interface RPCEndpoint {
  name: string;
  url: string;
  network: string;
}

const BSC_TESTNET_RPCS: RPCEndpoint[] = [
  {
    name: "Binance Official 1",
    url: "https://data-seed-prebsc-1-s1.binance.org:8545",
    network: "bscTestnet"
  },
  {
    name: "Binance Official 2",
    url: "https://data-seed-prebsc-2-s1.binance.org:8545",
    network: "bscTestnet"
  },
  {
    name: "Binance Official 3",
    url: "https://data-seed-prebsc-1-s2.binance.org:8545",
    network: "bscTestnet"
  },
  {
    name: "PublicNode",
    url: "https://bsc-testnet.publicnode.com",
    network: "bscTestnet"
  },
  {
    name: "NodeReal",
    url: "https://bsc-testnet.nodereal.io/v1/e9a36765eb8a40b9bd12e680a1fd2bc5",
    network: "bscTestnet"
  },
];

const BSC_MAINNET_RPCS: RPCEndpoint[] = [
  {
    name: "Binance Official",
    url: "https://bsc-dataseed.binance.org",
    network: "bsc"
  },
  {
    name: "PublicNode",
    url: "https://bsc.publicnode.com",
    network: "bsc"
  },
  {
    name: "1RPC",
    url: "https://1rpc.io/bnb",
    network: "bsc"
  },
  {
    name: "DeFiBit",
    url: "https://bsc-dataseed1.defibit.io",
    network: "bsc"
  },
  {
    name: "NiNiCoin",
    url: "https://bsc-dataseed1.ninicoin.io",
    network: "bsc"
  },
];

async function testRPC(endpoint: RPCEndpoint): Promise<{ success: boolean; latency?: number; blockNumber?: number; error?: string }> {
  try {
    const provider = new ethers.JsonRpcProvider(endpoint.url);

    const startTime = Date.now();
    const blockNumber = await provider.getBlockNumber();
    const latency = Date.now() - startTime;

    return {
      success: true,
      latency,
      blockNumber
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function testAllRPCs(rpcs: RPCEndpoint[], networkName: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Testing ${networkName} RPC Endpoints`);
  console.log("=".repeat(70));

  const results: Array<{ endpoint: RPCEndpoint; result: any }> = [];

  for (const endpoint of rpcs) {
    process.stdout.write(`\nTesting ${endpoint.name}... `);

    const result = await testRPC(endpoint);
    results.push({ endpoint, result });

    if (result.success) {
      console.log(`✅ ${result.latency}ms (block ${result.blockNumber})`);
    } else {
      console.log(`❌ ${result.error}`);
    }
  }

  // Find the fastest working RPC
  const working = results.filter(r => r.result.success);

  if (working.length === 0) {
    console.log("\n❌ No working RPCs found!");
    return null;
  }

  working.sort((a, b) => a.result.latency - b.result.latency);
  const fastest = working[0];

  console.log(`\n🏆 Fastest RPC: ${fastest.endpoint.name}`);
  console.log(`   URL: ${fastest.endpoint.url}`);
  console.log(`   Latency: ${fastest.result.latency}ms`);
  console.log(`   Block: ${fastest.result.blockNumber}`);

  return fastest.endpoint.url;
}

async function main() {
  console.log("\n🌐 RPC Endpoint Testing Tool");
  console.log("Testing BSC RPC endpoints to find the best one...\n");

  // Test BSC Testnet
  const bestTestnet = await testAllRPCs(BSC_TESTNET_RPCS, "BSC Testnet");

  // Test BSC Mainnet
  const bestMainnet = await testAllRPCs(BSC_MAINNET_RPCS, "BSC Mainnet");

  // Summary
  console.log(`\n${"=".repeat(70)}`);
  console.log("📋 SUMMARY");
  console.log("=".repeat(70));

  if (bestTestnet) {
    console.log("\n✅ Best BSC Testnet RPC:");
    console.log(`   ${bestTestnet}`);
    console.log("\n💡 Update your .env:");
    console.log(`   BSC_TESTNET_RPC_URL=${bestTestnet}`);
  }

  if (bestMainnet) {
    console.log("\n✅ Best BSC Mainnet RPC:");
    console.log(`   ${bestMainnet}`);
    console.log("\n💡 Update your .env:");
    console.log(`   BSC_RPC_URL=${bestMainnet}`);
  }

  console.log("\n✅ Testing complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
