# PolnationAlpha 2.0 — 部署指南（LP 控制合约包层）

> 目标：用户资金进 Uniswap V3 (USDC/USDT 0.01%)，LP NFT 由 **PolnationAlphaV2** 持有。  
> 部署后通过 `authorizeLpOperator` 把 NFPM `setApprovalForAll` 授给 **AlphaLpController**。  
> **Controller owner ≡ 完整 LP 资金控制权**（decrease / collect / reclaim NFT）。建议用 Safe 多签。

---

## 信任模型（诚实）

| 角色 | 权限 |
|------|------|
| PolnationAlphaV2 | NFT **owner**；用户 claim/compound 走合约内加减仓；`pause`（若未 renounce） |
| AlphaLpController | NFPM **operator**（对 V2 的 setApprovalForAll）；可抽流动性、`reclaimLpNft` 把 NFT 转到自己 |
| Controller owner | 上述全部后门的控制者 — **不是** true-defi「无人能撤本金」 |

授权必须在 NFT 转入 V2 **之后**由 V2 调用（按当前 owner 记账）。部署者在 transfer 前自己 `setApprovalForAll` **无效**。

---

## 已锁定参数

| 项 | 值 |
|----|-----|
| 链 | Polygon 主网 (chainId 137) |
| 池子 | Uniswap V3 USDC/USDT **0.01%** — `0x31083a78e11b18e450fd139f9abea98cd53181b7` |
| 质押币 | 原生 USDC `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` (6 dec) |
| 根 username | `alpha`（= root 钱包 = 手续费钱包） |
| 手续费 | deposit **7%** / compound **3%** → root 钱包 |
| 最低质押 | **$100**（所有档） |
| 计划 | 15d 4.5% / 30d 33% / 60d 70% / 90d 120% / 300d 400% |
| 提前退出 | **无** — 锁仓至到期，只能到期 claim / compound |
| 推荐 | 10 层 `10/8/6/4/2/1/1/1/1/1`%；L1-3 自有≥$100，L4-10 需 2~8 合格直推 |
| 团队长 | 7 级差额，封顶 10%（门槛照搬 TURBOLOOP） |
| claim/compound 最低 | **$5** |
| 每钱包仓位上限 | **50** |
| 推荐资格 | 活跃质押 ≥ **$10** |
| V2 owner | `pause` / `authorizeLpOperator` / `revokeLpOperator`；可选 `renounceOwnership()`（**不**影响已授权的 controller） |
| Controller | 完整 LP 运维 + 紧急出口 |
| 事后加池 | 任何人可调 `topUpLiquidity(usdcAmount)`（只能加；renounce 后仍可用） |

---

## 前置准备

`contracts/.env`：
```
PRIVATE_KEY=你的私钥（不带0x，这个钱包会成为 root/手续费/推荐根）
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGONSCAN_API_KEY=你的key
```

钱包里要有：
- **POL**（gas，~1-2 POL 足够）
- **种子流动性**：USDC + USDT 各约 **$1000**（可调，见下）
- 想用别的钱包收手续费/当根：设 `ROOT_WALLET=0x...`
- 想把 controller 交给多签：设 `CONTROLLER_OWNER=0x...`（Safe 地址）

---

## 第 1 步 — 编译

```bash
cd contracts
npm install
npx hardhat compile
```
期望：`Compiled ... successfully`

---

## 第 2 步 — 一键部署（mint + V2 + controller + 授权）

脚本会自动：

1. Mint LP 头寸  
2. 部署 `PolnationAlphaV2`  
3. 部署 `AlphaLpController`（可选 `transferOwnership` → `CONTROLLER_OWNER`）  
4. 把 NFT 转进 V2  
5. `V2.authorizeLpOperator(controller)`  

