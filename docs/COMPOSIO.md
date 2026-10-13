# Integrasi Composio Platform

Dokumen ini menjelaskan bagaimana Composio terpasang di proyek ini, apa yang
disimpan, dan cara menjalankan tool call pertama.

## Pilihan produk

Repositori ini adalah aplikasi dengan identitas pengguna sendiri, jadi yang
dipakai adalah **Composio Platform** dengan jalur **sessions** — bukan
"Composio For You" (MCP/CLI untuk akun pribadi). Kredensialnya adalah
**project API key** (`COMPOSIO_API_KEY`), bukan consumer key `ck_...`.

## Pemetaan identitas

`user_id` Composio diturunkan dari identitas yang sudah ada, bukan sistem
pengguna kedua:

| Aplikasi | Composio |
| --- | --- |
| `admin_account.id` (singleton, `id = 1`) | `user_id` = `pmii-admin-1` |

Diturunkan oleh `src/server/integrations/composio/identity.ts`. Karena nilainya
stabil, koneksi aplikasi (mis. Gmail) tidak perlu diotorisasi ulang setiap kali
sesi baru diterbitkan.

Modul ini sengaja memakai akun admin karena itulah satu-satunya identitas
terautentikasi di repositori. Bila kelak MAPABA punya akun peserta, pemetaan
perlu ditinjau ulang — jangan menambahkan tabel pengguna paralel.

## Apa yang disimpan

Tabel `composio_session` (migrasi `002_composio_sessions.sql`) hanya menyimpan
ID sesi dan daftar toolkit yang pernah dipakai:

```
admin_id | user_id | session_id | toolkits | created_at | updated_at
```

**Tidak ada kredensial di database.** `COMPOSIO_API_KEY` hanya hidup di
environment dan tidak pernah dicetak, di-log, atau dikirim ke klien. RLS
diaktifkan pada tabel ini (deny by default untuk akses anon).

## Berkas yang ditambahkan

```text
src/server/integrations/composio/
  client.ts       klien Composio (tunggal, server-only, telemetry SDK dimatikan)
  identity.ts     pemetaan admin → user_id Composio
  operations.ts   baca koneksi, tautan koneksi, cari tool, jalankan tool
  repository.ts   akses tabel composio_session
  session.ts      siklus hidup sesi (pakai ulang / terbitkan baru)
  types.ts        tipe bersama
src/server/db/migrations/002_composio_sessions.sql
scripts/composio-smoke.ts
```

## Konfigurasi

`COMPOSIO_API_KEY` bersifat opsional; server tetap berjalan tanpa kunci itu dan
integrasi hanya tidak aktif.

1. Buka <https://dashboard.composio.dev> → project → Getting Started, salin
   project API key (berawalan `ak_`).
2. Tambahkan ke `.env.local` (sudah diabaikan git) dan jangan commit:
   ```dotenv
   COMPOSIO_API_KEY=ak_...
   ```
3. Terapkan migrasi: `npm run db:migrate`.

Kredensial tidak boleh diminta lewat chat, disimpan di dokumen, atau direkam di
log.

## Menjalankan

Toolkit dan tool **tidak pernah ditebak**: koneksi diperiksa lewat
`session.toolkits()` dan tool ditemukan lewat `session.search()` saat runtime.

Verifikasi pertama tanpa otorisasi aplikasi apa pun (Hacker News publik):

```bash
npx tsx --conditions=react-server scripts/composio-smoke.ts \
  --toolkit hackernews \
  --tool HACKERNEWS_GET_USER \
  --args "{\"username\":\"pg\"}"
```

Aplikasi yang butuh akun pengguna (mis. Gmail) mengembalikan Connect Link:

```bash
npx tsx --conditions=react-server scripts/composio-smoke.ts --toolkit gmail
```

Buka tautan yang tercetak, beri izin, lalu **jalankan ulang perintah yang sama** —
kini koneksi terdeteksi dan tool dieksekusi. Keluaran menyertakan **log ID**
Composio untuk penelusuran di dashboard.

Bila `--tool` tidak diberikan, skrip mencari tool lewat sesi dan mencetak
kandidatnya lebih dulu.

### Catatan shell

Pada PowerShell, `npm run composio:smoke -- --toolkit x` dapat menelan tanda
`--`. Panggil `npx tsx --conditions=react-server ...` seperti di atas, atau
gunakan tanda kutip pada seluruh argumen.

## Kenapa `--conditions=react-server`

`server-only` melempar error bila kondisi `react-server` tidak aktif. Next.js
mengaktifkannya saat membundel, tetapi `tsx` tidak. Tanpa flag ini, setiap
skrip yang mengimpor modul server (termasuk `db:migrate` dan `db:seed` yang
sudah ada) gagal dengan pesan "This module cannot be imported from a Client
Component module".

Skrip `composio:smoke` dan `test:db` sudah memakai flag tersebut.

## Batas saat ini

- Belum ada UI admin untuk Composio; jalur yang tersedia adalah skrip ini.
- Belum ada trigger/webhook Composio.
- Autentikasi memakai auth bawaan Composio (managed). Pindah ke OAuth milik
  sendiri hanya bila branding, scope, atau kuota khusus dibutuhkan.
- Satu sesi per akun admin; mode multi-akun belum diaktifkan.
