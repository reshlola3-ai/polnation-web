// Lottery Mini App — i18n translations
// Add new languages by duplicating the `en` block and translating values.

export type Locale = 'en' | 'zh' | 'ru' | 'es' | 'pt' | 'fr' | 'de' | 'ja' | 'ko' | 'tr'

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
  de: { label: 'Deutsch',    flag: '🇩🇪' },
  ja: { label: '日本語',      flag: '🇯🇵' },
  ko: { label: '한국어',      flag: '🇰🇷' },
  tr: { label: 'Türkçe',     flag: '🇹🇷' },
}

export const LOCALES = Object.keys(LOCALE_META) as Locale[]

// Map TG language_code (ISO 639-1) → our Locale
const TG_LANG_MAP: Record<string, Locale> = {
  en: 'en', zh: 'zh', 'zh-hans': 'zh', 'zh-hant': 'zh',
  ru: 'ru', es: 'es', pt: 'pt',
  fr: 'fr', de: 'de', ja: 'ja', ko: 'ko', tr: 'tr',
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

  // network
  invitedBy: string
  youInvited: string
  friends: (n: number) => string
  inviteBtn: string
  inviteHint: string

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
}

const en: Translations = {
  startingUp: 'Starting…',
  connecting: 'Connecting…',
  openInTelegram: 'Open this page from inside Telegram.',
  noSession: 'No Telegram session data — open via the bot.',
  cantOpenLottery: "Couldn't open the lottery",
  tryAgainBtn: 'Try Again',

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

  invitedBy: 'Invited By',
  youInvited: 'You Invited',
  friends: (n) => `${n} ${n === 1 ? 'friend' : 'friends'}`,
  inviteBtn: '🔗 Invite a Friend → +1 Spin',
  inviteHint: 'Each friend who joins via Telegram earns you 1 spin.',

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

  shareText: '🎰 Spin the Polnation Lottery and win USDC!',
}

const zh: Translations = {
  startingUp: '启动中…',
  connecting: '连接中…',
  openInTelegram: '请在 Telegram 中打开此页面。',
  noSession: '未检测到 Telegram 会话，请通过机器人打开。',
  cantOpenLottery: '无法打开抽奖',
  tryAgainBtn: '重试',

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

  invitedBy: '邀请人',
  youInvited: '你邀请了',
  friends: (n) => `${n} 位好友`,
  inviteBtn: '🔗 邀请好友 → +1 次抽奖',
  inviteHint: '每位通过你的链接加入 Telegram 的好友可为你赢得 1 次抽奖机会。',

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

  shareText: '🎰 来 Polnation 转盘抽奖，赢取 USDC！',
}

const ru: Translations = {
  startingUp: 'Запуск…',
  connecting: 'Подключение…',
  openInTelegram: 'Откройте эту страницу в Telegram.',
  noSession: 'Данные сессии Telegram отсутствуют — откройте через бота.',
  cantOpenLottery: 'Не удалось открыть лотерею',
  tryAgainBtn: 'Повторить',

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

  invitedBy: 'Пригласил',
  youInvited: 'Вы пригласили',
  friends: (n) => `${n} ${n === 1 ? 'друг' : n < 5 ? 'друга' : 'друзей'}`,
  inviteBtn: '🔗 Пригласить друга → +1 спин',
  inviteHint: 'Каждый друг, вступивший через Telegram, даёт вам 1 спин.',

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

  shareText: '🎰 Крути лотерею Polnation и выигрывай USDC!',
}

const es: Translations = {
  startingUp: 'Iniciando…',
  connecting: 'Conectando…',
  openInTelegram: 'Abre esta página desde Telegram.',
  noSession: 'Sin datos de sesión de Telegram — ábrelo desde el bot.',
  cantOpenLottery: 'No se pudo abrir la lotería',
  tryAgainBtn: 'Intentar de nuevo',

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

  invitedBy: 'Invitado por',
  youInvited: 'Tú invitaste',
  friends: (n) => `${n} amigo${n === 1 ? '' : 's'}`,
  inviteBtn: '🔗 Invitar a un amigo → +1 giro',
  inviteHint: 'Cada amigo que se una vía Telegram te da 1 giro.',

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

  shareText: '🎰 ¡Gira la lotería Polnation y gana USDC!',
}

const pt: Translations = {
  startingUp: 'Iniciando…',
  connecting: 'Conectando…',
  openInTelegram: 'Abra esta página dentro do Telegram.',
  noSession: 'Sem dados de sessão do Telegram — abra pelo bot.',
  cantOpenLottery: 'Não foi possível abrir a loteria',
  tryAgainBtn: 'Tentar novamente',

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

  invitedBy: 'Convidado por',
  youInvited: 'Você convidou',
  friends: (n) => `${n} amigo${n === 1 ? '' : 's'}`,
  inviteBtn: '🔗 Convidar um amigo → +1 giro',
  inviteHint: 'Cada amigo que entrar pelo Telegram lhe rende 1 giro.',

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

  shareText: '🎰 Gire a loteria Polnation e ganhe USDC!',
}

