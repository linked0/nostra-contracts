// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Order} from "../libraries/OrderStructs.sol";

interface ISignatures {
    /// @notice Error for invalid signature
    error InvalidSignature();

    /// @notice Validates the signature of an order
    /// @param orderHash - The hash of the order
    /// @param order - The order
    function validateOrderSignature(bytes32 orderHash, Order memory order) external view;
}
