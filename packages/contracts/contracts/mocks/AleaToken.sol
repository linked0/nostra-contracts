// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Alea Token
 * @notice Stable token for trading in Nostra prediction market
 * @dev 18 decimals (standard ERC20)
 *
 * Name: Alea (Latin for "dice", "chance", "risk")
 * Reference: "Alea iacta est" (The die is cast) - Julius Caesar
 */
contract AleaToken is ERC20, Ownable {
    uint8 private constant _DECIMALS = 18;
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 10 ** uint256(_DECIMALS);

    constructor() ERC20("Alea", "ALEA") Ownable(msg.sender) {
        // Mint initial supply to deployer
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Mint tokens to any address (for testing)
    /// @param to - Address to mint to
    /// @param amount - Amount to mint
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Mint tokens to any address (for testing) - anyone can call
    /// @param to - Address to mint to
    /// @param amount - Amount to mint
    function mintForTesting(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
