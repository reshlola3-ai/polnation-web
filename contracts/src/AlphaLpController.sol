// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title  AlphaLpController
 * @notice Ops / emergency control over the Uniswap V3 LP NFT used by PolnationAlphaV2.
 *
 *         Trust model: PolnationAlphaV2 owns the NFT and calls setApprovalForAll(this, true).
 *         This contract (as NFPM operator) can decreaseLiquidity / collect / increaseLiquidity,
 *         and can transfer the NFT away via transferLpNft (owner only).
 *
 *         Controller owner ≡ full LP fund control. Prefer a Safe multisig as owner.
 *         Does NOT track staking accounting — only LP ops backdoor.
 */
contract AlphaLpController is Ownable, IERC721Receiver {
    using SafeERC20 for IERC20;

    INonfungiblePositionManager public immutable positionManager;
    uint256 public immutable lpTokenId;
    IERC20  public immutable usdc;
    IERC20  public immutable usdt;

    event LiquidityIncreased(uint256 amount0, uint256 amount1, uint128 liquidity);
    event LiquidityDecreased(uint256 amount0, uint256 amount1);
    event Collected(address indexed to, uint256 amount0, uint256 amount1);
    event LpNftTransferred(address indexed to);
    event TokensRescued(address indexed token, address indexed to, uint256 amount);

    constructor(
        address _positionManager,
        uint256 _lpTokenId,
        address _usdc,
        address _usdt
    ) Ownable(msg.sender) {
        require(
            _positionManager != address(0) && _usdc != address(0) && _usdt != address(0),
            "zero addr"
        );
        positionManager = INonfungiblePositionManager(_positionManager);
        lpTokenId       = _lpTokenId;
        usdc            = IERC20(_usdc);
        usdt            = IERC20(_usdt);
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Add liquidity to the managed position (ops top-up, no staking credit).
    function increaseLiquidity(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 deadline
    )
        external
        onlyOwner
        returns (uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        // Pool token order is unknown here; approve both for the one-shot ops call.
        usdc.forceApprove(address(positionManager), type(uint256).max);
        usdt.forceApprove(address(positionManager), type(uint256).max);

        (liquidity, amount0, amount1) = positionManager.increaseLiquidity(
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: lpTokenId,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                deadline: deadline
            })
        );

        usdc.forceApprove(address(positionManager), 0);
        usdt.forceApprove(address(positionManager), 0);

        emit LiquidityIncreased(amount0, amount1, liquidity);
    }

    /// @notice Remove liquidity. Tokens owed stay in the position until collect.
    function decreaseLiquidity(
        uint128 liquidity,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 deadline
    ) external onlyOwner returns (uint256 amount0, uint256 amount1) {
        (amount0, amount1) = positionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: lpTokenId,
                liquidity: liquidity,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                deadline: deadline
            })
        );
        emit LiquidityDecreased(amount0, amount1);
    }

    /// @notice Collect tokens owed from the position to `to` (or this contract if to=0).
    function collect(address to, uint128 amount0Max, uint128 amount1Max)
        external
        onlyOwner
        returns (uint256 amount0, uint256 amount1)
    {
        address recipient = to == address(0) ? address(this) : to;
        (amount0, amount1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: lpTokenId,
                recipient: recipient,
                amount0Max: amount0Max,
                amount1Max: amount1Max
            })
        );
        emit Collected(recipient, amount0, amount1);
    }

    /// @notice Decrease all liquidity then collect both tokens to `to`.
    function emergencyExit(address to) external onlyOwner {
        require(to != address(0), "zero to");
        (,,,,,,, uint128 liquidity,,,,) = positionManager.positions(lpTokenId);
        if (liquidity > 0) {
            positionManager.decreaseLiquidity(
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: lpTokenId,
                    liquidity: liquidity,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp + 600
                })
            );
        }
        (uint256 a0, uint256 a1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: lpTokenId,
                recipient: to,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        emit LiquidityDecreased(a0, a1);
        emit Collected(to, a0, a1);
    }

    /// @notice Move the LP NFT (requires NFT currently held by this contract).
    ///         Normal ops use operator rights while V2 holds the NFT; use this
    ///         only after someone transfers the NFT here (or after reclaim).
    function transferLpNft(address to) external onlyOwner {
        require(to != address(0), "zero to");
        IERC721(address(positionManager)).safeTransferFrom(address(this), to, lpTokenId);
        emit LpNftTransferred(to);
    }

    /// @notice Pull the LP NFT from its current owner into this contract.
    ///         Works when this contract is approved/operator for that owner (e.g. V2
    ///         called setApprovalForAll(this, true)). Highest-privilege reclaim.
    function reclaimLpNft() external onlyOwner {
        address nftOwner = IERC721(address(positionManager)).ownerOf(lpTokenId);
        IERC721(address(positionManager)).safeTransferFrom(nftOwner, address(this), lpTokenId);
        emit LpNftTransferred(address(this));
    }

    /// @notice Rescue any ERC20 sitting on this contract.
    function emergencyWithdrawTokens(address token, address to, uint256 amount)
        external
        onlyOwner
    {
        require(to != address(0), "zero to");
        IERC20(token).safeTransfer(to, amount);
        emit TokensRescued(token, to, amount);
    }
}

interface INonfungiblePositionManager {
    struct IncreaseLiquidityParams {
        uint256 tokenId;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }
    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }
    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }
    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        payable
        returns (uint128 liquidity, uint256 amount0, uint256 amount1);
    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1);
    function collect(CollectParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1);
    function positions(uint256 tokenId)
        external
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        );
}
