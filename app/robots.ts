import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://www.polnation.com'
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/auth/',
          '/_next/',
          // 需要登录的页面 - 禁止爬取（会被重定向）
          '/dashboard/',
          '/profile/',
          '/referral/',
          '/tasks/',
          '/earnings/',
          '/community/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
