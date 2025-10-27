// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IAssets.sol";

abstract contract Assets is IAssets {
    address internal immutable collateral;
    address internal immutable ctf;

    constructor(address _collateral, address _ctf) {
        collateral = _collateral;
        ctf = _ctf;
        IERC20(collateral).approve(ctf, type(uint256).max);
    }

    function getCollateral() public view virtual override returns (address) {
        return collateral;
    }

    function getCtf() public view virtual override returns (address) {
        return ctf;
    }
}
