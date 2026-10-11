# Referensi desain dan hasil inspeksi

## Sumber
Website: https://pmii-rayon-saintek.vercel.app/
Tanggal inspeksi publik: 11 Oktober 2026.
Catatan ini berasal dari tampilan dan DOM publik. Catatan ini tidak membuktikan teknologi backend, penyimpanan data, atau keberhasilan form website asli. Tidak ada form yang dikirim saat inspeksi.

Pengguna menyatakan memiliki source dan aset. Source serta aset tersebut belum dimasukkan dalam paket. Source menjadi dasar migrasi; website menjadi pembanding hasil render. Bila keduanya berbeda, tanyakan versi yang harus diikuti.

## Halaman yang dibaca
Beranda, Sejarah, Struktur, KOPRI, Galeri, Landasan Hukum, Advokasi, dan MAPABA. Tautan internal menampilkan bentuk `.html` pada DOM; sebagian navigasi dinormalisasi menjadi URL tanpa ekstensi. Inventaris route final harus diperiksa dari source, termasuk aturan redirect dan route tambahan.

## Beranda
- Header putih, lambang PMII dan nama organisasi di kiri.
- Navigasi di kanan, dropdown Profil, CTA MAPABA kuning.
- Hero dua kolom: judul besar biru gelap/biru terang, motto warna kuning/oranye, deskripsi dan dua CTA di kiri; kartu lambang organisasi dengan bayangan dan badge lokasi di kanan.
- Latar putih dengan grid halus dan gradasi biru/kuning lembut.
- Statistik berdiri 1960, kader aktif 50+, program studi 8 sesuai sumber yang dibaca.
- Bagian Akses Cepat, Tentang Kami, tiga nilai, kutipan, dan kartu CTA.
- Footer biru gelap dengan identitas, tautan, kontak dan sosial media.
- Skip link, breadcrumb pada halaman lain, dan tombol kembali ke atas.

## Halaman lainnya
Sejarah berisi artikel dan linimasa. Struktur berisi BPH, biro rayon dan KOPRI masa khidmat 2026–2027. KOPRI berisi profil, nilai, program dan CTA MAPABA. Galeri memiliki filter Semua, MAPABA, Kajian, Aksi, Pengabdian, kartu album, dan muat lebih banyak. Ada album kategori Kaderisasi dan Harlah meski kedua kategori tidak muncul pada filter yang dibaca.

Landasan Hukum memuat tujuh kartu dokumen dengan tautan Google Drive pada inspeksi. Jangan mengganti tautan eksternal dengan file lokal tanpa keputusan pengguna.

## Inkonsistensi yang harus ditanyakan
- MAPABA menampilkan pendaftaran dibuka 1 Oktober 2026, tetapi teks countdown pada inspeksi menyatakan sudah ditutup. Cari penyebab dalam source dan tanyakan jadwal yang berlaku.
- Persyaratan menyebut mahasiswa UIN SGD, tetapi field universitas menyatakan boleh perguruan tinggi lain di Kabupaten Bandung. Tanyakan aturan peserta.
- Beberapa kartu album memiliki href `#`. Perilaku album/lightbox perlu diperiksa dalam source dan ditanyakan jika memang belum ada.
- Referensi menyebut salinan tiket via email. Konfigurasi serta backend email tidak terlihat dari UI.
- Beranda menyebut platform ujian kader, tetapi modul ujian tidak teramati dalam navigasi yang dibaca. Jangan membuat modul ujian tanpa konfirmasi/source yang mendukung.

## Metode kesamaan visual
1. Baca CSS, font, logo, foto, ikon dan breakpoint asli. Catat ukuran dan token dari sumber, bukan menebak nilai hex dari screenshot.
2. Pindahkan HTML menjadi komponen TSX tanpa mengubah struktur yang memengaruhi layout.
3. Pastikan semua section terungkap sebelum mengambil screenshot. Screenshot full page awal bisa memiliki area kosong karena animasi reveal belum terpicu.
4. Bandingkan source dan implementasi pada viewport sama, minimal contoh 390, 768 dan 1440 px, lalu breakpoint tambahan dari CSS asli.
5. Periksa header, navigasi mobile, setiap section, footer, form focus/error/success, modal dan accordion sesuai sumber.
6. Buat catatan perbedaan. Perbaiki perbedaan warna, font, ukuran, jarak, crop, animasi dan overflow.
7. Jika font atau aset hilang, minta file asli. Jangan menggantinya dengan stok atau AI tanpa izin.

Bukan seluruh teks referensi disalin ke dokumen ini. Agent harus mengimpor teks lengkap dari source asli agar tidak ada bagian yang hilang.
