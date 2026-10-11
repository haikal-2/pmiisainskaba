# Dokumentasi teknis resmi

Diperiksa pada 11 Oktober 2026. Agent harus memeriksa ulang saat implementasi dan memilih versi yang kompatibel.

- Next.js App Router: https://nextjs.org/docs/app
- Next.js Route Handlers: https://nextjs.org/docs/app/api-reference/file-conventions/route
- Batas server/client dan server-only: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Backend for Frontend dan batas static export: https://nextjs.org/docs/app/guides/backend-for-frontend
- Neon PostgreSQL connections: https://neon.tech/docs/connect/connect-from-any-app
- Neon connection pooling: https://neon.tech/docs/connect/connection-pooling
- Vercel Blob: https://vercel.com/docs/storage/vercel-blob
- Vercel Blob private stores: https://vercel.com/docs/storage/vercel-blob/private-storage
- Vercel Functions limitations: https://vercel.com/docs/functions/limitations
- Vercel direct uploads terkait body limit: https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions

Prinsip yang dipakai: backend Next.js membutuhkan runtime server; data berprivilege tetap di server; koneksi database sesuai serverless; file private memerlukan kontrol akses; upload besar tidak dikirim melalui fungsi dengan batas body.

Catatan UI berasal dari pemeriksaan browser terhadap website referensi, bukan dokumentasi penyedia. Backend asli belum diketahui dan tidak diklaim sama.
