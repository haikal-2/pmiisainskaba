# Kontrak API usulan

Route berikut adalah kontrak internal usulan. Route admin tidak ditautkan dari halaman publik, tetapi tetap dianggap dapat diketahui dan harus dilindungi. Path login UI final menunggu keputusan pengguna.

## Aturan umum
JSON sukses: `{ "data": ..., "requestId": "..." }`.
JSON gagal: `{ "error": { "code": "...", "message": "...", "fields": {} }, "requestId": "..." }`.
Tidak ada payload error yang memuat SQL, stack trace, kredensial, isi pengaduan, atau metadata pribadi pihak lain.

Status: 200 untuk baca/update, 201 setelah create commit, 204 setelah aksi tanpa body, 400/422 untuk input, 401 tanpa sesi valid, 403 untuk akses/origin terlarang, 404 untuk objek tidak ditemukan, 409 untuk konflik, 413 untuk ukuran, 415 untuk tipe file, 429 untuk batas request. Client menangani status nyata.

## Publik
| Method dan route | Fungsi |
| --- | --- |
| GET /api/public/site | DTO beranda dan kontak publik |
| GET /api/public/pages/:key | Section halaman yang terbit |
| GET /api/public/structure | Struktur dan periode terbit |
| GET /api/public/kopri | Isi dan program terbit |
| GET /api/public/gallery | Filter/pagination album terbit |
| GET /api/public/gallery/:id | Foto terbit, setelah perilaku detail disepakati |
| GET /api/public/documents | Metadata/tautan dokumen terbit |
| GET /api/public/mapaba | Event, agenda, FAQ dan keadaan registrasi |
| POST /api/public/mapaba/uploads | Otorisasi upload sementara untuk draft form |
| POST /api/public/mapaba/registrations | Validasi, finalisasi file dan simpan peserta |
| POST /api/public/advocacy/reports | Simpan laporan dan terbitkan tiket |

Tidak ada GET publik untuk peserta, daftar pengaduan, detail tiket, atau berkas KTM. Tambahkan tracking publik hanya jika pengguna memintanya, dengan mekanisme akses yang ditinjau.

## Autentikasi
| Method dan route | Fungsi |
| --- | --- |
| POST /api/auth/admin/login | Verifikasi username/password dan buat sesi cookie |
| POST /api/auth/admin/logout | Cabut sesi server dan hapus cookie |
| GET /api/auth/admin/session | Status sesi minimal untuk UI privat |

Tidak ada `/register`, `/signup`, `/invite`, atau endpoint bootstrap akun. Request ke route yang tidak disediakan gagal. Error login tidak membedakan username tidak ada dan password salah.

## Admin, semua wajib sesi valid
| Route dasar | Operasi |
| --- | --- |
| /api/admin/site | GET, PATCH pengaturan publik |
| /api/admin/pages/:key | GET, PATCH section sesuai schema |
| /api/admin/structure | GET, POST, PATCH/DELETE item terkonfirmasi |
| /api/admin/kopri | GET dan mutasi program/konten |
| /api/admin/gallery | GET dan mutasi album/foto |
| /api/admin/documents | GET dan mutasi metadata/tautan/file |
| /api/admin/mapaba/event | GET, PATCH konfigurasi kegiatan |
| /api/admin/mapaba/registrations | GET daftar privat dengan pagination/filter |
| /api/admin/mapaba/registrations/:id | GET detail dan PATCH status yang disepakati |
| /api/admin/advocacy/reports | GET daftar privat dengan pagination/filter |
| /api/admin/advocacy/reports/:id | GET detail dan PATCH status yang disepakati |
| /api/admin/advocacy/reports/:id/notes | GET, POST catatan privat |
| /api/admin/media/uploads | POST otorisasi upload admin |
| /api/admin/media/:id/download | GET otorisasi download privat setelah pemeriksaan sesi |

Endpoint DELETE hanya tersedia untuk objek yang kebijakan penghapusannya sudah disepakati. Jangan mengimplementasikan hapus massal peserta/pengaduan tanpa keputusan. Tidak ada endpoint pengelolaan akun tambahan.

## Request khusus
- Pengiriman form memakai idempotency key terbatas sehingga klik ganda tidak membuat data ganda. Konfirmasi aturan duplikasi bisnis secara terpisah.
- PATCH konten membawa version untuk mendeteksi kehilangan edit saat tab admin terbuka bersamaan.
- Upload mengembalikan object key acak dan tiket singkat yang hanya mengizinkan upload ke path yang ditentukan. Finalisasi menolak objek dari draft lain.
- Daftar dibatasi per halaman dengan batas server, bukan mengambil seluruh data sensitif.
- URL bukti/divalidasi sebagai http(s). Server tidak mengambil URL bukti sembarangan dan tidak menjalankan SSRF.
- Cookie auth: HttpOnly, Secure di produksi, SameSite sesuai desain; validasi Origin/CSRF untuk mutasi.
- Respons privat menggunakan Cache-Control no-store. Jangan cache detail pengaduan atau signed URL di CDN publik.
