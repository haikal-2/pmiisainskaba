# Keamanan dan akses admin

## URL khusus
URL admin tidak tampil pada navigasi publik, footer, menu mobile, sitemap, CTA, atau shortcut. Halaman admin menggunakan noindex dan header X-Robots-Tag yang sesuai. Robots/noindex tidak mengamankan data dan tidak menjamin URL tidak ditemukan. Jangan menjanjikan URL rahasia tidak bisa dilacak.

ADMIN_PATH hanya konfigurasi server, tidak memakai NEXT_PUBLIC_. Path diketahui oleh admin secara langsung. Route API autentikasi boleh stabil, tetapi jangan mengirimkannya melalui komponen publik tanpa kebutuhan.

## Akun
Hanya satu admin. Buat CLI provisioning lokal/server, dengan input username dan prompt password tersembunyi. Fail jika akun sudah ada. Tidak ada kredensial default. Reset kredensial melalui CLI yang terpisah dan cabut seluruh sesi setelah reset. Dokumentasikan penargetan database agar tidak mengubah database yang salah.

Gunakan hash password dari implementasi teruji. Jangan menggunakan hash cepat biasa, enkripsi reversible untuk password, atau plaintext. Jangan mengembangkan algoritma autentikasi sendiri. Pakai timing-safe verification dari library.

## Sesi
Token acak kriptografis opaque dalam cookie HttpOnly. Simpan hanya hash token di database. Rotasi sesi saat login dan hapus token server saat logout. Expiry ditentukan konfigurasi dan ditanyakan kepada pengguna. Sesi yang kadaluarsa, dicabut, atau terkait admin nonaktif harus ditolak.

Layout/proxy hanya lapisan pengalaman pengguna. Setiap Route Handler, layanan privat dan server action memeriksa sesi sendiri. Tidak ada bypass melalui API langsung.

## Penyimpanan
- Bucket aset publik hanya untuk konten organisasi yang diterbitkan.
- Pas foto dan KTM masuk bucket private. Akses melalui pemeriksaan backend dan URL sementara.
- Pengaduan dan identitas tidak memiliki endpoint publik dan hanya dapat dibaca melalui operasi server yang mengharuskan sesi admin.
- Service role key hanya server-side, tidak masuk bundle browser.
- Upload divalidasi ukuran, ekstensi, signature file, MIME dan pemilik draft. Jangan menerima SVG aktif sebagai foto. Jangan membuat nama objek dari NIM atau kontak.
- Setiap tiket upload anonim terbatas path/ukuran/tipe/waktu sesuai fasilitas provider dan verifikasi finalisasi server. Jika provider tidak menegakkan semua batas, server tetap memverifikasi objek sebelum diterima dan membersihkan objek gagal.

## Perlindungan request
Validasi server untuk semua input. Terapkan CSRF/Origin check pada mutasi berbasis cookie, sanitasi konten dan URL, parameterized query/ORM, serta rate limit yang bekerja lintas fungsi Vercel. Tanpa konfigurasi pembatas persisten, jangan melaporkan rate limiting selesai.

Referensi mengklaim IP tidak disimpan. Aplikasi tidak boleh menyimpan IP mentah pada tabel, log, atau audit. Jangan menjanjikan log infrastruktur pihak ketiga tidak memuat IP tanpa pemeriksaan konfigurasi. Jika ingin menggunakan pengenal turunan IP untuk rate limit, jelaskan dan tanyakan pengguna sebelum membuatnya.

## Logging
Audit admin mencatat tindakan, objek, waktu dan hasil tanpa isi pengaduan atau kredensial. Error publik generik dengan request ID. Jangan mencatat form payload sensitif. Pisahkan test dari produksi.

## Hal yang harus diputuskan
Retensi data dan file, penghapusan, durasi sesi, kebijakan tracking tiket, notifikasi, dan penggunaan identitas untuk pembatas spam. Tidak ada MFA atau CAPTCHA baru tanpa keputusan pengguna yang memengaruhi alur login/form.
