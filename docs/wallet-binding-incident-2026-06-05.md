# 钱包绑定错乱事故复盘 + 根治（2026-06-05）

> 从「在 admin 端做一个利润提现历史」一路挖到的一个真实数据事故：用户的
> profile 钱包地址被悄悄改掉，导致「提现到的钱包」和「当前绑定的钱包」对不上。
> 本文记录完整的发现过程、根因、以及最终的根治方案。

---

## 1. 起因：提现历史里发现「钱包对不上」

需求本来是给 admin 端做一个全站**利润提现历史**页面（谁在提、提了多少）。做好之后，
管理员在排查一笔提现时发现一个矛盾：

| 看到的地方 | 钱包地址 |
|---|---|
| 用户 profile 当前绑定 | `0x1c4edd8f…04e0`（记为 **0x1c4e**） |
| 该用户的提现记录 | `0x02772c5e…d625`（记为 **0x0277**） |

同一个账号，profile 上绑的钱包，和提现实际打款的钱包，是**两个不同地址**。

涉事账号：
- `id = 51943167-27af-45ad-bd34-00a3a1f521c6`
- `username = user_02772c`，`email = akifnaqeeb512@gmail.com`

---

## 2. 第一层线索（看代码就能得出）

- **用户名能证明原始钱包**：钱包登录注册时用户名按 `user_${wallet.slice(2,8)}` 生成
  （`app/api/auth/wallet-login/route.ts`）。`0x` **`02772c`** `5e…` → 用户名 `user_02772c`。
  所以这账号**最初的钱包就是 0x0277**。
- **提现存的是「提现当时」的钱包快照**：提现接口把 `profiles.wallet_address` 直接写进
  提现记录（`app/api/withdraw/route.ts`），且没钱包会被拦截。说明**提现那一刻 profile 绑的就是 0x0277**，钱发对了。
- **0x1c4e 是后来才换上去的**：`wallet_bound_at` 比提现时间晚了约 3 小时。

第一层结论：提现没发错，但 profile 的钱包在提现之后被换成了 0x1c4e。

---

## 3. 第一个（错误的）判断

我把全部 6 处会写 `wallet_address` 的代码都查了一遍，发现它们**都有保护：只在钱包为空时才写，不覆盖**；代码里也**没有任何解绑 / 清空钱包的入口**。
据此我一度判断：**这只可能是有人在 Supabase 后台手动改了库。**

**这个判断是错的。** 管理员当场否认：「绝对不是手动改库，是他自己换的，我们只是没发现他是怎么改的。」——这把调查重新拉回了代码。

---

## 4. 查库取证

用 Supabase SQL Editor 查这个 `user_id`，拿到真实数据（库里时间为 UTC）：

**profiles（账号 A）**
- `wallet_address = 0x1c4e…04e0`，`wallet_bound_at = 2026-06-04 17:10:57`，`updated_at = 17:10:57`
- `created_at = 2026-06-03 05:34:10`

**permit_signatures**
- 仅一条：`owner_address = 0x0277…d625`，`2026-06-03 05:39:26`，`pending`

**withdrawals**
- `2026-06-04 13:52:35`　$5.50 USDC　completed　→ `0x0277`
- `2026-06-03 11:41:03`　$5.50 POL 　completed　→ `0x0277`

进一步查「没签名的钱包 0x1c4e 有没有注册过」，发现**它自己是一个独立账号**：

**账号 B（0x1c4e 用钱包登录建的）**
- `id = 4b5c36b2-5e2d-4062-b163-b91db88938ed`
- `username = user_1c4edd`，`email = 1c4edd8f@wallet.polnation.com`
- `auth.users`：`auth_type = wallet`，`meta_wallet = 0x1c4e`，`created_at = 2026-06-04 17:04:22`
- 当前钱包又是**第三个地址** `0x2d14…f6d3`（17:08:04 绑的）
- 体检：**无上线、无下线、无提现、无利润余额** → 空壳小号

---

## 5. 完整时间线（北京时间）

| 时间 | 事件 | 钱包 |
|---|---|---|
| 06-03 13:34 | 账号 A 创建（钱包登录） | 0x0277 |
| 06-03 13:39 | 账号 A 用 0x0277 签 permit | 0x0277 |
| 06-03 19:41 / 06-04 21:52 | 账号 A 两笔提现 ✅ | → 0x0277 |
| 06-05 01:04:22 | 用 **0x1c4e** 钱包登录 → 新建空壳**账号 B** | 0x1c4e |
| 06-05 01:08:04 | 账号 B 绑上第三个钱包 0x2d14 | 0x2d14 |
| 06-05 01:10:42 | 账号 B 最后登录 | — |
| **06-05 01:10:57** | **账号 A 的钱包被覆盖成 0x1c4e** | 0x0277 → **0x1c4e** |

一个人手握 3 个钱包（0x0277 / 0x1c4e / 0x2d14）、2 个账号，在凌晨几分钟内反复连钱包，
把主账号 A 的钱包搞乱了。

---

## 6. 真正的根因：profile 页 `autoBindWallet` 缺一道判断

`app/(dashboard)/profile/page.tsx` 里「钱包连上后自动绑定」的旧逻辑：

