// Lottery Mini App — i18n translations
// Add new languages by duplicating the `en` block and translating values.

export type Locale = 'en' | 'zh' | 'ru' | 'es' | 'pt' | 'fr' | 'ja' | 'ko' | 'tr' | 'id' | 'vi' | 'hi' | 'ar' | 'ur'

export interface LocaleMeta {
  label: string
  flag: string
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { label: 'English',    flag: '🇺🇸' },
  zh: { label: '中文',        flag: '🇨🇳' },
  ru: { label: 'Русский',    flag: '🇷🇺' },
  es: { label: 'Español',    flag: '🇪🇸' },
  pt: { label: 'Português',  flag: '🇧🇷' },
  fr: { label: 'Français',   flag: '🇫🇷' },
  ja: { label: '日本語',      flag: '🇯🇵' },
  ko: { label: '한국어',      flag: '🇰🇷' },
  tr: { label: 'Türkçe',     flag: '🇹🇷' },
  id: { label: 'Indonesia',  flag: '🇮🇩' },
  vi: { label: 'Tiếng Việt', flag: '🇻🇳' },
  hi: { label: 'हिन्दी',      flag: '🇮🇳' },
  ar: { label: 'العربية',    flag: '🇸🇦' },
  ur: { label: 'اردو',       flag: '🇵🇰' },
}

export const LOCALES = Object.keys(LOCALE_META) as Locale[]

export const RTL_LOCALES = new Set<Locale>(['ar', 'ur'])

// Map TG language_code (ISO 639-1) → our Locale
const TG_LANG_MAP: Record<string, Locale> = {
  en: 'en', zh: 'zh', 'zh-hans': 'zh', 'zh-hant': 'zh',
  ru: 'ru', es: 'es', pt: 'pt',
  fr: 'fr', ja: 'ja', ko: 'ko', tr: 'tr',
  id: 'id', vi: 'vi', hi: 'hi', ar: 'ar', ur: 'ur',
}

export function detectLocale(tgLangCode?: string): Locale {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('pol_locale') as Locale | null
    if (stored && LOCALES.includes(stored)) return stored
  }
  if (tgLangCode) {
    const mapped = TG_LANG_MAP[tgLangCode.toLowerCase()]
    if (mapped) return mapped
  }
  return 'en'
}

export function saveLocale(locale: Locale) {
  if (typeof window !== 'undefined') localStorage.setItem('pol_locale', locale)
}

// ── Translation dictionary ──────────────────────────────────────────────────

export interface Translations {
  // loading / auth
  startingUp: string
  connecting: string
  openInTelegram: string
  noSession: string
  cantOpenLottery: string
  tryAgainBtn: string
  // onboarding prep animation (new-user slow path)
  prepStep1Title: string
  prepStep1Sub: string
  prepStep2Title: string
  prepStep2Sub: string
  prepStep3Title: string
  prepStep3Sub: string

  // header
  webLink: string
  language: string

  // greeting / title
  greeting: (name: string) => string
  lotteryTitle: string
  spinToWin: string
  unlimitedSpins: string
  spinsAvailable: (n: number) => string

  // welcome task
  welcomeTask: string
  joinTelegramGroup: string
  earnFreeSpin: string
  joinGroupBtn: string
  verifyingMembership: string
  inviteUnavailable: string

  // withdraw section
  withdrawable: string
  joinToWithdraw: string
  connectWallet: string
  minWithdraw: string
  withdrawSubmitted: string
  withdraw: string
  withdrawPending: string
  maxPlaceholder: (max: string) => string

  // team pool
  teamPool: (level: number) => string
  teamPoolUnlocked: (level: number) => string
  teamPoolProgress: (remaining: string, pool: string) => string
  teamPoolEmpty: string
  viewTeamProgress: string
  teamPoolNeedMore: (remaining: string) => string
  teamPoolHowToUnlock: string
  teamPoolWayInvite: string
  teamPoolWayTasks: string
  teamPoolWayInfluencer: string
  teamPoolClaim: string

  // network
  invitedBy: string
  youInvited: string
  friends: (n: number) => string
  inviteBtn: string
  inviteHint: string
  // invite & earn hero
  inviteEarnTitle: string
  spinsBankedFromInvites: (n: number) => string
  outOfSpinsInvite: string
  // share your win → bonus spin
  shareWinBtn: string
  shareWinText: (prize: string) => string
  // first-spin welcome win
  firstWinTitle: string
  firstWinMsg: (amount: string) => string
  // invite milestones
  inviteMilestoneTitle: string
  inviteMilestoneNext: (remaining: number, reward: string) => string
  inviteMilestoneAllDone: string
  // weekly invite leaderboard
  leaderboardTitle: string
  leaderboardPrizeNote: string
  leaderboardYou: (rank: number, count: number) => string
  leaderboardUnranked: string

  // history
  spinHistory: string

  // explore
  explorePolnation: string
  exploreAll: string
  exploreHint: string
  dashboard: string
  earnings: string
  agenticTeam: string

  // main button
  spinning: string
  spinBtn: (n: number) => string
  spinBtnUnlimited: string
  noSpinsLeft: string

  // TG popups
  noSpinsTitle: string
  noSpinsMsg: string
  congratsTitle: string
  tryAgainTitle: string
  betterLuck: string
  usdcAdded: (label: string) => string
  bonusAdded: (label: string) => string
  electronicsAdded: (label: string) => string
  withdrawSuccessTitle: string
  withdrawSuccessMsg: (amount: string) => string
  tgGroupRequired: string

  // rules modal
  howItWorks: string
  earnSpinsTitle: string
  earnSpins1: string
  earnSpins2: string
  earnSpins3: string
  usdcPrizesTitle: string
  usdcPrizesDesc: string
  bonusPrizesTitle: string
  bonusPrizesDesc1: string
  bonusPrizesDesc2: string
  tryAgainSection: string
  tryAgainDesc: string
  viewTeamBtn: string

  // share
  shareText: string

  // web login binding (Phase 7 step 4)
  webAccessTitle: string
  webAccessDesc: string
  webAccessBtn: string
  webLoginTitle: string
  webLoginIntro: string
  webLoginEmailLabel: string
  webLoginPasswordLabel: string
  webLoginSaveBtn: string
  webLoginSavingBtn: string
  webLoginDoneBtn: string
  webLoginSuccess: (email: string) => string
  webLoginPasswordTooShort: string
  webLoginGenericError: string
  webLoginNetworkError: string

  // wallet binder — Trust on Android falls back to Chrome guide
  walletTrustNotInTg: string
  walletTrustStep1: string
  walletTrustStep2: string
  walletTrustStep3: string
  walletTrustAlt: string
  walletOpenInBrowser: string
  walletInstall: string
  walletBackBtn: string
}

const en: Translations = {
  startingUp: 'Starting…',
  connecting: 'Connecting…',
  openInTelegram: 'Open this page from inside Telegram.',
  noSession: 'No Telegram session data — open via the bot.',
  cantOpenLottery: "Couldn't open the lottery",
  tryAgainBtn: 'Try Again',
  prepStep1Title: 'Verifying Telegram',
  prepStep1Sub: 'Securing your session…',
  prepStep2Title: 'Creating your account',
  prepStep2Sub: 'Almost there…',
  prepStep3Title: 'Preparing your spins',
  prepStep3Sub: 'Loading prizes…',

  webLink: 'WEB ↗',
  language: 'Language',

  greeting: (name) => `Hi ${name} 👋`,
  lotteryTitle: 'Polnation Lottery',
  spinToWin: 'Spin to Win',
  unlimitedSpins: '∞ Unlimited spins',
  spinsAvailable: (n) => `${n} spin${n === 1 ? '' : 's'} available`,

  welcomeTask: 'Welcome Task',
  joinTelegramGroup: 'Join our Telegram group',
  earnFreeSpin: 'Earn 1 free spin — claimable once.',
  joinGroupBtn: '📢 Join Group → +1 Spin',
  verifyingMembership: 'Verifying membership…',
  inviteUnavailable: 'Group invite unavailable. Try again later.',

  withdrawable: 'Withdrawable',
  joinToWithdraw: '📢 Join Telegram Group to Withdraw',
  connectWallet: '🔗 Connect Wallet to Withdraw',
  minWithdraw: 'Minimum $0.10 USDC',
  withdrawSubmitted: '✅ Withdrawal submitted',
  withdraw: 'Withdraw',
  withdrawPending: '…',
  maxPlaceholder: (max) => `Max $${max}`,

  teamPool: (level) => `Team Pool · Level ${level}`,
  teamPoolUnlocked: (level) => `Level ${level} pool unlocked — claim on web to start daily yield.`,
  teamPoolProgress: (remaining, pool) => `$${remaining} more to unlock the $${pool} prize pool. Bonus spins + invites fill it.`,
  teamPoolEmpty: 'Win Bonus prizes or invite friends to fill the team pool.',
  viewTeamProgress: 'VIEW TEAM PROGRESS ↗',
  teamPoolNeedMore: (remaining) => `Need $${remaining} more to unlock`,
  teamPoolHowToUnlock: 'How to unlock faster',
  teamPoolWayInvite: 'Invite friends',
  teamPoolWayTasks: 'Complete tasks on dashboard',
  teamPoolWayInfluencer: 'Become influencer (50% off)',
  teamPoolClaim: 'CLAIM ON DASHBOARD ↗',

  invitedBy: 'Invited By',
  youInvited: 'You Invited',
  friends: (n) => `${n} ${n === 1 ? 'friend' : 'friends'}`,
  inviteBtn: '🔗 Invite a Friend → +1 Spin',
  inviteHint: 'Each friend who joins via Telegram earns you 1 spin.',
  inviteEarnTitle: 'Invite & Earn Spins',
  spinsBankedFromInvites: (n) => `🎟️ ${n} spins earned from invites`,
  outOfSpinsInvite: 'Out of spins? Invite friends — +1 spin each!',
  shareWinBtn: '🎟️ Share & Earn +1 Spin',
  firstWinTitle: '🎉 Welcome Gift!',
  inviteMilestoneTitle: 'Invite Milestones',
  inviteMilestoneNext: (remaining, reward) => `Invite ${remaining} more to earn ${reward}`,
  inviteMilestoneAllDone: '🏆 All invite milestones claimed!',
  leaderboardTitle: 'Weekly Invite Leaderboard',
  leaderboardPrizeNote: 'Top 3 win $5 / $3 / $2 every week',
  leaderboardYou: (rank, count) => `You: #${rank} · ${count} invites`,
  leaderboardUnranked: "Invite friends to climb this week's board!",
  firstWinMsg: (amount) => `You won $${amount} USDC — it's already in your withdrawable balance. Cash out below!`,
  shareWinText: (prize) => `I just won ${prize} on Polnation 🎉 Spin to win free USDC:`,

  spinHistory: 'Spin History',

  explorePolnation: 'Explore Polnation',
  exploreAll: 'ALL ↗',
  exploreHint: 'Bonus prizes unlock progress on your web account. Daily USDC distributions, staking yields, and referral commissions all live on the main site.',
  dashboard: 'Dashboard',
  earnings: 'Earnings',
  agenticTeam: 'Agentic Team Earnings',

  spinning: 'SPINNING…',
  spinBtn: (n) => `SPIN (${n} LEFT)`,
  spinBtnUnlimited: 'SPIN ∞',
  noSpinsLeft: 'NO SPINS LEFT',

  noSpinsTitle: 'No spins left',
  noSpinsMsg: 'Invite a friend who joins via Telegram to earn another spin.',
  congratsTitle: '🎉 Congratulations',
  tryAgainTitle: 'Try again',
  betterLuck: 'Better luck next time!',
  usdcAdded: (label) => `${label}\n\n💰 Added to your withdrawable balance.`,
  bonusAdded: (label) => `${label}\n\n⭐ Added to your unlock progress.`,
  electronicsAdded: (label) => `${label}\n\n🎁 Contact admin on Telegram to claim your prize.`,
  withdrawSuccessTitle: '✅ Withdrawal submitted',
  withdrawSuccessMsg: (amount) => `$${amount} USDC is being processed to your wallet.`,
  tgGroupRequired: 'Join the Polnation Telegram group to withdraw.',

  howItWorks: 'How it Works',
  earnSpinsTitle: 'How to earn spins',
  earnSpins1: 'Join our official Telegram group → +1 free spin (one-time)',
  earnSpins2: 'Invite a friend who joins via your link → +1 spin per friend',
  earnSpins3: 'Daily airdrop tasks on web — every 7 claims → +1 spin',
  usdcPrizesTitle: 'USDC prizes — instant withdrawable',
  usdcPrizesDesc: 'Winning $0.50 / $1 / $5 USDC credits your withdrawable balance immediately. Connect a wallet and tap Withdraw to send USDC straight to your address on Polygon.',
  bonusPrizesTitle: 'Bonus prizes — Team prize pool',
  bonusPrizesDesc1: '+$1 / +$2 / +$3 Bonus wins do not withdraw directly. They feed your team prize pool progress, alongside your team referral volume.',
  bonusPrizesDesc2: "Once your effective progress hits the level threshold, you can claim that level's prize pool on the web dashboard — it then pays out daily yield until exhausted.",
  tryAgainSection: 'Try Again',
  tryAgainDesc: 'Some slices have no prize. Your spin count is consumed but no reward is credited — better luck next time.',
  viewTeamBtn: 'View Team Pool Progress ↗',

  shareText: 'Free spins for Real USDC rewards. No complicated setup.\n\nJoin Polnation through my link and start earning. Invite and Earn.',

  webAccessTitle: 'WEB ACCESS',
  webAccessDesc: 'Sign in on polnation.com from any browser using email + password. Your Telegram login keeps working.',
  webAccessBtn: 'SET UP WEB LOGIN →',
  webLoginTitle: 'Set up web login',
  webLoginIntro: 'Bind an email and password so you can sign in on polnation.com from any browser. Your Telegram login continues to work — this is just an additional way in.',
  webLoginEmailLabel: 'Email',
  webLoginPasswordLabel: 'Password (6+ chars)',
  webLoginSaveBtn: 'Save',
  webLoginSavingBtn: 'Saving…',
  webLoginDoneBtn: 'Done',
  webLoginSuccess: (email) => `Web login is ready. Sign in at polnation.com with ${email}.`,
  webLoginPasswordTooShort: 'Password must be at least 6 characters',
  webLoginGenericError: 'Failed to set up web login',
  webLoginNetworkError: 'Network error — please try again',

  walletTrustNotInTg: 'Trust Wallet is not supported in Telegram',
  walletTrustStep1: 'Open polnation.com in Chrome',
  walletTrustStep2: 'Sign in with email or Telegram',
  walletTrustStep3: 'Bind wallet → choose Trust',
  walletTrustAlt: 'Or use Bitget Wallet or SafePal here in Telegram.',
  walletOpenInBrowser: 'Open in browser',
  walletInstall: 'Install',
  walletBackBtn: 'Back',
}

