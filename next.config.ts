import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // 压缩优化
  compress: true,
  
  // 图片优化
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },
  
  // 实验性优化
  experimental: {
    optimizeCss: true,
  },
  
  // 重定向旧路由到新的Team页面
  async redirects() {
    return [
      {
        source: '/community',
        destination: '/team',
        permanent: true,
      },
      {
        source: '/referral',
        destination: '/team',
        permanent: true,
      },
      // Legal page aliases — external backlinks / SEO crawlers may
      // use these "standard" slugs. Map to our real pages.
      {
        source: '/terms-of-use',
        destination: '/terms',
        permanent: true,
      },
      {
        source: '/legal-terms',
        destination: '/terms',
        permanent: true,
      },
      {
        source: '/privacy-policy',
        destination: '/privacy',
        permanent: true,
      },
    ];
  },

  // 自定义响应头
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
