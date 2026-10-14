# Teknis Feedback dan Rencana Implementasi untuk pmiisainskaba-pi.vercel.app

## Ringkasan Kesimpulan dan Umbalan

Berdasarkan audit teknis terhadap arsitektur backend, struktur API, dan implementasi basis data aplikasi yang dihosting di https://pmiisainskaba-pi.vercel.app/, berikut adalah temuan utama:

1. **Arsitektur Backend**: Aplikasi menggunakan Next.js 16 dengan App Router. Logika backend terstruktur secara modular di bawah `src/server/`, dengan pemisahan tanggung jawab yang jelas untuk layanan, integrasi, keamanan, dan akses basis data. Basis data mengakses PostgreSQL melalui driver `pg` tanpa ORM, memberikan kontrol penuh atas SQL. Koneksi basis data dikelola melalui pool dengan ukuran kecil yang sesuai dengan arsitektur serverless Vercel.

2. **Struktur API**: API diorganisasikan menggunakan route handler Next.js di `src/app/api/`. Endpoint publik yang relevan termasuk:
   - `GET /api/public/mapaba` – seharusnya mengembalikan detail acara MAPABA.
   - `POST /api/public/mapaba/registrations` – menangani pendaftaran peserta.
   - `POST /api/public/advocacy/reports` – menangani pengaduan advokasi.
   - `GET /api/internal/health` – pemeriksaan ketergantungan operasional.
   Middleware meliputi pemeriksaan ukuran body, rate limiting, verifikasi CAPTCHA, dan validasi payload menggunakan Zod. Respons API terstandarisasi melalui fungsi `ok` dan `fail` yang menyertakan request ID untuk traceability.

3. **Implementasi Basis Data**: Skema didefinisikan dalam file migrasi SQL. Tabel `mapaba_event` dirancang sebagai entri singleton (`id = 1`) dengan kolom `published` yang default-nya `true`. Fungsi seed (`src/server/db/seed.ts`) tidak secara eksplisit menyetel kolom `published`, bergantung pada nilai default. Jika baris sudah ada dan nilai `published` telah berubah menjadi `false`, seed berikutnya tidak akan menimpanya karena penggunaan `ON CONFLICT (id) DO NOTHING`.

4. **Temuan Utama**:
   - Endpoint publik `/api/public/mapaba` mengembalikan 500 Internal Server Error karena query basis data gagal (kemungkinan karena baris `mapaba_event` dengan `id = 1` tidak ada atau tidak dipublikasikan).
   - Layanan Cron tidak tersedia karena variabel lingkungan `CRON_SECRET` tidak disetel ( kondisi yang diharapkan jika tidak dikonfigurasi).
   - Layanan Google Sheets dan Composio dinonaktifkan karena kredensial tidak disetel (konfigurasi sengaja untuk mencegah integrasi eksternal bila tidak diperlukan).
   - Header keamanan global (CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy) sudah diimplementasikan melalui `src/proxy.ts`.
   - Validasi dan rate sisi server sudah ada dan sesuai dengan praktik baik.

5. **Masalah Cloudflare Protection (seperti yang diminta)**:
   - Aplikasi saat ini menggunakan rate limiting sisi server dan CAPTCHA untuk melindungi pengiriman formulir (MAPABA dan Advokasi).
   - Tidak ada integrasi Cloudflare dalam kode atau konfigurasi yang terdeteksi selama audit. Domain menggunakan subdomain Vercel (`pmiisainskaba-pi.vercel.app`), yang berarti tidak ada proxy Cloudflare di depan kecuali dikonfigurasi secara khusus melalui domain kustom dan pengaturan Cloudflare for SaaS (which is complex and not in place).
   - Jika diperlukan lapisan keamanan tambahan seperti WAF, perlindungan DDoS, atau Bot Management dari Cloudflare, maka integrasi saat ini hilang.

## Daftar Perbaikan Teknis yang Diperlukan

1. **Perbaiki Data `mapaba_event`**:
   - Pastikan baris dengan `id = 1` ada di tabel `mapaba_event` dan memiliki `published = true`.
   - Jadikan fungsi seed secara eksplisit menyetel kolom `published` untuk menghindari ketergantungan pada nilai default.

2. **Perbarui Fungsi Seed untuk Kolom `published`**:
   - Modifikasi `seedMapaba` di `src/server/db/seed.ts` untuk menyertakan kolom `published` dalam Pernyataan `INSERT` dan menyetelnya ke `true`.
   - Perbarui klausa `ON CONFLICT` untuk memperbarui kolom `published` sehingga baris yang ada dipastikan terbit.

