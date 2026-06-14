# 抽奖病毒增长机制 · 运营说明

面向运营/客服。覆盖抽奖(Lottery)小程序里所有"发抽奖次数 / 发钱"的机制:**怎么触发、发多少、预算、防刷点、代码位置**。

> 口径约定
> - **spin / 抽奖次数**:`user_lottery_spins.total_spins - used_spins`。
> - **可提现 USDC**:`user_profits.available_usdc`(用户在提现页能提的钱)。
> - **Bonus**:进 `user_task_progress.total_task_bonus`(解锁进度,不是现金)。
> - 所有时间判断按 **UTC**。

---

## 一、抽奖次数(spin)从哪来

| # | 机制 | 触发 | 发放 | 去重 / 防刷 | 代码 |
|---|------|------|------|------------|------|
| 基础 | 加群送 spin | 用户自己加入指定 TG 群 | +1(永久一次性) | `grant_reason='welcome_join_telegram'`,每人一次;离开再加不重复 | `api/lottery/check-spins` |
| 基础 | 邀请认证返 spin | 被邀请人接入 TG(`telegram_chat_id` 有值)或 Twitter 认证 | 推荐人 +1 | 每个下线一次(`referral_verified`) | `api/lottery/check-spins` |
| 基础 | 自己领空投里程碑 | 自己累计领空投每满 7 次 | +1 | 按里程碑去重(`self_airdrop_7x`) | 空投发放流程 |
| 基础 | 下线领空投里程碑 | 某个直推下线累计领空投满 7 次 | 推荐人 +1 | 每个下线一次(`referral_airdrop_7`) | 空投发放流程 |
| **#2** | 晒中奖返 spin | 中奖弹窗点"Share & Earn +1 Spin"→ 打开 TG 分享(带邀请链接) | +1 | **每天最多 1 次**,`grant_reason='shared_win'` + 当天日期去重 | `api/lottery/share-bonus` |
| **#4** | 邀请里程碑(10人) | 有 **10 个"有 USDC 余额"的被邀请人** | +5 spins | `invite_milestone_10` 一次性 | `api/lottery/check-spins` |
| **#6** | 连胜 3 天 | 连续 3 个自然日各 spin 至少 1 次 | +1 | 每个连胜周期到第 3 天发一次;断签后重新连可再得 | `api/lottery/spin` |

---

## 二、可提现 USDC 从哪来

| # | 机制 | 触发 | 发放 | 预算 / 频率 | 防刷点 | 代码 |
|---|------|------|------|-----------|--------|------|
| 抽奖 | 转盘中 USDC | 抽中 `usdc_*` 格 | $0.05 / $0.50 / $1 / $5 | 按转盘权重(见下) | 抽奖权重控制总成本 | `api/lottery/spin` |
| **#3** | 首抽必中 | 新用户**第一次** spin(此前无任何抽奖记录) | **$0.05**(直接进可提现) | 每个新号一次 = $0.05 | 仅"第一次 spin",按 `lottery_records` 是否为空判定 | `api/lottery/spin` |
| **#4** | 里程碑(3人) | 有 **3 个"有 USDC 余额"的被邀请人** | $1 | 一次性 | 被邀请人钱包必须 **链上 USDC > 0** 才计数 | `api/lottery/check-spins` |
| **#4** | 里程碑(10人) | 有 **10 个有余额的被邀请人** | $5(另加 5 spins) | 一次性 | 同上 | `api/lottery/check-spins` |
| **#5** | 每周邀请榜 | 每周结算上周邀请最多的前 3 名 | **$5 / $3 / $2** | 每周最多 $10 | 发奖按**链上核实**(只算有 USDC 余额的下线),榜单显示按原始邀请数 | cron `api/cron/lottery-leaderboard` |
| **#6** | 连胜 7 天 | 连续 7 个自然日各 spin | **$0.5** | 每 7 天一次/人 | 维持连胜需每天都有 spin(次数本身要靠赚) | `api/lottery/spin` |

