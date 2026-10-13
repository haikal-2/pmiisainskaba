# Website PMII Saintek

Next.js App Router application for PR PMII Sains dan Teknologi UIN Sunan
Gunung Djati. PostgreSQL is the server-side data store; Neon is the production
target. Private uploads (pas foto & KTM) go through one storage abstraction
with two explicit drivers:

| Driver | When | Notes |
| --- | --- | --- |
| `blob` | production, or whenever `BLOB_READ_WRITE_TOKEN` is set | Vercel Blob private; missing credentials fail loudly (503), never fall back to disk |
| `local` | non-production only | `.local-uploads/`; never emits a URL, the database stores a canonical pathname |

References are opaque: `media_asset.object_key` and the upload API response hold
`mapaba-private/<48 hex>/<pasFoto|ktm>`, never a `local-upload:/` scheme or a signed
Blob URL. `src/server/storage/reference.ts` is the single place that validates them.

## Local setup

1. Use Node.js 20.9 or newer and run `npm ci`.
2. Copy `.env.example` to `.env.local`; set `DATABASE_URL` to an isolated
   PostgreSQL database. Do not use production data for local tests.
3. Run `npm run db:migrate`, then `npm run db:seed`.
4. Start the app with `npm run dev`.
5. Provision the sole admin with `npm run admin:create`. Passwords are entered
   interactively and are never accepted as CLI arguments. Remote database writes
   require typing `YES` after the host/database target is displayed.

`npm run test:db` and `npm run test:mapaba` use in-memory PGlite and never connect to `DATABASE_URL`: both run with `--env-file=tests/empty.env` so `.env.local` is not loaded.
Builds and runtime commands require an explicit valid `DATABASE_URL`; production
also requires `RATE_LIMIT_HASH_SALT`, and private uploads require `BLOB_READ_WRITE_TOKEN`.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint |
| `npm run test:db` | Isolated config/database integration tests (PGlite) |
| `npm run test:mapaba` | End-to-end MAPABA flow, outbox worker, and storage driver tests (PGlite) |
| `npm run build` | Production build |
| `npm run verify` | Run all checks, tests, and build |
| `npm run admin:reset` | Interactively replace the admin password and optionally username; revokes sessions |
| `npm run admin:revoke` | Revoke all active admin sessions |

Server-side logging is structured (one JSON line per event) and classifies each
failure by the dependency that caused it — `database`, `storage`, `google-sheets`,
`cron`, `validation`, or `internal` — so an incident can be traced from the client's
`X-Request-Id` to the owning component. Tokens, payloads, private object pathnames,
and personal data are never logged.

## Operational endpoints

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `/api/internal/health` | none; status only, never data | Per-dependency health: database, storage driver, cron secret, Sheets, Composio. 503 only when a critical dependency (database/storage) is down |
| `/api/internal/cron/dispatch-outbox` | `Authorization: Bearer $CRON_SECRET` | The only sender to Google Sheets. Rejects every request when `CRON_SECRET` is unset (fails closed) |
| `/api/admin/outbox` | admin session | List pending sync items and force a retry |

`vercel.json` schedules the cron worker every 5 minutes. Registration and advocacy
writes only insert an outbox row inside the same transaction as the main record, so
no user request waits on Google Sheets and nothing is delivered twice. The worker
claims rows with a lease it owns, retries with exponential backoff, and leaves any
failure visible to the admin.

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for Vercel, Neon, and Vercel Blob setup.

## Product decisions
- Frontend dan backend menggunakan TypeScript.
- Next.js fullstack dalam satu proyek.
- Database PostgreSQL di Neon; berkas privat memakai Vercel Blob, dengan driver lokal hanya untuk non-produksi.
- Hosting Vercel.
- Seluruh halaman, konten, aset, dan animasi mengikuti website asli.
- Pengguna memiliki source code dan aset asli, tetapi belum disertakan dalam paket ini.
- Satu akun admin mengelola semua modul.
- Akun admin hanya dibuat melalui sistem; tidak ada register admin.
- Halaman publik tidak memiliki akses login atau register akun.
- Login admin melalui URL khusus yang diketik langsung.
- Jangan mengarang keputusan yang belum jelas. Tanyakan kepada pengguna.

## Project documentation (folder `docs/`)
| File | Fungsi |
| --- | --- |
| [docs/MAIN_PROMPT.md](./docs/MAIN_PROMPT.md) | Prompt utama panduan proyek |
| [docs/CLAUDE.md](./docs/CLAUDE.md) | Instruksi kerja agen coding di repositori |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Batas frontend/backend dan alur data |
| [docs/PRD.md](./docs/PRD.md) | Ruang lingkup halaman dan modul admin |
| [docs/DESIGN_REFERENCE.md](./docs/DESIGN_REFERENCE.md) | Catatan inspeksi dan aturan kesamaan visual |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | Rancangan data serta aturan privasi |
| [docs/API_SPEC.md](./docs/API_SPEC.md) | Kontrak API dan matriks akses |
| [docs/SECURITY.md](./docs/SECURITY.md) | Login, sesi, dan perlindungan data |
| [docs/TASKS.md](./docs/TASKS.md) | Urutan implementasi dan status setiap tahap |
| [docs/ACCEPTANCE_CRITERIA.md](./docs/ACCEPTANCE_CRITERIA.md) | Kriteria penerimaan yang teruji |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Konfigurasi dan verifikasi Vercel/Neon/Vercel Blob |
| [docs/OPEN_QUESTIONS.md](./docs/OPEN_QUESTIONS.md) | Keputusan dan jawaban pengguna |
| [.env.example](./.env.example) | Template variabel konfigurasi, tanpa rahasia |
| [docs/SOURCES.md](./docs/SOURCES.md) | Dokumentasi teknis resmi |

Tidak ada jaminan kesamaan piksel dari inspeksi beranda saja. Agent wajib membandingkan hasil terhadap source dan aset asli pada beberapa ukuran layar. Jangan menyatakan aplikasi selesai bila koneksi database, storage, atau alur admin belum diuji.
