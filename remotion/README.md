# Polnation 推广视频（Remotion）

竖屏 9:16 · 1080×1920 · 30fps · 20 秒。

## 预览 / 导出（在这个 `remotion/` 目录下运行）

```bash
cd remotion
npm install

# 浏览器里实时预览、改参数
npm run studio        # 打开 http://localhost:3000

# 导出 MP4 → out/polnation-promo.mp4
npm run render

# 导出单帧封面 → out/frame.png
npm run still
```

> 注意：Remotion 渲染要下载一次 Chromium（首次 render 会自动装）。
> 如果本地代理拦 localhost，用 `127.0.0.1:3000` 打开 studio。

## 分镜（20s）

| 时间 | 镜头 | 文件 |
|---|---|---|
| 0–3s | 品牌 + 每日到账余额跳动 | `src/beats/Hero.tsx` |
| 3–7s | Alpha Trading bots 24/7 + **可核对交易** | `src/beats/Bots.tsx` |
| 7–10s | Hold USDC · Paid daily · No lock-up | `src/beats/NoLock.tsx` |
| 10–13s | Stake to earn more（日利率上跳） | `src/beats/Stake.tsx` |
| 13–16.5s | Grow your team · Earn together（裂变） | `src/beats/Team.tsx` |
| 16.5–20s | Join Polnation · polnation.com | `src/beats/Cta.tsx` |

## 改文案 / 数字

- 品牌名、slogan、URL：`src/theme.ts` 的 `BRAND`
- 配色：`src/theme.ts` 的 `COLORS`
- 各镜头起止帧：`src/theme.ts` 的 `BEATS`
- 交易哈希/PnL 示例：`src/beats/Bots.tsx` 顶部 `TRADES`
- 每日收益数字（+$12.90）：`src/beats/Hero.tsx` 的 `target`

## 加背景音乐

把 `music.mp3` 放进 `remotion/public/`，然后在 `src/PromoVideo.tsx` 取消 `<Audio>` 那两行的注释。
