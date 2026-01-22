/**
 * Token constants for Nostra SDK
 * Use these instead of calling decimals() on contracts for efficiency
 */

/**
 * Alea Token (StablePoint) decimals
 * The stable token for trading in Nostra prediction market
 */
export const ALEA_DECIMALS = 18;

/**
 * MockUSDC decimals (for testing)
 */
export const MOCK_USDC_DECIMALS = 6;

/**
 * Alias for ALEA_DECIMALS
 * Generic reference for the stable trading token
 */
export const STABLE_POINT_DECIMALS = ALEA_DECIMALS;

/**
 * Token metadata
 */
export const ALEA_TOKEN = {
  name: 'Alea',
  symbol: 'ALEA',
  decimals: ALEA_DECIMALS,
} as const;

export const MOCK_USDC_TOKEN = {
  name: 'Mock USD Coin',
  symbol: 'mUSDC',
  decimals: MOCK_USDC_DECIMALS,
} as const;