const zh: Translations = {
  startingUp: '启动中…',
  connecting: '连接中…',
  openInTelegram: '请在 Telegram 中打开此页面。',
  noSession: '未检测到 Telegram 会话，请通过机器人打开。',
  cantOpenLottery: '无法打开抽奖',
  tryAgainBtn: '重试',
  prepStep1Title: '正在验证 Telegram',
  prepStep1Sub: '建立安全连接…',
  prepStep2Title: '正在创建你的账户',
  prepStep2Sub: '马上完成…',
  prepStep3Title: '准备抽奖次数',
  prepStep3Sub: '加载奖品…',

  webLink: '网页 ↗',
  language: '语言',

  greeting: (name) => `你好 ${name} 👋`,
  lotteryTitle: 'Polnation 抽奖',
  spinToWin: '转盘赢奖',
  unlimitedSpins: '∞ 无限次',
  spinsAvailable: (n) => `剩余 ${n} 次`,

  welcomeTask: '新手任务',
  joinTelegramGroup: '加入我们的 Telegram 群组',
  earnFreeSpin: '获得 1 次免费抽奖 — 仅限一次。',
  joinGroupBtn: '📢 加入群组 → +1 次抽奖',
  verifyingMembership: '正在验证成员资格…',
  inviteUnavailable: '群组邀请链接暂不可用，请稍后重试。',

  withdrawable: '可提现余额',
  joinToWithdraw: '📢 加入 Telegram 群组以提现',
  connectWallet: '🔗 连接钱包以提现',
  minWithdraw: '最低提现 $0.10 USDC',
  withdrawSubmitted: '✅ 提现申请已提交',
  withdraw: '提现',
  withdrawPending: '…',
  maxPlaceholder: (max) => `最多 $${max}`,

  teamPool: (level) => `团队奖池 · Level ${level}`,
  teamPoolUnlocked: (level) => `Level ${level} 奖池已解锁 — 在网站领取以开始每日收益。`,
  teamPoolProgress: (remaining, pool) => `还需 $${remaining} 解锁 $${pool} 奖池，奖励抽奖和邀请好友均可填充。`,
  teamPoolEmpty: '赢取奖励大奖或邀请好友填满团队奖池。',
  viewTeamProgress: '查看团队进度 ↗',
  teamPoolNeedMore: (remaining) => `还需 $${remaining} 解锁`,
  teamPoolHowToUnlock: '如何更快解锁',
  teamPoolWayInvite: '邀请好友',
  teamPoolWayTasks: '在 dashboard 完成任务',
  teamPoolWayInfluencer: '成为 influencer（5折门槛）',
  teamPoolClaim: '前往 DASHBOARD 领取 ↗',

  invitedBy: '邀请人',
  youInvited: '你邀请了',
  friends: (n) => `${n} 位好友`,
  inviteBtn: '🔗 邀请好友 → +1 次抽奖',
  inviteHint: '每位通过你的链接加入 Telegram 的好友可为你赢得 1 次抽奖机会。',
  inviteEarnTitle: '邀请赚抽奖次数',
  spinsBankedFromInvites: (n) => `🎟️ 已通过邀请获得 ${n} 次抽奖`,
  outOfSpinsInvite: '次数用完了？邀请好友，每人 +1 次抽奖！',
  shareWinBtn: '🎟️ 晒中奖 → +1 抽奖',
  firstWinTitle: '🎉 新人见面礼！',
  inviteMilestoneTitle: '邀请里程碑',
  inviteMilestoneNext: (remaining, reward) => `再邀请 ${remaining} 人即可获得 ${reward}`,
  inviteMilestoneAllDone: '🏆 所有邀请里程碑已达成！',
  leaderboardTitle: '每周邀请榜',
  leaderboardPrizeNote: '每周前 3 名赢 $5 / $3 / $2',
  leaderboardYou: (rank, count) => `你：第 ${rank} 名 · ${count} 人`,
  leaderboardUnranked: '邀请好友冲上本周榜单！',
  firstWinMsg: (amount) => `你赢得了 $${amount} USDC，已进入你的可提现余额。到下方提现吧！`,
  shareWinText: (prize) => `我在 Polnation 抽中了 ${prize} 🎉 快来转盘赢免费 USDC：`,

  spinHistory: '抽奖记录',

  explorePolnation: '探索 Polnation',
  exploreAll: '全部 ↗',
  exploreHint: '奖励大奖将解锁网页账户进度。每日 USDC 分发、质押收益和推荐佣金均在主网站上。',
  dashboard: '控制台',
  earnings: '收益',
  agenticTeam: '智能团队收益',

  spinning: '旋转中…',
  spinBtn: (n) => `抽奖 (剩余 ${n} 次)`,
  spinBtnUnlimited: '抽奖 ∞',
  noSpinsLeft: '暂无抽奖次数',

  noSpinsTitle: '没有抽奖次数了',
  noSpinsMsg: '邀请通过 Telegram 加入的好友以获得更多次数。',
  congratsTitle: '🎉 恭喜',
  tryAgainTitle: '再试一次',
  betterLuck: '下次运气更好！',
  usdcAdded: (label) => `${label}\n\n💰 已添加到可提现余额。`,
  bonusAdded: (label) => `${label}\n\n⭐ 已添加到解锁进度。`,
  electronicsAdded: (label) => `${label}\n\n🎁 请在 Telegram 联系管理员领取奖品。`,
  withdrawSuccessTitle: '✅ 提现申请已提交',
  withdrawSuccessMsg: (amount) => `$${amount} USDC 正在处理到你的钱包。`,
  tgGroupRequired: '请先加入 Polnation Telegram 群组再提现。',

  howItWorks: '活动规则',
  earnSpinsTitle: '如何获得抽奖次数',
  earnSpins1: '加入官方 Telegram 群组 → +1 次免费抽奖（仅限一次）',
  earnSpins2: '邀请好友通过你的链接加入 → 每位好友 +1 次',
  earnSpins3: '完成网站每日空投任务 — 每累计 7 次 → +1 次',
  usdcPrizesTitle: 'USDC 奖励 — 即时可提现',
  usdcPrizesDesc: '赢得 $0.50 / $1 / $5 USDC 将立即添加到可提现余额。连接钱包后点击提现，直接发送到你在 Polygon 上的地址。',
  bonusPrizesTitle: '奖励大奖 — 团队奖池',
  bonusPrizesDesc1: '+$1 / +$2 / +$3 奖励不可直接提现，而是填充你的团队奖池进度（加上团队推荐量）。',
  bonusPrizesDesc2: '当有效进度达到等级阈值后，可在网页控制台领取该等级奖池，届时每日发放收益直至耗尽。',
  tryAgainSection: '谢谢参与',
  tryAgainDesc: '部分扇形无奖励，消耗抽奖次数但不发放奖励，祝下次好运。',
  viewTeamBtn: '查看团队奖池进度 ↗',

  shareText: '免费抽奖，赢取真实 USDC 奖励。无需复杂设置。\n\n通过我的链接加入 Polnation，开始赚取奖励。邀请好友也能赚。',

  webAccessTitle: '网页登录',
  webAccessDesc: '在任何浏览器使用邮箱+密码登录 polnation.com。你的 Telegram 登录继续有效。',
  webAccessBtn: '设置网页登录 →',
  webLoginTitle: '设置网页登录',
  webLoginIntro: '绑定邮箱和密码后，可以在任何浏览器登录 polnation.com。你的 Telegram 登录继续有效——这只是多一种登录方式。',
  webLoginEmailLabel: '邮箱',
  webLoginPasswordLabel: '密码（至少 6 位）',
  webLoginSaveBtn: '保存',
  webLoginSavingBtn: '保存中…',
  webLoginDoneBtn: '完成',
  webLoginSuccess: (email) => `网页登录已就绪。使用 ${email} 在 polnation.com 登录。`,
  webLoginPasswordTooShort: '密码至少需要 6 位',
  webLoginGenericError: '设置网页登录失败',
  webLoginNetworkError: '网络错误——请重试',

  walletTrustNotInTg: 'Trust 钱包暂不支持在 Telegram 中连接',
  walletTrustStep1: '在 Chrome 浏览器中打开 polnation.com',
  walletTrustStep2: '使用邮箱或 Telegram 登录',
  walletTrustStep3: '绑定钱包 → 选择 Trust',
  walletTrustAlt: '或在 Telegram 中使用 Bitget 钱包或 SafePal。',
  walletOpenInBrowser: '在浏览器中打开',
  walletInstall: '安装',
  walletBackBtn: '返回',
}

const ru: Translations = {
  startingUp: 'Запуск…',
  connecting: 'Подключение…',
  openInTelegram: 'Откройте эту страницу в Telegram.',
  noSession: 'Данные сессии Telegram отсутствуют — откройте через бота.',
  cantOpenLottery: 'Не удалось открыть лотерею',
  tryAgainBtn: 'Повторить',
  prepStep1Title: 'Проверка Telegram',
  prepStep1Sub: 'Защита вашей сессии…',
  prepStep2Title: 'Создание аккаунта',
  prepStep2Sub: 'Почти готово…',
  prepStep3Title: 'Подготовка спинов',
  prepStep3Sub: 'Загрузка призов…',

  webLink: 'ВЕБ ↗',
  language: 'Язык',

  greeting: (name) => `Привет, ${name} 👋`,
  lotteryTitle: 'Лотерея Polnation',
  spinToWin: 'Крути и выигрывай',
  unlimitedSpins: '∞ Безлимитно',
  spinsAvailable: (n) => `${n} ${n === 1 ? 'попытка' : n < 5 ? 'попытки' : 'попыток'}`,

  welcomeTask: 'Приветственное задание',
  joinTelegramGroup: 'Вступите в нашу группу Telegram',
  earnFreeSpin: 'Получите 1 бесплатный спин — только один раз.',
  joinGroupBtn: '📢 Вступить в группу → +1 спин',
  verifyingMembership: 'Проверка членства…',
  inviteUnavailable: 'Ссылка-приглашение недоступна. Попробуйте позже.',

  withdrawable: 'Доступно для вывода',
  joinToWithdraw: '📢 Вступите в группу Telegram для вывода',
  connectWallet: '🔗 Подключить кошелёк для вывода',
  minWithdraw: 'Минимум $0.10 USDC',
  withdrawSubmitted: '✅ Заявка на вывод отправлена',
  withdraw: 'Вывести',
  withdrawPending: '…',
  maxPlaceholder: (max) => `Макс. $${max}`,

  teamPool: (level) => `Командный пул · Уровень ${level}`,
  teamPoolUnlocked: (level) => `Пул уровня ${level} разблокирован — заберите на сайте для начала ежедневного дохода.`,
  teamPoolProgress: (remaining, pool) => `Ещё $${remaining} до разблокировки призового пула $${pool}. Бонусные спины и приглашения заполняют его.`,
  teamPoolEmpty: 'Выигрывайте бонусы или приглашайте друзей, чтобы заполнить командный пул.',
  viewTeamProgress: 'ПРОГРЕСС КОМАНДЫ ↗',
  teamPoolNeedMore: (remaining) => `Ещё $${remaining} до разблокировки`,
  teamPoolHowToUnlock: 'Как разблокировать быстрее',
  teamPoolWayInvite: 'Пригласить друзей',
  teamPoolWayTasks: 'Выполнить задания в dashboard',
  teamPoolWayInfluencer: 'Стать инфлюенсером (-50%)',
  teamPoolClaim: 'ЗАБРАТЬ В DASHBOARD ↗',

  invitedBy: 'Пригласил',
  youInvited: 'Вы пригласили',
  friends: (n) => `${n} ${n === 1 ? 'друг' : n < 5 ? 'друга' : 'друзей'}`,
  inviteBtn: '🔗 Пригласить друга → +1 спин',
  inviteHint: 'Каждый друг, вступивший через Telegram, даёт вам 1 спин.',
  inviteEarnTitle: 'Приглашай и получай спины',
  spinsBankedFromInvites: (n) => `🎟️ ${n} спинов получено за приглашения`,
  outOfSpinsInvite: 'Спины закончились? Приглашай друзей — +1 спин за каждого!',
  shareWinBtn: '🎟️ Поделиться → +1 спин',
  firstWinTitle: '🎉 Приветственный подарок!',
  inviteMilestoneTitle: 'Этапы приглашений',
  inviteMilestoneNext: (remaining, reward) => `Пригласите ещё ${remaining}, чтобы получить ${reward}`,
  inviteMilestoneAllDone: '🏆 Все этапы приглашений выполнены!',
  leaderboardTitle: 'Недельный топ приглашений',
  leaderboardPrizeNote: 'Топ-3 каждую неделю получают $5 / $3 / $2',
  leaderboardYou: (rank, count) => `Вы: #${rank} · ${count} приглаш.`,
  leaderboardUnranked: 'Приглашайте друзей, чтобы попасть в топ недели!',
  firstWinMsg: (amount) => `Вы выиграли $${amount} USDC — они уже на вашем балансе для вывода. Выводите ниже!`,
  shareWinText: (prize) => `Я только что выиграл ${prize} на Polnation 🎉 Крути и выигрывай USDC:`,

  spinHistory: 'История спинов',

  explorePolnation: 'Исследуйте Polnation',
  exploreAll: 'ВСЕ ↗',
  exploreHint: 'Бонусные призы разблокируют прогресс на вашем веб-аккаунте. Ежедневные выплаты USDC, стейкинг и реферальные комиссии — на основном сайте.',
  dashboard: 'Панель',
  earnings: 'Доходы',
  agenticTeam: 'Командные доходы AI',

  spinning: 'ВРАЩЕНИЕ…',
  spinBtn: (n) => `КРУТИТЬ (${n} ОСТ.)`,
  spinBtnUnlimited: 'КРУТИТЬ ∞',
  noSpinsLeft: 'НЕТ СПИНОВ',

  noSpinsTitle: 'Спины закончились',
  noSpinsMsg: 'Пригласите друга через Telegram, чтобы получить ещё спин.',
  congratsTitle: '🎉 Поздравляем',
  tryAgainTitle: 'Попробуйте ещё раз',
  betterLuck: 'В следующий раз повезёт!',
  usdcAdded: (label) => `${label}\n\n💰 Добавлено на баланс для вывода.`,
  bonusAdded: (label) => `${label}\n\n⭐ Добавлено к прогрессу разблокировки.`,
  electronicsAdded: (label) => `${label}\n\n🎁 Свяжитесь с админом в Telegram, чтобы получить приз.`,
  withdrawSuccessTitle: '✅ Заявка на вывод отправлена',
  withdrawSuccessMsg: (amount) => `$${amount} USDC обрабатывается и будет отправлено на ваш кошелёк.`,
  tgGroupRequired: 'Вступите в группу Telegram Polnation для вывода средств.',

  howItWorks: 'Как это работает',
  earnSpinsTitle: 'Как получить спины',
  earnSpins1: 'Вступите в официальную группу Telegram → +1 бесплатный спин (один раз)',
  earnSpins2: 'Пригласите друга по вашей ссылке → +1 спин за каждого',
  earnSpins3: 'Ежедневные задания на сайте — каждые 7 выполнений → +1 спин',
  usdcPrizesTitle: 'Призы USDC — мгновенный вывод',
  usdcPrizesDesc: 'Выигрыш $0.50 / $1 / $5 USDC сразу зачисляется на баланс для вывода. Подключите кошелёк и нажмите «Вывести» для отправки USDC на адрес в сети Polygon.',
  bonusPrizesTitle: 'Бонусные призы — командный пул',
  bonusPrizesDesc1: 'Выигрыши +$1 / +$2 / +$3 не выводятся напрямую. Они пополняют прогресс командного пула вместе с объёмом реферальной команды.',
  bonusPrizesDesc2: 'После достижения порога уровня вы можете забрать призовой пул на веб-панели — он выплачивается ежедневно до исчерпания.',
  tryAgainSection: 'Не повезло',
  tryAgainDesc: 'Некоторые секторы не имеют приза. Спин расходуется, но награда не начисляется — удачи в следующий раз.',
  viewTeamBtn: 'Прогресс командного пула ↗',

  shareText: 'Бесплатные вращения за реальные награды в USDC. Никакой сложной настройки.\n\nПрисоединяйтесь к Polnation по моей ссылке и начинайте зарабатывать. Приглашайте и зарабатывайте.',

  webAccessTitle: 'ВХОД ЧЕРЕЗ ВЕБ',
  webAccessDesc: 'Войдите на polnation.com из любого браузера через email и пароль. Вход через Telegram продолжит работать.',
  webAccessBtn: 'НАСТРОИТЬ ВЕБ-ВХОД →',
  webLoginTitle: 'Настроить веб-вход',
  webLoginIntro: 'Привяжите email и пароль, чтобы входить на polnation.com из любого браузера. Вход через Telegram продолжит работать — это просто дополнительный способ.',
  webLoginEmailLabel: 'Email',
  webLoginPasswordLabel: 'Пароль (от 6 символов)',
  webLoginSaveBtn: 'Сохранить',
  webLoginSavingBtn: 'Сохранение…',
  webLoginDoneBtn: 'Готово',
  webLoginSuccess: (email) => `Веб-вход готов. Войдите на polnation.com с ${email}.`,
  webLoginPasswordTooShort: 'Пароль должен быть не менее 6 символов',
  webLoginGenericError: 'Не удалось настроить веб-вход',
  webLoginNetworkError: 'Ошибка сети — попробуйте снова',

  walletTrustNotInTg: 'Trust Wallet не поддерживается в Telegram',
  walletTrustStep1: 'Откройте polnation.com в Chrome',
  walletTrustStep2: 'Войдите через email или Telegram',
  walletTrustStep3: 'Привяжите кошелёк → выберите Trust',
  walletTrustAlt: 'Или используйте Bitget Wallet либо SafePal здесь, в Telegram.',
  walletOpenInBrowser: 'Открыть в браузере',
  walletInstall: 'Установить',
  walletBackBtn: 'Назад',
}

