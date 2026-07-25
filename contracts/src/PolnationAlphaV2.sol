// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title  PolnationAlphaV2  ("PolnationAlpha 2.0")
 * @notice Users lock USDC; funds are supplied to a Uniswap V3 USDC/USDT
 *         position (0.01% pool) that is OWNED BY THIS CONTRACT.
 *
 *         After deployment the LP NFT is transferred into this contract. The
 *         deployer then calls authorizeLpOperator(AlphaLpController) so a
 *         separate control contract retains full LP ops (decrease / collect /
 *         reclaim NFT) via NFPM setApprovalForAll. Controller owner ≡ fund
 *         control — prefer a Safe multisig. V2 owner may still pause() and can
 *         renounce without revoking the controller.
 *
 *         User funds leave through coded paths (claim / compound at maturity)
 *         and the transparent platform fee (7% deposit / 3% compound) to
 *         ROOT_WALLET. Positions are locked until maturity — no early exit.
 *
 *         Model mirrors the referenced BSC "TURBOLOOP" contract, adapted to:
 *           - Polygon + Uniswap V3 (USDC/USDT 0.01%)
 *           - USDC 6-decimals
 *           - 5 lock plans, all min $100
 *           - 10-level referral, 7-rank leadership
 *           - 7% deposit fee / 3% compound fee
 *
 * Polygonscan trace on deposit:
 *   User -> PolnationAlphaV2 -> NonfungiblePositionManager.increaseLiquidity -> Uniswap V3 Pool
 */
