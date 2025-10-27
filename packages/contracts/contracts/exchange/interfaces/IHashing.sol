// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../libraries/OrderStructs.sol";

interface IHashing {
    /// @notice Computes the hash for an order
    /// @param order - The order to be hashed
    function hashOrder(Order memory order) external view returns (bytes32);
}
