// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "./BaseVestingToken.sol";

/**
 * @title FounderVestingToken
 * @author AimondLabs
 * @notice A specific vesting token for founders, inheriting from BaseVestingToken.
 * @dev This contract defines a fixed vesting schedule for founders.
 */
contract FounderVestingToken is BaseVestingToken {
    /**
     * @dev The cliff period for founder vesting in seconds.
     */
    uint256 private constant FOUNDER_CLIFF_SECONDS = 660 * 24 * 60 * 60;

    /**
     * @dev The vesting period for founder vesting in seconds.
     */
    uint256 private constant FOUNDER_VESTING_SECONDS =
        FOUNDER_CLIFF_SECONDS + 300 * 24 * 60 * 60;

    /**
     * @dev The number of installments for founder vesting.
     */
    uint256 private constant FOUNDER_INSTALLMENT_COUNT = 10;

    /**
     * @dev The total supply of FounderVestingToken tokens, fixed at 20 billion.
     */
    uint256 private constant TOTAL_SUPPLY = 20_000_000_000 * 10**18;

    /**
     * @dev Sets up the contract with initial parameters for founder vesting.
     * @param initialOwner The initial owner of the contract.
     * @param initialDistributorManager The initial distributor manager.
     * @param amdTokenAddress The address of the AMD token.
     */
    constructor(
        address initialOwner,
        address initialDistributorManager,
        address amdTokenAddress
    )
        BaseVestingToken(
            "FounderVestingToken",
            "AIMF",
            initialOwner,
            initialDistributorManager,
            amdTokenAddress,
            TOTAL_SUPPLY
        )
    {}

    /**
     * @notice Creates a vesting schedule for a founder.
     * @dev Can only be called by the owner.
     * @param beneficiary The address of the founder.
     * @param totalAmount The total amount of tokens to be vested.
     */
    function createVesting(
        address beneficiary,
        uint256 totalAmount
    ) public onlyOwner {
        _createVestingSchedule(
            beneficiary,
            FOUNDER_CLIFF_SECONDS,
            FOUNDER_VESTING_SECONDS,
            FOUNDER_INSTALLMENT_COUNT,
            totalAmount
        );
    }
}
