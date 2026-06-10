// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AlphaYieldStrategy.sol";

/**
 * @title  AlphaStake
 * @notice Users lock USDC for a fixed tier period. Each stake is immediately supplied
 *         to Aave V3 on Polygon via AlphaYieldStrategy (visible on Polygonscan).
 *         Platform rewards / redemptions are handled off-chain (Polnation withdraw).
 *
 * Key mechanics:
 *  - 5 lock tiers: 15 / 30 / 60 / 150 / 300 days
 *  - Minimum stake: $1 USDC
 *  - Every stake → instant Aave supply (same transaction)
 *  - Users can withdraw principal on-chain after unlock, or emergency unstake early
 *  - Owner withdrawals: pull from Aave to EOA — <$50k instant, >=$50k 48h timelock
 */
contract AlphaStake is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant MIN_STAKE          = 1 * 1e6;        // $1 USDC (6 dec)
    uint256 public constant EARLY_PENALTY_BPS  = 1500;           // 15.00%
    uint256 public constant TIMELOCK_THRESHOLD = 50_000 * 1e6;   // $50,000 USDC
    uint256 public constant TIMELOCK_DELAY     = 48 hours;
    uint8   public constant TIER_COUNT         = 5;

    // ─── Token & Strategy ─────────────────────────────────────────────────────

    IERC20 public immutable usdc;
    AlphaYieldStrategy public immutable yieldStrategy;

    // ─── Tiers ────────────────────────────────────────────────────────────────

    struct Tier {
        uint64 duration;       // seconds
        uint16 dailyRateBps;   // basis points/day  (100 = 1.00%)
    }

    Tier[TIER_COUNT] public tiers;

    // ─── Positions ────────────────────────────────────────────────────────────

    struct Position {
        address user;
        uint256 amount;      // principal in USDC (6 decimals)
        uint8   tierId;
        uint64  startTime;
        uint64  unlockTime;
        bool    closed;
    }

    mapping(uint256 => Position)  public positions;
    mapping(address => uint256[]) public userPositionIds;
    uint256 public nextPositionId;

    // ─── Timelock Withdrawals (owner pulls from Aave) ─────────────────────────

    struct PendingWithdrawal {
        address to;
        uint256 amount;
        uint256 executeAfter;
        bool    executed;
        bool    cancelled;
    }

    mapping(uint256 => PendingWithdrawal) public pendingWithdrawals;
    uint256 public nextWithdrawalId;

    // ─── Accounting ───────────────────────────────────────────────────────────

    uint256 public totalStaked;   // sum of open positions' principal
    uint256 public penaltyPool;   // accumulated early-unstake penalties

    // ─── Events ───────────────────────────────────────────────────────────────

    event Staked(
        uint256 indexed positionId,
        address indexed user,
        uint256 amount,
        uint8   tierId,
        uint64  unlockTime
    );
    event SuppliedToAave(uint256 indexed positionId, uint256 amount);
    event Withdrawn(
        uint256 indexed positionId,
        address indexed user,
        uint256 amount
    );
    event EarlyUnstaked(
        uint256 indexed positionId,
        address indexed user,
        uint256 returned,
        uint256 penalty
    );
    event WithdrawalQueued(
        uint256 indexed withdrawalId,
        address indexed to,
        uint256 amount,
        uint256 executeAfter
    );
    event WithdrawalExecuted(
        uint256 indexed withdrawalId,
        address indexed to,
        uint256 amount
    );
    event WithdrawalCancelled(uint256 indexed withdrawalId);
    event OwnerWithdrewInstant(address indexed to, uint256 amount);
    event PenaltiesWithdrawn(address indexed to, uint256 amount);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _usdc, address _yieldStrategy) Ownable(msg.sender) {
        require(_usdc != address(0), "Zero USDC address");
        require(_yieldStrategy != address(0), "Zero strategy address");
        usdc = IERC20(_usdc);
        yieldStrategy = AlphaYieldStrategy(_yieldStrategy);

        tiers[0] = Tier({ duration: uint64(15  days), dailyRateBps: 100 });
        tiers[1] = Tier({ duration: uint64(30  days), dailyRateBps: 110 });
        tiers[2] = Tier({ duration: uint64(60  days), dailyRateBps: 120 });
        tiers[3] = Tier({ duration: uint64(150 days), dailyRateBps: 130 });
        tiers[4] = Tier({ duration: uint64(300 days), dailyRateBps: 150 });
    }

    // ─── User: Stake ──────────────────────────────────────────────────────────

    /// @notice Stake USDC; funds are supplied to Aave in the same transaction.
    function stake(uint256 amount, uint8 tierId)
        external
        whenNotPaused
        nonReentrant
    {
        _validateStake(amount, tierId);
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 positionId = _createPosition(msg.sender, amount, tierId);
        _supplyToAave(amount, positionId);
    }

    /// @notice Stake with EIP-2612 permit; funds are supplied to Aave in the same transaction.
    function stakeWithPermit(
        uint256 amount,
        uint8   tierId,
        uint256 deadline,
        uint8   v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused nonReentrant {
        _validateStake(amount, tierId);
        IERC20Permit(address(usdc)).permit(
            msg.sender, address(this), amount, deadline, v, r, s
        );
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 positionId = _createPosition(msg.sender, amount, tierId);
        _supplyToAave(amount, positionId);
    }

    function _validateStake(uint256 amount, uint8 tierId) internal pure {
        require(tierId < TIER_COUNT, "Invalid tier");
        require(amount >= MIN_STAKE, "Below $1 minimum");
    }

    function _createPosition(address user, uint256 amount, uint8 tierId)
        internal
        returns (uint256 posId)
    {
        uint64 start  = uint64(block.timestamp);
        uint64 unlock = uint64(block.timestamp + tiers[tierId].duration);

        posId = nextPositionId++;
        positions[posId] = Position({
            user:       user,
            amount:     amount,
            tierId:     tierId,
            startTime:  start,
            unlockTime: unlock,
            closed:     false
        });
        userPositionIds[user].push(posId);
        totalStaked += amount;

        emit Staked(posId, user, amount, tierId, unlock);
    }

    function _supplyToAave(uint256 amount, uint256 positionId) internal {
        usdc.forceApprove(address(yieldStrategy), amount);
        yieldStrategy.supplyFromStake(amount);
        emit SuppliedToAave(positionId, amount);
    }

    // ─── User: Unstake ────────────────────────────────────────────────────────

    /// @notice Withdraw 100% of principal after the lock period expires.
    ///         Pulls USDC back from Aave in the same transaction.
    function withdraw(uint256 positionId)
        external
        whenNotPaused
        nonReentrant
    {
        Position storage pos = positions[positionId];
        require(pos.user == msg.sender, "Not your position");
        require(!pos.closed, "Already closed");
        require(block.timestamp >= pos.unlockTime, "Still locked");

        uint256 amount = pos.amount;
        pos.closed = true;
        totalStaked -= amount;

        yieldStrategy.withdrawTo(address(this), amount);
        usdc.safeTransfer(msg.sender, amount);

        emit Withdrawn(positionId, msg.sender, amount);
    }

    /// @notice Unstake early. 15% penalty deducted from principal.
    ///         Pulls USDC back from Aave, pays user, and leaves penalty in this contract.
    function emergencyUnstake(uint256 positionId)
        external
        whenNotPaused
        nonReentrant
    {
        Position storage pos = positions[positionId];
        require(pos.user == msg.sender, "Not your position");
        require(!pos.closed, "Already closed");
        require(block.timestamp < pos.unlockTime, "Lock expired - use withdraw()");

        uint256 principal = pos.amount;
        uint256 penalty = (principal * EARLY_PENALTY_BPS) / 10_000;
        uint256 returned = principal - penalty;

        pos.closed = true;
        totalStaked -= principal;
        penaltyPool += penalty;

        yieldStrategy.withdrawTo(address(this), principal);
        usdc.safeTransfer(msg.sender, returned);

        emit EarlyUnstaked(positionId, msg.sender, returned, penalty);
    }

    // ─── Owner: Pull from Aave ──────────────────────────────────────────────────

    /// @notice Withdraw USDC from Aave to `to` (EOA allowed) — instant under $50k.
    function ownerWithdrawInstant(address to, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        require(to != address(0), "Zero address");
        require(amount < TIMELOCK_THRESHOLD, "Use queueWithdrawal for >= $50k");

        yieldStrategy.withdrawTo(to, amount);
        emit OwnerWithdrewInstant(to, amount);
    }

    /// @notice Queue a withdrawal >= $50k from Aave. Executable after 48-hour delay.
    function queueWithdrawal(address to, uint256 amount)
        external
        onlyOwner
        returns (uint256 withdrawalId)
    {
        require(to != address(0), "Zero address");
        require(amount >= TIMELOCK_THRESHOLD, "Use ownerWithdrawInstant for < $50k");

        withdrawalId = nextWithdrawalId++;
        uint256 execAfter = block.timestamp + TIMELOCK_DELAY;

        pendingWithdrawals[withdrawalId] = PendingWithdrawal({
            to:           to,
            amount:       amount,
            executeAfter: execAfter,
            executed:     false,
            cancelled:    false
        });

        emit WithdrawalQueued(withdrawalId, to, amount, execAfter);
    }

    /// @notice Execute a queued Aave withdrawal once the timelock has passed.
    function executeWithdrawal(uint256 withdrawalId)
        external
        onlyOwner
        nonReentrant
    {
        PendingWithdrawal storage pw = pendingWithdrawals[withdrawalId];
        require(!pw.executed,  "Already executed");
        require(!pw.cancelled, "Cancelled");
        require(block.timestamp >= pw.executeAfter, "Timelock not expired");

        pw.executed = true;
        yieldStrategy.withdrawTo(pw.to, pw.amount);
        emit WithdrawalExecuted(withdrawalId, pw.to, pw.amount);
    }

    function cancelWithdrawal(uint256 withdrawalId) external onlyOwner {
        PendingWithdrawal storage pw = pendingWithdrawals[withdrawalId];
        require(!pw.executed,  "Already executed");
        require(!pw.cancelled, "Already cancelled");

        pw.cancelled = true;
        emit WithdrawalCancelled(withdrawalId);
    }

    /// @notice Withdraw accumulated early-unstake penalties to a destination address.
    function withdrawPenalties(address to) external onlyOwner nonReentrant {
        require(to != address(0), "Zero address");
        uint256 amount = penaltyPool;
        require(amount > 0, "No penalties accumulated");

        penaltyPool = 0;
        usdc.safeTransfer(to, amount);
        emit PenaltiesWithdrawn(to, amount);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getPosition(uint256 positionId)
        external
        view
        returns (Position memory)
    {
        return positions[positionId];
    }

    function getUserPositions(address user)
        external
        view
        returns (uint256[] memory)
    {
        return userPositionIds[user];
    }

    function getTier(uint8 tierId)
        external
        view
        returns (Tier memory)
    {
        require(tierId < TIER_COUNT, "Invalid tier");
        return tiers[tierId];
    }

    /// @notice Idle USDC in this contract (should be ~0 after instant supply).
    function idleBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /// @notice USDC deployed in Aave via strategy (principal + Aave interest).
    function aaveBalance() external view returns (uint256) {
        return yieldStrategy.aaveBalance();
    }

    /// @notice Total USDC under management (idle + Aave).
    function totalAssets() external view returns (uint256) {
        return usdc.balanceOf(address(this)) + yieldStrategy.aaveBalance();
    }
}
