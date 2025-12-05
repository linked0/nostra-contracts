// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "../interfaces/IAssets.sol";
import "../interfaces/IAssetOperations.sol";
import "../interfaces/IConditionalTokens.sol";
import "../libraries/TransferHelper.sol";
import "./Balances.sol";

/// @title Asset Operations
/// @notice Operations on the CTF and Collateral assets
/// @dev This mixin expects getCollateral() and getCtf() from Assets mixin
abstract contract AssetOperations is IAssetOperations, IAssets, Balances {
    bytes32 public constant parentCollectionId = bytes32(0);

    /// @notice Get collateral token address - must be implemented by Assets mixin
    function getCollateral() public view virtual override(IAssets, Balances) returns (address);

    /// @notice Get CTF token address - must be implemented by Assets mixin
    function getCtf() public view virtual override returns (address);

    function _getBalance(uint256 tokenId) internal virtual returns (uint256) {
        if (tokenId == 0) return IERC20(getCollateral()).balanceOf(address(this));
        return IERC1155(getCtf()).balanceOf(address(this), tokenId);
    }

    function _transfer(address from, address to, uint256 id, uint256 value) internal virtual {
        if (id == 0) return _transferCollateral(from, to, value);
        return _transferCTF(from, to, id, value);
    }

    function _transferCollateral(address from, address to, uint256 value) internal virtual {
        // Case 1: Exchange -> User (e.g. Payout)
        if (from == address(this)) {
            balances[to] += value;
            return;
        }

        // Case 2: User -> Exchange (e.g. Minting)
        if (to == address(this)) {
            require(balances[from] >= value, "Insufficient balance");
            balances[from] -= value;
            return;
        }

        // Case 3: User -> User (e.g. Trading)
        require(balances[from] >= value, "Insufficient balance");
        balances[from] -= value;
        balances[to] += value;
    }

    function _transferCTF(address from, address to, uint256 id, uint256 value) internal virtual {
        TransferHelper._transferFromERC1155(getCtf(), from, to, id, value);
    }

    function _mint(bytes32 conditionId, uint256 amount) internal virtual {
        uint256[] memory partition = new uint256[](2);
        partition[0] = 1;
        partition[1] = 2;
        IConditionalTokens(getCtf()).splitPosition(
            IERC20(getCollateral()), parentCollectionId, conditionId, partition, amount
        );
    }

    function _merge(bytes32 conditionId, uint256 amount) internal virtual {
        uint256[] memory partition = new uint256[](2);
        partition[0] = 1;
        partition[1] = 2;

        IConditionalTokens(getCtf()).mergePositions(
            IERC20(getCollateral()), parentCollectionId, conditionId, partition, amount
        );
    }
}
