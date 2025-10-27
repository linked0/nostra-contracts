/**
 * Contract utility functions
 */

import { Contract, Provider, Signer } from 'ethers';
import { Network } from '../types';
import { getContractAddress } from '../generated/addresses';
import { getContractABI } from '../generated/abis';

/**
 * Get a contract instance
 */
export function getContract(
  contractName: 'ConditionalTokens' | 'MarketFactory' | 'CTFExchange' | 'ResolutionOracle' | 'MockUSDC',
  network: Network,
  signerOrProvider: Signer | Provider
): Contract {
  const address = getContractAddress(network, contractName);
  if (!address) {
    throw new Error(`Contract ${contractName} not deployed on network ${network}`);
  }

  const abi = getContractABI(contractName);
  return new Contract(address, abi, signerOrProvider);
}

/**
 * Get ConditionalTokens contract instance
 */
export function getConditionalTokens(network: Network, signerOrProvider: Signer | Provider): Contract {
  return getContract('ConditionalTokens', network, signerOrProvider);
}

/**
 * Get MarketFactory contract instance
 */
export function getMarketFactory(network: Network, signerOrProvider: Signer | Provider): Contract {
  return getContract('MarketFactory', network, signerOrProvider);
}

/**
 * Get CTFExchange contract instance
 */
export function getCTFExchange(network: Network, signerOrProvider: Signer | Provider): Contract {
  return getContract('CTFExchange', network, signerOrProvider);
}

/**
 * Get ResolutionOracle contract instance
 */
export function getResolutionOracle(network: Network, signerOrProvider: Signer | Provider): Contract {
  return getContract('ResolutionOracle', network, signerOrProvider);
}

/**
 * Get MockUSDC contract instance (only available on test networks)
 */
export function getMockUSDC(network: Network, signerOrProvider: Signer | Provider): Contract {
  return getContract('MockUSDC', network, signerOrProvider);
}
