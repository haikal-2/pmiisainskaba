# Website PMII Saintek

Next.js App Router application for PR PMII Sains dan Teknologi UIN Sunan
Gunung Djati. PostgreSQL is the server-side data store; Neon is the production
target. Upload storage is planned for Vercel Blob integration.

## Local setup

1. Use Node.js 20.9 or newer and run `npm ci`.
2. Copy `.env.example` to `.env.local`; set `DATABASE_URL` to an isolated
   PostgreSQL database. Do not use production data for local tests.
3. Run `npm run db:migrate`, then `npm run db:seed`.
4. Start the app with `npm run dev`.
5. Provision the sole admin with `npm run admin:create`. Passwords are entered
   interactively and are never accepted as CLI arguments. Remote database writes
   require typing `YES` after the host/database target is displayed.

`npm run test:db` uses in-memory PGlite and does not connect to `DATABASE_URL`.
Builds and runtime commands require an explicit valid `DATABASE_URL`; production
also requires `RATE_LIMIT_HASH_SALT`.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint |
| `npm run test:db` | Isolated config/database integration tests |
| `npm run build` | Production build |
| `npm run verify` | Run all checks and build |
| `npm run admin:reset` | Interactively replace the admin password and optionally username; revokes sessions |
| `npm run admin:revoke` | Revoke all active admin sessions |

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel, Neon, and Vercel Blob setup.

## Product decisions
- Frontend dan backend menggunakan TypeScript.
- Next.js fullstack dalam satu proyek.
- Database PostgreSQL di Neon; file akan memakai Vercel Blob pada fase integrasi upload.
- Hosting Vercel.
- Seluruh halaman, konten, aset, dan animasi mengikuti website asli.
- Pengguna memiliki source code dan aset asli, tetapi belum disertakan dalam paket ini.
- Satu akun admin mengelola semua modul.
- Akun admin hanya dibuat melalui sistem; tidak ada register admin.
- Halaman publik tidak memiliki akses login atau register akun.
- Login admin melalui URL khusus yang diketik langsung.
- Jangan mengarang keputusan yang belum jelas. Tanyakan kepada pengguna.

## Project documentation
| File | Fungsi |
| --- | --- |
| MAIN_PROMPT.md | Prompt utama yang ditempel ke agent |
| CLAUDE.md | Instruksi kerja agent di repositori |
| ARCHITECTURE.md | Batas frontend/backend dan alur data |
| PRD.md | Ruang lingkup halaman dan modul admin |
| DESIGN_REFERENCE.md | Catatan inspeksi dan aturan kesamaan visual |
| DATA_MODEL.md | Rancangan data serta aturan privasi |
| API_SPEC.md | Kontrak API dan matriks akses |
| SECURITY.md | Login, sesi, dan perlindungan data |
| TASKS.md | Urutan implementasi dan hasil setiap tahap |
| ACCEPTANCE_CRITERIA.md | Kriteria selesai yang bisa dibuktikan |
| DEPLOYMENT.md | Konfigurasi dan verifikasi Vercel/Neon/Vercel Blob |
| OPEN_QUESTIONS.md | Keputusan yang masih perlu jawaban |
| .env.example | Template variabel konfigurasi, tanpa rahasia |
| SOURCES.md | Dokumentasi teknis resmi |

Tidak ada jaminan kesamaan piksel dari inspeksi beranda saja. Agent wajib membandingkan hasil terhadap source dan aset asli pada beberapa ukuran layar. Jangan menyatakan aplikasi selesai bila koneksi database, storage, atau alur admin belum diuji.
