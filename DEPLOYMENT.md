# Deployment Vercel, Neon, dan Vercel Blob

Dokumen ini adalah runbook implementasi. Belum ada proyek Neon/Vercel yang dibuat atau deployment yang dilakukan.

## Sebelum deploy
- Gunakan versi Node dan dependency yang kompatibel, tercatat dalam proyek dan lockfile.
- Siapkan proyek Neon, role database aplikasi dengan izin minimum, dan pooled connection string untuk runtime serverless.
- Pisahkan akses migrasi dari runtime bila driver/provider memerlukannya.
- Siapkan Vercel Blob untuk aset publik dan berkas MAPABA private pada fase integrasi upload; validasi akses pada server, jangan menganggap nama/path sebagai kontrol akses.
- Putuskan path admin, kebijakan form dan durasi sesi.

## Environment
Salin `.env.example` menjadi `.env.local`, isi `DATABASE_URL` dengan database lokal/test yang terisolasi, dan gunakan `DATABASE_SSL=disable` hanya untuk loopback. Di production isi `DATABASE_URL`, `MIGRATION_DATABASE_URL` jika terpisah, dan `RATE_LIMIT_HASH_SALT`. Simpan rahasia produksi pada pengaturan environment Vercel, bukan repo atau chat. `ADMIN_PATH` tidak memakai prefix `NEXT_PUBLIC_`. Pisahkan database/storage preview dari produksi untuk test. Jangan membuat environment preview membaca pengaduan produksi.

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

## Upload pada Vercel
Gunakan otorisasi upload langsung ke Vercel Blob, kemudian panggil backend untuk finalisasi metadata. Payload dua file 3 MB tidak boleh dikirim bersama melalui fungsi Vercel yang memiliki batas body. Verifikasi batas provider terkini saat implementasi.

## Operasi
Dokumentasikan reset admin lewat CLI, pencabutan sesi, backup/restore yang tersedia pada plan terpilih, serta cleanup draft/objek upload gagal. Jangan menjanjikan backup/retensi berbayar sebelum plan ditentukan. Rollback deployment aplikasi tidak otomatis rollback database; migrasi harus mempertimbangkan kompatibilitas.

Bila email dipilih, tambahkan provider dan environment setelah pengguna menentukan layanan. Bila pembayaran dipilih, lakukan hal yang sama. Tanpa keputusan itu, jangan membuat konfigurasi provider fiktif.
