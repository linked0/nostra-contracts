// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IAuth {
    /// @notice Emitted when a new admin is added
    event NewAdmin(address indexed newAdminAddress, address admin);

    /// @notice Emitted when a new operator is added
    event NewOperator(address indexed newOperatorAddress, address admin);

    /// @notice Emitted when an admin is removed
    event RemovedAdmin(address indexed removedAdmin, address admin);

    /// @notice Emitted when an operator is removed
    event RemovedOperator(address indexed removedOperator, address admin);

    /// @notice Error when caller is not an admin
    error NotAdmin();

    /// @notice Error when caller is not an operator
    error NotOperator();

    /// @notice Check if an address is an admin
    function isAdmin(address usr) external view returns (bool);

    /// @notice Check if an address is an operator
    function isOperator(address usr) external view returns (bool);

    /// @notice Add a new admin
    function addAdmin(address admin_) external;

    /// @notice Add a new operator
    function addOperator(address operator_) external;

    /// @notice Remove an admin
    function removeAdmin(address admin) external;

    /// @notice Remove an operator
    function removeOperator(address operator) external;

    /// @notice Renounce admin role
    function renounceAdminRole() external;

    /// @notice Renounce operator role
    function renounceOperatorRole() external;
}
