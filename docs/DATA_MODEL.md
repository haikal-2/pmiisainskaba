# Rancangan data

Nama tabel dan field adalah usulan teknis. Finalisasi setelah membaca source dan keputusan pengguna. Jangan membuat schema final dari daftar ini tanpa meninjau aturan formulir asli.

| Entitas | Data utama | Akses |
| --- | --- | --- |
| admin_account | id singleton, username unique, password_hash, active, timestamps | Server saja |
| admin_session | id, admin_id, token_hash unique, expires_at, revoked_at | Server saja |
| site_settings | brand, logo, kontak, sosial media, statistik | DTO publik untuk field publik |
| content_section | page_key, section_key, content tervalidasi, sort_order, version | Publik jika terbit |
| timeline_entry | tanggal/label, isi, urutan | Publik jika terbit |
| organization_member | nama, jabatan, group, biro, periode, foto opsional, urutan | Publik jika terbit |
| kopri_program | judul, isi, tautan opsional, urutan | Publik jika terbit |
| gallery_album | judul, kategori, tanggal, cover, publication | Publik jika terbit |
| gallery_photo | album_id, media_id, alt, caption, urutan | Publik jika album terbit |
| legal_document | judul, deskripsi, jenis, external_url atau media_id, urutan | Publik jika terbit |
| mapaba_event | judul, jadwal, waktu registrasi, kuota, kontribusi, eligibility, publication | Informasi publik |
| mapaba_agenda | event_id, hari, judul, items, urutan | Publik sesuai event |
| mapaba_faq | event_id, pertanyaan, jawaban, urutan | Publik sesuai event |
| mapaba_registration | event_id, nomor registrasi, identitas, kontak, motivasi, consent, status | Admin saja |
| advocacy_report | tiket unique, nama nullable, kontak, email nullable, kategori, kronologi, evidence_url, confidentiality, consent, status | Admin saja |
| advocacy_note | report_id, admin_id, catatan, timestamp | Admin saja |
| media_asset | bucket, object_key, visibility, mime, byte_size, owner/draft, state | Sesuai pemilik/visibility |
| upload_draft | token_hash, scope, expiry, objek yang diizinkan, finalized_at | Server saja |
| audit_event | admin_id, action, resource_id, timestamp, hasil | Admin saja, tanpa isi sensitif |
| submission_guard | idempotency_hash, scope, expires_at, hasil minimal | Server saja |

## Constraint
- Admin menggunakan singleton constraint sehingga hanya satu akun dapat aktif/tersimpan sesuai keputusan. Tidak ada jalur create admin melalui API.
- Simpan hash password dan hash token sesi. Token mentah sesi hanya berada pada cookie pengunjung admin.
- Nomor tiket dan registrasi dibuat server, unik pada database, tidak memakai hitungan browser.
- NIM dan nomor telepon berupa string, bukan angka, agar nol awal tetap ada.
- Gunakan foreign key, indeks, timestamps, dan constraint panjang/enum sesuai source.
- Urutan section, anggota, program, foto dan dokumen dapat dikelola admin.
- Field JSON konten harus memiliki schema validasi per jenis bagian. Jangan membuat arbitrary HTML editor tanpa sanitasi.
- Simpan waktu sebagai timestamp dengan zona waktu; konversi waktu acara berdasarkan zona waktu yang disepakati. Jangan mengikuti timezone browser secara diam-diam.
- Unique `(event_id, nim)` hanya diterapkan setelah pengguna menetapkan kebijakan duplikasi.
- Hitungan foto diturunkan dari data yang tersedia. Jangan membuat 42 foto palsu untuk menyamai label sumber jika file hanya sebagian.

## Data sensitif
Pisahkan media publik dari pas foto/KTM private. Jangan memasukkan tabel privat ke Data API publik. Terapkan least privilege dan policy deny-by-default pada schema/bucket sensitif. Jika memakai koneksi database server yang melewati RLS, otorisasi backend tetap wajib; jangan mengandalkan RLS yang tidak berjalan pada koneksi tersebut.

## Migrasi dan seed
Migrasi terlacak dalam git. Seed konten mengambil sumber asli dan memelihara identitas import yang stabil. Jangan men-seed peserta/pengaduan nyata atau password default. Menjalankan seed kedua kali tidak membuat duplikasi atau menghapus perubahan admin. Akun admin diprovision terpisah dari seed.

## Keputusan tertunda
Status peserta/pengaduan, retensi, penghapusan, duplikasi, batas kuota, dan export harus mengikuti jawaban pengguna. Tabel tambahan hanya dibuat jika mendukung fitur terkonfirmasi.
