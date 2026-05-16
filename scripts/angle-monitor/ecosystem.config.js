// pm2 config — run: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name:          'angle-monitor',
      script:        'npx',
      args:          'tsx scripts/angle-monitor/index.ts',
      restart_delay: 5000,
      max_restarts:  50,
      env: {
        NODE_ENV:        'production',
        ALCHEMY_API_KEY: 'EPSkgE2Y0OHmmJnMwU8KX',
        TG_BOT_TOKEN:    '8986937867:AAHBor_6yVvhQv51ZRpEZHc9fGbDYfxye8I',
        TG_CHAT_ID:      '-1003548662779',
        MIN_USDC:        '10',
      },
    },
  ],
}