```bash
# 可选环境变量：
#   SEED_USDC / SEED_USDT  种子金额（human，默认 1000）
#   RANGE_BPS              区间半宽 bps（默认 20 = ±0.2%）
#   ROOT_WALLET            手续费+推荐根（默认部署者）
#   CONTROLLER_OWNER       AlphaLpController owner（默认部署者；建议 Safe）
#   RENOUNCE=true          仅放弃 V2 owner（默认 false；永不 renounce controller）

npx hardhat run scripts/deploy-polnation-alpha-v2.js --network polygon
```

输出会给你：
- `PolnationAlphaV2 deployed to: 0x...`
- `AlphaLpController deployed to: 0x...`
- `isApprovedForAll(V2, controller): true`
- verify 命令
- `.env.local` 变量

---

## 第 3 步 — 验证合约（公开源码）

复制脚本输出的两条 verify 命令，例如：
```bash
npx hardhat verify --network polygon <V2地址> \
  0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 \
  0xC36442b4a4522E871399CD717aBDD847Ab11FE88 \
  <tokenId> true <usdcToLiquidityRate> <rootWallet>

npx hardhat verify --network polygon <Controller地址> \
  0xC36442b4a4522E871399CD717aBDD847Ab11FE88 \
  <tokenId> \
  0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 \
  0xc2132D05D31c914a87C6611C10748AEb04B58e8F
```

---

## 第 4 步 — （可选）放弃 V2 owner

若部署时没加 `RENOUNCE=true`，稳定后可手动对 **V2** 调 `renounceOwnership()`。  
调用后 V2 不可再 `pause` / `revokeLpOperator`，但 **controller 仍可** 管理 LP。

**不要** renounce `AlphaLpController`，除非你有意放弃全部控制权。

---

## 第 5 步 — 前端接线

`g:\polnation\.env.local`：
```
NEXT_PUBLIC_POLNATION_ALPHA_V2_ADDRESS=<V2合约地址>
NEXT_PUBLIC_POLNATION_ALPHA_V2_LP_TOKEN_ID=<tokenId>
NEXT_PUBLIC_POLNATION_ALPHA_V2_CONTROLLER=<Controller地址>
```
然后改前端（AlphaClient / admin / API）指向新合约。

---

## 资金流向（Polygonscan 可验证）

```
质押：  User → PolnationAlphaV2 → NFPM.increaseLiquidity → Uniswap V3 Pool
                              └→ 7% USDC → ROOT_WALLET（透明手续费）
领取：  Pool → NFPM.decreaseLiquidity/collect → User（仅到期；V2 以 owner 调用）
补池：  Anyone → topUpLiquidity → NFPM.increaseLiquidity（无仓位、无领取权）
运维：  AlphaLpController → NFPM.decreaseLiquidity/collect/reclaimLpNft（operator）
```

---

## Controller 常用操作（owner）

| 函数 | 作用 |
|------|------|
| `decreaseLiquidity` / `collect` | 减仓并收款 |
| `emergencyExit(to)` | 清空流动性并 collect 到 `to` |
| `reclaimLpNft()` | 把 NFT 从 V2 转到 controller（需已 authorize） |
| `transferLpNft(to)` | NFT 已在 controller 上时再转出 |
| `increaseLiquidity` | 运维补仓（先把 USDC/USDT 打进 controller） |
| `emergencyWithdrawTokens` | 清出卡在 controller 上的 ERC20 |

---

## 诚实风险（内部）

- 高 ROI（最高 300d 400%）+ 35% 推荐 + 10% 团队长 → 池子靠**新入金**支撑。
- Controller owner 能抽本金 — 对外勿再宣称「无人可撤」。
- 7% deposit 费使仅 93% 进池，加速消耗。
- 这是 TURBOLOOP 同类模型。

---

## 合约/脚本位置

- 质押合约：`contracts/src/PolnationAlphaV2.sol`
- 控制合约：`contracts/src/AlphaLpController.sol`
- 部署脚本：`contracts/scripts/deploy-polnation-alpha-v2.js`
