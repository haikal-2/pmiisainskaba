import type { MetadataRoute } from 'next';

/**
 * Sitemap dinamis dengan URL route Next.js yang sebenarnya.
 * robots.txt menunjuk ke /sitemap.xml — file ini yang disajikan.
 * Tanggal lastmod diubah saat konten halaman diperbarui.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL || 'http://localhost:3000';
  const lastModified = new Date();
  const pages: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/mapaba', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/advokasi', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/galeri', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/kopri', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/profil/sejarah', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/profil/struktur', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/landasan-hukum', priority: 0.6, changeFrequency: 'yearly' },
  ];
  return pages.map((page) => ({
    url: `${base}${page.path}`,
    lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
