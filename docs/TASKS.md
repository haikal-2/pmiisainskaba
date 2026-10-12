# Urutan pekerjaan agent

Semua item berstatus belum diimplementasikan pada paket ini. Agent menandai selesai hanya setelah hasil tersedia dan diperiksa.

## 0. Inventaris dan keputusan
- [ ] Terima/baca source serta aset asli.
- [ ] Identifikasi seluruh route, breakpoint, font, icon, form, skrip, dokumen dan interaksi.
- [ ] Bandingkan source dengan website publik.
- [ ] Jawab keputusan relevan pada OPEN_QUESTIONS bersama pengguna.
- [ ] Catat versi dependency dari dokumentasi resmi dan kunci lockfile.
Hasil: manifest referensi, route map dan keputusan terkonfirmasi.

## 1. Fondasi
- [ ] Next.js App Router dan TypeScript strict.
- [ ] Struktur layanan server, repository, schema, DTO dan error.
- [ ] Template environment dan validasi konfigurasi.
- [ ] Typecheck, lint dan build dasar.
Hasil: proyek berjalan tanpa mock produksi.

## 2. Database dan storage
- [ ] Schema/migrasi, indeks dan least privilege.
- [ ] Bucket publik/private serta aturan akses.
- [ ] Import konten asli idempotent.
- [ ] Koneksi serverless dan akses migrasi dipisahkan sesuai provider.
Hasil: konten berasal dari database dan file tersimpan permanen.

## 3. Admin
- [ ] CLI provisioning/reset/revoke untuk satu admin.
- [ ] Login pada path pilihan pengguna, tanpa register.
- [ ] Sesi persisten, logout, expiry, proteksi server.
- [ ] Tidak ada tautan admin pada halaman publik.
Hasil: akses langsung berhasil dengan kredensial benar dan API tanpa sesi ditolak.

## 4. Halaman publik
- [ ] Migrasi beranda, sejarah, struktur, KOPRI, galeri, dokumen, advokasi dan MAPABA.
- [ ] Font/aset/teks/animasi/breakpoint sesuai source.
- [ ] Navigasi, form, accordion, filter dan interaksi sesuai keputusan.
Hasil: seluruh route tampil dan berfungsi pada desktop/mobile.

## 5. Integrasi form
- [ ] Advokasi: validasi, consent, commit dan tiket unik.
- [ ] MAPABA: validasi, aturan waktu/eligibility/duplikasi/kuota terkonfirmasi.
- [ ] Upload direct, verifikasi file, finalisasi dan cleanup draft gagal.
- [ ] Idempotency dan status loading/error/success nyata.
Hasil: peserta dan laporan dapat dibaca admin, tidak tersedia publik.

## 6. Pengelolaan semua modul
- [ ] Editor terstruktur beranda, sejarah, pengaturan/kontak.
- [ ] Struktur organisasi dan periode.
- [ ] KOPRI dan program.
- [ ] Album/foto/kategori sesuai aturan.
- [ ] Dokumen dan tautan/file sesuai pilihan.
- [ ] Event/agenda/FAQ MAPABA dan administrasi peserta.
- [ ] Laporan/catatan/status Advokasi.
- [ ] Invalidasi cache konten dan penanganan konflik edit.
Hasil: edit admin tersimpan, tetap ada setelah refresh/deploy dan tampil di publik.

## 7. Verifikasi
- [ ] Seluruh kriteria pada ACCEPTANCE_CRITERIA diuji.
- [ ] Pemeriksaan visual dengan source asli.
- [ ] Perbaiki kegagalan, kebocoran data dan perbedaan layout.
Hasil: laporan bukti, bukan checklist tanpa hasil.

## 8. Deployment
- [ ] Siapkan environment Vercel, Neon, dan Vercel Blob tanpa membagikan rahasia.
- [ ] Migrasi dan provisioning terkontrol, bukan build hook otomatis.
- [ ] Deploy ke target yang diberikan pengguna dan verifikasi.
- [ ] Dokumentasikan runbook pemeliharaan, backup dan reset admin.
Hasil: aplikasi tersambung di lingkungan target atau penghambat konfigurasi dijelaskan secara spesifik.