const fr: Translations = {
  startingUp: 'Démarrage…',
  connecting: 'Connexion…',
  openInTelegram: 'Ouvrez cette page depuis Telegram.',
  noSession: 'Aucune session Telegram — ouvrez via le bot.',
  cantOpenLottery: 'Impossible d\'ouvrir la loterie',
  tryAgainBtn: 'Réessayer',

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

  invitedBy: 'Invité par',
  youInvited: 'Vous avez invité',
  friends: (n) => `${n} ami${n === 1 ? '' : 's'}`,
  inviteBtn: '🔗 Inviter un ami → +1 tour',
  inviteHint: 'Chaque ami qui rejoint via Telegram vous rapporte 1 tour.',

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

  shareText: '🎰 Faites tourner la loterie Polnation et gagnez des USDC !',
}

const de: Translations = {
  startingUp: 'Starten…',
  connecting: 'Verbinden…',
  openInTelegram: 'Öffne diese Seite in Telegram.',
  noSession: 'Keine Telegram-Sitzungsdaten — über den Bot öffnen.',
  cantOpenLottery: 'Lotterie konnte nicht geöffnet werden',
  tryAgainBtn: 'Erneut versuchen',

  webLink: 'WEB ↗',
  language: 'Sprache',

  greeting: (name) => `Hallo ${name} 👋`,
  lotteryTitle: 'Polnation Lotterie',
  spinToWin: 'Drehen und Gewinnen',
  unlimitedSpins: '∞ Unbegrenzte Drehungen',
  spinsAvailable: (n) => `${n} Drehung${n === 1 ? '' : 'en'} verfügbar`,

  welcomeTask: 'Willkommensaufgabe',
  joinTelegramGroup: 'Tritt unserer Telegram-Gruppe bei',
  earnFreeSpin: 'Erhalte 1 Gratis-Drehung — einmalig.',
  joinGroupBtn: '📢 Gruppe beitreten → +1 Drehung',
  verifyingMembership: 'Mitgliedschaft wird überprüft…',
  inviteUnavailable: 'Einladungslink nicht verfügbar. Später erneut versuchen.',

  withdrawable: 'Auszahlbar',
  joinToWithdraw: '📢 Telegram-Gruppe beitreten zum Auszahlen',
  connectWallet: '🔗 Wallet verbinden zum Auszahlen',
  minWithdraw: 'Minimum $0.10 USDC',
  withdrawSubmitted: '✅ Auszahlung eingereicht',
  withdraw: 'Auszahlen',
  withdrawPending: '…',
  maxPlaceholder: (max) => `Max. $${max}`,

  teamPool: (level) => `Team-Pool · Level ${level}`,
  teamPoolUnlocked: (level) => `Level ${level} Pool entsperrt — im Web einfordern für tägliche Rendite.`,
  teamPoolProgress: (remaining, pool) => `Noch $${remaining} bis zum $${pool} Pool. Bonus-Drehungen & Einladungen füllen ihn.`,
  teamPoolEmpty: 'Gewinne Bonus-Preise oder lade Freunde ein, um den Team-Pool zu füllen.',
  viewTeamProgress: 'TEAM-FORTSCHRITT ↗',

  invitedBy: 'Eingeladen von',
  youInvited: 'Du hast eingeladen',
  friends: (n) => `${n} Freund${n === 1 ? '' : 'e'}`,
  inviteBtn: '🔗 Einen Freund einladen → +1 Drehung',
  inviteHint: 'Jeder Freund, der über Telegram beitritt, bringt dir 1 Drehung.',

  spinHistory: 'Dreh-Verlauf',

  explorePolnation: 'Polnation erkunden',
  exploreAll: 'ALLE ↗',
  exploreHint: 'Bonus-Preise entsperren Fortschritt im Web-Konto. Tägliche USDC-Ausschüttungen, Staking-Renditen und Empfehlungsprovisionen auf der Hauptseite.',
  dashboard: 'Dashboard',
  earnings: 'Einnahmen',
  agenticTeam: 'KI Team-Einnahmen',

  spinning: 'DREHT…',
  spinBtn: (n) => `DREHEN (${n} ÜBRIG)`,
  spinBtnUnlimited: 'DREHEN ∞',
  noSpinsLeft: 'KEINE DREHUNGEN',

  noSpinsTitle: 'Keine Drehungen mehr',
  noSpinsMsg: 'Lade einen Freund via Telegram ein, um eine weitere Drehung zu erhalten.',
  congratsTitle: '🎉 Glückwunsch!',
  tryAgainTitle: 'Nochmal versuchen',
  betterLuck: 'Beim nächsten Mal mehr Glück!',
  usdcAdded: (label) => `${label}\n\n💰 Zu deinem auszahlbaren Guthaben hinzugefügt.`,
  bonusAdded: (label) => `${label}\n\n⭐ Zu deinem Entsperrungsfortschritt hinzugefügt.`,
  withdrawSuccessTitle: '✅ Auszahlung eingereicht',
  withdrawSuccessMsg: (amount) => `$${amount} USDC wird an dein Wallet verarbeitet.`,
  tgGroupRequired: 'Tritt der Polnation Telegram-Gruppe bei, um auszuzahlen.',

  howItWorks: 'So funktioniert es',
  earnSpinsTitle: 'Wie man Drehungen verdient',
  earnSpins1: 'Der offiziellen Telegram-Gruppe beitreten → +1 Gratis-Drehung (einmalig)',
  earnSpins2: 'Einen Freund mit deinem Link einladen → +1 Drehung pro Freund',
  earnSpins3: 'Tägliche Airdrop-Aufgaben im Web — alle 7 → +1 Drehung',
  usdcPrizesTitle: 'USDC-Preise — sofort auszahlbar',
  usdcPrizesDesc: 'Ein Gewinn von $0.50 / $1 / $5 USDC wird sofort auf dein auszahlbares Guthaben gutgeschrieben. Verbinde ein Wallet und tippe auf Auszahlen, um USDC auf Polygon zu senden.',
  bonusPrizesTitle: 'Bonus-Preise — Team-Pool',
  bonusPrizesDesc1: '+$1 / +$2 / +$3 Bonus-Gewinne können nicht direkt ausgezahlt werden. Sie füllen den Team-Pool-Fortschritt zusammen mit dem Empfehlungsvolumen.',
  bonusPrizesDesc2: 'Sobald der Level-Schwellenwert erreicht ist, kannst du den Pool im Web-Dashboard einfordern — er zahlt dann täglich Rendite aus.',
  tryAgainSection: 'Kein Gewinn',
  tryAgainDesc: 'Einige Felder haben keinen Preis. Die Drehung wird verbraucht, aber keine Belohnung gutgeschrieben — beim nächsten Mal mehr Glück.',
  viewTeamBtn: 'Team-Pool-Fortschritt ansehen ↗',

  shareText: '🎰 Drehe die Polnation Lotterie und gewinne USDC!',
}

