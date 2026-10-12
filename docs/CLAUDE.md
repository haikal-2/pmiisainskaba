# Instruksi repositori untuk agent Claude

## Prioritas
Instruksi pengguna terbaru menjadi acuan utama. Dokumen ini menegaskan kebutuhan proyek, bukan izin mengakses atau mengubah website referensi. Website referensi hanya dibaca. Jangan mengirim pengaduan, pendaftaran, atau data uji ke website asli.

## Prinsip implementasi
- TypeScript strict untuk kode aplikasi frontend dan backend.
- Next.js App Router, dengan Route Handlers untuk API browser. Tidak menggunakan static export untuk aplikasi ini.
- PostgreSQL di Neon menjadi penyimpanan permanen; Vercel Blob dipakai untuk file pada fase integrasi upload.
- Pertahankan CSS asli bila memungkinkan untuk mengurangi perbedaan visual. Jangan memilih UI kit yang mengubah tampilan.
- Server Components mengambil data melalui layanan server. Client Components menggunakan kontrak API untuk interaksi.
- Modul database, storage berprivilege, password, dan sesi diberi batas `server-only`.
- Hindari kebocoran rahasia ke props, HTML, client bundle, source map publik, atau error.
- Periksa dokumentasi resmi terkini sebelum memilih versi dependency dan konfigurasi. Kunci versi dan commit lockfile. Jangan menebak versi terbaru.

## Keputusan teknis
Struktur folder, ORM, pustaka validasi, hashing, dan pustaka test pada dokumen adalah rancangan implementasi, bukan fitur bisnis tambahan. Jika agent memilih alternatif, jelaskan alasan dan perbarui dokumen tanpa mengubah kebutuhan pengguna. Perubahan penyedia layanan, framework utama, biaya, aturan bisnis, dan pengalaman pengguna memerlukan jawaban pengguna.

## Larangan
- Jangan membuat register atau login pengguna publik.
- Jangan membuat register admin atau endpoint provisioning akun.
- Jangan menaruh password default, service role key, atau koneksi database dalam kode.
- Jangan mencatat isi pengaduan, KTM, password, token, atau nomor kontak di log.
- Jangan menggunakan database produksi untuk pengujian otomatis.
- Jangan menyimpan upload di filesystem Vercel sebagai hasil permanen.
- Jangan menambahkan ujian, blog, payment gateway, chatbot, email otomatis, atau fitur lain hanya karena terlihat berguna.
- Jangan menambahkan subagent atau kerja paralel agent kecuali pengguna mengizinkannya.

## Cara bekerja
Baca source sebelum mengubahnya. Pertahankan perubahan pengguna. Tulis progres yang singkat. Pisahkan keputusan terkonfirmasi, hasil pengamatan, dan usulan. Perbarui status tugas berdasarkan bukti. Saat akses tidak tersedia, jelaskan kebutuhan konfigurasi secara tepat tanpa meminta rahasia lewat chat.

## Pemeriksaan sebelum selesai
Jalankan typecheck, lint, build, pengujian autentikasi/otorisasi dan alur penyimpanan yang relevan. Lakukan perbandingan visual dengan viewport yang sama dan setelah animasi selesai. Jangan melaporkan pemeriksaan yang belum dijalankan sebagai lulus.