const es: Translations = {
  startingUp: 'Iniciando…',
  connecting: 'Conectando…',
  openInTelegram: 'Abre esta página desde Telegram.',
  noSession: 'Sin datos de sesión de Telegram — ábrelo desde el bot.',
  cantOpenLottery: 'No se pudo abrir la lotería',
  tryAgainBtn: 'Intentar de nuevo',
  prepStep1Title: 'Verificando Telegram',
  prepStep1Sub: 'Asegurando tu sesión…',
  prepStep2Title: 'Creando tu cuenta',
  prepStep2Sub: 'Casi listo…',
  prepStep3Title: 'Preparando tus giros',
  prepStep3Sub: 'Cargando premios…',

  webLink: 'WEB ↗',
  language: 'Idioma',

  greeting: (name) => `Hola ${name} 👋`,
  lotteryTitle: 'Lotería Polnation',
  spinToWin: 'Gira y Gana',
  unlimitedSpins: '∞ Giros ilimitados',
  spinsAvailable: (n) => `${n} giro${n === 1 ? '' : 's'} disponible${n === 1 ? '' : 's'}`,

  welcomeTask: 'Tarea de bienvenida',
  joinTelegramGroup: 'Únete a nuestro grupo de Telegram',
  earnFreeSpin: 'Gana 1 giro gratis — solo una vez.',
  joinGroupBtn: '📢 Unirse al grupo → +1 giro',
  verifyingMembership: 'Verificando membresía…',
  inviteUnavailable: 'Enlace de invitación no disponible. Inténtalo más tarde.',

  withdrawable: 'Retirable',
  joinToWithdraw: '📢 Únete al grupo de Telegram para retirar',
  connectWallet: '🔗 Conectar billetera para retirar',
  minWithdraw: 'Mínimo $0.10 USDC',
  withdrawSubmitted: '✅ Retiro enviado',
  withdraw: 'Retirar',
  withdrawPending: '…',
  maxPlaceholder: (max) => `Máx. $${max}`,

  teamPool: (level) => `Pool del equipo · Nivel ${level}`,
  teamPoolUnlocked: (level) => `Pool nivel ${level} desbloqueado — reclámalo en la web para empezar el rendimiento diario.`,
  teamPoolProgress: (remaining, pool) => `$${remaining} más para desbloquear el pool de $${pool}. Los giros bonus e invitaciones lo llenan.`,
  teamPoolEmpty: 'Gana premios bonus o invita amigos para llenar el pool del equipo.',
  viewTeamProgress: 'VER PROGRESO DEL EQUIPO ↗',
  teamPoolNeedMore: (remaining) => `Faltan $${remaining} para desbloquear`,
  teamPoolHowToUnlock: 'Cómo desbloquear más rápido',
  teamPoolWayInvite: 'Invitar amigos',
  teamPoolWayTasks: 'Completa tareas en el dashboard',
  teamPoolWayInfluencer: 'Ser influencer (50% menos)',
  teamPoolClaim: 'RECLAMAR EN DASHBOARD ↗',

  invitedBy: 'Invitado por',
  youInvited: 'Tú invitaste',
  friends: (n) => `${n} amigo${n === 1 ? '' : 's'}`,
  inviteBtn: '🔗 Invitar a un amigo → +1 giro',
  inviteHint: 'Cada amigo que se una vía Telegram te da 1 giro.',
  inviteEarnTitle: 'Invita y gana giros',
  spinsBankedFromInvites: (n) => `🎟️ ${n} giros ganados por invitaciones`,
  outOfSpinsInvite: '¿Sin giros? Invita amigos: ¡+1 giro por cada uno!',
  shareWinBtn: '🎟️ Compartir → +1 giro',
  firstWinTitle: '🎉 ¡Regalo de bienvenida!',
  inviteMilestoneTitle: 'Hitos de invitación',
  inviteMilestoneNext: (remaining, reward) => `Invita a ${remaining} más para ganar ${reward}`,
  inviteMilestoneAllDone: '🏆 ¡Todos los hitos de invitación logrados!',
  leaderboardTitle: 'Ranking semanal de invitaciones',
  leaderboardPrizeNote: 'El top 3 gana $5 / $3 / $2 cada semana',
  leaderboardYou: (rank, count) => `Tú: #${rank} · ${count} invitados`,
  leaderboardUnranked: '¡Invita amigos para subir al ranking de la semana!',
  firstWinMsg: (amount) => `Ganaste $${amount} USDC, ya están en tu saldo retirable. ¡Retíralo abajo!`,
  shareWinText: (prize) => `¡Acabo de ganar ${prize} en Polnation! 🎉 Gira y gana USDC gratis:`,

  spinHistory: 'Historial de giros',

  explorePolnation: 'Explorar Polnation',
  exploreAll: 'TODO ↗',
  exploreHint: 'Los premios bonus desbloquean el progreso en tu cuenta web. Distribuciones diarias de USDC, rendimientos de staking y comisiones de referidos en el sitio principal.',
  dashboard: 'Panel',
  earnings: 'Ganancias',
  agenticTeam: 'Ganancias del equipo IA',

  spinning: 'GIRANDO…',
  spinBtn: (n) => `GIRAR (${n} REST.)`,
  spinBtnUnlimited: 'GIRAR ∞',
  noSpinsLeft: 'SIN GIROS',

  noSpinsTitle: 'Sin giros disponibles',
  noSpinsMsg: 'Invita a un amigo que se una vía Telegram para ganar otro giro.',
  congratsTitle: '🎉 ¡Felicitaciones!',
  tryAgainTitle: 'Inténtalo de nuevo',
  betterLuck: '¡Mejor suerte la próxima vez!',
  usdcAdded: (label) => `${label}\n\n💰 Añadido a tu saldo retirable.`,
  bonusAdded: (label) => `${label}\n\n⭐ Añadido a tu progreso de desbloqueo.`,
  electronicsAdded: (label) => `${label}\n\n🎁 Contacta al admin en Telegram para reclamar tu premio.`,
  withdrawSuccessTitle: '✅ Retiro enviado',
  withdrawSuccessMsg: (amount) => `$${amount} USDC está siendo procesado a tu billetera.`,
  tgGroupRequired: 'Únete al grupo de Telegram de Polnation para retirar.',

  howItWorks: 'Cómo funciona',
  earnSpinsTitle: 'Cómo ganar giros',
  earnSpins1: 'Únete al grupo oficial de Telegram → +1 giro gratis (único)',
  earnSpins2: 'Invita a un amigo con tu enlace → +1 giro por amigo',
  earnSpins3: 'Tareas diarias de airdrop en la web — cada 7 → +1 giro',
  usdcPrizesTitle: 'Premios USDC — retiro instantáneo',
  usdcPrizesDesc: 'Ganar $0.50 / $1 / $5 USDC acredita tu saldo retirable de inmediato. Conecta una billetera y toca Retirar para enviar USDC a tu dirección en Polygon.',
  bonusPrizesTitle: 'Premios bonus — pool del equipo',
  bonusPrizesDesc1: 'Las ganancias de +$1 / +$2 / +$3 bonus no se retiran directamente. Alimentan el progreso de tu pool del equipo, junto al volumen referido.',
  bonusPrizesDesc2: 'Al alcanzar el umbral del nivel, puedes reclamar el pool en el panel web — luego paga rendimiento diario hasta agotarse.',
  tryAgainSection: 'Sin premio',
  tryAgainDesc: 'Algunos sectores no tienen premio. El giro se consume sin recompensa — ¡mejor suerte la próxima!',
  viewTeamBtn: 'Ver progreso del pool del equipo ↗',

  shareText: 'Giros gratis por recompensas reales en USDC. Sin configuración complicada.\n\nÚnete a Polnation con mi enlace y empieza a ganar. Invita y gana.',

  webAccessTitle: 'ACCESO WEB',
  webAccessDesc: 'Inicia sesión en polnation.com desde cualquier navegador con email y contraseña. Tu inicio con Telegram sigue funcionando.',
  webAccessBtn: 'CONFIGURAR ACCESO WEB →',
  webLoginTitle: 'Configurar acceso web',
  webLoginIntro: 'Vincula un email y contraseña para iniciar sesión en polnation.com desde cualquier navegador. Tu inicio con Telegram sigue funcionando — esto es solo una forma adicional de entrar.',
  webLoginEmailLabel: 'Email',
  webLoginPasswordLabel: 'Contraseña (6+ caracteres)',
  webLoginSaveBtn: 'Guardar',
  webLoginSavingBtn: 'Guardando…',
  webLoginDoneBtn: 'Listo',
  webLoginSuccess: (email) => `Acceso web listo. Inicia sesión en polnation.com con ${email}.`,
  webLoginPasswordTooShort: 'La contraseña debe tener al menos 6 caracteres',
  webLoginGenericError: 'No se pudo configurar el acceso web',
  webLoginNetworkError: 'Error de red — inténtalo de nuevo',

  walletTrustNotInTg: 'Trust Wallet no es compatible con Telegram',
  walletTrustStep1: 'Abre polnation.com en Chrome',
  walletTrustStep2: 'Inicia sesión con email o Telegram',
  walletTrustStep3: 'Vincular wallet → elige Trust',
  walletTrustAlt: 'O usa Bitget Wallet o SafePal aquí en Telegram.',
  walletOpenInBrowser: 'Abrir en el navegador',
  walletInstall: 'Instalar',
  walletBackBtn: 'Atrás',
}

const pt: Translations = {
  startingUp: 'Iniciando…',
  connecting: 'Conectando…',
  openInTelegram: 'Abra esta página dentro do Telegram.',
  noSession: 'Sem dados de sessão do Telegram — abra pelo bot.',
  cantOpenLottery: 'Não foi possível abrir a loteria',
  tryAgainBtn: 'Tentar novamente',
  prepStep1Title: 'Verificando Telegram',
  prepStep1Sub: 'Protegendo sua sessão…',
  prepStep2Title: 'Criando sua conta',
  prepStep2Sub: 'Quase lá…',
  prepStep3Title: 'Preparando seus giros',
  prepStep3Sub: 'Carregando prêmios…',

  webLink: 'WEB ↗',
  language: 'Idioma',

  greeting: (name) => `Olá ${name} 👋`,
  lotteryTitle: 'Loteria Polnation',
  spinToWin: 'Gire e Ganhe',
  unlimitedSpins: '∞ Giros ilimitados',
  spinsAvailable: (n) => `${n} giro${n === 1 ? '' : 's'} disponível${n === 1 ? '' : 'is'}`,

  welcomeTask: 'Tarefa de boas-vindas',
  joinTelegramGroup: 'Entre no nosso grupo do Telegram',
  earnFreeSpin: 'Ganhe 1 giro grátis — apenas uma vez.',
  joinGroupBtn: '📢 Entrar no grupo → +1 giro',
  verifyingMembership: 'Verificando participação…',
  inviteUnavailable: 'Link de convite indisponível. Tente mais tarde.',

  withdrawable: 'Saldo disponível',
  joinToWithdraw: '📢 Entre no grupo do Telegram para sacar',
  connectWallet: '🔗 Conectar carteira para sacar',
  minWithdraw: 'Mínimo $0.10 USDC',
  withdrawSubmitted: '✅ Saque enviado',
  withdraw: 'Sacar',
  withdrawPending: '…',
  maxPlaceholder: (max) => `Máx. $${max}`,

  teamPool: (level) => `Pool da equipe · Nível ${level}`,
  teamPoolUnlocked: (level) => `Pool nível ${level} desbloqueado — resgate no site para iniciar o rendimento diário.`,
  teamPoolProgress: (remaining, pool) => `$${remaining} a mais para desbloquear o pool de $${pool}. Giros bônus e convites o preenchem.`,
  teamPoolEmpty: 'Ganhe prêmios bônus ou convide amigos para preencher o pool da equipe.',
  viewTeamProgress: 'VER PROGRESSO DA EQUIPE ↗',
  teamPoolNeedMore: (remaining) => `Faltam $${remaining} para desbloquear`,
  teamPoolHowToUnlock: 'Como desbloquear mais rápido',
  teamPoolWayInvite: 'Convidar amigos',
  teamPoolWayTasks: 'Complete tarefas no dashboard',
  teamPoolWayInfluencer: 'Tornar-se influenciador (-50%)',
  teamPoolClaim: 'RESGATAR NO DASHBOARD ↗',

  invitedBy: 'Convidado por',
  youInvited: 'Você convidou',
  friends: (n) => `${n} amigo${n === 1 ? '' : 's'}`,
  inviteBtn: '🔗 Convidar um amigo → +1 giro',
  inviteHint: 'Cada amigo que entrar pelo Telegram lhe rende 1 giro.',
  inviteEarnTitle: 'Convide e ganhe giros',
  spinsBankedFromInvites: (n) => `🎟️ ${n} giros ganhos com convites`,
  outOfSpinsInvite: 'Sem giros? Convide amigos — +1 giro para cada um!',
  shareWinBtn: '🎟️ Compartilhar → +1 giro',
  firstWinTitle: '🎉 Presente de boas-vindas!',
  inviteMilestoneTitle: 'Marcos de convite',
  inviteMilestoneNext: (remaining, reward) => `Convide mais ${remaining} para ganhar ${reward}`,
  inviteMilestoneAllDone: '🏆 Todos os marcos de convite concluídos!',
  leaderboardTitle: 'Ranking semanal de convites',
  leaderboardPrizeNote: 'Top 3 ganha $5 / $3 / $2 toda semana',
  leaderboardYou: (rank, count) => `Você: #${rank} · ${count} convidados`,
  leaderboardUnranked: 'Convide amigos para subir no ranking da semana!',
  firstWinMsg: (amount) => `Você ganhou $${amount} USDC — já está no seu saldo para saque. Saque abaixo!`,
  shareWinText: (prize) => `Acabei de ganhar ${prize} na Polnation 🎉 Gire e ganhe USDC grátis:`,

  spinHistory: 'Histórico de giros',

  explorePolnation: 'Explorar Polnation',
  exploreAll: 'TUDO ↗',
  exploreHint: 'Prêmios bônus desbloqueiam progresso na sua conta web. Distribuições diárias de USDC, rendimentos de staking e comissões de indicação ficam no site principal.',
  dashboard: 'Painel',
  earnings: 'Ganhos',
  agenticTeam: 'Ganhos da equipe IA',

  spinning: 'GIRANDO…',
  spinBtn: (n) => `GIRAR (${n} REST.)`,
  spinBtnUnlimited: 'GIRAR ∞',
  noSpinsLeft: 'SEM GIROS',

  noSpinsTitle: 'Sem giros disponíveis',
  noSpinsMsg: 'Convide um amigo pelo Telegram para ganhar outro giro.',
  congratsTitle: '🎉 Parabéns!',
  tryAgainTitle: 'Tente novamente',
  betterLuck: 'Mais sorte na próxima vez!',
  usdcAdded: (label) => `${label}\n\n💰 Adicionado ao seu saldo disponível.`,
  bonusAdded: (label) => `${label}\n\n⭐ Adicionado ao seu progresso de desbloqueio.`,
  electronicsAdded: (label) => `${label}\n\n🎁 Entre em contato com o admin no Telegram para resgatar seu prêmio.`,
  withdrawSuccessTitle: '✅ Saque enviado',
  withdrawSuccessMsg: (amount) => `$${amount} USDC está sendo processado para sua carteira.`,
  tgGroupRequired: 'Entre no grupo Telegram da Polnation para sacar.',

  howItWorks: 'Como funciona',
  earnSpinsTitle: 'Como ganhar giros',
  earnSpins1: 'Entre no grupo oficial do Telegram → +1 giro grátis (único)',
  earnSpins2: 'Convide um amigo com seu link → +1 giro por amigo',
  earnSpins3: 'Tarefas diárias de airdrop no site — a cada 7 → +1 giro',
  usdcPrizesTitle: 'Prêmios USDC — saque imediato',
  usdcPrizesDesc: 'Ganhar $0.50 / $1 / $5 USDC credita seu saldo disponível imediatamente. Conecte uma carteira e toque em Sacar para enviar USDC ao seu endereço na Polygon.',
  bonusPrizesTitle: 'Prêmios bônus — pool da equipe',
  bonusPrizesDesc1: 'Ganhos de +$1 / +$2 / +$3 bônus não são sacados diretamente. Eles alimentam o progresso do pool da equipe, junto ao volume de indicações.',
  bonusPrizesDesc2: 'Ao atingir o limite do nível, você pode resgatar o pool no painel web — ele paga rendimento diário até se esgotar.',
  tryAgainSection: 'Sem prêmio',
  tryAgainDesc: 'Alguns setores não têm prêmio. O giro é consumido sem recompensa — boa sorte na próxima!',
  viewTeamBtn: 'Ver progresso do pool da equipe ↗',

  shareText: 'Giros grátis por recompensas reais em USDC. Sem configuração complicada.\n\nEntre na Polnation pelo meu link e comece a ganhar. Convide e ganhe.',

  webAccessTitle: 'ACESSO WEB',
  webAccessDesc: 'Faça login em polnation.com de qualquer navegador com email e senha. Seu login pelo Telegram continua funcionando.',
  webAccessBtn: 'CONFIGURAR LOGIN WEB →',
  webLoginTitle: 'Configurar login web',
  webLoginIntro: 'Vincule um email e senha para fazer login em polnation.com de qualquer navegador. Seu login pelo Telegram continua funcionando — isto é apenas uma forma adicional de entrar.',
  webLoginEmailLabel: 'Email',
  webLoginPasswordLabel: 'Senha (6+ caracteres)',
  webLoginSaveBtn: 'Salvar',
  webLoginSavingBtn: 'Salvando…',
  webLoginDoneBtn: 'Concluído',
  webLoginSuccess: (email) => `Login web pronto. Entre em polnation.com com ${email}.`,
  webLoginPasswordTooShort: 'A senha deve ter pelo menos 6 caracteres',
  webLoginGenericError: 'Falha ao configurar login web',
  webLoginNetworkError: 'Erro de rede — tente novamente',

  walletTrustNotInTg: 'Trust Wallet não é compatível com o Telegram',
  walletTrustStep1: 'Abra polnation.com no Chrome',
  walletTrustStep2: 'Entre com email ou Telegram',
  walletTrustStep3: 'Vincular carteira → escolha Trust',
  walletTrustAlt: 'Ou use Bitget Wallet ou SafePal aqui no Telegram.',
  walletOpenInBrowser: 'Abrir no navegador',
  walletInstall: 'Instalar',
  walletBackBtn: 'Voltar',
}

