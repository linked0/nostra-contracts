/**
 * Contract addresses by network
 *
 * This file reads contract addresses from deployments.json.
 * Addresses are automatically updated during deployment.
 *
 * BROWSER COMPATIBLE: Uses static import instead of fs
 */

import { Network, Deployments, ContractDeployment } from '../types';
// Static import - works in both Node.js and browser
import deploymentsData from '../../deployments.json';

/**
 * Network deployment structure from deployments.json
 */
interface NetworkDeployment {
  chainId: number;
  contracts: {
    ConditionalTokens: string;
    MarketFactory: string;
    CTFExchange: string;
    ResolutionOracle: string;
    MockUSDC?: string;
  };
}

interface DeploymentsFile {
  [network: string]: NetworkDeployment;
}

/**
 * Load deployments from deployments.json
 * Browser-compatible: uses static import instead of fs
 */
function loadDeployments(): DeploymentsFile {
  return deploymentsData as DeploymentsFile;
}

/**
 * Helper to create deployment info
 */
function createDeployment(address?: string): ContractDeployment | undefined {
  if (!address || address === '') return undefined;
  return {
    address,
    blockNumber: 0, // Will be updated by deployment scripts
    deployedAt: new Date().toISOString(),
  };
}

/**
 * Convert network name from deployments.json to Network enum
 */
function normalizeNetworkName(name: string): Network | undefined {
  const mapping: { [key: string]: Network } = {
    'localhost': Network.LOCALHOST,
    'polygon': Network.POLYGON,
    'polygonAmoy': Network.POLYGON_AMOY,
    'bsc': Network.BSC,
    'bscTestnet': Network.BSC_TESTNET,
  };
  return mapping[name];
}

/**
 * Build deployments object from deployments.json
 */
function buildDeployments(): Deployments {
  const deploymentsFile = loadDeployments();
  const result: Deployments = {} as Deployments;

  for (const [networkName, deployment] of Object.entries(deploymentsFile)) {
    const network = normalizeNetworkName(networkName);
    if (!network) continue;

    result[network] = {
      network,
      chainId: deployment.chainId,
      contracts: {
        ConditionalTokens: createDeployment(deployment.contracts.ConditionalTokens)!,
        MarketFactory: createDeployment(deployment.contracts.MarketFactory)!,
        CTFExchange: createDeployment(deployment.contracts.CTFExchange)!,
        ResolutionOracle: createDeployment(deployment.contracts.ResolutionOracle)!,
        ...(deployment.contracts.MockUSDC && {
          MockUSDC: createDeployment(deployment.contracts.MockUSDC),
        }),
      },
    };
  }

  return result;
}

/**
 * All contract deployments across all networks
 *
 * Loaded from deployments.json at module initialization
 */
export const deployments: Deployments = buildDeployments();

/**
 * Get contract address for a specific network
 */
export function getContractAddress(
  network: Network,
  contractName: 'ConditionalTokens' | 'MarketFactory' | 'CTFExchange' | 'ResolutionOracle' | 'MockUSDC'
): string | undefined {
  return deployments[network]?.contracts[contractName]?.address;
}

/**
 * Get all contract addresses for a network
 */
export function getNetworkAddresses(network: Network) {
  return deployments[network]?.contracts;
}

/**
 * Check if a network has deployments
 */
export function hasDeployments(network: Network): boolean {
  const contracts = deployments[network]?.contracts;
  if (!contracts) return false;

  // Check if at least the core contracts are deployed
  return !!(
    contracts.ConditionalTokens?.address &&
    contracts.MarketFactory?.address &&
    contracts.CTFExchange?.address &&
    contracts.ResolutionOracle?.address
  );
}

/**
 * Get all available networks with deployments
 */
export function getAvailableNetworks(): Network[] {
  return Object.values(Network).filter(network => hasDeployments(network));
}
