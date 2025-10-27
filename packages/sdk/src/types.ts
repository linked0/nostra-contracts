/**
 * Network types supported by Nostra
 */
export enum Network {
  LOCALHOST = 'localhost',
  POLYGON = 'polygon',
  POLYGON_AMOY = 'polygon-amoy',
  BSC = 'bsc',
  BSC_TESTNET = 'bsc-testnet',
}

/**
 * Contract deployment information
 */
export interface ContractDeployment {
  address: string;
  blockNumber: number;
  deployedAt: string;
}

/**
 * Network deployment configuration
 */
export interface NetworkDeployment {
  network: Network;
  chainId: number;
  contracts: {
    ConditionalTokens: ContractDeployment;
    MarketFactory: ContractDeployment;
    CTFExchange: ContractDeployment;
    ResolutionOracle: ContractDeployment;
    MockUSDC?: ContractDeployment;
  };
}

/**
 * All network deployments
 */
export interface Deployments {
  [Network.LOCALHOST]?: NetworkDeployment;
  [Network.POLYGON]?: NetworkDeployment;
  [Network.POLYGON_AMOY]?: NetworkDeployment;
  [Network.BSC]?: NetworkDeployment;
  [Network.BSC_TESTNET]?: NetworkDeployment;
}