3. **Konfigurasi Variabel Lingkungan untuk Layanan Opsional (jika diperlukan)**:
   - Jika layanan cron diperlukan: atur `CRON_SECRET`.
   - Jika layanan Google Sheets diperlukan: atur `GOOGLE_SHEETS_ADVOKASI_WEBHOOK_URL`, `GOOGLE_SHEETS_MAPABA_WEBHOOK_URL`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, dan `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.
   - Jika layanan Composio diperlukan: atur `COMPOSIO_API_KEY`.

4. **Evaluasi dan Implementasi Perlindungan Cloudflare (jika diperlukan)**:
   - Tentukan apakah proyek memerlukan lapisan keamanan tambahan dari Cloudflare (WAF, DDoS protection, Bot Management) di atas yang sudah ada (rate limiting, CAPTCHA, dan potensi perlindungan bawaan Vercel).
   - Jika ya, lakukan salah satu dari berikut:
     a. Migrasikan ke domain kustom dan konfigurasikan Cloudflare untuk memproxy domain tersebut.
     b. Gunakan Cloudflare for SaaS untuk melindungi subdomain Vercel (lebih kompleks dan mungkin tidak diperlukan jika perlindungan bawaan Vercel cukup).
   - Alternatifnya,andalkan pada perlindungan bawaan Vercel (jika ada dalam rencana) dan pastikan bahwa rate limiting dan CAPTCHA sudah dikonfigurasi dengan benar.

## Laporan Bug Spesifik: Bagian Mapaba dan Advokasi – Perlindungan Cloudflare yang Hilang pada Pengiriman Formulir

**Judul**: Hilang Integrasi Cloudflare untuk Keamanan yang Ditingkatkan pada Pengiriman Formulir

**Deskripsi**:
Aplikasi saat ini mengandalkan rate limiting sisi server dan CAPTCHA untuk melindungi pengiriman formulir (MAPABA dan Advokasi). Meskipun efektif melawan serangan volume sedang dan bot dasar, tidak ada lapisan keamanan tambahan dari Cloudflare (seperti Web Application Firewall, perlindungan DDoS, atau Bot Management) yang dapat memberikan pertahanan terhadap serangan volumetrik yang besar dan bot yang lebih canggih. Hal ini membiarkan aplikasi rentan terhadap lalu lintas yang dapat membypass perlindungan sisi server.

**Langkah untuk Mereproduksi**:
1. Periksa pengaturan DNS untuk domain `pmiisainskaba-pi.vercel.app` (atau domain utama jika berbeda) untuk melihat apakah ia diarahkan langsung ke Vercel atau melalui Cloudflare.
2. Perhatikan bahwa tidak ada header khusus Cloudflare (mis. `cf-ray`, `cf-visitor`) yang terlihat dalam respons HTTP yang diperiksa selama audit (meskipun header ini adalah header permintaan, tidak respons).
3. Catat bahwa kode aplikasi tidak berisi logika untuk mempercayai atau menggunakan header Cloudflare untuk identifikasi pengunjung atau penilaian ancaman.

**Hasil yang Diharapkan**:
Aplikasi seharusnya ditempatkan di belakang Cloudflare, dengan domain dikonfigurasi untuk menggunakan proxy Cloudflare, dan server asal (Vercel) seharusnya dibatasi untuk hanya menerima lalu lintas dari rentang IP Cloudflare. Secara opsional, aplikasi bisa menggunakan header Cloudflare (seperti `cf-connecting-ip` untuk IP asli, setelah memvalidasi bahwa permintaan datang dari Cloudflare) untuk meningkatkan keamanan.

**Hasil yang Sejati**:
Domain saat ini diarahkan langsung ke Vercel (seperti yang ditunjukkan oleh subdomain Vercel dan tidak ada tanda proxy Cloudflare dalam audit), dan tidak ada mekanisme dalam aplikasi untuk memanfaatkan fitur keamanan Cloudflare.

## Rencana Tindakan Lengkap

### Fase 1: Perbaiki Masalah Sekunder yang Menyebabkan Kesalahan 500
| Tugas | Deskripsi | Metodologi Teknis |
|-------|-----------|-------------------|
| 1.1 | Pastikan data `mapaba_event` lengkap dan benar | - Conect ke basis data produksi (melalui integrasi PostgreSQL Vercel atau koneksi langsung jika diizinkan).<br>- Periksa keadaan saat ini tabel `mapaba_event`.<br>- Jika baris hilang, sisipkan dengan data yang benar dan setel `published = true`.<br>- Jika baris ada tetapi `published` adalah `false`, perbarui menjadi `true`.<br>- Alternatifnya, jalani skrip seed dengan klausa `ON CONFLICT DO UPDATE` untuk memastikan kolom `published` disetel ke `true`. |
| 1.2 | Perbarui fungsi seed untuk secara eksplisit menyetel kolom `published` | - Berkas edit `src/server/db/seed.ts`.<br>- Di fungsi `seedMapaba`, tambahkan kolom `published` ke dalam daftar `INSERT` dan setel ke `true`.<br>- Perbarui klausa `ON CONFLICT` untuk memperbarui kolom `published` ke nilai baru (yang memastikan baris yang ada disetel ke `true`).<br>- Deploy perubahan. |

### Fase 2: Verifikasi dan Konfigurasi Layanan Opsional (jika diperlukan)
| Tugas | Deskripsi | Metodologi Teknis |
|-------|-----------|-------------------|
| 2.1 | Tentukan layanan apa yang diperlukan (cron, Google Sheets, Composio) | - Konsultasikan dengan pemilik produk atau dokumentasi proyek untuk menentukan apakah layanan-layanan ini diperlukan untuk fungsionalitas produksi. |
| 2.2 | Atur variabel lingkungan di Vercel untuk layanan yang diperlukan | - Di pengaturan proyek Vercel, tambahkan variabel lingkungan berikut sesuai kebutuhan:<br>  &nbsp;&nbsp;• `CRON_SECRET` (untuk cron)<br>  &nbsp;&nbsp;• `GOOGLE_SHEETS_ADVOKASI_WEBHOOK_URL`, `GOOGLE_SHEETS_MAPABA_WEBHOOK_URL`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (untuk Google Sheets)<br>  &nbsp;&nbsp;• `COMPOSIO_API_KEY` (untuk Composio)<br>- Simpan perubahan dan redeploy aplikasi. |

### Fase 3: Evaluasi dan Implementasi Perlindungan Cloudflare (jika diperlukan)
| Tugas | Deskripsi | Metodologi Teknis |
|-------|-----------|-------------------|
| 3.1 | Tentukan apakah perlindungan Cloudflare diperlukan | - Evaluasi kebutuhan proyek untuk fitur keamanan tambahan seperti WAF kustom, Bot Management, atau jika perlindungan bawaan Vercel (jika ada) tidak cukup.<br>- Pertimbangkan kompleksitas dan biaya dari mengintegrasikan Cloudflare dengan subdomain Vercel versus menggunakan domain kustom. |
| 3.2 | Jika diperlukan dan menggunakan domain kustom: | - Beli dan konfigurasikan domain kustom (jika belum ada).<br>- Tambahkan domain ke akun Cloudflare dan ubah nameserver untuk mempointer ke Cloudflare.<br>- Di Cloudflare, aktifkan fitur keamanan yang diinginkan (WAF, Bot Management, dll.) dan konfigurasikan aturan sesuai kebutuhan.<br>- Di Vercel, tambahkan domain kustom ke proyek dan verifikasi konfigurasi.<br>- Opsional: gunakan Autenticated Origin Pulls dari Cloudflare atau tambahkan middleware untuk memvalidasi header Cloudflare (setelah memastikan bahwa hanya traffic dari Cloudflare yang dapat mencapai origin). |
| 3.3 | Jika diperlukan dan menggunakan subdomain Vercel (lebih kompleks): | - Evaluasi penggunaan Cloudflare for SaaS untuk melindungi subdomain Vercel (memerlukan konfigurasi tingkat enterprise dan mungkin tidak praktis).<br>- Jika tidak praktis, pertimbangkan untuk mengandalkan perlindungan bawaan Vercel (jika tersedia dalam rencana) dan pastikan bahwa rate limiting dan CAPTCHA sudah dikonfigurasi dengan benar. |
| 3.4 | Jika tidak diperlukan: | - Catat bahwa aplikasi mengandalkan rate limiting sisi server, CAPTCHA, dan potensi perlindungan bawaan Vercel untuk keamanan formulir.<br>- Tidak diperlukan tindakan lebih lanjut terkait Cloudflare. |

### Fase 4: Verifikasi dan Pengujian
| Tugas | Deskripsi | Metodologi Teknis |
|-------|-----------|-------------------|
| 4.1 | Verifikasi bahwa endpoint `/api/public/mapaba` kembali bekerja | - Kirim permintaan `GET` ke `https://pmiisainskaba-pi.vercel.app/api/public/mapaba` dan pastikan mengembalikan respons 200 dengan data acara yang benar. |
| 4.2 | Verifikasi bahwa pendaftaran MAPABA dan pengaduan advokasi berfungsi | - Uji endpoint `POST` dengan payload valid (gunakan alat seperti curl atau Postman) dan pastikan mengembalikan respons 201.<br>- Verifikasi bahwa rate limiting dan CAPTCHA berfungsi seperti yang diharapkan (misalnya, dengan mengirimkan permintaan berlebihan atau token CAPTCHA yang tidak valid). |
| 4.3 | Verifikasi bahwa layanan opsional berfungsi (jika dikonfigurasi) | - Jika cron diaktifkan, verifikasi bahwa endpoint cron tersedia dan terlindungi.<br>- Jika Google Sheets atau Composio diaktifkan, verifikasi bahwa integrasi berfungsi dengan memicu operasi yang relevan. |
| 4.4 | Verifikasi header keamanan | - Periksa respons HTTP dari endpoint manapun untuk memastikan bahwa header keamanan (CSP, X-Frame-Options, dll.) ada dan dikonfigurasi dengan benar. |

## Catatan
- Perbaikan di Fase 1 dan 2 krusial untuk mengembalikan fungsionalitas dasar aplikasi.
- Fase 3 hanya diperlukan jika proyek secara eksplisit memerlukan lapisan keamanan tambahan dari Cloudflare. Jika tidak, langkah-langkah ini dapat diabaikan.
- Selalu cadangkan basis data sebelum melakukan perubahan langsung.
- Semua perubahan kode harus diikuti dengan proses penerapan ke Vercel dan pengujian di lingkungan staging (jika ada) sebelum produksi.
