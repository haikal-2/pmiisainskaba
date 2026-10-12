# Kriteria penerimaan

## Kesamaan referensi
- Semua route dan section source asli tersedia.
- Teks, logo, foto, font, ikon, warna, spacing, ukuran, animasi dan navigasi mengikuti sumber.
- Tidak ada gambar/isi pengganti, modul tambahan atau perubahan desain tanpa keputusan.
- Periksa desktop, tablet dan mobile pada viewport sama; scroll memicu section reveal.
- Tidak ada overflow horizontal, logo terdistorsi, gambar hilang atau konten terpotong.
- Interaksi mouse/keyboard dan menu mobile sesuai sumber, dengan label/focus yang dapat digunakan.

## Integrasi
- Edit teks/statistik/kontak melalui admin, simpan, refresh, lalu periksa halaman publik.
- Buat/ubah anggota dan urutan, program KOPRI, album/foto, dokumen, event/agenda/FAQ; hasil tersimpan permanen.
- Upload publik muncul sesuai publikasi; draft/private tidak muncul.
- Kirim form Advokasi ke aplikasi test, periksa database dan detail admin, pastikan tiket unik.
- Kirim form MAPABA di aplikasi test dengan dua file valid, periksa database dan akses berkas admin.
- Klik ganda tidak membuat duplikasi pengiriman teknis.
- Error database/storage tidak menghasilkan pesan sukses.
- Perubahan tetap ada setelah refresh dan redeploy.

## Admin
- Header/footer/menu mobile/publik tidak memuat login/register/admin shortcut.
- Login hanya tersedia pada path yang dipilih pengguna.
- Tidak ada halaman maupun endpoint register, invite atau bootstrap admin.
- CLI provisioning berhasil untuk satu admin; provisioning kedua ditolak.
- Login salah ditolak tanpa mengungkap keberadaan username.
- Akses halaman/API privat tanpa sesi ditolak; tidak bocor melalui Server Components.
- Logout mencabut sesi pada server. Reset password mencabut seluruh sesi.
- Sesi kadaluarsa/nonaktif ditolak.
- Cookie memiliki konfigurasi keamanan yang sesuai produksi.

## Data sensitif dan upload
- GET publik tidak bisa mengambil peserta, pengaduan, KTM atau pas foto.
- Data privat tidak dapat dibaca melalui endpoint publik atau tanpa sesi admin yang valid.
- Bucket private tidak mengizinkan list/download anonim.
- Upload oversized, tipe salah, signature palsu, objek draft lain dan tiket kedaluwarsa ditolak.
- Tidak ada secret di client bundle, props, HTML, repository atau log.
- Mutasi CSRF/cross-origin yang tidak diizinkan ditolak.
- Detail pengaduan dan signed URL tidak di-cache publik.

## Aturan bisnis
Uji aturan yang telah dijawab pengguna, termasuk registrasi buka/tutup, kuota/konkurensi, eligibility, duplikasi, status, dan pembayaran jika ada. Jangan mengarang aturan untuk melengkapi test.

## Bukti akhir
Catat perintah dan hasil typecheck/lint/build. Catat hasil integration/e2e menggunakan database test. Sertakan ringkasan perbandingan visual dan sisa perbedaan. Pisahkan pemeriksaan lokal, preview dan produksi. Fitur yang memerlukan kredensial/provider tetapi belum diuji harus dinyatakan belum terverifikasi.
