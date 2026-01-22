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
  contractName: 'ConditionalTokens' | 'MarketFactory' | 'CTFExchange' | 'ResolutionOracle' | 'MockUSDC' | 'AleaToken',
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

/**
 * Get AleaToken contract instance
 * Alea is the stable token for trading in Nostra prediction market (18 decimals)
 */
export function getAleaToken(network: Network, signerOrProvider: Signer | Provider): Contract {
  return getContract('AleaToken', network, signerOrProvider);
}

/**
 * Get StablePoint (AleaToken) contract instance
 * Alias for getAleaToken - provides a generic reference for the stable trading token
 */
export function getStablePoint(network: Network, signerOrProvider: Signer | Provider): Contract {
  return getAleaToken(network, signerOrProvider);
}
