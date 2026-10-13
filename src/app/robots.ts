import type { MetadataRoute } from 'next';

/**
 * robots.txt dinamis — Sitemap mengikuti APP_URL sehingga tidak ada
 * domain yang di-hardcode (lokal = localhost, produksi = domain Vercel/kustom).
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL || 'http://localhost:3000';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/uploads/', '/api/'],
      },
      {
        userAgent: 'AhrefsBot',
        crawlDelay: 10,
        allow: '/',
        disallow: ['/admin/', '/uploads/', '/api/'],
      },
      {
        userAgent: 'SemrushBot',
        crawlDelay: 10,
        allow: '/',
        disallow: ['/admin/', '/uploads/', '/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