```js
// 只检查「这个新钱包有没有被别人占用」
const { data: existingProfile } = await supabase
  .from('profiles').select('id')
  .eq('wallet_address', normalizedAddress)   // 查的是「新地址」属于谁
  .single()

if (existingProfile && existingProfile.id !== user.id) {
  setError('已被别人绑定'); return
}

// 只要没别人占，就直接写进当前账号 —— 从没检查「我自己是不是已经绑过别的钱包」
if (!existingProfile) {
  await supabase.from('profiles')
    .update({ wallet_address: normalizedAddress, wallet_bound_at: now })
    .eq('id', user.id)   // ← 直接覆盖当前账号的钱包
}
```

两个缺陷叠加：

1. 这段**只问「新地址有没有被别人占」，从不问「当前账号是不是已经绑了钱包」**。
   只要新钱包没被别人占，就直接覆盖当前账号的绑定。
2. 唯一像防线的 `if (profile?.wallet_address) return` 读的是**前端 React 的 `profile` 状态**，
   而这个 effect 依赖 `[address]`、钱包一连上就触发，此时 `loadProfile()` 可能还没跑完、
   `profile` 还是 `null` → **竞态绕过防线**，落到上面的覆盖逻辑。

复现完全吻合：用户登录着账号 A，在 profile 页连上 0x1c4e；那一刻 0x1c4e 没被任何 profile 占用
（账号 B 当时已改绑 0x2d14）→ 缺判断的代码把 A 的钱包从 0x0277 覆盖成 0x1c4e，
`wallet_bound_at = new Date()` = `01:10:57`。

**其余 5 个绑钱包入口**（ConnectWallet、PermitSigner、bind-wallet API、profits/user、admin sync）
**都先查「我自己有没有绑过钱包」，有就不覆盖** —— 唯独 profile 页这条漏了。

---

## 7. 即时处置

把账号 A 的 `wallet_address` 改回签名地址 `0x0277`（它唯一密码学验证过的钱包），
让 profile 钱包 = 签名钱包 = 提现钱包三者一致。空壳账号 B 不影响，留置不动。

```sql
update profiles
set wallet_address = '0x02772c5e3d8707f84c076656b52be09a9909d625',
    wallet_bound_at = '2026-06-03 05:39:26+00'
where id = '51943167-27af-45ad-bd34-00a3a1f521c6';
```

---

## 8. 根治方案（已实现并上线）

定下的策略：**钱包绑定后永久不可变（谁都不能改）+ 全程审计留痕**。
关键思路：**把防线从「App 代码」下沉到「数据库」**——App 代码会有 bug，数据库约束不会被绕过。

提交：`fix(wallet): make wallet binding immutable + audit trail`

| 层 | 改动 | 文件 |
|---|---|---|
| **数据库** | `BEFORE UPDATE` 触发器：已绑钱包改成别的地址（或改回空）一律 `RAISE EXCEPTION`，**前端 bug / API / 手动 SQL 全拦**。`AFTER` 触发器：钱包从空→有值时自动记一条 `bound`（覆盖所有入口）。新增 `wallet_binding_audit` 审计表（RLS，仅服务端可读写） | `supabase/wallet-immutability.sql` |
| **修 bug** | profile 页不再前端直接写库，改走有防护的 `POST /api/profile/bind-wallet`，消除竞态；已绑再连新钱包时给出「不可更换」的明确提示 | `app/(dashboard)/profile/page.tsx` |
| **接口** | 同地址幂等成功；拦截换绑尝试时记 `change_blocked` 审计（旧 / 想换的新 / 来源）+ 清晰错误码 | `app/api/profile/bind-wallet/route.ts` |
| **后台** | 用户详情页新增「Wallet Binding Audit」区块，首次绑定 + 被拦的换绑尝试都能看到 | `app/(admin)/admin/users/[userId]/page.tsx`、`app/api/admin/users/[userId]/route.ts` |

> ⚠️ 代码上线后，**必须在 Supabase → SQL Editor 手动运行一次 `supabase/wallet-immutability.sql`**，
> 数据库层的不可变约束 + 审计表才会生效。（已执行。）

---

## 9. 如何验证铁闸生效

对任意已绑钱包的账号执行一条改钱包的 update，应当**直接报错、不生效**：

```sql
update profiles set wallet_address = '0x0000000000000000000000000000000000000001'
where id = '51943167-27af-45ad-bd34-00a3a1f521c6';
-- 期望：ERROR  wallet_address is immutable once bound (...)
```

---

## 10. 经验教训

- **「代码上看起来不可能」≠「没发生」**：所有写入点都有保护，不代表数据不会变 ——
  漏掉一个**前端竞态 + 缺判断**就够了。先穷尽客户端时序问题，再下「手动改库」的结论。
- **校验只放在客户端 = 没有校验**：真正的不变量要靠**数据库约束 / 触发器**兜底。
- **同一个不变量散落在 6 个入口** = 迟早有一个漏。能在 DB 层集中表达的约束，就别靠每个调用点自觉。
- **审计要趁早**：这次能还原全过程靠的是 `permit_signatures`、`withdrawals`、`auth.users` 的时间戳；
  现在补上了 `wallet_binding_audit`，以后这类问题一眼可查。
