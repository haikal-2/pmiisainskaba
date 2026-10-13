import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Login, sesi, dan API membutuhkan runtime Node. Static export tidak dipakai.
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
  },
  // Modul native / berat tetap di luar bundel server agar tidak di-bundle ulang.
  // @composio/core ESM-only dan memakai subpath `imports` (#platform, #files),
  // yang tidak dapat di-bundle dengan aman oleh Turbopack/webpack.
  serverExternalPackages: ['pg', '@node-rs/argon2', 'googleapis', '@composio/core'],
  // Jangan pernah mengirim header internal ke klien.
  logging: { fetches: { fullUrl: false } },
  async redirects() {
    // Permanen (301): URL .html dari situs lama dipetakan ke route Next.js
    // untuk mempertahankan ranking/backlink di mesin pencari.
    const legacy: Array<[string, string]> = [
      ['/index.html', '/'],
      ['/advokasi.html', '/advokasi'],
      ['/galeri.html', '/galeri'],
      ['/kopri.html', '/kopri'],
      ['/landasan-hukum.html', '/landasan-hukum'],
      ['/mapaba.html', '/mapaba'],
      ['/profil/sejarah.html', '/profil/sejarah'],
      ['/profil/struktur.html', '/profil/struktur'],
    ];
    return legacy.map(([source, destination]) => ({
      source,
      destination,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        // Halaman privat: tidak diindeks, tidak di-cache.
        source: '/:adminPath((?!api|_next|assets).*)',
        has: [{ type: 'header', key: 'x-pmii-private' }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
      },
      {
        source: '/assets/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;

