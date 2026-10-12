# Prompt utama untuk agent AI Claude

Kamu bertugas membangun website PMII yang lengkap dan berfungsi, dengan referensi https://pmii-rayon-saintek.vercel.app/ dan source code serta aset asli yang akan saya berikan.

Baca `CLAUDE.md`, `PRD.md`, `ARCHITECTURE.md`, `DESIGN_REFERENCE.md`, `DATA_MODEL.md`, `API_SPEC.md`, `SECURITY.md`, `TASKS.md`, `ACCEPTANCE_CRITERIA.md`, `DEPLOYMENT.md`, dan `OPEN_QUESTIONS.md` sebelum mengubah kode.

## Hasil yang saya minta
Buat frontend dan backend TypeScript dalam satu proyek Next.js fullstack, memakai PostgreSQL di Neon, Vercel Blob untuk berkas, dan siap berjalan di Vercel. Implementasikan aplikasi nyata beserta migrasi, data awal dari source asli, konfigurasi, dokumentasi, dan pengujian yang relevan.

Tampilan seluruh halaman publik harus mengikuti referensi secara tepat: susunan bagian, tipografi, warna, ukuran, jarak, logo, foto, teks, ikon, efek, animasi, navigasi, dan perilaku responsif. Gunakan source dan aset asli sebagai dasar. Jangan mendesain ulang, mengganti gambar, menyederhanakan konten, atau menambahkan halaman dan fitur bisnis tanpa jawaban saya.

## Admin
- Satu akun admin mengelola seluruh konten dan modul yang tercakup dalam PRD.
- Admin hanya masuk lewat URL khusus yang saya tentukan. Jangan memilih URL final sendiri.
- Jangan menampilkan login, register, tautan dashboard, ikon admin, atau shortcut admin pada header, footer, menu mobile, maupun konten publik.
- Tidak boleh ada register admin, register pengguna, endpoint signup, social login, invitation flow, atau pembuat admin berbasis browser.
- Formulir pendaftaran peserta MAPABA tetap tersedia sesuai referensi. Form ini membuat data peserta, bukan akun website.
- Buat akun admin melalui perintah server/CLI. Password masuk melalui input tersembunyi, di-hash, dan tidak disimpan dalam source code atau argumen CLI.
- Reset username/password dan pencabutan sesi juga lewat perintah server/CLI. Jangan membuat panel pengelolaan akun tambahan.
- Proteksi setiap halaman dan API admin pada server. URL khusus tidak menggantikan autentikasi.

## Integrasi wajib
Setiap aksi antarmuka harus menjalankan operasi backend yang benar. Form MAPABA dan Advokasi harus menyimpan data setelah validasi server. Admin harus dapat membaca data tersebut secara privat. Penyuntingan konten harus tersimpan dan muncul pada halaman publik setelah pembaruan cache. Upload file harus masuk ke storage permanen dengan hak akses yang sesuai.

Jangan memakai mock API, array hardcoded sebagai database, localStorage sebagai penyimpanan utama, sukses palsu, placeholder upload, atau tombol tanpa fungsi sebagai hasil final. Data test boleh dipakai dalam lingkungan test yang terpisah.

## Jangan membuat asumsi
Mulai dengan inventaris source dan daftar pertanyaan yang relevan dari `OPEN_QUESTIONS.md`. Tanyakan pilihan yang belum jelas, khususnya URL admin, aturan MAPABA yang bertentangan, cara pembayaran, perilaku galeri yang belum berfungsi, serta kebutuhan email. Jika jawaban belum ada, kerjakan bagian independen dan tandai bagian yang bergantung pada jawaban sebagai tertahan. Jangan menganggap diam sebagai persetujuan.

Source asli diperlukan untuk memenuhi kesamaan penuh. Jika source belum tersedia, minta pengguna menyediakannya. Jangan menyatakan hasil identik berdasarkan perkiraan.

## Urutan kerja
1. Periksa sumber asli dan aset. Catat seluruh route, form, interaksi, integrasi eksternal, dan inkonsistensi.
2. Tanyakan keputusan yang memengaruhi perilaku sebelum mengimplementasikannya.
3. Susun pemetaan halaman lama ke Next.js, model data, API, dan daftar aset yang terverifikasi. Perbarui dokumen ini bila source menunjukkan fitur yang belum tercatat.
4. Implementasikan fondasi, database, storage, autentikasi, backend, halaman publik, dan admin per modul.
5. Verifikasi alur end-to-end dan tampilan desktop, tablet, serta mobile.
6. Siapkan konfigurasi Vercel, Neon, dan Vercel Blob. Jangan melaporkan deploy berhasil jika belum benar-benar dilakukan dan diverifikasi.
7. Laporkan hasil, pengujian yang benar-benar dijalankan, perbedaan visual yang tersisa, dan penghambat yang membutuhkan tindakan saya.

Jangan berhenti setelah membuat UI atau rencana. Selesaikan seluruh pekerjaan yang tidak tertahan keputusan atau akses. Jangan menyatakan alur email, pembayaran, database, atau upload berfungsi tanpa bukti.