const fr: Translations = {
  startingUp: 'Démarrage…',
  connecting: 'Connexion…',
  openInTelegram: 'Ouvrez cette page depuis Telegram.',
  noSession: 'Aucune session Telegram — ouvrez via le bot.',
  cantOpenLottery: 'Impossible d\'ouvrir la loterie',
  tryAgainBtn: 'Réessayer',
  prepStep1Title: 'Vérification de Telegram',
  prepStep1Sub: 'Sécurisation de votre session…',
  prepStep2Title: 'Création de votre compte',
  prepStep2Sub: 'Presque terminé…',
  prepStep3Title: 'Préparation de vos tours',
  prepStep3Sub: 'Chargement des prix…',

  webLink: 'WEB ↗',
  language: 'Langue',

  greeting: (name) => `Bonjour ${name} 👋`,
  lotteryTitle: 'Loterie Polnation',
  spinToWin: 'Tournez et gagnez',
  unlimitedSpins: '∞ Tours illimités',
  spinsAvailable: (n) => `${n} tour${n === 1 ? '' : 's'} disponible${n === 1 ? '' : 's'}`,

  welcomeTask: 'Tâche de bienvenue',
  joinTelegramGroup: 'Rejoignez notre groupe Telegram',
  earnFreeSpin: 'Gagnez 1 tour gratuit — une seule fois.',
  joinGroupBtn: '📢 Rejoindre le groupe → +1 tour',
  verifyingMembership: 'Vérification de l\'adhésion…',
  inviteUnavailable: 'Lien d\'invitation indisponible. Réessayez plus tard.',

  withdrawable: 'Retirable',
  joinToWithdraw: '📢 Rejoignez le groupe Telegram pour retirer',
  connectWallet: '🔗 Connecter un portefeuille pour retirer',
  minWithdraw: 'Minimum $0.10 USDC',
  withdrawSubmitted: '✅ Retrait soumis',
  withdraw: 'Retirer',
  withdrawPending: '…',
  maxPlaceholder: (max) => `Max $${max}`,

  teamPool: (level) => `Pool d'équipe · Niveau ${level}`,
  teamPoolUnlocked: (level) => `Pool niveau ${level} débloqué — réclamez sur le web pour démarrer le rendement quotidien.`,
  teamPoolProgress: (remaining, pool) => `$${remaining} de plus pour débloquer le pool de $${pool}. Les tours bonus et invitations le remplissent.`,
  teamPoolEmpty: 'Gagnez des prix bonus ou invitez des amis pour remplir le pool d\'équipe.',
  viewTeamProgress: 'VOIR LA PROGRESSION ↗',
  teamPoolNeedMore: (remaining) => `Encore $${remaining} pour débloquer`,
  teamPoolHowToUnlock: 'Comment débloquer plus vite',
  teamPoolWayInvite: 'Inviter des amis',
  teamPoolWayTasks: 'Compléter les tâches du dashboard',
  teamPoolWayInfluencer: 'Devenir influenceur (-50%)',
  teamPoolClaim: 'RÉCLAMER SUR DASHBOARD ↗',

  invitedBy: 'Invité par',
  youInvited: 'Vous avez invité',
  friends: (n) => `${n} ami${n === 1 ? '' : 's'}`,
  inviteBtn: '🔗 Inviter un ami → +1 tour',
  inviteHint: 'Chaque ami qui rejoint via Telegram vous rapporte 1 tour.',
  inviteEarnTitle: 'Invitez et gagnez des tours',
  spinsBankedFromInvites: (n) => `🎟️ ${n} tours gagnés grâce aux invitations`,
  outOfSpinsInvite: 'Plus de tours ? Invitez des amis — +1 tour chacun !',
  shareWinBtn: '🎟️ Partager → +1 tour',
  firstWinTitle: '🎉 Cadeau de bienvenue !',
  inviteMilestoneTitle: 'Paliers de parrainage',
  inviteMilestoneNext: (remaining, reward) => `Invitez ${remaining} de plus pour gagner ${reward}`,
  inviteMilestoneAllDone: '🏆 Tous les paliers de parrainage atteints !',
  leaderboardTitle: 'Classement hebdo des parrainages',
  leaderboardPrizeNote: 'Le top 3 gagne 5 $ / 3 $ / 2 $ chaque semaine',
  leaderboardYou: (rank, count) => `Vous : n°${rank} · ${count} invités`,
  leaderboardUnranked: 'Invitez des amis pour grimper au classement !',
  firstWinMsg: (amount) => `Vous avez gagné $${amount} USDC — déjà dans votre solde retirable. Retirez ci-dessous !`,
  shareWinText: (prize) => `Je viens de gagner ${prize} sur Polnation 🎉 Tournez et gagnez des USDC :`,

  spinHistory: 'Historique des tours',

  explorePolnation: 'Explorer Polnation',
  exploreAll: 'TOUT ↗',
  exploreHint: 'Les prix bonus débloquent la progression de votre compte web. Distributions quotidiennes de USDC, rendements de staking et commissions de parrainage sur le site principal.',
  dashboard: 'Tableau de bord',
  earnings: 'Revenus',
  agenticTeam: 'Revenus équipe IA',

  spinning: 'EN COURS…',
  spinBtn: (n) => `TOURNER (${n} REST.)`,
  spinBtnUnlimited: 'TOURNER ∞',
  noSpinsLeft: 'PLUS DE TOURS',

  noSpinsTitle: 'Plus de tours disponibles',
  noSpinsMsg: 'Invitez un ami via Telegram pour gagner un tour supplémentaire.',
  congratsTitle: '🎉 Félicitations !',
  tryAgainTitle: 'Réessayez',
  betterLuck: 'Meilleure chance la prochaine fois !',
  usdcAdded: (label) => `${label}\n\n💰 Ajouté à votre solde retirable.`,
  bonusAdded: (label) => `${label}\n\n⭐ Ajouté à votre progression.`,
  electronicsAdded: (label) => `${label}\n\n🎁 Contactez l'admin sur Telegram pour réclamer votre prix.`,
  withdrawSuccessTitle: '✅ Retrait soumis',
  withdrawSuccessMsg: (amount) => `$${amount} USDC est en cours de traitement vers votre portefeuille.`,
  tgGroupRequired: 'Rejoignez le groupe Telegram Polnation pour retirer.',

  howItWorks: 'Comment ça marche',
  earnSpinsTitle: 'Comment gagner des tours',
  earnSpins1: 'Rejoignez le groupe Telegram officiel → +1 tour gratuit (unique)',
  earnSpins2: 'Invitez un ami avec votre lien → +1 tour par ami',
  earnSpins3: 'Tâches d\'airdrop quotidiennes — tous les 7 → +1 tour',
  usdcPrizesTitle: 'Prix USDC — retrait instantané',
  usdcPrizesDesc: 'Gagner $0.50 / $1 / $5 USDC crédite immédiatement votre solde retirable. Connectez un portefeuille et appuyez sur Retirer pour envoyer des USDC sur Polygon.',
  bonusPrizesTitle: 'Prix bonus — pool d\'équipe',
  bonusPrizesDesc1: 'Les gains +$1 / +$2 / +$3 bonus ne se retirent pas directement. Ils alimentent la progression du pool d\'équipe avec le volume de parrainage.',
  bonusPrizesDesc2: 'Une fois le seuil atteint, vous pouvez réclamer le pool sur le tableau de bord web — il verse un rendement quotidien jusqu\'à épuisement.',
  tryAgainSection: 'Sans gain',
  tryAgainDesc: 'Certains secteurs n\'ont pas de prix. Le tour est consommé sans récompense — bonne chance la prochaine fois.',
  viewTeamBtn: 'Voir la progression du pool ↗',

  shareText: 'Des tours gratuits pour de vraies récompenses en USDC. Pas de configuration compliquée.\n\nRejoins Polnation avec mon lien et commence à gagner. Invite et gagne.',

  webAccessTitle: 'ACCÈS WEB',
  webAccessDesc: "Connectez-vous sur polnation.com depuis n'importe quel navigateur avec email et mot de passe. Votre connexion Telegram continue de fonctionner.",
  webAccessBtn: "CONFIGURER L'ACCÈS WEB →",
  webLoginTitle: "Configurer l'accès web",
  webLoginIntro: "Associez un email et un mot de passe pour vous connecter sur polnation.com depuis n'importe quel navigateur. Votre connexion Telegram continue de fonctionner — c'est juste un moyen supplémentaire d'entrer.",
  webLoginEmailLabel: 'Email',
  webLoginPasswordLabel: 'Mot de passe (6+ caractères)',
  webLoginSaveBtn: 'Enregistrer',
  webLoginSavingBtn: 'Enregistrement…',
  webLoginDoneBtn: 'Terminé',
  webLoginSuccess: (email) => `Accès web prêt. Connectez-vous sur polnation.com avec ${email}.`,
  webLoginPasswordTooShort: 'Le mot de passe doit faire au moins 6 caractères',
  webLoginGenericError: "Impossible de configurer l'accès web",
  webLoginNetworkError: 'Erreur réseau — veuillez réessayer',

  walletTrustNotInTg: 'Trust Wallet n\'est pas pris en charge dans Telegram',
  walletTrustStep1: 'Ouvrez polnation.com dans Chrome',
  walletTrustStep2: 'Connectez-vous avec email ou Telegram',
  walletTrustStep3: 'Lier le portefeuille → choisir Trust',
  walletTrustAlt: 'Ou utilisez Bitget Wallet ou SafePal ici dans Telegram.',
  walletOpenInBrowser: 'Ouvrir dans le navigateur',
  walletInstall: 'Installer',
  walletBackBtn: 'Retour',
}

const ja: Translations = {
  startingUp: '起動中…',
  connecting: '接続中…',
  openInTelegram: 'Telegram内からこのページを開いてください。',
  noSession: 'Telegramセッションデータがありません。ボットから開いてください。',
  cantOpenLottery: '抽選を開けませんでした',
  tryAgainBtn: 'もう一度試す',
  prepStep1Title: 'Telegramを認証中',
  prepStep1Sub: 'セッションを保護中…',
  prepStep2Title: 'アカウントを作成中',
  prepStep2Sub: 'もう少しで完了…',
  prepStep3Title: 'スピンを準備中',
  prepStep3Sub: '賞品を読み込み中…',

  webLink: 'WEB ↗',
  language: '言語',

  greeting: (name) => `こんにちは ${name} 👋`,
  lotteryTitle: 'Polnation 抽選',
  spinToWin: 'スピンして当てよう',
  unlimitedSpins: '∞ 無制限',
  spinsAvailable: (n) => `残り ${n} 回`,

  welcomeTask: 'ウェルカムタスク',
  joinTelegramGroup: 'Telegramグループに参加する',
  earnFreeSpin: '無料スピン1回獲得 — 1回限り。',
  joinGroupBtn: '📢 グループに参加 → +1スピン',
  verifyingMembership: 'メンバーシップを確認中…',
  inviteUnavailable: '招待リンクが利用できません。後でお試しください。',

  withdrawable: '引き出し可能',
  joinToWithdraw: '📢 引き出しにはTelegramグループへの参加が必要です',
  connectWallet: '🔗 ウォレットを接続して引き出す',
  minWithdraw: '最低 $0.10 USDC',
  withdrawSubmitted: '✅ 引き出しリクエスト送信済み',
  withdraw: '引き出す',
  withdrawPending: '…',
  maxPlaceholder: (max) => `最大 $${max}`,

  teamPool: (level) => `チームプール · レベル ${level}`,
  teamPoolUnlocked: (level) => `レベル ${level} プール解放 — ウェブでクレームして日次利回りを開始。`,
  teamPoolProgress: (remaining, pool) => `あと $${remaining} で $${pool} プール解放。ボーナススピン・招待で蓄積。`,
  teamPoolEmpty: 'ボーナス賞品を獲得するか、友達を招待してチームプールを満たしましょう。',
  viewTeamProgress: 'チーム進捗を見る ↗',
  teamPoolNeedMore: (remaining) => `あと $${remaining} で解放`,
  teamPoolHowToUnlock: 'もっと早く解放するには',
  teamPoolWayInvite: '友達を招待する',
  teamPoolWayTasks: 'Dashboard でタスクを完了',
  teamPoolWayInfluencer: 'インフルエンサーになる（50%オフ）',
  teamPoolClaim: 'DASHBOARD でクレーム ↗',

  invitedBy: '招待者',
  youInvited: '招待した人数',
  friends: (n) => `${n} 人`,
  inviteBtn: '🔗 友達を招待 → +1スピン',
  inviteHint: 'Telegram経由で参加した友達1人につき1スピン獲得。',
  inviteEarnTitle: '招待してスピンを獲得',
  spinsBankedFromInvites: (n) => `🎟️ 招待で${n}スピン獲得`,
  outOfSpinsInvite: 'スピン切れ？友達を招待して1人につき+1スピン！',
  shareWinBtn: '🎟️ シェアして+1スピン',
  firstWinTitle: '🎉 ウェルカムギフト！',
  inviteMilestoneTitle: '招待マイルストーン',
  inviteMilestoneNext: (remaining, reward) => `あと${remaining}人招待で${reward}獲得`,
  inviteMilestoneAllDone: '🏆 すべての招待マイルストーン達成！',
  leaderboardTitle: '週間招待ランキング',
  leaderboardPrizeNote: '毎週トップ3が $5 / $3 / $2 を獲得',
  leaderboardYou: (rank, count) => `あなた：${rank}位 · ${count}人`,
  leaderboardUnranked: '友達を招待して今週のランキングへ！',
  firstWinMsg: (amount) => `$${amount} USDCが当たりました。出金可能残高に追加済みです。下から出金しよう！`,
  shareWinText: (prize) => `Polnationで${prize}が当たった🎉 回して無料USDCを当てよう：`,

  spinHistory: 'スピン履歴',

  explorePolnation: 'Polnationを探索',
  exploreAll: 'すべて ↗',
  exploreHint: 'ボーナス賞品はウェブアカウントの進捗を解放します。日次USDC配布、ステーキング収益、紹介報酬はメインサイトで確認できます。',
  dashboard: 'ダッシュボード',
  earnings: '収益',
  agenticTeam: 'AIチーム収益',

  spinning: 'スピン中…',
  spinBtn: (n) => `スピン (残り${n}回)`,
  spinBtnUnlimited: 'スピン ∞',
  noSpinsLeft: 'スピン残なし',

  noSpinsTitle: 'スピンがありません',
  noSpinsMsg: 'Telegram経由で参加した友達を招待してスピンを獲得してください。',
  congratsTitle: '🎉 おめでとうございます！',
  tryAgainTitle: 'もう一度',
  betterLuck: '次回はきっと当たります！',
  usdcAdded: (label) => `${label}\n\n💰 引き出し可能残高に追加されました。`,
  bonusAdded: (label) => `${label}\n\n⭐ 解放進捗に追加されました。`,
  electronicsAdded: (label) => `${label}\n\n🎁 Telegramで管理者に連絡して賞品を受け取ってください。`,
  withdrawSuccessTitle: '✅ 引き出しリクエスト送信済み',
  withdrawSuccessMsg: (amount) => `$${amount} USDCをウォレットに処理中です。`,
  tgGroupRequired: '出金するには Polnation Telegram グループに参加してください。',

  howItWorks: 'ルール説明',
  earnSpinsTitle: 'スピンの獲得方法',
  earnSpins1: '公式Telegramグループに参加 → 無料スピン+1回（1回限り）',
  earnSpins2: 'リンクで友達を招待 → 友達1人につき+1スピン',
  earnSpins3: 'ウェブの日次エアドロップタスク — 7回ごとに+1スピン',
  usdcPrizesTitle: 'USDC賞品 — 即時引き出し可能',
  usdcPrizesDesc: '$0.50 / $1 / $5 USDCの当選は即座に引き出し可能残高に追加。ウォレットを接続して引き出すをタップし、Polygon上のアドレスに送金。',
  bonusPrizesTitle: 'ボーナス賞品 — チームプール',
  bonusPrizesDesc1: '+$1 / +$2 / +$3ボーナス当選は直接引き出せません。チーム紹介量と合算してチームプール進捗に追加されます。',
  bonusPrizesDesc2: 'レベル閾値に達するとウェブダッシュボードでプールを請求可能。その後、残高がなくなるまで日次利回りを支払います。',
  tryAgainSection: '惜しい！',
  tryAgainDesc: '一部のスロットに賞品はありません。スピンは消費されますが報酬は付与されません。',
  viewTeamBtn: 'チームプール進捗を確認 ↗',

  shareText: '無料スピンでリアルなUSDC報酬を狙えます。複雑な設定は不要です。\n\n私のリンクからPolnationに参加して、報酬獲得を始めましょう。招待して稼ぐ。',

  webAccessTitle: 'ウェブアクセス',
  webAccessDesc: 'メールとパスワードを使って、どのブラウザからでも polnation.com にサインインできます。Telegram ログインも引き続き有効です。',
  webAccessBtn: 'ウェブログインを設定 →',
  webLoginTitle: 'ウェブログインを設定',
  webLoginIntro: 'メールとパスワードを設定すると、どのブラウザからでも polnation.com にサインインできます。Telegram ログインも引き続き有効です——これは追加のサインイン方法です。',
  webLoginEmailLabel: 'メール',
  webLoginPasswordLabel: 'パスワード（6文字以上）',
  webLoginSaveBtn: '保存',
  webLoginSavingBtn: '保存中…',
  webLoginDoneBtn: '完了',
  webLoginSuccess: (email) => `ウェブログインの準備が完了しました。${email} で polnation.com にサインインしてください。`,
  webLoginPasswordTooShort: 'パスワードは6文字以上必要です',
  webLoginGenericError: 'ウェブログインの設定に失敗しました',
  webLoginNetworkError: 'ネットワークエラー——もう一度お試しください',

  walletTrustNotInTg: 'Trust Wallet は Telegram 内では利用できません',
  walletTrustStep1: 'Chrome で polnation.com を開く',
  walletTrustStep2: 'メールまたは Telegram でログイン',
  walletTrustStep3: 'ウォレットを連携 → Trust を選択',
  walletTrustAlt: 'または Telegram 内では Bitget Wallet や SafePal をご利用ください。',
  walletOpenInBrowser: 'ブラウザで開く',
  walletInstall: 'インストール',
  walletBackBtn: '戻る',
}

