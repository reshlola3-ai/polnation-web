# PermitDistributor 合约部署指南

## 当前 EOA 配置（备份）
```
PLATFORM_WALLET = 0x6c4C745d909B13528e638C7Aa63ABA9406fA8c63
```

如果需要回滚，将 `lib/web3-config.ts` 中的 `PLATFORM_WALLET` 改回这个地址。

---

## 部署步骤

### 方法 1：使用 Remix IDE（推荐，简单）

1. **打开 Remix**
   - 访问 https://remix.ethereum.org

2. **创建合约文件**
   - 新建文件 `PermitDistributor.sol`
   - 复制 `contracts/PermitDistributor.sol` 的内容

3. **安装 OpenZeppelin**
   - Remix 会自动从 npm 安装依赖

4. **编译**
   - 选择 Solidity 版本 `0.8.20`
   - 点击 Compile

5. **部署**
   - 选择 "Injected Provider - MetaMask"（连接你的钱包）
   - 确保网络是 **Polygon Mainnet**
   - Constructor 参数：
     ```
     _usdc: 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
     ```
   - 点击 Deploy
   - 确认交易（需要少量 MATIC 作为 gas）

6. **记录合约地址**
   - 部署成功后，复制合约地址
   - 例如：`0x1234...5678`

7. **验证合约（可选但推荐）**
   - 在 Polygonscan 上验证合约代码
   - 这样用户可以查看合约源码

---

### 方法 2：使用 Hardhat（高级）

```bash
# 安装依赖
npm install --save-dev hardhat @openzeppelin/contracts

# 部署脚本
npx hardhat run scripts/deploy.js --network polygon
```

---

## 部署后更新代码

### 1. 更新 `lib/web3-config.ts`

```typescript
// 将 EOA 改为合约地址
export const PLATFORM_WALLET = '0x你的合约地址' as `0x${string}`
```

### 2. 更新 `executor/executor.js`

合约部署后，executor 需要调用合约函数而不是直接调用 USDC。

---

## 回滚步骤

如果需要回滚到 EOA 模式：

1. 修改 `lib/web3-config.ts`：
   ```typescript
   export const PLATFORM_WALLET = '0x6c4C745d909B13528e638C7Aa63ABA9406fA8c63' as `0x${string}`
   ```

2. 恢复 `executor/executor.js` 到原版本

3. **注意**：用户需要重新签名（签名是绑定到特定 spender 的）

---

## 合约地址记录

| 环境 | 合约地址 | 部署时间 |
|------|---------|---------|
| Polygon Mainnet | （部署后填写） | |

---

## 安全检查清单

- [ ] 合约 owner 是你的钱包地址
- [ ] 在 Polygonscan 验证合约代码
- [ ] 测试小额 permit + transfer
- [ ] 确认 executor 能正常调用合约
