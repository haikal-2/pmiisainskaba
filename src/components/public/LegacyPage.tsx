import 'server-only';

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { notFound } from 'next/navigation';

import LegacyInteractions from '@/components/public/LegacyInteractions';

const SOURCE_FILES = {
  home: 'index.html',
  history: 'profil/sejarah.html',
  structure: 'profil/struktur.html',
  kopri: 'kopri.html',
  gallery: 'galeri.html',
  legal: 'landasan-hukum.html',
  advocacy: 'advokasi.html',
  mapaba: 'mapaba.html',
} as const;

export type LegacyPageKey = keyof typeof SOURCE_FILES;

const ROUTES: ReadonlyArray<[RegExp, string]> = [
  [/profil\/sejarah\.html/gi, '/profil/sejarah'],
  [/profil\/struktur\.html/gi, '/profil/struktur'],
  [/(?:\.\/)?kopri\.html/gi, '/kopri'],
  [/(?:\.\/)?galeri\.html/gi, '/galeri'],
  [/(?:\.\/)?landasan-hukum\.html/gi, '/landasan-hukum'],
  [/(?:\.\/)?advokasi\.html/gi, '/advokasi'],
  [/(?:\.\/)?mapaba\.html/gi, '/mapaba'],
  [/(?:\.\/)?index\.html/gi, '/'],
];

function rewriteMarkup(markup: string, page: LegacyPageKey): string {
  let html = markup;
  for (const [pattern, route] of ROUTES) html = html.replace(pattern, route);
  html = html.replace(/(src|href)="assets\//g, '$1="/assets/');
  html = html.replace(/href="site\.webmanifest"/g, 'href="/site.webmanifest"');

  if (page === 'mapaba') {
    html = html
      // Frasa spesifik lebih dulu: penggantian tanggal generik di bawah
      // mematahkan pola frasa bila dijalankan terbalik.
      .replaceAll('Pendaftaran Dibuka 1 Oktober 2026', 'Pendaftaran Dibuka')
      .replaceAll(
        'akan dibuka pada 1 Oktober 2026 dan ditutup pada 28 Oktober 2026',
        'telah dibuka dan akan ditutup pada 3 November 2026',
      )
      .replaceAll('Pendaftaran dibuka dalam', 'Pendaftaran ditutup dalam')
      .replaceAll('Pendaftaran Belum Dibuka', 'Pendaftaran Dibuka')
      .replaceAll('31 Okt – 2 Nov', '6–8 November 2026')
      .replaceAll('31 Okt - 2 Nov', '6–8 November 2026')
      .replaceAll('data-countdown="2026-10-01T00:00:00+07:00"', 'data-countdown="2026-11-03T23:59:59+07:00"')
      .replaceAll('data-registration-opens="2026-10-01T00:00:00+07:00"', 'data-registration-opens="2026-01-01T00:00:00+07:00"')
      .replaceAll('data-registration-closes="2026-10-28T23:59:59+07:00"', 'data-registration-closes="2026-11-03T23:59:59+07:00"')
      .replaceAll('2026-10-28T23:59:59+07:00', '2026-11-03T23:59:59+07:00')
      .replaceAll('2026-11-01T23:59:59+07:00', '2026-11-03T23:59:59+07:00')
      .replaceAll('28 Oktober 2026', '3 November 2026')
      .replaceAll('1 November 2026', '3 November 2026')
      // Label atribut data-registration-opens-label dan sisa teks umum.
      .replaceAll('1 Oktober 2026', 'Dibuka')
      .replaceAll('150 peserta', '100 peserta')
      .replaceAll('200 peserta', '100 peserta');

    // Field universitas menjadi pilihan sesuai keputusan pengguna.
    html = html.replace(
      /<input class="input" id="universitas" name="universitas" type="text" required maxlength="150"[\s\S]*?data-label="Universitas"\s*\/>/,
      '<select class="input" id="universitas" name="universitas" required data-label="Universitas"><option value="UIN Sunan Gunung Djati Bandung">UIN Sunan Gunung Djati Bandung</option><option value="lainnya">Perguruan tinggi lain di Kabupaten Bandung</option></select><input class="input mt-3 hidden" id="universitasLain" type="text" maxlength="150" placeholder="Nama perguruan tinggi" aria-label="Nama perguruan tinggi">',
    );
  }

  if (page === 'home') {
    html = html
      .replaceAll('Dibuka 1 Okt 2026', 'Pendaftaran Dibuka')
      .replaceAll('31 Okt – 2 Nov', '6–8 November 2026')
      .replaceAll('31 Okt - 2 Nov', '6–8 November 2026');
  }

  if (page === 'gallery') {
    html = html.replace(/<a href="#"/g, '<a href="#gallery-album" data-gallery-album');
  }
  return html;
}

export async function LegacyPage({ page }: { page: LegacyPageKey }) {
  const file = SOURCE_FILES[page];
  if (!file) notFound();
  const sourcePath = resolve(process.cwd(), 'reference-original', file);
  const source = await readFile(sourcePath, 'utf8');
  const body = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  if (!body) throw new Error(`Markup body sumber ${file} tidak ditemukan.`);

  // HTML ini berasal dari source referensi statis yang diunduh read-only dan
  // dikomit bersama aplikasi. Semua data dinamis/sensitif dirender terpisah.
  const safeMarkup = rewriteMarkup(
    body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<script\b[^>]*\/\s*>/gi, ''),
    page,
  );

  return (
    <>
      <div id="main-content" dangerouslySetInnerHTML={{ __html: safeMarkup }} />
      {/* Konfigurasi widget captcha klien dibaca oleh skrip widget captcha.
          Provider nonaktif = widget disembunyikan oleh captcha.js. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.PMII_CONFIG=Object.assign(window.PMII_CONFIG||{},{captcha:{provider:${JSON.stringify(
            process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER || 'none',
          )},siteKey:${JSON.stringify(process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY || '')}}});`,
        }}
      />
      <LegacyInteractions page={page} />
      {/* Widget captcha klien (hanya bila provider diisi; skrip penyedia dimuat captcha.js). */}
      {(process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER || 'none') !== 'none' && (
        <script src="/assets/js/captcha.js" defer />
      )}
    </>
  );
}
