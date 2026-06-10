// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IAaveV3.sol";

/**
 * @title  AlphaYieldStrategy
 * @notice Receives USDC from AlphaStake and immediately supplies to Aave V3 on Polygon.
 *         Owner withdrawals exit Aave directly to any address (including EOA).
 *
 * Polygonscan trace on stake:
 *   User → AlphaStake → AlphaYieldStrategy → Aave Pool V3
 */
contract AlphaYieldStrategy is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Polygon mainnet — native USDC + Aave V3
    address public constant USDC_POLYGON =
        0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359;
    address public constant AAVE_POOL_POLYGON =
        0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    address public constant AUSDC_POLYGON =
        0x625E7708f30cA75bfd92586e17077590C60eb4cD;

    IERC20 public immutable usdc;
    IERC20 public immutable aUsdc;
    IPool   public immutable aavePool;

    address public alphaStake;

    event AlphaStakeSet(address indexed alphaStake);
    event SuppliedToAave(uint256 amount, uint256 timestamp);
    event WithdrawnFromAave(address indexed to, uint256 amount);

    modifier onlyAlphaStake() {
        require(msg.sender == alphaStake, "Only AlphaStake");
        _;
    }

    constructor() Ownable(msg.sender) {
        usdc     = IERC20(USDC_POLYGON);
        aUsdc    = IERC20(AUSDC_POLYGON);
        aavePool = IPool(AAVE_POOL_POLYGON);
    }

    /// @notice Wire AlphaStake after both contracts are deployed (one-time).
    function setAlphaStake(address _alphaStake) external onlyOwner {
        require(_alphaStake != address(0), "Zero address");
        require(alphaStake == address(0), "Already set");
        alphaStake = _alphaStake;
        emit AlphaStakeSet(_alphaStake);
    }

    /// @notice Called by AlphaStake on every stake — USDC → Aave in the same tx.
    function supplyFromStake(uint256 amount) external onlyAlphaStake nonReentrant {
        require(amount > 0, "Zero amount");

        usdc.safeTransferFrom(alphaStake, address(this), amount);
        usdc.forceApprove(address(aavePool), amount);
        aavePool.supply(address(usdc), amount, address(this), 0);

        emit SuppliedToAave(amount, block.timestamp);
    }

    /// @notice Pull USDC from Aave to `to` (EOA or contract). Called by AlphaStake owner flows.
    function withdrawTo(address to, uint256 amount) external onlyAlphaStake nonReentrant {
        require(to != address(0), "Zero address");
        require(amount > 0, "Zero amount");

        uint256 withdrawn = aavePool.withdraw(address(usdc), amount, to);
        emit WithdrawnFromAave(to, withdrawn);
    }

    /// @notice aPolUSDC balance held by this strategy (= principal + accrued Aave interest).
    function aaveBalance() external view returns (uint256) {
        return aUsdc.balanceOf(address(this));
    }
}
