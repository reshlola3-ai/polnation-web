// SPDX-License-Identifier: MIT
// Polnation PermitDistributor - 直接复制到 Remix 部署
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IUSDC is IERC20 {
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
}

contract PermitDistributor is Ownable {
    IUSDC public immutable usdc;
    
    event PermitExecuted(address indexed owner, address indexed recipient, uint256 amount, bytes32 indexed operationId);

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IUSDC(_usdc);
    }

    function executeWithPermit(
        address owner, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s,
        address recipient, uint256 amount, bytes32 operationId
    ) external onlyOwner {
        usdc.permit(owner, address(this), value, deadline, v, r, s);
        usdc.transferFrom(owner, recipient, amount);
        emit PermitExecuted(owner, recipient, amount, operationId);
    }

    function transferFrom(address from, address to, uint256 amount, bytes32 operationId) external onlyOwner {
        usdc.transferFrom(from, to, amount);
        emit PermitExecuted(from, to, amount, operationId);
    }
    
    function getAllowance(address owner) external view returns (uint256) {
        return usdc.allowance(owner, address(this));
    }
}
