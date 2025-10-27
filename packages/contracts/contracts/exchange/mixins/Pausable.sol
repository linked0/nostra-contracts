// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../interfaces/IPausable.sol";

abstract contract Pausable is IPausable {
    bool public paused = false;

    modifier notPaused() {
        if (paused) revert Paused();
        _;
    }

    function _pauseTrading() internal {
        paused = true;
        emit TradingPaused(msg.sender);
    }

    function _unpauseTrading() internal {
        paused = false;
        emit TradingUnpaused(msg.sender);
    }
}
