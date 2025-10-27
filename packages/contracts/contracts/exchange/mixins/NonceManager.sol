// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../interfaces/INonceManager.sol";

abstract contract NonceManager is INonceManager {
    mapping(address => uint256) public nonces;

    function incrementNonce() external override {
        updateNonce(1);
    }

    function updateNonce(uint256 val) internal {
        nonces[msg.sender] = nonces[msg.sender] + val;
    }

    function isValidNonce(address usr, uint256 nonce) public view virtual override returns (bool) {
        return nonces[usr] == nonce;
    }
}