const ko: Translations = {
  startingUp: '시작 중…',
  connecting: '연결 중…',
  openInTelegram: 'Telegram 앱에서 이 페이지를 열어주세요.',
  noSession: 'Telegram 세션 데이터 없음 — 봇을 통해 열어주세요.',
  cantOpenLottery: '복권을 열 수 없습니다',
  tryAgainBtn: '다시 시도',
  prepStep1Title: 'Telegram 인증 중',
  prepStep1Sub: '세션 보호 중…',
  prepStep2Title: '계정 생성 중',
  prepStep2Sub: '거의 다 됐어요…',
  prepStep3Title: '스핀 준비 중',
  prepStep3Sub: '상품 불러오는 중…',

  webLink: '웹 ↗',
  language: '언어',

  greeting: (name) => `안녕하세요 ${name} 👋`,
  lotteryTitle: 'Polnation 복권',
  spinToWin: '돌려서 당첨',
  unlimitedSpins: '∞ 무제한 스핀',
  spinsAvailable: (n) => `스핀 ${n}회 가능`,

  welcomeTask: '환영 과제',
  joinTelegramGroup: 'Telegram 그룹에 참가하세요',
  earnFreeSpin: '무료 스핀 1회 획득 — 1회 한정.',
  joinGroupBtn: '📢 그룹 참가 → +1 스핀',
  verifyingMembership: '멤버십 확인 중…',
  inviteUnavailable: '초대 링크 사용 불가. 나중에 다시 시도해주세요.',

  withdrawable: '출금 가능',
  joinToWithdraw: '📢 출금하려면 Telegram 그룹에 참가하세요',
  connectWallet: '🔗 지갑을 연결하여 출금',
  minWithdraw: '최소 $0.10 USDC',
  withdrawSubmitted: '✅ 출금 신청 완료',
  withdraw: '출금',
  withdrawPending: '…',
  maxPlaceholder: (max) => `최대 $${max}`,

  teamPool: (level) => `팀 풀 · 레벨 ${level}`,
  teamPoolUnlocked: (level) => `레벨 ${level} 풀 해제 — 웹에서 청구하여 일일 수익을 시작하세요.`,
  teamPoolProgress: (remaining, pool) => `$${pool} 풀 해제까지 $${remaining} 더 필요. 보너스 스핀·초대로 채울 수 있습니다.`,
  teamPoolEmpty: '보너스 상품을 획득하거나 친구를 초대해 팀 풀을 채우세요.',
  viewTeamProgress: '팀 진행 상황 보기 ↗',
  teamPoolNeedMore: (remaining) => `해제까지 $${remaining} 더 필요`,
  teamPoolHowToUnlock: '더 빠르게 해제하는 방법',
  teamPoolWayInvite: '친구 초대',
  teamPoolWayTasks: '대시보드에서 작업 완료',
  teamPoolWayInfluencer: '인플루언서 되기 (50% 할인)',
  teamPoolClaim: '대시보드에서 청구하기 ↗',

  invitedBy: '초대한 사람',
  youInvited: '초대한 친구',
  friends: (n) => `${n}명`,
  inviteBtn: '🔗 친구 초대 → +1 스핀',
  inviteHint: 'Telegram으로 참가한 친구 1명당 스핀 1회 획득.',
  inviteEarnTitle: '초대하고 스핀 받기',
  spinsBankedFromInvites: (n) => `🎟️ 초대로 ${n}회 스핀 획득`,
  outOfSpinsInvite: '스핀이 없나요? 친구를 초대하면 1명당 +1 스핀!',
  shareWinBtn: '🎟️ 공유하고 +1 스핀',
  firstWinTitle: '🎉 웰컴 선물!',
  inviteMilestoneTitle: '초대 마일스톤',
  inviteMilestoneNext: (remaining, reward) => `${remaining}명 더 초대하면 ${reward} 획득`,
  inviteMilestoneAllDone: '🏆 모든 초대 마일스톤 달성!',
  leaderboardTitle: '주간 초대 랭킹',
  leaderboardPrizeNote: '매주 상위 3명 $5 / $3 / $2 획득',
  leaderboardYou: (rank, count) => `나: ${rank}위 · ${count}명`,
  leaderboardUnranked: '친구를 초대해 이번 주 랭킹에 올라보세요!',
  firstWinMsg: (amount) => `$${amount} USDC 당첨! 이미 출금 가능 잔액에 들어왔어요. 아래에서 출금하세요!`,
  shareWinText: (prize) => `Polnation에서 ${prize} 당첨 🎉 돌리고 무료 USDC 받으세요:`,

  spinHistory: '스핀 기록',

  explorePolnation: 'Polnation 탐색',
  exploreAll: '전체 ↗',
  exploreHint: '보너스 상품은 웹 계정의 진행 상황을 해제합니다. 일일 USDC 배포, 스테이킹 수익 및 추천 수수료는 메인 사이트에 있습니다.',
  dashboard: '대시보드',
  earnings: '수익',
  agenticTeam: 'AI 팀 수익',

  spinning: '돌리는 중…',
  spinBtn: (n) => `스핀 (${n}회 남음)`,
  spinBtnUnlimited: '스핀 ∞',
  noSpinsLeft: '스핀 없음',

  noSpinsTitle: '스핀이 없습니다',
  noSpinsMsg: 'Telegram으로 참가한 친구를 초대해 스핀을 더 받으세요.',
  congratsTitle: '🎉 축하합니다!',
  tryAgainTitle: '다시 시도',
  betterLuck: '다음엔 행운을!',
  usdcAdded: (label) => `${label}\n\n💰 출금 가능 잔액에 추가되었습니다.`,
  bonusAdded: (label) => `${label}\n\n⭐ 해제 진행에 추가되었습니다.`,
  electronicsAdded: (label) => `${label}\n\n🎁 상품을 받으려면 Telegram에서 관리자에게 문의하세요.`,
  withdrawSuccessTitle: '✅ 출금 신청 완료',
  withdrawSuccessMsg: (amount) => `$${amount} USDC가 지갑으로 처리되고 있습니다.`,
  tgGroupRequired: '출금하려면 Polnation Telegram 그룹에 참가해주세요.',

  howItWorks: '이용 방법',
  earnSpinsTitle: '스핀 획득 방법',
  earnSpins1: '공식 Telegram 그룹 참가 → 무료 스핀 +1회 (1회 한정)',
  earnSpins2: '링크로 친구 초대 → 친구 1명당 +1 스핀',
  earnSpins3: '웹 일일 에어드롭 과제 — 7회마다 +1 스핀',
  usdcPrizesTitle: 'USDC 상품 — 즉시 출금 가능',
  usdcPrizesDesc: '$0.50 / $1 / $5 USDC 당첨 시 즉시 출금 가능 잔액에 추가됩니다. 지갑을 연결하고 출금을 눌러 Polygon 주소로 전송하세요.',
  bonusPrizesTitle: '보너스 상품 — 팀 풀',
  bonusPrizesDesc1: '+$1 / +$2 / +$3 보너스 당첨은 직접 출금되지 않습니다. 추천 팀 볼륨과 함께 팀 풀 진행에 추가됩니다.',
  bonusPrizesDesc2: '레벨 임계값에 도달하면 웹 대시보드에서 풀을 청구할 수 있으며, 소진될 때까지 일일 수익을 지급합니다.',
  tryAgainSection: '아쉽네요',
  tryAgainDesc: '일부 섹터에는 상품이 없습니다. 스핀은 소비되지만 보상은 지급되지 않습니다.',
  viewTeamBtn: '팀 풀 진행 상황 보기 ↗',

  shareText: '무료 스핀으로 실제 USDC 보상을 노려보세요. 복잡한 설정은 없습니다.\n\n제 링크로 Polnation에 참여하고 보상을 시작하세요. 초대하고 적립하세요.',

  webAccessTitle: '웹 액세스',
  webAccessDesc: '이메일 + 비밀번호로 어떤 브라우저에서든 polnation.com에 로그인하세요. 텔레그램 로그인도 계속 작동합니다.',
  webAccessBtn: '웹 로그인 설정 →',
  webLoginTitle: '웹 로그인 설정',
  webLoginIntro: '이메일과 비밀번호를 연결하면 어떤 브라우저에서든 polnation.com에 로그인할 수 있습니다. 텔레그램 로그인도 계속 작동합니다 — 이는 추가 로그인 방법입니다.',
  webLoginEmailLabel: '이메일',
  webLoginPasswordLabel: '비밀번호 (6자 이상)',
  webLoginSaveBtn: '저장',
  webLoginSavingBtn: '저장 중…',
  webLoginDoneBtn: '완료',
  webLoginSuccess: (email) => `웹 로그인이 준비되었습니다. ${email}로 polnation.com에 로그인하세요.`,
  webLoginPasswordTooShort: '비밀번호는 6자 이상이어야 합니다',
  webLoginGenericError: '웹 로그인 설정 실패',
  webLoginNetworkError: '네트워크 오류 — 다시 시도하세요',

  walletTrustNotInTg: 'Trust 지갑은 Telegram 내에서 지원되지 않습니다',
  walletTrustStep1: 'Chrome에서 polnation.com 열기',
  walletTrustStep2: '이메일 또는 Telegram으로 로그인',
  walletTrustStep3: '지갑 연결 → Trust 선택',
  walletTrustAlt: '또는 Telegram에서 Bitget Wallet 또는 SafePal을 사용하세요.',
  walletOpenInBrowser: '브라우저에서 열기',
  walletInstall: '설치',
  walletBackBtn: '뒤로',
}

const tr: Translations = {
  startingUp: 'Başlatılıyor…',
  connecting: 'Bağlanıyor…',
  openInTelegram: 'Bu sayfayı Telegram içinden açın.',
  noSession: 'Telegram oturumu bulunamadı — botu kullanarak açın.',
  cantOpenLottery: 'Çekiliş açılamadı',
  tryAgainBtn: 'Tekrar Dene',
  prepStep1Title: 'Telegram doğrulanıyor',
  prepStep1Sub: 'Oturumunuz güvenli hale getiriliyor…',
  prepStep2Title: 'Hesabınız oluşturuluyor',
  prepStep2Sub: 'Neredeyse tamamlandı…',
  prepStep3Title: 'Çekilişleriniz hazırlanıyor',
  prepStep3Sub: 'Ödüller yükleniyor…',

  webLink: 'WEB ↗',
  language: 'Dil',

  greeting: (name) => `Merhaba ${name} 👋`,
  lotteryTitle: 'Polnation Çekilişi',
  spinToWin: 'Çevir ve Kazan',
  unlimitedSpins: '∞ Sınırsız',
  spinsAvailable: (n) => `${n} hak mevcut`,

  welcomeTask: 'Hoş Geldin Görevi',
  joinTelegramGroup: 'Telegram grubuna katıl',
  earnFreeSpin: '1 ücretsiz hak kazan — tek seferlik.',
  joinGroupBtn: '📢 Gruba Katıl → +1 Hak',
  verifyingMembership: 'Üyelik doğrulanıyor…',
  inviteUnavailable: 'Davet linki mevcut değil. Daha sonra tekrar deneyin.',

  withdrawable: 'Çekilebilir',
  joinToWithdraw: '📢 Çekim için Telegram grubuna katılın',
  connectWallet: '🔗 Çekim için cüzdan bağla',
  minWithdraw: 'Minimum $0.10 USDC',
  withdrawSubmitted: '✅ Çekim talebi gönderildi',
  withdraw: 'Çek',
  withdrawPending: '…',
  maxPlaceholder: (max) => `Maks. $${max}`,

  teamPool: (level) => `Takım Havuzu · Seviye ${level}`,
  teamPoolUnlocked: (level) => `Seviye ${level} havuzu açıldı — günlük getiri için web'den talep edin.`,
  teamPoolProgress: (remaining, pool) => `$${pool} havuzunu açmak için $${remaining} daha gerekli. Bonus haklar ve davetler dolduruyor.`,
  teamPoolEmpty: 'Bonus ödüller kazanın veya takım havuzunu doldurmak için arkadaş davet edin.',
  viewTeamProgress: 'TAKIM İLERLEMESİ ↗',
  teamPoolNeedMore: (remaining) => `Açılmaya $${remaining} kaldı`,
  teamPoolHowToUnlock: 'Daha hızlı nasıl açılır',
  teamPoolWayInvite: 'Arkadaş davet et',
  teamPoolWayTasks: 'Dashboardda görevleri tamamla',
  teamPoolWayInfluencer: 'Influencer ol (%50 indirim)',
  teamPoolClaim: 'DASHBOARDDAN TALEP ET ↗',

  invitedBy: 'Davet Eden',
  youInvited: 'Davet Ettiğin',
  friends: (n) => `${n} arkadaş`,
  inviteBtn: '🔗 Arkadaş Davet Et → +1 Hak',
  inviteHint: 'Telegram üzerinden katılan her arkadaş 1 hak kazandırır.',
  inviteEarnTitle: 'Davet Et, Hak Kazan',
  spinsBankedFromInvites: (n) => `🎟️ Davetlerden ${n} hak kazanıldı`,
  outOfSpinsInvite: 'Hakkın mı bitti? Arkadaş davet et — her biri için +1 hak!',
  shareWinBtn: '🎟️ Paylaş → +1 Hak',
  firstWinTitle: '🎉 Hoş geldin hediyesi!',
  inviteMilestoneTitle: 'Davet Kilometre Taşları',
  inviteMilestoneNext: (remaining, reward) => `${reward} kazanmak için ${remaining} kişi daha davet et`,
  inviteMilestoneAllDone: '🏆 Tüm davet hedefleri tamamlandı!',
  leaderboardTitle: 'Haftalık Davet Sıralaması',
  leaderboardPrizeNote: 'İlk 3 her hafta $5 / $3 / $2 kazanır',
  leaderboardYou: (rank, count) => `Sen: #${rank} · ${count} davet`,
  leaderboardUnranked: 'Bu haftanın sıralamasına girmek için arkadaş davet et!',
  firstWinMsg: (amount) => `$${amount} USDC kazandın — çekilebilir bakiyene eklendi. Aşağıdan çek!`,
  shareWinText: (prize) => `Polnation'da ${prize} kazandım 🎉 Çevir, ücretsiz USDC kazan:`,

  spinHistory: 'Çevirme Geçmişi',

  explorePolnation: 'Polnation\'ı Keşfet',
  exploreAll: 'TÜMÜ ↗',
  exploreHint: 'Bonus ödüller web hesabınızdaki ilerlemenizi açar. Günlük USDC dağıtımları, staking getirileri ve referans komisyonları ana sitede.',
  dashboard: 'Pano',
  earnings: 'Kazançlar',
  agenticTeam: 'AI Takım Kazançları',

  spinning: 'ÇEVİRİLİYOR…',
  spinBtn: (n) => `ÇEVİR (${n} KALDI)`,
  spinBtnUnlimited: 'ÇEVİR ∞',
  noSpinsLeft: 'HAK KALMADI',

  noSpinsTitle: 'Hak kalmadı',
  noSpinsMsg: 'Bir hak daha kazanmak için Telegram üzerinden katılan bir arkadaş davet edin.',
  congratsTitle: '🎉 Tebrikler!',
  tryAgainTitle: 'Tekrar Dene',
  betterLuck: 'Bir dahaki sefere daha şanslı olursun!',
  usdcAdded: (label) => `${label}\n\n💰 Çekilebilir bakiyene eklendi.`,
  bonusAdded: (label) => `${label}\n\n⭐ Kilidi açma ilerlemenize eklendi.`,
  electronicsAdded: (label) => `${label}\n\n🎁 Ödülünü almak için Telegram'da yöneticiyle iletişime geç.`,
  withdrawSuccessTitle: '✅ Çekim talebi gönderildi',
  withdrawSuccessMsg: (amount) => `$${amount} USDC cüzdanına işleniyor.`,
  tgGroupRequired: 'Çekim yapmak için Polnation Telegram grubuna katıl.',

  howItWorks: 'Nasıl Çalışır',
  earnSpinsTitle: 'Hak kazanma yolları',
  earnSpins1: 'Resmi Telegram grubuna katıl → ücretsiz +1 hak (tek seferlik)',
  earnSpins2: 'Linkinle arkadaş davet et → her arkadaş için +1 hak',
  earnSpins3: 'Web\'deki günlük görevler — her 7 tamamlamada → +1 hak',
  usdcPrizesTitle: 'USDC ödülleri — anlık çekilebilir',
  usdcPrizesDesc: '$0.50 / $1 / $5 USDC kazanmak bakiyenize anında yansır. Cüzdan bağlayın ve Polygon adresinize USDC göndermek için Çek\'e basın.',
  bonusPrizesTitle: 'Bonus ödüller — takım havuzu',
  bonusPrizesDesc1: '+$1 / +$2 / +$3 bonus kazanımlar doğrudan çekilemez. Referans takım hacmiyle birlikte takım havuzu ilerlemenizi besler.',
  bonusPrizesDesc2: 'Etkin ilerleme seviye eşiğine ulaştığında web panosundan havuzu talep edebilirsiniz — tükenene kadar günlük getiri öder.',
  tryAgainSection: 'Ödülsüz',
  tryAgainDesc: 'Bazı dilimlerde ödül yoktur. Hak tüketilir ancak ödül verilmez — bir sonraki sefere!',
  viewTeamBtn: 'Takım Havuzu İlerlemesini Gör ↗',

  shareText: 'Gerçek USDC ödülleri için ücretsiz haklar. Karmaşık kurulum yok.\n\nBağlantımla Polnation\'a katıl ve kazanmaya başla. Davet et ve kazan.',

  webAccessTitle: 'WEB ERİŞİMİ',
  webAccessDesc: "E-posta + şifre ile herhangi bir tarayıcıdan polnation.com'a giriş yapın. Telegram girişiniz çalışmaya devam eder.",
  webAccessBtn: 'WEB GİRİŞİ KUR →',
  webLoginTitle: 'Web girişi kur',
  webLoginIntro: "E-posta ve şifre bağlayın, böylece herhangi bir tarayıcıdan polnation.com'a giriş yapabilirsiniz. Telegram girişiniz çalışmaya devam eder — bu sadece ek bir giriş yolu.",
  webLoginEmailLabel: 'E-posta',
  webLoginPasswordLabel: 'Şifre (6+ karakter)',
  webLoginSaveBtn: 'Kaydet',
  webLoginSavingBtn: 'Kaydediliyor…',
  webLoginDoneBtn: 'Tamam',
  webLoginSuccess: (email) => `Web girişi hazır. ${email} ile polnation.com'a giriş yapın.`,
  webLoginPasswordTooShort: 'Şifre en az 6 karakter olmalıdır',
  webLoginGenericError: 'Web girişi kurulamadı',
  webLoginNetworkError: 'Ağ hatası — lütfen tekrar deneyin',

  walletTrustNotInTg: 'Trust Wallet Telegram\'da desteklenmiyor',
  walletTrustStep1: 'Chrome\'da polnation.com\'u açın',
  walletTrustStep2: 'E-posta veya Telegram ile giriş yapın',
  walletTrustStep3: 'Cüzdanı bağla → Trust\'ı seçin',
  walletTrustAlt: 'Veya Telegram\'da Bitget Wallet ya da SafePal kullanın.',
  walletOpenInBrowser: 'Tarayıcıda aç',
  walletInstall: 'Yükle',
  walletBackBtn: 'Geri',
}

