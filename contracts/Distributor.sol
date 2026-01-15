// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Distributor
 * @notice 空投分发合约 - 用于向用户分发 USDC 和 MATIC
 * @dev 只有 owner 可以调用分发函数，用户不直接交互
 */
contract Distributor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // USDC 合约地址 (Polygon)
    IERC20 public immutable usdc;
    
    // 事件
    event USDCDistributed(address indexed recipient, uint256 amount, bytes32 indexed withdrawalId);
    event MATICDistributed(address indexed recipient, uint256 amount, bytes32 indexed withdrawalId);
    event FundsDeposited(address indexed token, uint256 amount);
    event FundsWithdrawn(address indexed token, uint256 amount, address indexed to);

    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
    }

    /**
     * @notice 分发 USDC 给用户
     * @param recipient 接收地址
     * @param amount 金额 (6位小数)
     * @param withdrawalId 提现记录ID (用于链上追踪)
     */
    function distributeUSDC(
        address recipient,
        uint256 amount,
        bytes32 withdrawalId
    ) external onlyOwner nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient USDC balance");

        usdc.safeTransfer(recipient, amount);
        
        emit USDCDistributed(recipient, amount, withdrawalId);
    }

    /**
     * @notice 分发 MATIC 给用户
     * @param recipient 接收地址
     * @param amount 金额 (18位小数)
     * @param withdrawalId 提现记录ID
     */
    function distributeMATIC(
        address payable recipient,
        uint256 amount,
        bytes32 withdrawalId
    ) external onlyOwner nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(address(this).balance >= amount, "Insufficient MATIC balance");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "MATIC transfer failed");

        emit MATICDistributed(recipient, amount, withdrawalId);
    }

    /**
     * @notice 批量分发 USDC
     * @param recipients 接收地址数组
     * @param amounts 金额数组
     * @param withdrawalIds 提现ID数组
     */
    function batchDistributeUSDC(
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32[] calldata withdrawalIds
    ) external onlyOwner nonReentrant {
        require(recipients.length == amounts.length, "Length mismatch");
        require(recipients.length == withdrawalIds.length, "Length mismatch");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        require(usdc.balanceOf(address(this)) >= totalAmount, "Insufficient USDC balance");

        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] != address(0) && amounts[i] > 0) {
                usdc.safeTransfer(recipients[i], amounts[i]);
                emit USDCDistributed(recipients[i], amounts[i], withdrawalIds[i]);
            }
        }
    }

    /**
     * @notice 管理员提取资金（紧急情况）
     * @param token 代币地址（0x0 表示 MATIC）
     * @param amount 金额
     * @param to 接收地址
     */
    function withdrawFunds(
        address token,
        uint256 amount,
        address payable to
    ) external onlyOwner {
        require(to != address(0), "Invalid recipient");

        if (token == address(0)) {
            // 提取 MATIC
            require(address(this).balance >= amount, "Insufficient balance");
            (bool success, ) = to.call{value: amount}("");
            require(success, "Transfer failed");
        } else {
            // 提取 ERC20
            IERC20(token).safeTransfer(to, amount);
        }

        emit FundsWithdrawn(token, amount, to);
    }

    /**
     * @notice 查询合约 USDC 余额
     */
    function getUSDCBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice 查询合约 MATIC 余额
     */
    function getMATICBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // 接收 MATIC
    receive() external payable {
        emit FundsDeposited(address(0), msg.value);
    }
}
