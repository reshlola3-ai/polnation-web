// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  AlphaStake
 * @notice Users lock USDC for a fixed tier period. The Owner (Gnosis Safe 3/5
 *         multisig) may withdraw funds for alpha-driven trading and return them.
 *         Interest is distributed off-chain via Polnation's withdrawable system.
 *
 * Key mechanics:
 *  - 5 lock tiers: 15 / 30 / 60 / 150 / 300 days
 *  - Minimum stake: $50 USDC
 *  - Early unstake penalty: 15% of principal (stays in penaltyPool)
 *  - Owner withdrawals: <$50k instant, >=$50k requires 48-hour timelock
 *  - Full pause: owner can freeze all user operations
 */
contract AlphaStake is Ownable, Pausable, ReentrancyGuard {

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant MIN_STAKE          = 50 * 1e6;       // $50 USDC (6 dec)
    uint256 public constant EARLY_PENALTY_BPS  = 1500;           // 15.00%
    uint256 public constant TIMELOCK_THRESHOLD = 50_000 * 1e6;   // $50,000 USDC
    uint256 public constant TIMELOCK_DELAY     = 48 hours;
    uint8   public constant TIER_COUNT         = 5;

    // ─── Token ────────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;

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

    // ─── Timelock Withdrawals ─────────────────────────────────────────────────

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
    uint256 public penaltyPool;   // accumulated 15% early-unstake penalties

    // ─── Events ───────────────────────────────────────────────────────────────

    event Staked(
        uint256 indexed positionId,
        address indexed user,
        uint256 amount,
        uint8   tierId,
        uint64  unlockTime
    );
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

    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "Zero USDC address");
        usdc = IERC20(_usdc);

        // Tier 0: 15 days  @ 1.0%/day
        tiers[0] = Tier({ duration: uint64(15  days), dailyRateBps: 100 });
        // Tier 1: 30 days  @ 1.1%/day
        tiers[1] = Tier({ duration: uint64(30  days), dailyRateBps: 110 });
        // Tier 2: 60 days  @ 1.2%/day
        tiers[2] = Tier({ duration: uint64(60  days), dailyRateBps: 120 });
        // Tier 3: 150 days @ 1.3%/day
        tiers[3] = Tier({ duration: uint64(150 days), dailyRateBps: 130 });
        // Tier 4: 300 days @ 1.5%/day
        tiers[4] = Tier({ duration: uint64(300 days), dailyRateBps: 150 });
    }

    // ─── User: Stake ──────────────────────────────────────────────────────────

    /// @notice Stake USDC using standard ERC20 approval flow.
    function stake(uint256 amount, uint8 tierId)
        external
        whenNotPaused
        nonReentrant
    {
        _validateStake(amount, tierId);
        usdc.transferFrom(msg.sender, address(this), amount);
        _createPosition(msg.sender, amount, tierId);
    }

    /// @notice Stake USDC using EIP-2612 gasless permit (no prior approval tx needed).
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
        usdc.transferFrom(msg.sender, address(this), amount);
        _createPosition(msg.sender, amount, tierId);
    }

    function _validateStake(uint256 amount, uint8 tierId) internal pure {
        require(tierId < TIER_COUNT, "Invalid tier");
        require(amount >= MIN_STAKE, "Below $50 minimum");
    }

    function _createPosition(address user, uint256 amount, uint8 tierId) internal {
        uint64 start  = uint64(block.timestamp);
        uint64 unlock = uint64(block.timestamp + tiers[tierId].duration);

        uint256 posId = nextPositionId++;
        positions[posId] = Position({
            user:      user,
            amount:    amount,
            tierId:    tierId,
            startTime: start,
            unlockTime: unlock,
            closed:    false
        });
        userPositionIds[user].push(posId);
        totalStaked += amount;

        emit Staked(posId, user, amount, tierId, unlock);
    }

    // ─── User: Withdraw ───────────────────────────────────────────────────────

    /// @notice Withdraw 100% of principal after the lock period expires.
    function withdraw(uint256 positionId)
        external
        whenNotPaused
        nonReentrant
    {
        Position storage pos = positions[positionId];
        require(pos.user == msg.sender,            "Not your position");
        require(!pos.closed,                        "Already closed");
        require(block.timestamp >= pos.unlockTime,  "Still locked");

        uint256 amount = pos.amount;
        pos.closed   = true;
        totalStaked -= amount;

        usdc.transfer(msg.sender, amount);
        emit Withdrawn(positionId, msg.sender, amount);
    }

    /// @notice Unstake early. 15% penalty deducted from principal.
    function emergencyUnstake(uint256 positionId)
        external
        whenNotPaused
        nonReentrant
    {
        Position storage pos = positions[positionId];
        require(pos.user == msg.sender,          "Not your position");
        require(!pos.closed,                      "Already closed");
        require(block.timestamp < pos.unlockTime, "Lock expired - use withdraw()");

        uint256 principal = pos.amount;
        uint256 penalty   = (principal * EARLY_PENALTY_BPS) / 10_000;
        uint256 returned  = principal - penalty;

        pos.closed   = true;
        totalStaked -= principal;
        penaltyPool += penalty;

        usdc.transfer(msg.sender, returned);
        emit EarlyUnstaked(positionId, msg.sender, returned, penalty);
    }

    // ─── Owner: Fund Management ───────────────────────────────────────────────

    /// @notice Withdraw USDC for trading — instant for amounts under $50k.
    ///         Called by Gnosis Safe after 3/5 signers approve the transaction.
    function ownerWithdrawInstant(address to, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        require(to != address(0),           "Zero address");
        require(amount < TIMELOCK_THRESHOLD, "Use queueWithdrawal for >= $50k");

        usdc.transfer(to, amount);
        emit OwnerWithdrewInstant(to, amount);
    }

    /// @notice Queue a withdrawal >= $50k. Executable only after 48-hour delay.
    ///         Delay is visible on-chain, giving stakers time to react.
    function queueWithdrawal(address to, uint256 amount)
        external
        onlyOwner
        returns (uint256 withdrawalId)
    {
        require(to != address(0),            "Zero address");
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

    /// @notice Execute a queued withdrawal once the 48-hour timelock has passed.
    function executeWithdrawal(uint256 withdrawalId)
        external
        onlyOwner
        nonReentrant
    {
        PendingWithdrawal storage pw = pendingWithdrawals[withdrawalId];
        require(!pw.executed,                       "Already executed");
        require(!pw.cancelled,                      "Cancelled");
        require(block.timestamp >= pw.executeAfter, "Timelock not expired");

        pw.executed = true;
        usdc.transfer(pw.to, pw.amount);
        emit WithdrawalExecuted(withdrawalId, pw.to, pw.amount);
    }

    /// @notice Cancel a queued withdrawal before it executes.
    function cancelWithdrawal(uint256 withdrawalId) external onlyOwner {
        PendingWithdrawal storage pw = pendingWithdrawals[withdrawalId];
        require(!pw.executed,  "Already executed");
        require(!pw.cancelled, "Already cancelled");

        pw.cancelled = true;
        emit WithdrawalCancelled(withdrawalId);
    }

    /// @notice Withdraw accumulated penalty pool to a destination address.
    function withdrawPenalties(address to) external onlyOwner nonReentrant {
        require(to != address(0), "Zero address");
        uint256 amount = penaltyPool;
        require(amount > 0, "No penalties accumulated");

        penaltyPool = 0;
        usdc.transfer(to, amount);
        emit PenaltiesWithdrawn(to, amount);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Pause all user operations (stake, withdraw, emergencyUnstake).
    function pause() external onlyOwner { _pause(); }

    /// @notice Resume operations.
    function unpause() external onlyOwner { _unpause(); }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getPosition(uint256 positionId)
        external view returns (Position memory)
    {
        return positions[positionId];
    }

    /// @notice Returns all position IDs ever created by a user (open and closed).
    function getUserPositions(address user)
        external view returns (uint256[] memory)
    {
        return userPositionIds[user];
    }

    function getTier(uint8 tierId)
        external view returns (Tier memory)
    {
        require(tierId < TIER_COUNT, "Invalid tier");
        return tiers[tierId];
    }

    /// @notice Current USDC balance held by this contract.
    function contractBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