const id: Translations = {
  startingUp: 'Memulai…',
  connecting: 'Menghubungkan…',
  openInTelegram: 'Buka halaman ini dari dalam Telegram.',
  noSession: 'Tidak ada data sesi Telegram — buka melalui bot.',
  cantOpenLottery: 'Tidak dapat membuka lotere',
  tryAgainBtn: 'Coba Lagi',
  prepStep1Title: 'Memverifikasi Telegram',
  prepStep1Sub: 'Mengamankan sesi Anda…',
  prepStep2Title: 'Membuat akun Anda',
  prepStep2Sub: 'Hampir selesai…',
  prepStep3Title: 'Menyiapkan putaran Anda',
  prepStep3Sub: 'Memuat hadiah…',

  webLink: 'WEB ↗',
  language: 'Bahasa',

  greeting: (name) => `Hai ${name} 👋`,
  lotteryTitle: 'Lotere Polnation',
  spinToWin: 'Putar untuk Menang',
  unlimitedSpins: '∞ Putaran tak terbatas',
  spinsAvailable: (n) => `${n} putaran tersedia`,

  welcomeTask: 'Tugas Selamat Datang',
  joinTelegramGroup: 'Bergabunglah dengan grup Telegram kami',
  earnFreeSpin: 'Dapatkan 1 putaran gratis — bisa diklaim sekali.',
  joinGroupBtn: '📢 Bergabung → +1 Putaran',
  verifyingMembership: 'Memverifikasi keanggotaan…',
  inviteUnavailable: 'Undangan grup tidak tersedia. Coba lagi nanti.',

  withdrawable: 'Dapat Ditarik',
  joinToWithdraw: '📢 Gabung Grup Telegram untuk Menarik',
  connectWallet: '🔗 Hubungkan Dompet untuk Menarik',
  minWithdraw: 'Minimum $0.10 USDC',
  withdrawSubmitted: '✅ Penarikan diajukan',
  withdraw: 'Tarik',
  withdrawPending: '…',
  maxPlaceholder: (max) => `Maks $${max}`,

  teamPool: (level) => `Pool Tim · Level ${level}`,
  teamPoolUnlocked: (level) => `Pool level ${level} terbuka — klaim di web untuk memulai hasil harian.`,
  teamPoolProgress: (remaining, pool) => `$${remaining} lagi untuk membuka pool hadiah $${pool}. Putaran bonus + undangan mengisinya.`,
  teamPoolEmpty: 'Menangkan hadiah Bonus atau undang teman untuk mengisi pool tim.',
  viewTeamProgress: 'LIHAT KEMAJUAN TIM ↗',
  teamPoolNeedMore: (remaining) => `Perlu $${remaining} lagi untuk membuka`,
  teamPoolHowToUnlock: 'Cara membuka lebih cepat',
  teamPoolWayInvite: 'Undang teman',
  teamPoolWayTasks: 'Selesaikan tugas di dashboard',
  teamPoolWayInfluencer: 'Jadilah influencer (diskon 50%)',
  teamPoolClaim: 'KLAIM DI DASHBOARD ↗',

  invitedBy: 'Diundang Oleh',
  youInvited: 'Anda Mengundang',
  friends: (n) => `${n} teman`,
  inviteBtn: '🔗 Undang Teman → +1 Putaran',
  inviteHint: 'Setiap teman yang bergabung via Telegram memberi Anda 1 putaran.',
  inviteEarnTitle: 'Undang & Dapatkan Putaran',
  spinsBankedFromInvites: (n) => `🎟️ ${n} putaran dari undangan`,
  outOfSpinsInvite: 'Kehabisan putaran? Undang teman — +1 putaran tiap orang!',
  shareWinBtn: '🎟️ Bagikan → +1 Putaran',
  firstWinTitle: '🎉 Hadiah Selamat Datang!',
  inviteMilestoneTitle: 'Tonggak Undangan',
  inviteMilestoneNext: (remaining, reward) => `Undang ${remaining} lagi untuk dapat ${reward}`,
  inviteMilestoneAllDone: '🏆 Semua tonggak undangan tercapai!',
  leaderboardTitle: 'Papan Peringkat Undangan Mingguan',
  leaderboardPrizeNote: 'Top 3 menang $5 / $3 / $2 tiap minggu',
  leaderboardYou: (rank, count) => `Kamu: #${rank} · ${count} undangan`,
  leaderboardUnranked: 'Undang teman untuk naik ke papan peringkat minggu ini!',
  firstWinMsg: (amount) => `Kamu menang $${amount} USDC — sudah masuk saldo yang bisa ditarik. Tarik di bawah!`,
  shareWinText: (prize) => `Saya baru menang ${prize} di Polnation 🎉 Putar dan menang USDC gratis:`,

  spinHistory: 'Riwayat Putaran',

  explorePolnation: 'Jelajahi Polnation',
  exploreAll: 'SEMUA ↗',
  exploreHint: 'Hadiah bonus membuka kemajuan di akun web Anda. Distribusi USDC harian, hasil staking, dan komisi referral ada di situs utama.',
  dashboard: 'Dasbor',
  earnings: 'Penghasilan',
  agenticTeam: 'Penghasilan Tim Agentik',

  spinning: 'MEMUTAR…',
  spinBtn: (n) => `PUTAR (${n} TERSISA)`,
  spinBtnUnlimited: 'PUTAR ∞',
  noSpinsLeft: 'TIDAK ADA PUTARAN',

  noSpinsTitle: 'Putaran habis',
  noSpinsMsg: 'Undang teman yang bergabung via Telegram untuk mendapatkan putaran lagi.',
  congratsTitle: '🎉 Selamat!',
  tryAgainTitle: 'Coba lagi',
  betterLuck: 'Semoga lebih beruntung lain kali!',
  usdcAdded: (label) => `${label}\n\n💰 Ditambahkan ke saldo yang dapat ditarik.`,
  bonusAdded: (label) => `${label}\n\n⭐ Ditambahkan ke kemajuan buka kunci Anda.`,
  electronicsAdded: (label) => `${label}\n\n🎁 Hubungi admin di Telegram untuk mengklaim hadiahmu.`,
  withdrawSuccessTitle: '✅ Penarikan diajukan',
  withdrawSuccessMsg: (amount) => `$${amount} USDC sedang diproses ke dompet Anda.`,
  tgGroupRequired: 'Bergabunglah dengan grup Telegram Polnation untuk menarik.',

  howItWorks: 'Cara Kerja',
  earnSpinsTitle: 'Cara mendapatkan putaran',
  earnSpins1: 'Bergabung dengan grup Telegram resmi → +1 putaran gratis (sekali)',
  earnSpins2: 'Undang teman yang bergabung via link Anda → +1 putaran per teman',
  earnSpins3: 'Tugas airdrop harian di web — setiap 7 klaim → +1 putaran',
  usdcPrizesTitle: 'Hadiah USDC — langsung dapat ditarik',
  usdcPrizesDesc: 'Memenangkan $0.50 / $1 / $5 USDC langsung dikreditkan ke saldo Anda. Hubungkan dompet dan ketuk Tarik untuk mengirim USDC ke alamat Polygon Anda.',
  bonusPrizesTitle: 'Hadiah bonus — Pool hadiah tim',
  bonusPrizesDesc1: '+$1 / +$2 / +$3 kemenangan Bonus tidak dapat ditarik langsung. Mereka mengisi kemajuan pool hadiah tim Anda, bersama volume referral tim.',
  bonusPrizesDesc2: 'Setelah kemajuan efektif mencapai ambang level, Anda dapat mengklaim pool level tersebut di dashboard web — kemudian membayar hasil harian hingga habis.',
  tryAgainSection: 'Coba Lagi',
  tryAgainDesc: 'Beberapa irisan tidak memiliki hadiah. Putaran dikonsumsi tetapi tidak ada hadiah dikreditkan — semoga lebih beruntung lain kali.',
  viewTeamBtn: 'Lihat Kemajuan Pool Tim ↗',

  shareText: 'Putaran gratis untuk hadiah USDC nyata. Tanpa pengaturan rumit.\n\nGabung Polnation melalui link saya dan mulai menghasilkan. Undang dan Hasilkan.',

  webAccessTitle: 'AKSES WEB',
  webAccessDesc: 'Masuk ke polnation.com dari browser mana pun menggunakan email + kata sandi. Login Telegram Anda tetap berfungsi.',
  webAccessBtn: 'ATUR LOGIN WEB →',
  webLoginTitle: 'Atur login web',
  webLoginIntro: 'Ikat email dan kata sandi agar Anda dapat masuk ke polnation.com dari browser mana pun. Login Telegram Anda terus berfungsi — ini hanya cara masuk tambahan.',
  webLoginEmailLabel: 'Email',
  webLoginPasswordLabel: 'Kata Sandi (6+ karakter)',
  webLoginSaveBtn: 'Simpan',
  webLoginSavingBtn: 'Menyimpan…',
  webLoginDoneBtn: 'Selesai',
  webLoginSuccess: (email) => `Login web siap. Masuk ke polnation.com dengan ${email}.`,
  webLoginPasswordTooShort: 'Kata sandi minimal 6 karakter',
  webLoginGenericError: 'Gagal menyiapkan login web',
  webLoginNetworkError: 'Kesalahan jaringan — coba lagi',

  walletTrustNotInTg: 'Trust Wallet tidak didukung di Telegram',
  walletTrustStep1: 'Buka polnation.com di Chrome',
  walletTrustStep2: 'Masuk dengan email atau Telegram',
  walletTrustStep3: 'Hubungkan wallet → pilih Trust',
  walletTrustAlt: 'Atau gunakan Bitget Wallet atau SafePal di sini di Telegram.',
  walletOpenInBrowser: 'Buka di browser',
  walletInstall: 'Pasang',
  walletBackBtn: 'Kembali',
}

const vi: Translations = {
  startingUp: 'Đang khởi động…',
  connecting: 'Đang kết nối…',
  openInTelegram: 'Mở trang này từ bên trong Telegram.',
  noSession: 'Không có dữ liệu phiên Telegram — mở qua bot.',
  cantOpenLottery: 'Không thể mở xổ số',
  tryAgainBtn: 'Thử Lại',
  prepStep1Title: 'Xác minh Telegram',
  prepStep1Sub: 'Bảo mật phiên của bạn…',
  prepStep2Title: 'Tạo tài khoản của bạn',
  prepStep2Sub: 'Gần xong rồi…',
  prepStep3Title: 'Chuẩn bị lượt quay',
  prepStep3Sub: 'Đang tải phần thưởng…',

  webLink: 'WEB ↗',
  language: 'Ngôn ngữ',

  greeting: (name) => `Xin chào ${name} 👋`,
  lotteryTitle: 'Xổ số Polnation',
  spinToWin: 'Quay để Thắng',
  unlimitedSpins: '∞ Lượt quay không giới hạn',
  spinsAvailable: (n) => `${n} lượt quay khả dụng`,

  welcomeTask: 'Nhiệm vụ Chào mừng',
  joinTelegramGroup: 'Tham gia nhóm Telegram của chúng tôi',
  earnFreeSpin: 'Nhận 1 lượt quay miễn phí — có thể nhận một lần.',
  joinGroupBtn: '📢 Tham gia Nhóm → +1 Lượt',
  verifyingMembership: 'Đang xác minh tư cách thành viên…',
  inviteUnavailable: 'Link mời nhóm không khả dụng. Thử lại sau.',

  withdrawable: 'Có thể Rút',
  joinToWithdraw: '📢 Tham gia Nhóm Telegram để Rút',
  connectWallet: '🔗 Kết nối Ví để Rút',
  minWithdraw: 'Tối thiểu $0.10 USDC',
  withdrawSubmitted: '✅ Đã gửi yêu cầu rút',
  withdraw: 'Rút',
  withdrawPending: '…',
  maxPlaceholder: (max) => `Tối đa $${max}`,

  teamPool: (level) => `Pool Nhóm · Cấp ${level}`,
  teamPoolUnlocked: (level) => `Pool cấp ${level} đã mở — nhận trên web để bắt đầu lợi nhuận hàng ngày.`,
  teamPoolProgress: (remaining, pool) => `Còn $${remaining} nữa để mở pool thưởng $${pool}. Lượt quay bonus + lời mời sẽ lấp đầy.`,
  teamPoolEmpty: 'Thắng giải Bonus hoặc mời bạn bè để lấp đầy pool nhóm.',
  viewTeamProgress: 'XEM TIẾN ĐỘ NHÓM ↗',
  teamPoolNeedMore: (remaining) => `Cần thêm $${remaining} để mở khóa`,
  teamPoolHowToUnlock: 'Cách mở khóa nhanh hơn',
  teamPoolWayInvite: 'Mời bạn bè',
  teamPoolWayTasks: 'Hoàn thành nhiệm vụ trên dashboard',
  teamPoolWayInfluencer: 'Trở thành influencer (giảm 50%)',
  teamPoolClaim: 'NHẬN TRÊN DASHBOARD ↗',

  invitedBy: 'Được Mời Bởi',
  youInvited: 'Bạn Đã Mời',
  friends: (n) => `${n} bạn bè`,
  inviteBtn: '🔗 Mời Bạn Bè → +1 Lượt',
  inviteHint: 'Mỗi bạn bè tham gia qua Telegram cho bạn 1 lượt quay.',
  inviteEarnTitle: 'Mời bạn, nhận lượt quay',
  spinsBankedFromInvites: (n) => `🎟️ Đã nhận ${n} lượt quay từ lời mời`,
  outOfSpinsInvite: 'Hết lượt quay? Mời bạn bè — mỗi người +1 lượt!',
  shareWinBtn: '🎟️ Chia sẻ → +1 lượt',
  firstWinTitle: '🎉 Quà chào mừng!',
  inviteMilestoneTitle: 'Cột mốc mời bạn',
  inviteMilestoneNext: (remaining, reward) => `Mời thêm ${remaining} người để nhận ${reward}`,
  inviteMilestoneAllDone: '🏆 Đã đạt tất cả cột mốc mời bạn!',
  leaderboardTitle: 'Bảng xếp hạng mời tuần',
  leaderboardPrizeNote: 'Top 3 mỗi tuần nhận $5 / $3 / $2',
  leaderboardYou: (rank, count) => `Bạn: #${rank} · ${count} lượt mời`,
  leaderboardUnranked: 'Mời bạn bè để leo lên bảng xếp hạng tuần này!',
  firstWinMsg: (amount) => `Bạn đã thắng $${amount} USDC — đã vào số dư rút được. Rút ngay bên dưới!`,
  shareWinText: (prize) => `Tôi vừa trúng ${prize} trên Polnation 🎉 Quay để thắng USDC miễn phí:`,

  spinHistory: 'Lịch sử Quay',

  explorePolnation: 'Khám phá Polnation',
  exploreAll: 'TẤT CẢ ↗',
  exploreHint: 'Giải thưởng bonus mở khóa tiến độ trong tài khoản web của bạn. Phân phối USDC hàng ngày, lợi nhuận staking và hoa hồng giới thiệu trên trang chính.',
  dashboard: 'Bảng điều khiển',
  earnings: 'Thu nhập',
  agenticTeam: 'Thu nhập Nhóm AI',

  spinning: 'ĐANG QUAY…',
  spinBtn: (n) => `QUAY (CÒN ${n})`,
  spinBtnUnlimited: 'QUAY ∞',
  noSpinsLeft: 'HẾT LƯỢT QUAY',

  noSpinsTitle: 'Hết lượt quay',
  noSpinsMsg: 'Mời bạn bè tham gia qua Telegram để nhận thêm lượt quay.',
  congratsTitle: '🎉 Chúc mừng!',
  tryAgainTitle: 'Thử lại',
  betterLuck: 'Chúc may mắn lần sau!',
  usdcAdded: (label) => `${label}\n\n💰 Đã thêm vào số dư có thể rút.`,
  bonusAdded: (label) => `${label}\n\n⭐ Đã thêm vào tiến độ mở khóa.`,
  electronicsAdded: (label) => `${label}\n\n🎁 Liên hệ admin trên Telegram để nhận giải thưởng.`,
  withdrawSuccessTitle: '✅ Đã gửi yêu cầu rút',
  withdrawSuccessMsg: (amount) => `$${amount} USDC đang được xử lý đến ví của bạn.`,
  tgGroupRequired: 'Tham gia nhóm Telegram Polnation để rút.',

  howItWorks: 'Cách Hoạt Động',
  earnSpinsTitle: 'Cách kiếm lượt quay',
  earnSpins1: 'Tham gia nhóm Telegram chính thức → +1 lượt quay miễn phí (một lần)',
  earnSpins2: 'Mời bạn bè tham gia qua link của bạn → +1 lượt mỗi bạn',
  earnSpins3: 'Nhiệm vụ airdrop hàng ngày trên web — mỗi 7 lần → +1 lượt',
  usdcPrizesTitle: 'Giải thưởng USDC — rút ngay',
  usdcPrizesDesc: 'Thắng $0.50 / $1 / $5 USDC được ghi ngay vào số dư. Kết nối ví và nhấn Rút để gửi USDC đến địa chỉ Polygon của bạn.',
  bonusPrizesTitle: 'Giải thưởng bonus — Pool nhóm',
  bonusPrizesDesc1: '+$1 / +$2 / +$3 thắng Bonus không rút trực tiếp. Chúng lấp đầy tiến độ pool nhóm cùng khối lượng giới thiệu.',
  bonusPrizesDesc2: 'Khi tiến độ đạt ngưỡng cấp, bạn có thể nhận pool đó trên dashboard web — sau đó trả lợi nhuận hàng ngày cho đến hết.',
  tryAgainSection: 'Thử Lại',
  tryAgainDesc: 'Một số ô không có giải. Lượt quay bị tiêu thụ nhưng không có phần thưởng — chúc may mắn lần sau.',
  viewTeamBtn: 'Xem Tiến độ Pool Nhóm ↗',

  shareText: 'Lượt quay miễn phí cho phần thưởng USDC thật. Không cần cài đặt phức tạp.\n\nTham gia Polnation qua link của tôi và bắt đầu kiếm tiền. Mời và Kiếm.',

  webAccessTitle: 'TRUY CẬP WEB',
  webAccessDesc: 'Đăng nhập polnation.com từ bất kỳ trình duyệt nào bằng email + mật khẩu. Đăng nhập Telegram của bạn vẫn hoạt động.',
  webAccessBtn: 'CÀI ĐẶT ĐĂNG NHẬP WEB →',
  webLoginTitle: 'Cài đặt đăng nhập web',
  webLoginIntro: 'Liên kết email và mật khẩu để đăng nhập polnation.com từ bất kỳ trình duyệt nào. Đăng nhập Telegram của bạn tiếp tục hoạt động — đây chỉ là cách đăng nhập bổ sung.',
  webLoginEmailLabel: 'Email',
  webLoginPasswordLabel: 'Mật khẩu (6+ ký tự)',
  webLoginSaveBtn: 'Lưu',
  webLoginSavingBtn: 'Đang lưu…',
  webLoginDoneBtn: 'Xong',
  webLoginSuccess: (email) => `Đăng nhập web đã sẵn sàng. Đăng nhập polnation.com với ${email}.`,
  webLoginPasswordTooShort: 'Mật khẩu phải ít nhất 6 ký tự',
  webLoginGenericError: 'Không thể cài đặt đăng nhập web',
  webLoginNetworkError: 'Lỗi mạng — vui lòng thử lại',

  walletTrustNotInTg: 'Trust Wallet không được hỗ trợ trong Telegram',
  walletTrustStep1: 'Mở polnation.com trên Chrome',
  walletTrustStep2: 'Đăng nhập bằng email hoặc Telegram',
  walletTrustStep3: 'Kết nối ví → chọn Trust',
  walletTrustAlt: 'Hoặc dùng Bitget Wallet hoặc SafePal ngay trong Telegram.',
  walletOpenInBrowser: 'Mở trong trình duyệt',
  walletInstall: 'Cài đặt',
  walletBackBtn: 'Quay lại',
}

