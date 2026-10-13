# Deployment Vercel, Neon, dan Vercel Blob

Dokumen ini adalah runbook implementasi. Belum ada proyek Neon/Vercel yang dibuat atau deployment yang dilakukan.

## Sebelum deploy
- Gunakan versi Node dan dependency yang kompatibel, tercatat dalam proyek dan lockfile.
- Siapkan proyek Neon, role database aplikasi dengan izin minimum, dan pooled connection string untuk runtime serverless.
- Pisahkan akses migrasi dari runtime bila driver/provider memerlukannya.
- Siapkan Vercel Blob untuk aset publik dan berkas MAPABA private pada fase integrasi upload; validasi akses pada server, jangan menganggap nama/path sebagai kontrol akses.
- Putuskan path admin, kebijakan form dan durasi sesi.

## Environment
Salin `.env.example` menjadi `.env.local`, isi `DATABASE_URL` dengan database lokal/test yang terisolasi, dan gunakan `DATABASE_SSL=disable` hanya untuk loopback. Di production isi `DATABASE_URL`, `MIGRATION_DATABASE_URL` jika terpisah, `RATE_LIMIT_HASH_SALT`, serta `GOOGLE_SHEETS_ADVOKASI_WEBHOOK_URL` dan `GOOGLE_SHEETS_MAPABA_WEBHOOK_URL` untuk pencatatan spreadsheets secara real-time. Simpan rahasia produksi pada pengaturan environment Vercel, bukan repo atau chat. `ADMIN_PATH` tidak memakai prefix `NEXT_PUBLIC_`. Pisahkan database/storage preview dari produksi untuk test. Jangan membuat environment preview membaca pengaduan produksi.

Variabel yang wajib ada di produksi sebelum deploy:

| Variabel | Konsekuensi bila kosong |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Unggah berkas privat gagal keras (503). Penyimpanan lokal **tidak** dipakai di produksi; jangan mengandalkan disk serverless |
| `CRON_SECRET` | `/api/internal/cron/dispatch-outbox` menolak semua permintaan, sehingga tidak ada pengiriman Sheets sama sekali |
| `RATE_LIMIT_HASH_SALT` | Rate limit dan idempotency tidak dapat disimpan dengan aman |
| `TRUSTED_CLIENT_IP_HEADER` | Tanpa header tepercaya, seluruh trafik publik berbagi satu bucket rate limit (gagal tertutup) |

Isi `TRUSTED_CLIENT_IP_HEADER` (mis. `x-real-ip`) **hanya** bila proxy di depan aplikasi menimpa header tersebut. Aplikasi mempercayai satu nama header saja dan mengabaikan `x-forwarded-for`, karena header itu dapat dipalsukan klien untuk menghindari kuota.

## Migrasi dan import
Jalankan migrasi dengan koneksi yang sesuai dan langkah yang terkontrol. Jangan menjalankan reset database, seed destruktif, atau provisioning password default pada build/deploy hook. Import konten/aset dari source asli. Buat admin dengan `npm run admin:create` setelah migrasi dan konfigurasi database benar. Perintah `npm run admin:reset` memperbarui password (serta username bila diberikan) dan mencabut seluruh sesi; `npm run admin:revoke` hanya mencabut sesi. Perintah CLI meminta password tersembunyi dan meminta konfirmasi `YES` untuk target non-loopback. Pastikan host/nama database yang ditampilkan sesuai sebelum menyetujui operasi.

## Build dan deploy
- Sediakan perintah install/build sesuai lockfile dan Next.js.
- Jangan mengaktifkan static export; login/API membutuhkan runtime server.
- Jalankan pemeriksaan yang disyaratkan sebelum deploy.
- Deployment harus memakai target pengguna. Jangan membuat akun layanan, menerima biaya/langganan, atau membeli domain atas asumsi.
- Dokumentasikan project root, runtime, environment scopes dan callback/origin jika diperlukan.

## Verifikasi lingkungan target
Buka seluruh route publik. Login admin melalui URL langsung. Uji edit konten dan invalidasi cache. Uji form di lingkungan uji yang sesuai, upload private, download admin, logout dan API tanpa sesi. Pastikan frontend benar-benar tersambung ke database serta storage target.

