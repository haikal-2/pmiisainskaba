# Urutan pekerjaan agent

Semua status diperbarui berdasarkan hasil implementasi dan verifikasi nyata.

## 0. Inventaris dan keputusan
- [x] Terima/baca source serta aset asli (`reference-original/`).
- [x] Identifikasi seluruh route, breakpoint, font, icon, form, skrip, dokumen dan interaksi.
- [x] Bandingkan source dengan website publik.
- [x] Jawab keputusan relevan pada OPEN_QUESTIONS bersama pengguna (termasuk webhook Google Sheets & tanggal Mapaba).
- [x] Catat versi dependency dari dokumentasi resmi dan kunci lockfile.
Hasil: manifest referensi, route map dan keputusan terkonfirmasi.

## 1. Fondasi
- [x] Next.js App Router dan TypeScript strict (`tsconfig.json` `strict: true`).
- [x] Struktur layanan server, repository, schema, DTO dan error boundaries.
- [x] Template environment (`.env.example` dan `.env.local`) dan validasi konfigurasi server.
- [x] Typecheck, lint dan build dasar berhasil tanpa error.
Hasil: proyek berjalan tanpa mock produksi.

## 2. Database dan storage
- [x] Schema/migrasi SQL transaksi (`001_init.sql`), indeks dan least privilege.
- [x] Bucket publik/private (`@vercel/blob` adapter) serta aturan akses.
- [x] Import konten asli idempotent (`src/server/db/seed.ts`).
- [x] Koneksi serverless dan akses migrasi dipisahkan sesuai provider (Neon connection pool).
Hasil: konten berasal dari database dan file tersimpan permanen.

## 3. Admin
- [x] CLI provisioning/reset/revoke untuk satu admin (`scripts/provision-admin.ts`, `scripts/reset-admin.ts`, `scripts/revoke-admin-sessions.ts`).
- [x] Login pada path pilihan pengguna (`/admin-secret`), tanpa registrasi publik.
- [x] Sesi persisten (cookie HttpOnly opaque, token SHA-256), logout, expiry, proteksi server.
- [x] Tidak ada tautan admin pada halaman publik.
Hasil: akses langsung berhasil dengan kredensial benar dan API tanpa sesi ditolak (401/404).

## 4. Halaman publik
- [x] Migrasi beranda, sejarah, struktur, KOPRI, galeri, dokumen, advokasi dan MAPABA.
- [x] Font/aset/teks/animasi/breakpoint sesuai source (`Plus Jakarta Sans`, `Sora`, Tailwind classes).
- [x] Navigasi, form, accordion, filter dan interaksi sesuai keputusan.
Hasil: seluruh route tampil dan berfungsi pada desktop/mobile.

## 5. Integrasi form
- [x] Advokasi: validasi zod, consent, commit database, nomor tiket unik (`ADV-YYYY-XXXX`).
- [x] MAPABA: validasi, aturan waktu pendaftaran (tutup 3 November 2026), kuota 100, pencegahan duplikasi NIM/email.
- [x] Upload direct, verifikasi file (pas foto & KTM), draft token, finalisasi dan cleanup.
- [x] Idempotency dan status loading/error/success nyata.
- [x] Sinkronisasi real-time ke Google Sheets via Google Apps Script Webhook URLs (Advokasi & MAPABA) + outbox queue cadangan.
Hasil: peserta dan laporan tersimpan di database admin dan masuk real-time ke spreadsheets.

## 6. Pengelolaan semua modul
- [x] Tampilan modul admin untuk advokasi, MAPABA, konten, struktur, KOPRI, galeri, dan dokumen.
- [x] Filter pencarian dan pagination pada pendaftar MAPABA dan laporan advokasi.
- [x] Status tiket dan pencatatan catatan privat advokasi.
- [x] Invalidasi cache dan proteksi CSRF/origin mutasi.
Hasil: data tersimpan dan dapat dikelola melalui `/admin-secret`.

## 7. Verifikasi
- [x] Seluruh kriteria pada ACCEPTANCE_CRITERIA diuji (22/22 tes integrasi PGlite lolos).
- [x] Pemeriksaan visual dan kelengkapan route dengan source referensi.
- [x] Typecheck (`npm run typecheck`), Lint (`npm run lint`), Test (`npm run test:db`), dan Build (`npm run build`) 100% lolos.
Hasil: suite pengujian otomatis lolos, build produksi berhasil.

## 8. Deployment (Langkah Selanjutnya oleh Pengguna)
- [ ] Buat proyek di Vercel dan database di Neon (PostgreSQL).
- [ ] Masukkan environment variables dari `.env.example` ke dashboard Vercel (termasuk `DATABASE_URL`, `RATE_LIMIT_HASH_SALT`, dan Google Sheets Webhook URLs).
- [ ] Jalankan migrasi `npm run db:migrate` dan seeding `npm run db:seed` ke database Neon.
- [ ] Buat akun admin pertama kali menggunakan `npm run admin:create`.
- [ ] Deploy ke Vercel dan verifikasi aplikasi live.
Hasil: runbook deployment lengkap terdokumentasi di `DEPLOYMENT.md`.
