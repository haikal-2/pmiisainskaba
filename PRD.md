# Kebutuhan produk

## Tujuan
Membangun ulang seluruh website publik dari source asli, menambahkan pengelolaan admin privat, dan menghubungkan setiap fitur ke backend permanen. Bahasa dan identitas organisasi mengikuti sumber.

## Pengguna
Pengunjung membaca konten, mengirim pengaduan, dan mendaftar MAPABA tanpa akun. Satu admin mengelola seluruh modul. Pembuatan akun admin berlangsung melalui sistem, bukan browser.

## Modul publik dan admin
| Modul publik | Fungsi publik | Pengelolaan admin |
| --- | --- | --- |
| Beranda | Hero, statistik, layanan, tentang, kutipan, CTA, footer | Isi teks, statistik, aset, CTA, kontak dan tautan |
| Sejarah | Artikel, linimasa, makna lambang | Isi dan urutan bagian/linimasa |
| Struktur | BPH, biro, anggota dan KOPRI | Nama, jabatan, kelompok, periode, urutan dan aset |
| KOPRI | Profil, nilai, program, kutipan dan CTA | Seluruh isi dan program |
| Galeri | Filter, album dan muat lebih banyak sesuai sumber | Album, kategori, foto, cover, urutan dan publikasi |
| Landasan Hukum | Kartu dokumen dan tautan Buka | Judul, deskripsi, jenis, tautan/file sesuai keputusan |
| Advokasi | Form anonim berbasis nama opsional dan tiket | Daftar privat, detail, status dan catatan tindak lanjut |
| MAPABA | Informasi kegiatan, agenda, FAQ dan registrasi peserta | Konten kegiatan, jadwal, kuota, formulir dan data peserta |

Pengelolaan semua modul bukan izin menambah layanan baru. Fitur dashboard yang belum ditentukan, termasuk export, analitik dan notifikasi, harus ditanyakan sebelum dibuat. Desain admin belum tersedia pada referensi publik; minta arahan desainnya.

## Advokasi
Bidang yang diamati: nama opsional, kontak wajib, email opsional, status pelapor wajib, kategori wajib, kronologi wajib 50 sampai 4000 karakter, tautan bukti opsional, pilihan merahasiakan identitas, dan persetujuan wajib. Salin pilihan select dari source asli.

Server menerbitkan tiket unik setelah commit. Hanya admin boleh membaca daftar dan detail. Nama boleh kosong tetapi kontak tetap wajib pada referensi. Jangan menjanjikan anonimitas penuh jika kontak masih dikumpulkan. Tidak ada pelacakan tiket publik kecuali pengguna memintanya.

## MAPABA
Bidang yang diamati: nama, NIM, angkatan, universitas, fakultas tetap Saintek, program studi, WhatsApp, email, jenis kelamin, asal daerah opsional, motivasi maksimal 1000 karakter, sumber informasi opsional, riwayat organisasi opsional, pas foto wajib, KTM wajib, serta dua persetujuan wajib.

Berkas JPG/PNG/WebP, maksimal 3 MB masing-masing. Backend memaksakan fakultas dari konfigurasi server, bukan mempercayai input disabled. Aturan duplikasi, batas minimum motivasi, waktu buka/tutup, dan hitungan kuota harus dipastikan dari source dan jawaban pengguna. Gunakan transaksi untuk penegakan kuota bila kuota memang dibatasi.

## Perbedaan login/register
Tidak ada login/register akun publik. Formulir registrasi peserta MAPABA tetap ada. Jangan menghapus form tersebut karena kata registrasi.

## Ketentuan penerimaan
Setiap mutasi menghasilkan perubahan persisten. Peserta dan pengaduan tidak ditampilkan publik. Tombol dan navigasi berfungsi sesuai sumber atau keputusan pengguna. Inkonsistensi source menjadi pertanyaan, bukan perubahan diam-diam.