### 转盘奖品权重(决定中奖成本)
`api/lottery/spin` 的 `PRIZES`(总权重 100):
- Try Again 40 · +$1 Bonus 20 · +$2 Bonus 10 · +$3 Bonus 5
- $0.50 USDC 15.45 · $1 USDC 7 · $5 USDC 2.5 · Premium Electronics 0.05
- 注:`$0.05 USDC` 不在常规权重里,**只有首抽(#3)强制中**,正常抽奖不会抽到。

---

## 三、每周邀请榜(#5)结算细节

- **定时**:`vercel.json` 里 cron `10 0 * * 1`(每周一 00:10 UTC)。
- **窗口**:上一个 ISO 周(周一 00:00 ~ 下周一 00:00 UTC)。
- **流程**:按上周新增下线数取前 15 名候选 → 逐个**读链上 USDC 余额**,只数"有余额"的下线 → 按有效数重排 → 前 3 名发 $5/$3/$2 进可提现。
- **去重**:`grant_reason='leaderboard_prize'` + 周键(上周一日期 YYYYMMDD),每人每周一次。
- **手动触发/重跑**:`curl -H "Authorization: Bearer <CRON_SECRET>" https://www.polnation.com/api/cron/lottery-leaderboard`(已发过的那周不会重复发)。
- ⚠️ **显示口径 ≠ 发奖口径**:榜单卡片为了即时/省成本,按"本周原始邀请数"排名;**真正发钱按链上有余额的下线核实**。所以可能出现"显示第1名但没拿到奖"(他邀请的全是空号)——这是有意的防刷,客服遇到要这样解释。

---

## 四、防刷设计汇总(客服/风控重点)

1. **里程碑 / 周榜只认"有 USDC 余额"的被邀请人**——纯注册空号刷不到现金。判定方式:被邀请人绑定钱包且**链上 USDC > 0**。
2. **晒中奖返 spin 每天封顶 1 次**——反复分享刷不出多余次数。
3. **首抽必中只认第一次**——靠 `lottery_records` 是否为空,清不掉。
4. **连胜需要每天真的有 spin**——而 spin 次数本身要靠邀请/空投/加群赚,维持 7 天连胜有真实成本。
5. **所有发放都有 grant 去重**(`lottery_spin_grants` 按 `grant_reason` + 里程碑/周/日期键),并发或重复请求不会双发;USDC 入账失败/重复有 23505 兜底。

### 仍存在的边界(知情即可)
- **Sybil(批量小号)**:有人可以注册多个号、各充一点 USDC 来凑里程碑/周榜。"有余额"抬高了门槛但不能根治。预算上限($1/$5/周榜$10)本身限制了损失。要更严可改成"被邀请人需签名/质押"。
- **首抽 $0.05 × 海量新号**:每个新号成本 $0.05,量大需配合注册风控(同设备/同 IP)。

---

## 五、可调参数(要改数值找开发)

| 想改什么 | 位置 |
|---------|------|
| 转盘奖品 / 概率 | `api/lottery/spin` 的 `PRIZES` 权重 |
| 首抽金额 | `api/lottery/spin` 首抽分支 `amount: 0.05` |
| 里程碑门槛 / 奖励 | `api/lottery/check-spins` 的 `MILESTONES` |
| 周榜奖金 | `api/lottery/leaderboard` 的 `PRIZES = [5,3,2]` |
| 周榜结算时间 | `vercel.json` 的 cron `schedule` |
| 连胜门槛 / 奖励 | `api/lottery/spin` 连胜分支(`=== 3`、`=== 7`、`0.5`) |
| 分享返奖频率 | `api/lottery/share-bonus`(当前按日去重) |
| 联系客服链接 | 代码内 `https://t.me/polnationsupport` |

---

## 六、依赖 / 部署清单(已完成)

- 迁移:`supabase/lottery-streak-schema.sql`(连胜字段)——**已执行**。
- 环境变量:`CRON_SECRET`(周榜 cron 鉴权,与 alpha cron 共用)——**已确认**。
- cron:`/api/cron/lottery-leaderboard`(周一 00:10 UTC),Vercel 部署后自动注册。
- 文案:用户侧全部 **14 语言**(`app/lottery-mini/i18n.ts`)。

> 未做:#6 限时翻倍事件 + TG 群广播(已决定暂缓)。需要时再开。