const ja: Translations = {
  startingUp: '起動中…',
  connecting: '接続中…',
  openInTelegram: 'Telegram内からこのページを開いてください。',
  noSession: 'Telegramセッションデータがありません。ボットから開いてください。',
  cantOpenLottery: '抽選を開けませんでした',
  tryAgainBtn: 'もう一度試す',

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

  invitedBy: '招待者',
  youInvited: '招待した人数',
  friends: (n) => `${n} 人`,
  inviteBtn: '🔗 友達を招待 → +1スピン',
  inviteHint: 'Telegram経由で参加した友達1人につき1スピン獲得。',

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

  shareText: '🎰 Polnation抽選をスピンしてUSDCを当てよう！',
}

const ko: Translations = {
  startingUp: '시작 중…',
  connecting: '연결 중…',
  openInTelegram: 'Telegram 앱에서 이 페이지를 열어주세요.',
  noSession: 'Telegram 세션 데이터 없음 — 봇을 통해 열어주세요.',
  cantOpenLottery: '복권을 열 수 없습니다',
  tryAgainBtn: '다시 시도',

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

  invitedBy: '초대한 사람',
  youInvited: '초대한 친구',
  friends: (n) => `${n}명`,
  inviteBtn: '🔗 친구 초대 → +1 스핀',
  inviteHint: 'Telegram으로 참가한 친구 1명당 스핀 1회 획득.',

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

  shareText: '🎰 Polnation 복권을 돌려 USDC를 당첨하세요!',
}

const tr: Translations = {
  startingUp: 'Başlatılıyor…',
  connecting: 'Bağlanıyor…',
  openInTelegram: 'Bu sayfayı Telegram içinden açın.',
  noSession: 'Telegram oturumu bulunamadı — botu kullanarak açın.',
  cantOpenLottery: 'Çekiliş açılamadı',
  tryAgainBtn: 'Tekrar Dene',

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

  invitedBy: 'Davet Eden',
  youInvited: 'Davet Ettiğin',
  friends: (n) => `${n} arkadaş`,
  inviteBtn: '🔗 Arkadaş Davet Et → +1 Hak',
  inviteHint: 'Telegram üzerinden katılan her arkadaş 1 hak kazandırır.',

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

  shareText: '🎰 Polnation çekilişini çevir ve USDC kazan!',
}

export const TRANSLATIONS: Record<Locale, Translations> = { en, zh, ru, es, pt, fr, de, ja, ko, tr }
