import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Login, sesi, dan API membutuhkan runtime Node. Static export tidak dipakai.
  reactStrictMode: true,
  poweredByHeader: false,
  // Modul native / berat tetap di luar bundel server agar tidak di-bundle ulang.
  serverExternalPackages: ['pg', '@node-rs/argon2', 'googleapis'],
  // Jangan pernah mengirim header internal ke klien.
  logging: { fetches: { fullUrl: false } },
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