contract PolnationAlphaV2 is ReentrancyGuard, Ownable, Pausable, IERC721Receiver {
    using SafeERC20 for IERC20;

    // ─── Custom errors ──────────────────────────────────────────────────────
    error AlreadyRegistered();
    error InvalidUsername();
    error UsernameTaken();
    error ReferrerNotFound();
    error CannotSelfRefer();
    error ReferrerNotQualified();
    error MustRegisterFirst();
    error BelowMinimum();
    error MaxPositions();
    error NotRegistered();
    error NoRewards();
    error InsufficientBalance();
    error InvalidPlan();
    error InvalidIndex();
    error AlreadyClaimed();
    error NotMatured();
    error NotYourPosition();

    // ─── Uniswap V3 NonfungiblePositionManager ──────────────────────────────
    INonfungiblePositionManager private immutable positionManager;
    IERC20 private immutable usdc;

    /// @notice The Uniswap V3 LP position this contract manages. Owned by the contract.
    uint256 public immutable lpPositionId;
    /// @notice True if USDC is token0 in the pool (Polygon USDC/USDT: USDC is token0).
    bool public immutable usdcIsToken0;
    /// @notice Liquidity units per 1e6 USDC for this (single-sided) position.
    ///         liquidity = usdcAmount * usdcToLiquidityRate / 1e18   (matches TURBOLOOP math)
    uint256 public immutable usdcToLiquidityRate;

    // ─── Platform fee wallet (root) ─────────────────────────────────────────
    /// @notice Also the genesis referral root (username "alpha").
    address public immutable ROOT_WALLET;

    // ─── Economics ──────────────────────────────────────────────────────────
    uint256 private constant MINIMUM_DEPOSIT       = 100 * 1e6;  // $100 USDC
    uint256 private constant MINIMUM_CLAIM         = 5 * 1e6;    // $5
    uint256 private constant MINIMUM_COMPOUND      = 5 * 1e6;    // $5
    uint256 private constant REFERRAL_QUALIFICATION = 10 * 1e6;  // $10 active to be a referrer
    uint256 private constant LEVEL_SELF_MIN        = 100 * 1e6;  // $100 self-active to unlock referral levels
    uint256 private constant QUALIFIED_DIRECT_MIN  = 100 * 1e6;  // direct counts as "qualified" at >= $100 active

    uint16  private constant MAX_POSITIONS         = 50;
    uint256 private constant DEPOSIT_FEE_BPS        = 700;       // 7%
    uint256 private constant COMPOUND_FEE_BPS       = 300;       // 3%
    uint256 private constant PERCENTS_DIVIDER       = 10000;
    uint256 public  constant TIME_STEP              = 1 days;

    uint8   private constant REFERRAL_DEPTH   = 10;
    uint8   private constant MAX_UPLINE_DEPTH = 100;
    uint256 private constant MAX_LEADERSHIP_PCT = 1000;         // 10% cap

    // Referral %: L1..L10 (bps of downline daily ROI)  10,8,6,4,2,1,1,1,1,1
    uint256[10] private REFERRAL_REWARDS = [
        uint256(1000), 800, 600, 400, 200, 100, 100, 100, 100, 100
    ];

    // ─── Plans ──────────────────────────────────────────────────────────────
    struct PlanConfig {
        uint256 duration;   // days
        uint256 totalROI;   // bps of principal (450 = 4.5%)
    }
    PlanConfig[5] public plans;

    // ─── Referral level unlock (per level: min qualified directs) ────────────
    // L1-L3 (index 0-2): 0 directs; L4-L10 (index 3-9): 2,3,4,5,6,7,8
    // All levels also require self-active >= LEVEL_SELF_MIN.
    mapping(uint8 => uint8) public minDirectsForLevel;

    // ─── Leadership ranks (TURBOLOOP thresholds, 6-dec) ──────────────────────
    struct RankConfig {
        uint256 rewardPct;                 // bps
        uint32  teamCountNeeded;
        uint256 teamActiveDepositNeeded;   // USDC 6-dec
    }
    RankConfig[7] public ranks;

    // ─── Users ──────────────────────────────────────────────────────────────
    struct Deposit {
        uint256 amount;                 // principal (net of deposit fee), USDC 6-dec
        uint256 startTime;
        uint256 lastRewardCalculation;
        uint256 calculatedROI;
        uint8   planId;
        bool    claimed;
    }

    struct User {
        address referrer;
        string  username;
        bool    registered;
        uint256 userId;
        uint256 totalActiveDeposit;
        uint256 teamActiveDeposit;
        uint256 teamTotalDeposit;
        uint256 teamTotalCompound;
        uint256 totalDeposited;
        uint256 totalWithdrawn;
        uint256 totalCompounded;
        Deposit[] deposits;
    }

    struct UserExtra {
        uint256 networkRewardAvailable;
        uint256 dailyRewardReserve;
        uint256 totalReferralReward;
        uint256 totalROIEarned;
        uint256 totalLeadershipReward;
        uint32  teamCount;
        uint32  directsCount;
        uint32  qualifiedDirects;
        uint8   currentRank;
        uint256 lastCalculationTime;
    }

    mapping(address => User) public users;
    mapping(address => UserExtra) public usersExtra;
    mapping(string => address) public usernameToAddress;   // key = lowercased username
    mapping(string => bool)    public usernameExists;       // key = lowercased username
    mapping(uint256 => address) public userIdToAddress;
    mapping(address => mapping(uint8 => uint32))  public levelDownlineCount;
    mapping(address => mapping(uint8 => uint256)) public levelReferralEarned;

    // Batch daily-reward bookkeeping
    mapping(uint256 => bool)    public dailyRewardDayCompleted;
    mapping(uint256 => uint256) public dailyRewardUsersProcessed;
    mapping(uint256 => uint256) public dailyRewardTotalROI;
    uint256 public dailyRewardCurrentDay;
    uint256 public dailyRewardLastProcessedUserId;

    uint256 public totalRegisteredUsers;
    uint256 public totalActiveUsers;
    uint256 public nextUserId;
    uint256 public launchDate;             // set to deploy time (active immediately)

    string private constant ROOT_USERNAME = "alpha";

    // ─── Events ───────────────────────────────────────────────────────────────
    event Registration(address indexed user, string username, address indexed referrer, uint256 timestamp);
    event Deposited(address indexed user, uint256 principal, uint256 fee, uint8 planId, uint256 timestamp);
    event Claimed(address indexed user, uint256 amount, uint256 timestamp);
    event Compounded(address indexed user, uint256 amount, uint8 planId, uint256 timestamp);
    event ReferralReward(address indexed upline, address indexed downline, uint8 level, uint256 amount, uint256 timestamp);
    event LeadershipReward(address indexed upline, address indexed downline, uint8 rank, uint256 amount, uint256 timestamp);
    event RankUpgraded(address indexed user, uint8 newRank, uint256 timestamp);
    event LiquidityToppedUp(address indexed from, uint256 amount, uint256 used, uint256 timestamp);
    event LpOperatorAuthorized(address indexed operator);
    event LpOperatorRevoked(address indexed operator);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(
        address _usdc,
        address _positionManager,
        uint256 _lpPositionId,
        bool    _usdcIsToken0,
        uint256 _usdcToLiquidityRate,
        address _rootWallet
    ) Ownable(msg.sender) {
        require(_usdc != address(0) && _positionManager != address(0) && _rootWallet != address(0), "zero addr");
        require(_usdcToLiquidityRate > 0, "zero rate");

        usdc                = IERC20(_usdc);
        positionManager     = INonfungiblePositionManager(_positionManager);
        lpPositionId        = _lpPositionId;
        usdcIsToken0        = _usdcIsToken0;
        usdcToLiquidityRate = _usdcToLiquidityRate;
        ROOT_WALLET         = _rootWallet;

        // Plans (all min $100). ROI in bps of principal.
        plans[0] = PlanConfig(15,  450);    // 4.5%
        plans[1] = PlanConfig(30,  3300);   // 33%
        plans[2] = PlanConfig(60,  7000);   // 70%
        plans[3] = PlanConfig(90,  12000);  // 120%
        plans[4] = PlanConfig(300, 40000);  // 400%

        // Referral level unlock (min qualified directs)
        // L1-L3 => 0 ; L4..L10 => 2,3,4,5,6,7,8
        minDirectsForLevel[3] = 2;
        minDirectsForLevel[4] = 3;
        minDirectsForLevel[5] = 4;
        minDirectsForLevel[6] = 5;
        minDirectsForLevel[7] = 6;
        minDirectsForLevel[8] = 7;
        minDirectsForLevel[9] = 8;

        // Leadership ranks (TURBOLOOP thresholds, converted to 6-dec USDC)
        ranks[0] = RankConfig(100,  250,   10_000  * 1e6);  // V1 1%
        ranks[1] = RankConfig(200,  500,   25_000  * 1e6);  // V2 2%
        ranks[2] = RankConfig(300,  1000,  50_000  * 1e6);  // V3 3%
        ranks[3] = RankConfig(400,  2500,  100_000 * 1e6);  // V4 4%
        ranks[4] = RankConfig(600,  5000,  200_000 * 1e6);  // V5 6%
        ranks[5] = RankConfig(800,  7500,  500_000 * 1e6);  // V6 8%
        ranks[6] = RankConfig(1000, 10000, 1_000_000 * 1e6);// V7 10%

        // Active immediately
        launchDate = block.timestamp;

        // Register root ("alpha") at the fee wallet
        nextUserId = 1;
        User storage root = users[_rootWallet];
        root.username   = ROOT_USERNAME;
        root.referrer   = address(0);
        root.registered = true;
        root.userId     = nextUserId;
        userIdToAddress[nextUserId] = _rootWallet;
        nextUserId++;

        usernameToAddress[ROOT_USERNAME] = _rootWallet;   // already lowercase
        usernameExists[ROOT_USERNAME]    = true;
        totalRegisteredUsers++;
    }

    // ─── ERC721 receive (accept the LP NFT into custody) ─────────────────────
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    // ─── Registration ─────────────────────────────────────────────────────────
    function register(string calldata username, string calldata referrerUsername)
        external
        nonReentrant
        whenNotPaused
    {
        if (users[msg.sender].registered) revert AlreadyRegistered();
        if (!_isValidUsername(username)) revert InvalidUsername();

        string memory lc = _toLower(username);
        if (usernameExists[lc]) revert UsernameTaken();

        address referrerAddr = usernameToAddress[_toLower(referrerUsername)];
        if (referrerAddr != ROOT_WALLET) {
            if (referrerAddr == address(0)) revert ReferrerNotFound();
            if (referrerAddr == msg.sender) revert CannotSelfRefer();
            if (!users[referrerAddr].registered) revert ReferrerNotQualified();
            if (_getQualificationDeposit(referrerAddr) < REFERRAL_QUALIFICATION) revert ReferrerNotQualified();
        }

        User storage u = users[msg.sender];
        u.username   = username;   // preserve original case for display
        u.referrer   = referrerAddr;
        u.registered = true;
        u.userId     = nextUserId;

        userIdToAddress[nextUserId] = msg.sender;
        nextUserId++;

        usernameToAddress[lc] = msg.sender;
        usernameExists[lc]    = true;
        totalRegisteredUsers++;

        emit Registration(msg.sender, username, referrerAddr, block.timestamp);
    }

    // ─── Deposit ───────────────────────────────────────────────────────────────
    function deposit(uint256 amount, uint8 planId) external nonReentrant whenNotPaused {
        if (amount < MINIMUM_DEPOSIT) revert BelowMinimum();
        if (planId >= 5) revert InvalidPlan();

        User storage u = users[msg.sender];
        if (!u.registered) revert MustRegisterFirst();
        if (u.deposits.length >= MAX_POSITIONS) revert MaxPositions();

        bool isFirstDeposit = (u.totalDeposited == 0);

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // 7% platform fee to root wallet (transparent, coded)
        uint256 fee = (amount * DEPOSIT_FEE_BPS) / PERCENTS_DIVIDER;
        if (fee > 0) usdc.safeTransfer(ROOT_WALLET, fee);

        uint256 net = amount - fee;
        uint256 principal = _addLiquidityToPool(net);   // refunds any unused USDC to user

        u.deposits.push(Deposit({
            amount: principal,
            startTime: block.timestamp,
            lastRewardCalculation: block.timestamp,
            calculatedROI: 0,
            planId: planId,
            claimed: false
        }));

        u.totalDeposited     += principal;
        u.totalActiveDeposit += principal;

        _updateTeamActiveDeposit(msg.sender, principal, true, false);

        if (isFirstDeposit) {
            _updateTeamCounters(msg.sender);
            totalActiveUsers++;
        }

        emit Deposited(msg.sender, principal, fee, planId, block.timestamp);
    }

    // ─── Claim rewards (matured ROI + referral/leadership) ─────────────────────
    function claimRewards(uint256 amount) external nonReentrant whenNotPaused {
        User storage u = users[msg.sender];
        UserExtra storage ux = usersExtra[msg.sender];
        if (!u.registered) revert NotRegistered();

        _calculateAndProcessMatured(msg.sender);

        uint256 dailyAvail   = ux.dailyRewardReserve;
        uint256 networkAvail = ux.networkRewardAvailable;
        uint256 totalAvail   = dailyAvail + networkAvail;
        if (totalAvail == 0) revert NoRewards();

        if (amount == 0) amount = totalAvail;
        if (amount > totalAvail) revert InsufficientBalance();
        if (amount < MINIMUM_CLAIM) revert BelowMinimum();

        _deductReserves(ux, amount, dailyAvail, networkAvail);

        _withdrawFromPool(amount, msg.sender);

        u.totalWithdrawn += amount;
        emit Claimed(msg.sender, amount, block.timestamp);
    }

    // ─── Compound rewards into a new position ───────────────────────────────────
    function compoundRewards(uint256 amount, uint8 planId) external nonReentrant whenNotPaused {
        if (planId >= 5) revert InvalidPlan();

        User storage u = users[msg.sender];
        UserExtra storage ux = usersExtra[msg.sender];
        if (!u.registered) revert NotRegistered();
        if (u.deposits.length >= MAX_POSITIONS) revert MaxPositions();

        _calculateAndProcessMatured(msg.sender);

        uint256 dailyAvail   = ux.dailyRewardReserve;
        uint256 networkAvail = ux.networkRewardAvailable;
        uint256 totalAvail   = dailyAvail + networkAvail;
        if (totalAvail == 0) revert NoRewards();

        if (amount == 0) amount = totalAvail;
        if (amount > totalAvail) revert InsufficientBalance();
        if (amount < MINIMUM_COMPOUND) revert BelowMinimum();

        _deductReserves(ux, amount, dailyAvail, networkAvail);

        // 3% compound fee pulled from pool to root wallet
        uint256 fee = (amount * COMPOUND_FEE_BPS) / PERCENTS_DIVIDER;
        if (fee > 0) _withdrawFromPool(fee, ROOT_WALLET);

        uint256 principal = amount - fee;

        u.deposits.push(Deposit({
            amount: principal,
            startTime: block.timestamp,
            lastRewardCalculation: block.timestamp,
            calculatedROI: 0,
            planId: planId,
            claimed: false
        }));

        u.totalCompounded    += principal;
        u.totalActiveDeposit += principal;

        _updateTeamActiveDeposit(msg.sender, principal, true, true);

        emit Compounded(msg.sender, principal, planId, block.timestamp);
    }

    // ─── Daily reward processing (self) ─────────────────────────────────────────
    function processMyDailyRewards() external nonReentrant whenNotPaused {
        if (!users[msg.sender].registered) revert NotRegistered();
        UserExtra storage ux = usersExtra[msg.sender];
        if (ux.lastCalculationTime >= block.timestamp) return;

        uint256 currentDay = (block.timestamp - launchDate) / TIME_STEP;
        uint256 startDay = ux.lastCalculationTime == 0
            ? 0
            : (ux.lastCalculationTime - launchDate) / TIME_STEP;

        uint256 totalROI = 0;
        for (uint256 day = startDay; day <= currentDay; day++) {
            uint256 dayEndTime = launchDate + ((day + 1) * TIME_STEP);
            if (dayEndTime > block.timestamp) dayEndTime = block.timestamp;
            if (ux.lastCalculationTime >= dayEndTime) continue;

            totalROI += _accrueUserDayROI(msg.sender, dayEndTime);
            ux.lastCalculationTime = dayEndTime;
        }

        if (totalROI > 0) {
            _processReferralRewards(msg.sender, totalROI);
            _processLeadershipRewards(msg.sender, totalROI);
        }
    }

    // ─── Batch daily reward processing (anyone / bot) ───────────────────────────
    function calculateDailyRewards(uint256 length) external nonReentrant whenNotPaused {
        require(length > 0, "length");
        uint256 currentDay = (block.timestamp - launchDate) / TIME_STEP;
        if (currentDay == 0) return;

        if (dailyRewardCurrentDay == 0 || dailyRewardDayCompleted[dailyRewardCurrentDay]) {
            for (uint256 day = dailyRewardCurrentDay; day < currentDay; day++) {
                if (!dailyRewardDayCompleted[day]) {
                    dailyRewardCurrentDay = day;
                    dailyRewardLastProcessedUserId = 0;
                    break;
                }
            }
        }
        if (dailyRewardDayCompleted[dailyRewardCurrentDay]) return;

        uint256 processed = 0;
        uint256 startUserId = dailyRewardLastProcessedUserId == 0 ? 1 : dailyRewardLastProcessedUserId;
        uint256 processingDay = dailyRewardCurrentDay;

        uint256 dayEndTime = launchDate + ((processingDay + 1) * TIME_STEP);
        if (dayEndTime > block.timestamp) dayEndTime = block.timestamp;

        for (uint256 userId = startUserId; userId < nextUserId && processed < length; userId++) {
            address addr = userIdToAddress[userId];
            User storage u = users[addr];
            UserExtra storage ux = usersExtra[addr];

            if (!u.registered || ux.lastCalculationTime >= dayEndTime) {
                processed++;
                continue;
            }

            uint256 roi = _accrueUserDayROI(addr, dayEndTime);
            if (roi > 0) {
                _processReferralRewards(addr, roi);
                _processLeadershipRewards(addr, roi);
                dailyRewardTotalROI[processingDay] += roi;
            }
            ux.lastCalculationTime = dayEndTime;
            processed++;
            dailyRewardUsersProcessed[processingDay]++;
        }

        dailyRewardLastProcessedUserId = startUserId + processed;
        if (dailyRewardLastProcessedUserId >= nextUserId) {
            dailyRewardDayCompleted[processingDay] = true;
            dailyRewardLastProcessedUserId = 0;
        }
    }

    // ─── Top-up LP (add-only; no withdrawal path) ───────────────────────────────
    /// @notice Donate USDC into the managed Uniswap V3 position. Anyone can call.
    ///         Survives renounceOwnership. Does NOT create staking positions or
    ///         claim rights — pure liquidity buffer. Unused dust stays in contract.
    function topUpLiquidity(uint256 usdcAmount) external nonReentrant whenNotPaused {
        if (usdcAmount == 0) revert BelowMinimum();
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        uint256 used = _addLiquidityToPoolFromSelf(usdcAmount);
        emit LiquidityToppedUp(msg.sender, usdcAmount, used, block.timestamp);
    }

    // ─── Owner: pause + LP operator authorization ───────────────────────────────
    /// @notice Authorize `operator` for all NFTs this contract holds on NFPM
    ///         (setApprovalForAll). Call AFTER the LP NFT is transferred here.
    ///         Typically `operator` = AlphaLpController. Survives renounce only
    ///         if already set; after renounce this function is unusable.
    function authorizeLpOperator(address operator) external onlyOwner {
        require(operator != address(0), "zero operator");
        positionManager.setApprovalForAll(operator, true);
        emit LpOperatorAuthorized(operator);
    }

    /// @notice Revoke a previously authorized LP operator.
    function revokeLpOperator(address operator) external onlyOwner {
        require(operator != address(0), "zero operator");
        positionManager.setApprovalForAll(operator, false);
        emit LpOperatorRevoked(operator);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Internal: rewards ──────────────────────────────────────────────────────

    /// @dev Accrue day-bounded ROI for all of a user's un-matured deposits.
    function _accrueUserDayROI(address addr, uint256 dayEndTime) internal returns (uint256 totalROI) {
        User storage u = users[addr];
        for (uint256 i = 0; i < u.deposits.length; i++) {
            Deposit storage d = u.deposits[i];
            if (d.claimed) continue;

            uint256 duration = plans[d.planId].duration;
            uint256 endTime  = d.startTime + (duration * TIME_STEP);
            if (d.lastRewardCalculation >= endTime) continue;

            uint256 calcUntil = dayEndTime < endTime ? dayEndTime : endTime;
            if (calcUntil <= d.lastRewardCalculation) continue;

            uint256 elapsed = calcUntil - d.lastRewardCalculation;
            uint256 roi = (d.amount * plans[d.planId].totalROI * elapsed)
                / (PERCENTS_DIVIDER * duration * TIME_STEP);
            if (roi > 0) {
                totalROI += roi;
                d.lastRewardCalculation = calcUntil;
                d.calculatedROI += roi;
            }
        }
    }

    /// @dev On claim/compound: sweep matured deposits' principal+ROI into reserve.
    function _calculateAndProcessMatured(address addr) internal {
        User storage u = users[addr];
        UserExtra storage ux = usersExtra[addr];
        uint256 totalExpired = 0;
        uint256 remainROI = 0;

        for (uint256 i = 0; i < u.deposits.length; i++) {
            Deposit storage d = u.deposits[i];
            if (d.claimed) continue;

            uint256 endTime = d.startTime + (plans[d.planId].duration * TIME_STEP);
            if (block.timestamp < endTime) continue;

            uint256 fullROI = (d.amount * plans[d.planId].totalROI) / PERCENTS_DIVIDER;
            if (fullROI > d.calculatedROI) remainROI += (fullROI - d.calculatedROI);

            d.claimed = true;
            if (u.totalActiveDeposit >= d.amount) {
                u.totalActiveDeposit -= d.amount;
                totalExpired += d.amount;
            }

            ux.totalROIEarned += fullROI;
            ux.dailyRewardReserve += d.amount + fullROI;  // principal + full ROI
        }

        if (totalExpired > 0) _updateTeamActiveDeposit(addr, totalExpired, false, false);
        if (remainROI > 0) {
            _processReferralRewards(addr, remainROI);
            _processLeadershipRewards(addr, remainROI);
        }
    }

    function _deductReserves(
        UserExtra storage ux,
        uint256 amount,
        uint256 dailyAvail,
        uint256 networkAvail
    ) internal {
        uint256 remaining = amount;
        if (dailyAvail > 0 && remaining > 0) {
            if (remaining >= dailyAvail) {
                remaining -= dailyAvail;
                ux.dailyRewardReserve = 0;
            } else {
                ux.dailyRewardReserve -= remaining;
                remaining = 0;
            }
        }
        if (networkAvail > 0 && remaining > 0) {
            if (remaining >= networkAvail) {
                ux.networkRewardAvailable = 0;
            } else {
                ux.networkRewardAvailable -= remaining;
            }
            remaining = 0;
        }
    }

    function _processReferralRewards(address addr, uint256 dailyROI) internal {
        address current = users[addr].referrer;
        for (uint8 level = 0; level < REFERRAL_DEPTH && current != address(0); level++) {
            if (_isLevelUnlocked(current, level)) {
                uint256 reward = (dailyROI * REFERRAL_REWARDS[level]) / PERCENTS_DIVIDER;
                UserExtra storage ue = usersExtra[current];
                ue.networkRewardAvailable += reward;
                ue.totalReferralReward    += reward;
                levelReferralEarned[current][level] += reward;
                emit ReferralReward(current, addr, level + 1, reward, block.timestamp);
            }
            current = users[current].referrer;
        }
    }

    function _processLeadershipRewards(address addr, uint256 dailyROI) internal {
        address current = users[addr].referrer;
        uint256 highestPctPaid = 0;
        for (uint8 depth = 0; depth < MAX_UPLINE_DEPTH && current != address(0); depth++) {
            User storage up = users[current];
            UserExtra storage ux = usersExtra[current];

            uint8 rk = ux.currentRank;
            uint256 rankPct = 0;
            if (ux.teamCount >= ranks[rk].teamCountNeeded &&
                up.teamActiveDeposit >= ranks[rk].teamActiveDepositNeeded) {
                rankPct = ranks[rk].rewardPct;
            }

            if (rankPct > highestPctPaid) {
                uint256 diff = rankPct - highestPctPaid;
                uint256 reward = (dailyROI * diff) / PERCENTS_DIVIDER;
                ux.networkRewardAvailable  += reward;
                ux.totalLeadershipReward   += reward;
                emit LeadershipReward(current, addr, rk, reward, block.timestamp);
                highestPctPaid = rankPct;
            }
            if (highestPctPaid >= MAX_LEADERSHIP_PCT) break;
            current = up.referrer;
        }
    }

    function _isLevelUnlocked(address addr, uint8 level) internal view returns (bool) {
        if (level >= REFERRAL_DEPTH) return false;
        UserExtra storage ux = usersExtra[addr];
        if (_getQualificationDeposit(addr) < LEVEL_SELF_MIN) return false;
        return ux.qualifiedDirects >= minDirectsForLevel[level];
    }

    function _updateTeamCounters(address addr) internal {
        address current = users[addr].referrer;
        if (current != address(0)) usersExtra[current].directsCount++;

        uint8 depth = 0;
        while (current != address(0) && depth < MAX_UPLINE_DEPTH) {
            usersExtra[current].teamCount++;
            if (depth < REFERRAL_DEPTH) levelDownlineCount[current][depth]++;
            _updateRank(current);
            current = users[current].referrer;
            depth++;
        }
    }

    function _updateTeamActiveDeposit(address addr, uint256 amount, bool isAdding, bool isCompound) internal {
        address current = users[addr].referrer;

        if (current != address(0)) {
            UserExtra storage sponsorExtra = usersExtra[current];
            uint256 userActive = users[addr].totalActiveDeposit;
            if (isAdding) {
                if (userActive >= QUALIFIED_DIRECT_MIN && userActive - amount < QUALIFIED_DIRECT_MIN) {
                    sponsorExtra.qualifiedDirects++;
                }
            } else {
                if (userActive < QUALIFIED_DIRECT_MIN && userActive + amount >= QUALIFIED_DIRECT_MIN) {
                    if (sponsorExtra.qualifiedDirects > 0) sponsorExtra.qualifiedDirects--;
                }
            }
        }

        uint8 depth = 0;
        while (current != address(0) && depth < MAX_UPLINE_DEPTH) {
            if (isAdding) {
                users[current].teamActiveDeposit += amount;
                if (isCompound) users[current].teamTotalCompound += amount;
                else users[current].teamTotalDeposit += amount;
            } else {
                if (users[current].teamActiveDeposit >= amount) users[current].teamActiveDeposit -= amount;
                else users[current].teamActiveDeposit = 0;
            }
            _updateRank(current);
            current = users[current].referrer;
            depth++;
        }
    }

    function _updateRank(address addr) internal {
        User storage u = users[addr];
        UserExtra storage ux = usersExtra[addr];
        uint8 newRank = ux.currentRank;
        for (uint8 i = 6; ; i--) {
            if (ux.teamCount >= ranks[i].teamCountNeeded &&
                u.teamActiveDeposit >= ranks[i].teamActiveDepositNeeded) {
                newRank = i;
                break;
            }
            if (i == 0) break;
        }
        if (newRank != ux.currentRank) {
            ux.currentRank = newRank;
            emit RankUpgraded(addr, newRank, block.timestamp);
        }
    }

    function _getQualificationDeposit(address addr) internal view returns (uint256) {
        User storage u = users[addr];
        return u.deposits.length >= MAX_POSITIONS ? u.totalDeposited : u.totalActiveDeposit;
    }

    // ─── Internal: Uniswap V3 LP ────────────────────────────────────────────────

    /// @dev Add USDC (pulled from user in deposit) into the managed LP position.
    ///      Single-sided USDC add; refunds any unused USDC back to the caller.
    function _addLiquidityToPool(uint256 usdcAmount) internal returns (uint256 used) {
        if (usdcAmount == 0) return 0;
        usdc.forceApprove(address(positionManager), usdcAmount);

        uint256 amount0Desired = usdcIsToken0 ? usdcAmount : 0;
        uint256 amount1Desired = usdcIsToken0 ? 0 : usdcAmount;
        uint256 amount0Min = (amount0Desired * 99) / 100;
        uint256 amount1Min = (amount1Desired * 99) / 100;

        (, uint256 a0, uint256 a1) = positionManager.increaseLiquidity(
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: lpPositionId,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                deadline: block.timestamp + 300
            })
        );

        used = usdcIsToken0 ? a0 : a1;
        if (usdcAmount > used) usdc.safeTransfer(msg.sender, usdcAmount - used);
    }

    /// @dev Add USDC already held by this contract (e.g. recycled penalty) into LP.
    ///      No refund to any user — leftover (should be ~0) stays in contract.
    function _addLiquidityToPoolFromSelf(uint256 usdcAmount) internal returns (uint256 used) {
        if (usdcAmount == 0) return 0;
        usdc.forceApprove(address(positionManager), usdcAmount);

        uint256 amount0Desired = usdcIsToken0 ? usdcAmount : 0;
        uint256 amount1Desired = usdcIsToken0 ? 0 : usdcAmount;

        (, uint256 a0, uint256 a1) = positionManager.increaseLiquidity(
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: lpPositionId,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 300
            })
        );
        used = usdcIsToken0 ? a0 : a1;
    }

    /// @dev Withdraw `amountNeeded` USDC from the LP to `recipient`.
    function _withdrawFromPool(uint256 amountNeeded, address recipient) internal {
        if (amountNeeded == 0) return;

        (,,,,,,, uint128 liquidity,,, uint128 owed0, uint128 owed1) = positionManager.positions(lpPositionId);
        uint128 usdcOwed = usdcIsToken0 ? owed0 : owed1;

        if (usdcOwed < amountNeeded) {
            uint256 deficit = amountNeeded - usdcOwed;
            uint256 liqNeeded = (deficit * usdcToLiquidityRate) / 1e18;
            uint128 liqToRemove = uint128(liqNeeded);
            if (liqToRemove == 0) liqToRemove = 1;
            require(liqToRemove <= liquidity, "Insufficient LP liquidity");

            positionManager.decreaseLiquidity(
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: lpPositionId,
                    liquidity: liqToRemove,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp + 300
                })
            );
        }

        uint128 collect0 = usdcIsToken0 ? uint128(amountNeeded) : 0;
        uint128 collect1 = usdcIsToken0 ? 0 : uint128(amountNeeded);
        positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: lpPositionId,
                recipient: recipient,
                amount0Max: collect0,
                amount1Max: collect1
            })
        );
    }

    // ─── Username helpers ───────────────────────────────────────────────────────
    function _isValidUsername(string calldata username) internal pure returns (bool) {
        bytes memory b = bytes(username);
        if (b.length < 3 || b.length > 20) return false;
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (!(c >= 0x30 && c <= 0x39) &&  // 0-9
                !(c >= 0x41 && c <= 0x5A) &&  // A-Z
                !(c >= 0x61 && c <= 0x7A))    // a-z
            {
                return false;
            }
        }
        return true;
    }

    function _toLower(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] >= 0x41 && b[i] <= 0x5A) b[i] = bytes1(uint8(b[i]) + 32);
        }
        return string(b);
    }

    // ─── Views ──────────────────────────────────────────────────────────────────
    function getUserInfo(address addr) external view returns (
        string memory username,
        address referrer,
        bool registered,
        uint256 totalActiveDeposit,
        uint256 totalDeposited,
        uint256 totalWithdrawn,
        uint256 totalCompounded
    ) {
        User storage u = users[addr];
        return (u.username, u.referrer, u.registered, u.totalActiveDeposit,
                u.totalDeposited, u.totalWithdrawn, u.totalCompounded);
    }

    function getUserTeamInfo(address addr) external view returns (
        uint256 teamActiveDeposit,
        uint256 teamTotalDeposit,
        uint32 teamCount,
        uint32 directsCount,
        uint32 qualifiedDirects,
        uint8 currentRank
    ) {
        User storage u = users[addr];
        UserExtra storage ux = usersExtra[addr];
        return (u.teamActiveDeposit, u.teamTotalDeposit, ux.teamCount,
                ux.directsCount, ux.qualifiedDirects, ux.currentRank);
    }

    function getDepositCount(address addr) external view returns (uint256) {
        return users[addr].deposits.length;
    }

    function getDepositInfo(address addr, uint256 index) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 endTime,
        uint8 planId,
        bool claimed,
        bool matured,
        uint256 expectedROI,
        uint256 generatedROI
    ) {
        User storage u = users[addr];
        if (index >= u.deposits.length) revert InvalidIndex();
        Deposit storage d = u.deposits[index];
        uint256 dur = plans[d.planId].duration;
        uint256 _end = d.startTime + (dur * TIME_STEP);
        uint256 roi = (d.amount * plans[d.planId].totalROI) / PERCENTS_DIVIDER;
        uint256 calcUntil = block.timestamp > _end ? _end : block.timestamp;
        uint256 elapsed = calcUntil > d.startTime ? calcUntil - d.startTime : 0;
        uint256 gen = elapsed > 0
            ? (d.amount * plans[d.planId].totalROI * elapsed) / (PERCENTS_DIVIDER * dur * TIME_STEP)
            : 0;
        return (d.amount, d.startTime, _end, d.planId, d.claimed, block.timestamp >= _end, roi, gen);
    }

    function getAvailableRewards(address addr) external view returns (
        uint256 totalAvailable,
        uint256 maturedAvailable,
        uint256 dailyReserve,
        uint256 networkAvailable,
        uint256 totalReferral,
        uint256 totalLeadership
    ) {
        User storage u = users[addr];
        UserExtra storage ux = usersExtra[addr];
        uint256 matured = ux.dailyRewardReserve;
        for (uint256 i = 0; i < u.deposits.length; i++) {
            Deposit storage d = u.deposits[i];
            if (d.claimed) continue;
            uint256 end = d.startTime + (plans[d.planId].duration * TIME_STEP);
            if (block.timestamp >= end) {
                matured += d.amount + (d.amount * plans[d.planId].totalROI) / PERCENTS_DIVIDER;
            }
        }
        return (matured + ux.networkRewardAvailable, matured, ux.dailyRewardReserve,
                ux.networkRewardAvailable, ux.totalReferralReward, ux.totalLeadershipReward);
    }

    function getPlanInfo(uint8 planId) external view returns (uint256 duration, uint256 totalROI) {
        require(planId < 5, "plan");
        return (plans[planId].duration, plans[planId].totalROI);
    }

    function isValidReferrer(string calldata referrerUsername, address addr) external view returns (bool) {
        address r = usernameToAddress[_toLower(referrerUsername)];
        if (r == ROOT_WALLET) return true;
        if (r == address(0) || r == addr) return false;
        if (!users[r].registered) return false;
        if (_getQualificationDeposit(r) < REFERRAL_QUALIFICATION) return false;
        return true;
    }

    function isUsernameAvailable(string calldata username) external view returns (bool) {
        if (!_isValidUsername(username)) return false;
        return !usernameExists[_toLower(username)];
    }

    function getContractStats() external view returns (
        uint256 registeredUsers,
        uint256 activeUsers,
        uint256 _launchDate
    ) {
        return (totalRegisteredUsers, totalActiveUsers, launchDate);
    }
}

// ─── Uniswap V3 NonfungiblePositionManager (minimal) ────────────────────────────
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
        external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1);
    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external payable returns (uint256 amount0, uint256 amount1);
    function collect(CollectParams calldata params)
        external payable returns (uint256 amount0, uint256 amount1);
    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function positions(uint256 tokenId) external view returns (
        uint96 nonce, address operator, address token0, address token1, uint24 fee,
        int24 tickLower, int24 tickUpper, uint128 liquidity,
        uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128,
        uint128 tokensOwed0, uint128 tokensOwed1
    );
}