const hi: Translations = {
  startingUp: 'शुरू हो रहा है…',
  connecting: 'जोड़ रहा है…',
  openInTelegram: 'इस पेज को Telegram के अंदर से खोलें।',
  noSession: 'Telegram सेशन डेटा नहीं — बॉट के ज़रिए खोलें।',
  cantOpenLottery: 'लॉटरी नहीं खोल सका',
  tryAgainBtn: 'फिर कोशिश करें',
  prepStep1Title: 'Telegram सत्यापित हो रहा है',
  prepStep1Sub: 'आपका सेशन सुरक्षित हो रहा है…',
  prepStep2Title: 'आपका खाता बन रहा है',
  prepStep2Sub: 'लगभग हो गया…',
  prepStep3Title: 'स्पिन तैयार हो रहे हैं',
  prepStep3Sub: 'पुरस्कार लोड हो रहे हैं…',

  webLink: 'WEB ↗',
  language: 'भाषा',

  greeting: (name) => `नमस्ते ${name} 👋`,
  lotteryTitle: 'Polnation लॉटरी',
  spinToWin: 'जीतने के लिए घुमाएं',
  unlimitedSpins: '∞ असीमित स्पिन',
  spinsAvailable: (n) => `${n} स्पिन उपलब्ध`,

  welcomeTask: 'स्वागत कार्य',
  joinTelegramGroup: 'हमारे Telegram ग्रुप में शामिल हों',
  earnFreeSpin: '1 मुफ्त स्पिन पाएं — एक बार दावा करने योग्य।',
  joinGroupBtn: '📢 ग्रुप जॉइन करें → +1 स्पिन',
  verifyingMembership: 'सदस्यता सत्यापित हो रही है…',
  inviteUnavailable: 'ग्रुप इन्वाइट उपलब्ध नहीं। बाद में कोशिश करें।',

  withdrawable: 'निकासी योग्य',
  joinToWithdraw: '📢 निकासी के लिए Telegram ग्रुप जॉइन करें',
  connectWallet: '🔗 निकासी के लिए वॉलेट जोड़ें',
  minWithdraw: 'न्यूनतम $0.10 USDC',
  withdrawSubmitted: '✅ निकासी जमा हुई',
  withdraw: 'निकालें',
  withdrawPending: '…',
  maxPlaceholder: (max) => `अधिकतम $${max}`,

  teamPool: (level) => `टीम पूल · स्तर ${level}`,
  teamPoolUnlocked: (level) => `स्तर ${level} पूल अनलॉक — वेब पर दावा करें दैनिक यील्ड शुरू करने के लिए।`,
  teamPoolProgress: (remaining, pool) => `$${pool} पुरस्कार पूल खोलने के लिए $${remaining} और चाहिए। बोनस स्पिन + इनवाइट भरते हैं।`,
  teamPoolEmpty: 'टीम पूल भरने के लिए बोनस पुरस्कार जीतें या दोस्तों को आमंत्रित करें।',
  viewTeamProgress: 'टीम प्रगति देखें ↗',
  teamPoolNeedMore: (remaining) => `अनलॉक के लिए $${remaining} और चाहिए`,
  teamPoolHowToUnlock: 'जल्दी अनलॉक कैसे करें',
  teamPoolWayInvite: 'दोस्तों को आमंत्रित करें',
  teamPoolWayTasks: 'डैशबोर्ड पर कार्य पूरे करें',
  teamPoolWayInfluencer: 'इन्फ्लुएंसर बनें (50% छूट)',
  teamPoolClaim: 'डैशबोर्ड पर दावा करें ↗',

  invitedBy: 'किसने आमंत्रित किया',
  youInvited: 'आपने आमंत्रित किया',
  friends: (n) => `${n} दोस्त`,
  inviteBtn: '🔗 दोस्त को आमंत्रित करें → +1 स्पिन',
  inviteHint: 'हर दोस्त जो Telegram से जुड़ता है आपको 1 स्पिन देता है।',
  inviteEarnTitle: 'आमंत्रित करें और स्पिन पाएं',
  spinsBankedFromInvites: (n) => `🎟️ आमंत्रण से ${n} स्पिन कमाए`,
  outOfSpinsInvite: 'स्पिन खत्म? दोस्तों को आमंत्रित करें — हर एक पर +1 स्पिन!',
  shareWinBtn: '🎟️ शेयर करें → +1 स्पिन',
  firstWinTitle: '🎉 स्वागत उपहार!',
  inviteMilestoneTitle: 'आमंत्रण माइलस्टोन',
  inviteMilestoneNext: (remaining, reward) => `${reward} पाने के लिए ${remaining} और आमंत्रित करें`,
  inviteMilestoneAllDone: '🏆 सभी आमंत्रण माइलस्टोन पूरे!',
  leaderboardTitle: 'साप्ताहिक आमंत्रण लीडरबोर्ड',
  leaderboardPrizeNote: 'हर हफ्ते टॉप 3 जीतें $5 / $3 / $2',
  leaderboardYou: (rank, count) => `आप: #${rank} · ${count} आमंत्रण`,
  leaderboardUnranked: 'इस हफ्ते की सूची में चढ़ने के लिए दोस्तों को आमंत्रित करें!',
  firstWinMsg: (amount) => `आपने $${amount} USDC जीते — यह आपके निकासी बैलेंस में आ गया है। नीचे निकालें!`,
  shareWinText: (prize) => `मैंने Polnation पर ${prize} जीता 🎉 घुमाएँ और मुफ़्त USDC जीतें:`,

  spinHistory: 'स्पिन इतिहास',

  explorePolnation: 'Polnation एक्सप्लोर करें',
  exploreAll: 'सभी ↗',
  exploreHint: 'बोनस पुरस्कार आपके वेब खाते में प्रगति अनलॉक करते हैं। दैनिक USDC वितरण, स्टेकिंग यील्ड और रेफरल कमीशन मुख्य साइट पर।',
  dashboard: 'डैशबोर्ड',
  earnings: 'कमाई',
  agenticTeam: 'एजेंटिक टीम कमाई',

  spinning: 'घूम रहा है…',
  spinBtn: (n) => `घुमाएं (${n} बचे)`,
  spinBtnUnlimited: 'घुमाएं ∞',
  noSpinsLeft: 'कोई स्पिन नहीं',

  noSpinsTitle: 'कोई स्पिन नहीं बचा',
  noSpinsMsg: 'एक और स्पिन पाने के लिए Telegram से जुड़ने वाले दोस्त को आमंत्रित करें।',
  congratsTitle: '🎉 बधाई!',
  tryAgainTitle: 'फिर कोशिश करें',
  betterLuck: 'अगली बार और किस्मत हो!',
  usdcAdded: (label) => `${label}\n\n💰 आपके निकासी योग्य बैलेंस में जोड़ा गया।`,
  bonusAdded: (label) => `${label}\n\n⭐ आपकी अनलॉक प्रगति में जोड़ा गया।`,
  electronicsAdded: (label) => `${label}\n\n🎁 अपना पुरस्कार पाने के लिए Telegram पर एडमिन से संपर्क करें।`,
  withdrawSuccessTitle: '✅ निकासी जमा हुई',
  withdrawSuccessMsg: (amount) => `$${amount} USDC आपके वॉलेट में प्रोसेस हो रहा है।`,
  tgGroupRequired: 'निकासी के लिए Polnation Telegram ग्रुप जॉइन करें।',

  howItWorks: 'यह कैसे काम करता है',
  earnSpinsTitle: 'स्पिन कैसे कमाएं',
  earnSpins1: 'आधिकारिक Telegram ग्रुप जॉइन करें → +1 मुफ्त स्पिन (एक बार)',
  earnSpins2: 'अपने लिंक से दोस्त को आमंत्रित करें → प्रति दोस्त +1 स्पिन',
  earnSpins3: 'वेब पर दैनिक एयरड्रॉप कार्य — हर 7 दावों पर → +1 स्पिन',
  usdcPrizesTitle: 'USDC पुरस्कार — तुरंत निकासी योग्य',
  usdcPrizesDesc: '$0.50 / $1 / $5 USDC जीतने पर तुरंत बैलेंस में जुड़ता है। वॉलेट जोड़ें और Polygon पर USDC भेजने के लिए निकालें टैप करें।',
  bonusPrizesTitle: 'बोनस पुरस्कार — टीम पुरस्कार पूल',
  bonusPrizesDesc1: '+$1 / +$2 / +$3 बोनस जीत सीधे नहीं निकाले जा सकते। वे टीम रेफरल वॉल्यूम के साथ टीम पूल प्रगति भरते हैं।',
  bonusPrizesDesc2: 'जब प्रभावी प्रगति स्तर सीमा तक पहुंचे, तो वेब डैशबोर्ड पर उस स्तर के पूल का दावा करें — फिर समाप्त होने तक दैनिक यील्ड मिलती है।',
  tryAgainSection: 'फिर कोशिश करें',
  tryAgainDesc: 'कुछ स्लाइस में कोई पुरस्कार नहीं है। स्पिन खर्च होता है लेकिन कोई इनाम नहीं — अगली बार और किस्मत हो।',
  viewTeamBtn: 'टीम पूल प्रगति देखें ↗',

  shareText: 'असली USDC पुरस्कारों के लिए मुफ्त स्पिन। कोई जटिल सेटअप नहीं।\n\nमेरे लिंक से Polnation जॉइन करें और कमाना शुरू करें। आमंत्रित करें और कमाएं।',

  webAccessTitle: 'वेब एक्सेस',
  webAccessDesc: 'किसी भी ब्राउज़र से email + पासवर्ड के साथ polnation.com पर साइन इन करें। आपका Telegram लॉगिन काम करता रहेगा।',
  webAccessBtn: 'वेब लॉगिन सेट करें →',
  webLoginTitle: 'वेब लॉगिन सेट करें',
  webLoginIntro: 'email और पासवर्ड बाइंड करें ताकि किसी भी ब्राउज़र से polnation.com पर साइन इन कर सकें। आपका Telegram लॉगिन काम करता रहेगा — यह सिर्फ एक अतिरिक्त तरीका है।',
  webLoginEmailLabel: 'ईमेल',
  webLoginPasswordLabel: 'पासवर्ड (6+ अक्षर)',
  webLoginSaveBtn: 'सहेजें',
  webLoginSavingBtn: 'सहेजा जा रहा है…',
  webLoginDoneBtn: 'हो गया',
  webLoginSuccess: (email) => `वेब लॉगिन तैयार है। ${email} से polnation.com पर साइन इन करें।`,
  webLoginPasswordTooShort: 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए',
  webLoginGenericError: 'वेब लॉगिन सेट करने में विफल',
  webLoginNetworkError: 'नेटवर्क त्रुटि — कृपया फिर कोशिश करें',

  walletTrustNotInTg: 'Trust Wallet Telegram में समर्थित नहीं है',
  walletTrustStep1: 'Chrome में polnation.com खोलें',
  walletTrustStep2: 'ईमेल या Telegram से साइन इन करें',
  walletTrustStep3: 'वॉलेट जोड़ें → Trust चुनें',
  walletTrustAlt: 'या Telegram में Bitget Wallet या SafePal का उपयोग करें।',
  walletOpenInBrowser: 'ब्राउज़र में खोलें',
  walletInstall: 'इंस्टॉल',
  walletBackBtn: 'वापस',
}

