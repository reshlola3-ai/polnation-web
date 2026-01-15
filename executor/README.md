# Polnation Permit Executor

执行用户的 Permit 签名，转移 USDC 到平台钱包。

## ⚠️ 安全警告

- **私钥** 只存储在本地 `.env` 文件中
- **不要** 将 `.env` 上传到 GitHub
- **不要** 分享 `.env` 给任何人

## 安装

```bash
cd executor
npm install
```

## 配置

1. 复制环境变量示例文件：

```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入真实值：

```env
# Supabase 配置
SUPABASE_URL=https://kifssxrhnqtseqnjsuby.supabase.co
SUPABASE_SERVICE_KEY=sb_secret_xxxxx  # 从 Supabase 获取 Secret key

# 平台钱包私钥 (必须有 MATIC 用于 gas)
PRIVATE_KEY=0x你的私钥

# 执行模式
MODE=dry-run  # 先用 dry-run 测试
```

## 使用

### 检查模式（推荐先运行）

```bash
npm run check
```

只检查签名有效性，不执行任何交易。

### 执行模式

```bash
# 修改 .env 中的 MODE=execute
npm start
```

真正执行 permit + transferFrom。

## 工作流程

```
1. 从 Supabase 获取 status='pending' 的签名
2. 验证每个签名：
   - 检查 deadline 是否过期
   - 检查 nonce 是否匹配
   - 检查用户 USDC 余额
3. 执行 permit() 授权
4. 执行 transferFrom() 转移 USDC
5. 更新签名状态为 'used'
```

## 注意事项

1. **Gas 费用**：执行钱包需要有足够的 MATIC 支付 gas
2. **RPC 限制**：公共 RPC 可能有速率限制，建议使用 Alchemy/Infura
3. **签名过期**：permit 签名有 deadline，过期后无效
4. **Nonce**：如果用户在签名后进行了其他 permit 操作，签名会失效

## 获取 Supabase Service Key

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目
3. Settings → API → Secret keys
4. 复制 `sb_secret_xxxxx` 开头的 key

## 推荐的私有 RPC

- [Alchemy](https://alchemy.com) - 免费额度
- [Infura](https://infura.io) - 免费额度
- [QuickNode](https://quicknode.com)
