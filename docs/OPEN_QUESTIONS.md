# Pertanyaan yang belum diputuskan

Jangan mengulang pertanyaan yang sudah dijawab. Catat jawaban pengguna di dokumen ini sebelum mengimplementasikan bagian terkait. Agent boleh mengerjakan bagian independen sambil menunggu.

## Sudah terkonfirmasi
TypeScript frontend/backend, Next.js fullstack, PostgreSQL, Vercel, seluruh modul dikelola admin, seluruh desain/konten/aset mengikuti referensi, satu admin.

### Jawaban pengguna (sesi ini)
1. Aset yang tersedia dari pengguna: **hanya logo**. Source code asli tidak disediakan. Sesuai DESIGN_REFERENCE.md, website live menjadi dasar migrasi; HTML/CSS/JS/aset referensi diunduh ke `reference-original/` sebagai acuan visual (read-only).
2. Path admin: **`/admin-secret`** (diketik langsung, tanpa tautan publik).
3. Desain panel admin: mengikuti gaya website referensi (warna pmii/kuning, kartu, tailwind asli).
4. Jadwal registrasi MAPABA: **pendaftaran ditutup pada 3 November 2026 pukul 23:59 WIB**, countdown waktu berjalan aktif sampai penutupan, **waktu pelaksanaan kegiatan: 6–8 November 2026**.
5. Eligibilitas: **UIN SGD atau kampus lain di Kabupaten Bandung**. Field universitas diubah menjadi pilihan (select) dengan opsi UIN SGD + opsi kampus lain.
6. Duplikasi: ya, dicegah pada NIM/email/telepon. **Kuota 100** dihitung dari seluruh pendaftar valid (bukan per status).
7. Kontribusi Rp75.000 dibayar **di luar website**; tidak ada payment gateway. Tidak dicatat sebagai status pembayaran.
8. Status peserta: **tidak ada** status tambahan. Admin juga **tidak perlu export/unduh daftar** (fitur export tidak dibuat).
9. Dokumen Landasan Hukum: tetap **tautan (Google Drive)**; tidak diunggah ke storage.
10. Galeri: album/kartu harus berfungsi (lightbox + muat lebih banyak).
11. Fitur ujian: **tidak ada**; jangan dibuat.
12. Notifikasi tiket Advokasi/MAPABA: dikirim **secara real-time ke Google Sheets via Google Apps Script Webhooks** (`GOOGLE_SHEETS_ADVOKASI_WEBHOOK_URL` dan `GOOGLE_SHEETS_MAPABA_WEBHOOK_URL`). Outbox tetap mencatat event sebagai cadangan sinkronisasi.
13. Status pengaduan + catatan tindak lanjut: **ya, dikelola admin** (status + catatan privat). Pelacakan tiket publik: tidak ada (hanya admin).
14. Durasi sesi admin: **tidak ditentukan**; memakai nilai konfigurasi wajar (default 7 hari) dan dapat diubah lewat env.
15. Rate limit tanpa IP mentah: **ya**, memakai hash turunan identifier + persisten di database.
16. Penyimpanan: **bukan Supabase**. Database PostgreSQL gratis (**Neon**) + storage file (**Vercel Blob**, mode private untuk KTM/pas foto). Kredensial via environment, bukan chat.

## Diperlukan saat memulai
1. ~~Di mana source code dan aset asli tersedia?~~ TERJAWAB: hanya logo; website live menjadi dasar migrasi.
2. ~~Apa path URL admin?~~ TERJAWAB: `/admin-secret`.
3. ~~Bagaimana desain panel admin?~~ TERJAWAB: mengikuti desain website referensi.

## MAPABA, tanyakan setelah memeriksa source
4. Jadwal buka/tutup registrasi dan zona waktu apa yang berlaku? UI live menunjukkan informasi buka/tutup yang bertentangan.
5. Apakah peserta hanya mahasiswa UIN SGD atau boleh kampus lain di Kabupaten Bandung?
6. Apa kebijakan duplikasi NIM/email/nomor telepon dan pengiriman ulang? Kuota menghitung semua pendaftar atau peserta dengan status tertentu?
7. Kontribusi Rp75.000 dibayar di luar website, dicatat manual, atau memerlukan pembayaran online? Jangan memasang payment gateway tanpa pilihan.
8. Status peserta apa yang dibutuhkan, dan apakah admin perlu export/unduh daftar?

## Konten dan dokumen
9. Dokumen tetap memakai tautan Google Drive, diunggah ke Storage, atau keduanya?
10. Jika source galeri hanya placeholder, apakah album dibuka dalam lightbox atau halaman detail? Apa fungsi muat lebih banyak yang diinginkan?
11. Apakah fitur ujian yang disebut pada beranda benar-benar ada di source dan termasuk ruang lingkup? Jangan membangun ujian dari satu kalimat promosi.

## Advokasi dan keamanan
12. Apakah tiket harus dikirim via email? Jika ya, provider/alamat pengirim apa yang dipakai? Apakah MAPABA juga memerlukan email?
13. Status pengaduan apa yang dipakai, dan bagaimana catatan penyelesaian dikelola? Apakah perlu pelacakan tiket publik atau tetap hanya admin?
14. Berapa lama sesi admin aktif, dan bagaimana kebijakan penyimpanan/penghapusan peserta, pengaduan, serta berkas?
15. Referensi menyebut IP tidak disimpan. Bagaimana pembatas spam harus dirancang tanpa menyimpan IP mentah? Jelaskan pilihan bila diperlukan; jangan mengubah klaim privasi diam-diam.

## Akses lingkungan
16. ~~Apakah proyek Vercel dan Neon sudah tersedia?~~ TERJAWAB: pakai Neon (PostgreSQL) + Vercel Blob. Proyek Neon/Vercel belum dibuat; kredensial diisi pengguna lewat environment Vercel/dashboard, bukan chat. Selama belum ada, migrasi dan verifikasi dijalankan terhadap database lokal/test yang terisolasi.

## Sisa pilihan yang perlu dikonfirmasi pengguna
- Kuota dihitung dari seluruh pendaftar valid (asumsi berdasarkan jawaban 6). Bila berbeda, beri tahu.
- Google Sheets: Menggunakan Webhook URL Google Apps Script yang disediakan pengguna untuk integrasi real-time (Advokasi & MAPABA).

Pertanyaan dapat digabung dalam kelompok singkat. Jangan membebani pengguna dengan detail yang sudah pasti dari source. Jika source menjawab pertanyaan teknis, catat sumbernya dan tanyakan hanya konflik atau pilihan bisnis yang tersisa.