const ar: Translations = {
  startingUp: 'جارٍ البدء…',
  connecting: 'جارٍ الاتصال…',
  openInTelegram: 'افتح هذه الصفحة من داخل Telegram.',
  noSession: 'لا توجد بيانات جلسة Telegram — افتح عبر البوت.',
  cantOpenLottery: 'تعذّر فتح اليانصيب',
  tryAgainBtn: 'حاول مجدداً',
  prepStep1Title: 'جارٍ التحقق من Telegram',
  prepStep1Sub: 'جارٍ تأمين جلستك…',
  prepStep2Title: 'جارٍ إنشاء حسابك',
  prepStep2Sub: 'اقتربنا من الانتهاء…',
  prepStep3Title: 'جارٍ تجهيز لفاتك',
  prepStep3Sub: 'جارٍ تحميل الجوائز…',

  webLink: 'الويب ↗',
  language: 'اللغة',

  greeting: (name) => `مرحباً ${name} 👋`,
  lotteryTitle: 'يانصيب Polnation',
  spinToWin: 'الف لتفوز',
  unlimitedSpins: '∞ لفات غير محدودة',
  spinsAvailable: (n) => `${n} لفة متاحة`,

  welcomeTask: 'مهمة الترحيب',
  joinTelegramGroup: 'انضم إلى مجموعة Telegram',
  earnFreeSpin: 'احصل على لفة مجانية — مرة واحدة فقط.',
  joinGroupBtn: '📢 انضم للمجموعة ← +1 لفة',
  verifyingMembership: 'جارٍ التحقق من العضوية…',
  inviteUnavailable: 'رابط الدعوة غير متاح. حاول لاحقاً.',

  withdrawable: 'قابل للسحب',
  joinToWithdraw: '📢 انضم لمجموعة Telegram للسحب',
  connectWallet: '🔗 اربط محفظة للسحب',
  minWithdraw: 'الحد الأدنى $0.10 USDC',
  withdrawSubmitted: '✅ تم تقديم طلب السحب',
  withdraw: 'سحب',
  withdrawPending: '…',
  maxPlaceholder: (max) => `الحد الأقصى $${max}`,

  teamPool: (level) => `مجمع الفريق · المستوى ${level}`,
  teamPoolUnlocked: (level) => `مجمع المستوى ${level} مفتوح — اطلبه على الويب لبدء العائد اليومي.`,
  teamPoolProgress: (remaining, pool) => `تحتاج $${remaining} أخرى لفتح مجمع الجوائز $${pool}. اللفات الإضافية + الدعوات تملؤه.`,
  teamPoolEmpty: 'اربح جوائز المكافأة أو ادعُ أصدقاء لملء مجمع الفريق.',
  viewTeamProgress: 'عرض تقدم الفريق ↗',
  teamPoolNeedMore: (remaining) => `تحتاج $${remaining} أخرى للفتح`,
  teamPoolHowToUnlock: 'كيفية الفتح بشكل أسرع',
  teamPoolWayInvite: 'دعوة الأصدقاء',
  teamPoolWayTasks: 'إكمال المهام في لوحة التحكم',
  teamPoolWayInfluencer: 'كن مؤثراً (خصم 50%)',
  teamPoolClaim: 'اطلبها في لوحة التحكم ↗',

  invitedBy: 'دعوة من',
  youInvited: 'دعوت',
  friends: (n) => `${n} صديق`,
  inviteBtn: '🔗 ادعُ صديقاً ← +1 لفة',
  inviteHint: 'كل صديق ينضم عبر Telegram يمنحك لفة واحدة.',
  inviteEarnTitle: 'ادعُ واكسب لفات',
  spinsBankedFromInvites: (n) => `🎟️ ربحت ${n} لفة من الدعوات`,
  outOfSpinsInvite: 'نفدت اللفات؟ ادعُ أصدقاءك — لفة لكل صديق!',
  shareWinBtn: '🎟️ شارك → +1 لفة',
  firstWinTitle: '🎉 هدية ترحيب!',
  inviteMilestoneTitle: 'مراحل الدعوة',
  inviteMilestoneNext: (remaining, reward) => `ادعُ ${remaining} آخرين لتربح ${reward}`,
  inviteMilestoneAllDone: '🏆 اكتملت كل مراحل الدعوة!',
  leaderboardTitle: 'لوحة دعوات الأسبوع',
  leaderboardPrizeNote: 'أفضل 3 يفوزون بـ $5 / $3 / $2 كل أسبوع',
  leaderboardYou: (rank, count) => `أنت: #${rank} · ${count} دعوة`,
  leaderboardUnranked: 'ادعُ أصدقاءك لتصعد لوحة هذا الأسبوع!',
  firstWinMsg: (amount) => `ربحت $${amount} USDC — أصبحت في رصيدك القابل للسحب. اسحبها بالأسفل!`,
  shareWinText: (prize) => `لقد ربحت ${prize} على Polnation 🎉 أدر العجلة واربح USDC مجاناً:`,

  spinHistory: 'سجل اللفات',

  explorePolnation: 'استكشف Polnation',
  exploreAll: 'الكل ↗',
  exploreHint: 'الجوائز الإضافية تفتح التقدم في حسابك على الويب. توزيعات USDC اليومية وعوائد التخزين وعمولات الإحالة في الموقع الرئيسي.',
  dashboard: 'لوحة التحكم',
  earnings: 'الأرباح',
  agenticTeam: 'أرباح فريق الذكاء الاصطناعي',

  spinning: 'جارٍ اللف…',
  spinBtn: (n) => `الف (${n} متبقية)`,
  spinBtnUnlimited: 'الف ∞',
  noSpinsLeft: 'لا لفات متبقية',

  noSpinsTitle: 'لا لفات متبقية',
  noSpinsMsg: 'ادعُ صديقاً ينضم عبر Telegram للحصول على لفة أخرى.',
  congratsTitle: '🎉 مبروك!',
  tryAgainTitle: 'حاول مجدداً',
  betterLuck: 'حظ أوفر في المرة القادمة!',
  usdcAdded: (label) => `${label}\n\n💰 أضيف إلى رصيدك القابل للسحب.`,
  bonusAdded: (label) => `${label}\n\n⭐ أضيف إلى تقدم فتح القفل.`,
  electronicsAdded: (label) => `${label}\n\n🎁 تواصل مع المسؤول على Telegram لاستلام جائزتك.`,
  withdrawSuccessTitle: '✅ تم تقديم طلب السحب',
  withdrawSuccessMsg: (amount) => `جارٍ معالجة $${amount} USDC إلى محفظتك.`,
  tgGroupRequired: 'انضم لمجموعة Polnation Telegram للسحب.',

  howItWorks: 'كيف يعمل',
  earnSpinsTitle: 'كيف تكسب لفات',
  earnSpins1: 'انضم لمجموعة Telegram الرسمية ← +1 لفة مجانية (مرة واحدة)',
  earnSpins2: 'ادعُ صديقاً ينضم عبر رابطك ← +1 لفة لكل صديق',
  earnSpins3: 'مهام الإسقاط الجوي اليومية على الويب — كل 7 مطالبات ← +1 لفة',
  usdcPrizesTitle: 'جوائز USDC — قابلة للسحب فوراً',
  usdcPrizesDesc: 'الفوز بـ $0.50 / $1 / $5 USDC يُضاف فوراً لرصيدك. اربط محفظة واضغط سحب لإرسال USDC لعنوانك على Polygon.',
  bonusPrizesTitle: 'جوائز المكافأة — مجمع جوائز الفريق',
  bonusPrizesDesc1: 'مكاسب المكافأة +$1 / +$2 / +$3 لا تُسحب مباشرة. تملأ تقدم مجمع الفريق إلى جانب حجم الإحالة.',
  bonusPrizesDesc2: 'عند بلوغ التقدم عتبة المستوى، يمكنك المطالبة بمجمع ذلك المستوى في لوحة التحكم — يدفع عائداً يومياً حتى النفاد.',
  tryAgainSection: 'حاول مجدداً',
  tryAgainDesc: 'بعض الأقسام لا تحتوي على جوائز. تُستهلك اللفة لكن لا يُمنح مكافأة — حظ أوفر في المرة القادمة.',
  viewTeamBtn: 'عرض تقدم مجمع الفريق ↗',

  shareText: 'لفات مجانية لجوائز USDC حقيقية. بدون إعداد معقد.\n\nانضم لـ Polnation عبر رابطي وابدأ الكسب. ادعُ واكسب.',

  webAccessTitle: 'الوصول عبر الويب',
  webAccessDesc: 'سجّل الدخول على polnation.com من أي متصفح باستخدام البريد الإلكتروني + كلمة المرور. تسجيل دخول Telegram يبقى يعمل.',
  webAccessBtn: 'إعداد تسجيل دخول الويب ←',
  webLoginTitle: 'إعداد تسجيل دخول الويب',
  webLoginIntro: 'اربط بريداً إلكترونياً وكلمة مرور للدخول على polnation.com من أي متصفح. تسجيل دخول Telegram يبقى يعمل — هذا مجرد وسيلة دخول إضافية.',
  webLoginEmailLabel: 'البريد الإلكتروني',
  webLoginPasswordLabel: 'كلمة المرور (6+ أحرف)',
  webLoginSaveBtn: 'حفظ',
  webLoginSavingBtn: 'جارٍ الحفظ…',
  webLoginDoneBtn: 'تم',
  webLoginSuccess: (email) => `تسجيل دخول الويب جاهز. سجّل الدخول على polnation.com بـ ${email}.`,
  webLoginPasswordTooShort: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
  webLoginGenericError: 'فشل إعداد تسجيل دخول الويب',
  webLoginNetworkError: 'خطأ في الشبكة — يرجى المحاولة مجدداً',

  walletTrustNotInTg: 'محفظة Trust غير مدعومة داخل Telegram',
  walletTrustStep1: 'افتح polnation.com في Chrome',
  walletTrustStep2: 'سجّل الدخول بالبريد الإلكتروني أو Telegram',
  walletTrustStep3: 'اربط المحفظة ← اختر Trust',
  walletTrustAlt: 'أو استخدم Bitget Wallet أو SafePal هنا في Telegram.',
  walletOpenInBrowser: 'افتح في المتصفح',
  walletInstall: 'تثبيت',
  walletBackBtn: 'رجوع',
}

const ur: Translations = {
  startingUp: 'شروع ہو رہا ہے…',
  connecting: 'جوڑ رہا ہے…',
  openInTelegram: 'اس صفحے کو Telegram کے اندر سے کھولیں۔',
  noSession: 'Telegram سیشن ڈیٹا نہیں — بوٹ کے ذریعے کھولیں۔',
  cantOpenLottery: 'لاٹری نہیں کھل سکی',
  tryAgainBtn: 'دوبارہ کوشش کریں',
  prepStep1Title: 'Telegram تصدیق ہو رہا ہے',
  prepStep1Sub: 'آپ کا سیشن محفوظ ہو رہا ہے…',
  prepStep2Title: 'آپ کا اکاؤنٹ بن رہا ہے',
  prepStep2Sub: 'تقریباً ہو گیا…',
  prepStep3Title: 'اسپن تیار ہو رہے ہیں',
  prepStep3Sub: 'انعامات لوڈ ہو رہے ہیں…',

  webLink: 'WEB ↗',
  language: 'زبان',

  greeting: (name) => `السلام علیکم ${name} 👋`,
  lotteryTitle: 'Polnation لاٹری',
  spinToWin: 'جیتنے کے لیے گھمائیں',
  unlimitedSpins: '∞ لامحدود اسپن',
  spinsAvailable: (n) => `${n} اسپن دستیاب`,

  welcomeTask: 'خوش آمدید کام',
  joinTelegramGroup: 'ہمارے Telegram گروپ میں شامل ہوں',
  earnFreeSpin: '1 مفت اسپن حاصل کریں — ایک بار دعوی کرنے کے قابل۔',
  joinGroupBtn: '📢 گروپ جوائن کریں ← +1 اسپن',
  verifyingMembership: 'رکنیت تصدیق ہو رہی ہے…',
  inviteUnavailable: 'گروپ دعوت دستیاب نہیں۔ بعد میں کوشش کریں۔',

  withdrawable: 'نکاسی کے قابل',
  joinToWithdraw: '📢 نکاسی کے لیے Telegram گروپ جوائن کریں',
  connectWallet: '🔗 نکاسی کے لیے والیٹ جوڑیں',
  minWithdraw: 'کم از کم $0.10 USDC',
  withdrawSubmitted: '✅ نکاسی جمع ہوئی',
  withdraw: 'نکالیں',
  withdrawPending: '…',
  maxPlaceholder: (max) => `زیادہ سے زیادہ $${max}`,

  teamPool: (level) => `ٹیم پول · سطح ${level}`,
  teamPoolUnlocked: (level) => `سطح ${level} پول کھل گیا — روزانہ منافع شروع کرنے کے لیے ویب پر دعوی کریں۔`,
  teamPoolProgress: (remaining, pool) => `$${pool} انعام پول کھولنے کے لیے $${remaining} اور چاہیے۔ بونس اسپن + دعوتیں بھرتی ہیں۔`,
  teamPoolEmpty: 'ٹیم پول بھرنے کے لیے بونس انعام جیتیں یا دوستوں کو مدعو کریں۔',
  viewTeamProgress: 'ٹیم پیشرفت دیکھیں ↗',
  teamPoolNeedMore: (remaining) => `کھولنے کے لیے $${remaining} اور چاہیے`,
  teamPoolHowToUnlock: 'جلدی کھولنے کا طریقہ',
  teamPoolWayInvite: 'دوستوں کو مدعو کریں',
  teamPoolWayTasks: 'ڈیش بورڈ پر کام مکمل کریں',
  teamPoolWayInfluencer: 'انفلوئنسر بنیں (50% چھوٹ)',
  teamPoolClaim: 'ڈیش بورڈ پر دعوی کریں ↗',

  invitedBy: 'کس نے مدعو کیا',
  youInvited: 'آپ نے مدعو کیا',
  friends: (n) => `${n} دوست`,
  inviteBtn: '🔗 دوست کو مدعو کریں ← +1 اسپن',
  inviteHint: 'ہر دوست جو Telegram سے جڑتا ہے آپ کو 1 اسپن دیتا ہے۔',
  inviteEarnTitle: 'مدعو کریں اور اسپن کمائیں',
  spinsBankedFromInvites: (n) => `🎟️ دعوتوں سے ${n} اسپن کمائے`,
  outOfSpinsInvite: 'اسپن ختم؟ دوستوں کو مدعو کریں — ہر ایک پر +1 اسپن!',
  shareWinBtn: '🎟️ شیئر کریں → +1 اسپن',
  firstWinTitle: '🎉 خوش آمدید تحفہ!',
  inviteMilestoneTitle: 'دعوت سنگِ میل',
  inviteMilestoneNext: (remaining, reward) => `${reward} حاصل کرنے کے لیے ${remaining} اور مدعو کریں`,
  inviteMilestoneAllDone: '🏆 تمام دعوت سنگِ میل مکمل!',
  leaderboardTitle: 'ہفتہ وار دعوت لیڈربورڈ',
  leaderboardPrizeNote: 'ہر ہفتے ٹاپ 3 جیتیں $5 / $3 / $2',
  leaderboardYou: (rank, count) => `آپ: #${rank} · ${count} دعوتیں`,
  leaderboardUnranked: 'اس ہفتے کی فہرست میں آنے کے لیے دوستوں کو مدعو کریں!',
  firstWinMsg: (amount) => `آپ نے $${amount} USDC جیتے — یہ آپ کے قابلِ واپسی بیلنس میں آ گئے۔ نیچے سے نکالیں!`,
  shareWinText: (prize) => `میں نے Polnation پر ${prize} جیتا 🎉 گھمائیں اور مفت USDC جیتیں:`,

  spinHistory: 'اسپن تاریخ',

  explorePolnation: 'Polnation دریافت کریں',
  exploreAll: 'سب ↗',
  exploreHint: 'بونس انعام آپ کے ویب اکاؤنٹ میں پیشرفت کھولتے ہیں۔ روزانہ USDC تقسیم، اسٹیکنگ منافع اور ریفرل کمیشن مرکزی سائٹ پر۔',
  dashboard: 'ڈیش بورڈ',
  earnings: 'آمدنی',
  agenticTeam: 'ایجنٹک ٹیم آمدنی',

  spinning: 'گھوم رہا ہے…',
  spinBtn: (n) => `گھمائیں (${n} باقی)`,
  spinBtnUnlimited: 'گھمائیں ∞',
  noSpinsLeft: 'کوئی اسپن نہیں',

  noSpinsTitle: 'کوئی اسپن نہیں بچا',
  noSpinsMsg: 'ایک اور اسپن پانے کے لیے Telegram سے جڑنے والے دوست کو مدعو کریں۔',
  congratsTitle: '🎉 مبارک ہو!',
  tryAgainTitle: 'دوبارہ کوشش کریں',
  betterLuck: 'اگلی بار بہتر قسمت!',
  usdcAdded: (label) => `${label}\n\n💰 آپ کے نکاسی کے قابل بیلنس میں شامل ہوا۔`,
  bonusAdded: (label) => `${label}\n\n⭐ آپ کی انلاک پیشرفت میں شامل ہوا۔`,
  electronicsAdded: (label) => `${label}\n\n🎁 اپنا انعام حاصل کرنے کے لیے Telegram پر ایڈمن سے رابطہ کریں۔`,
  withdrawSuccessTitle: '✅ نکاسی جمع ہوئی',
  withdrawSuccessMsg: (amount) => `$${amount} USDC آپ کے والیٹ میں پروسیس ہو رہا ہے۔`,
  tgGroupRequired: 'نکاسی کے لیے Polnation Telegram گروپ جوائن کریں۔',

  howItWorks: 'یہ کیسے کام کرتا ہے',
  earnSpinsTitle: 'اسپن کیسے کمائیں',
  earnSpins1: 'آفیشل Telegram گروپ جوائن کریں ← +1 مفت اسپن (ایک بار)',
  earnSpins2: 'اپنے لنک سے دوست کو مدعو کریں ← فی دوست +1 اسپن',
  earnSpins3: 'ویب پر روزانہ ایئر ڈراپ کام — ہر 7 دعووں پر ← +1 اسپن',
  usdcPrizesTitle: 'USDC انعامات — فوری نکاسی کے قابل',
  usdcPrizesDesc: '$0.50 / $1 / $5 USDC جیتنے پر فوری بیلنس میں شامل ہوتا ہے۔ والیٹ جوڑیں اور Polygon پر USDC بھیجنے کے لیے نکالیں ٹیپ کریں۔',
  bonusPrizesTitle: 'بونس انعامات — ٹیم انعام پول',
  bonusPrizesDesc1: '+$1 / +$2 / +$3 بونس جیت سیدھی نہیں نکالی جا سکتی۔ یہ ٹیم ریفرل حجم کے ساتھ ٹیم پول پیشرفت بھرتی ہیں۔',
  bonusPrizesDesc2: 'جب پیشرفت سطح کی حد تک پہنچے تو ویب ڈیش بورڈ پر اس سطح کے پول کا دعوی کریں — پھر ختم ہونے تک روزانہ منافع ملتا ہے۔',
  tryAgainSection: 'دوبارہ کوشش کریں',
  tryAgainDesc: 'کچھ حصوں میں انعام نہیں۔ اسپن خرچ ہوتا ہے لیکن کوئی انعام نہیں — اگلی بار بہتر قسمت۔',
  viewTeamBtn: 'ٹیم پول پیشرفت دیکھیں ↗',

  shareText: 'اصلی USDC انعامات کے لیے مفت اسپن۔ کوئی پیچیدہ سیٹ اپ نہیں۔\n\nمیرے لنک سے Polnation جوائن کریں اور کمانا شروع کریں۔ مدعو کریں اور کمائیں۔',

  webAccessTitle: 'ویب رسائی',
  webAccessDesc: 'کسی بھی براؤزر سے email + پاسورڈ کے ساتھ polnation.com پر سائن ان کریں۔ آپ کا Telegram لاگ ان کام کرتا رہے گا۔',
  webAccessBtn: 'ویب لاگ ان سیٹ کریں ←',
  webLoginTitle: 'ویب لاگ ان سیٹ کریں',
  webLoginIntro: 'email اور پاسورڈ باندھیں تاکہ کسی بھی براؤزر سے polnation.com پر سائن ان کر سکیں۔ آپ کا Telegram لاگ ان کام کرتا رہے گا — یہ صرف ایک اضافی طریقہ ہے۔',
  webLoginEmailLabel: 'ای میل',
  webLoginPasswordLabel: 'پاسورڈ (6+ حروف)',
  webLoginSaveBtn: 'محفوظ کریں',
  webLoginSavingBtn: 'محفوظ ہو رہا ہے…',
  webLoginDoneBtn: 'ہو گیا',
  webLoginSuccess: (email) => `ویب لاگ ان تیار ہے۔ ${email} سے polnation.com پر سائن ان کریں۔`,
  webLoginPasswordTooShort: 'پاسورڈ کم از کم 6 حروف کا ہونا چاہیے',
  webLoginGenericError: 'ویب لاگ ان سیٹ کرنے میں ناکامی',
  webLoginNetworkError: 'نیٹ ورک خرابی — براہ کرم دوبارہ کوشش کریں',

  walletTrustNotInTg: 'Trust Wallet Telegram میں سپورٹ نہیں ہے',
  walletTrustStep1: 'Chrome میں polnation.com کھولیں',
  walletTrustStep2: 'ای میل یا Telegram سے سائن ان کریں',
  walletTrustStep3: 'والٹ منسلک کریں ← Trust منتخب کریں',
  walletTrustAlt: 'یا Telegram میں Bitget Wallet یا SafePal استعمال کریں۔',
  walletOpenInBrowser: 'براؤزر میں کھولیں',
  walletInstall: 'انسٹال',
  walletBackBtn: 'واپس',
}

export const TRANSLATIONS: Record<Locale, Translations> = { en, zh, ru, es, pt, fr, ja, ko, tr, id, vi, hi, ar, ur }