Tambahan yang harus dibuktikan di lingkungan target:
- `GET /api/internal/health` melaporkan `storage.driver = "blob"` dan `cron.status = "ok"`.
- `/api/internal/cron/dispatch-outbox` menolak permintaan tanpa `Authorization` dan menerima permintaan dengan `CRON_SECRET` yang benar.
- Berkas privat tidak dapat dibuka tanpa sesi admin; setiap akses berhasil muncul di `audit_event` sebagai `read-media`.
- Satu pendaftaran uji menghasilkan tepat satu baris `integration_outbox` dan baris itu berubah menjadi `processed_at` setelah cron berjalan.

## Upload pada Vercel
Unggahan MAPABA berjalan dua langkah: `POST /api/public/mapaba/uploads` (JSON) membuat draft + token, lalu satu permintaan multipart per berkas (maksimal `MAX_UPLOAD_BYTES`, 3 MB). Respons berisi **pathname kanonik** (`mapaba-private/<48 hex>/<pasFoto|ktm>`), bukan URL storage. Pendaftaran mengirim `reference` pathname itu kembali; server memvalidasinya lewat `storage/reference.ts` dan menolak skema `local-upload:/`, URL Blob, maupun tautan asing. Payload dua berkas 3 MB tidak boleh dikirim bersama melalui satu fungsi Vercel: backend memeriksa `Content-Length` sebelum body diparse.

## Operasi
### Sinkronisasi Google Sheets (outbox)
Baris pendaftaran/pengaduan masuk ke `integration_outbox` **di dalam transaksi yang sama** dengan data utama; tidak ada pengiriman saat request pengguna. Urutan operasional:

1. Cron Vercel (`vercel.json`, setiap 5 menit) memanggil `/api/internal/cron/dispatch-outbox` dengan `Authorization: Bearer $CRON_SECRET`.
2. Worker mengklaim baris siap kirim dengan lease miliknya (`lease_owner` + `available_at` dimajukan 5 menit) memakai `FOR UPDATE SKIP LOCKED`, sehingga dua worker tidak memproses baris yang sama.
3. Kegagalan menaikkan `attempts`, mengisi `last_error`, dan menjadwalkan retry dengan backoff eksponensial (15 detik → maksimum 1 jam). Baris tetap `processed_at = NULL` sehingga terlihat admin.
4. Admin membuka modul **Sinkronisasi** (`/api/admin/outbox`) untuk melihat item pending dan memaksa kirim ulang; aksi ini tercatat di `audit_event` sebagai `requeue-outbox`.

Pemeriksaan saat insiden:
- `SELECT count(*) FROM integration_outbox WHERE processed_at IS NULL;` — jumlah tertunggak.
- `SELECT id, integration, attempts, last_error, available_at FROM integration_outbox WHERE processed_at IS NULL ORDER BY available_at;` — penyebab dan jadwal berikutnya.
- `GET /api/internal/health` — status database/storage/cron/Sheets/Composio secara terpisah.
- Log server: cari `"event":"outbox.delivery-failed"`; setiap kegagalan menyebut komponen penyebab dan tidak memuat data pribadi maupun pathname berkas privat.

Bila `CRON_SECRET` belum diisi, data utama tetap tersimpan tetapi spreadsheet akan tertinggal; jangan menganggap sinkronisasi berjalan tanpa memeriksa health check.

Dokumentasikan reset admin lewat CLI, pencabutan sesi, backup/restore yang tersedia pada plan terpilih, serta cleanup draft/objek upload gagal. Jangan menjanjikan backup/retensi berbayar sebelum plan ditentukan. Rollback deployment aplikasi tidak otomatis rollback database; migrasi harus mempertimbangkan kompatibilitas.

Bila email dipilih, tambahkan provider dan environment setelah pengguna menentukan layanan. Bila pembayaran dipilih, lakukan hal yang sama. Tanpa keputusan itu, jangan membuat konfigurasi provider fiktif.
