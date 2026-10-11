import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Database, DbExecutor } from './types';

/**
 * Import konten dasar dari salinan HTML asli.
 *
 * Import hanya idempotent pada entitas dengan natural key (slug / key).
 * Menjalankan seed berulang tidak menggandakan konten dan tidak menimpa edit
 * yang sudah dilakukan admin. Data pendaftar/pengaduan tidak pernah di-seed.
 */

const sourceFiles = ['index.html', 'profil/sejarah.html', 'profil/struktur.html', 'kopri.html', 'galeri.html', 'landasan-hukum.html', 'advokasi.html', 'mapaba.html'] as const;

async function ensureReferenceSource(sourceRoot: string): Promise<void> {
  await Promise.all(sourceFiles.map((file) => readFile(resolve(sourceRoot, file))));
}

const sectionSeed = [
  { page: 'home', key: 'quick-access', eyebrow: 'Akses Cepat', title: 'Semua yang kamu butuhkan, satu klik saja', subtitle: 'Informasi, dokumentasi, dokumen konstitusi, hingga layanan kaderisasi — tersusun rapi dalam satu panel.', sort: 10, body: { cards: ['Layanan Advokasi', 'Galeri Kegiatan', 'Landasan Hukum', 'KOPRI Rayon Saintek'] } },
  { page: 'home', key: 'about', eyebrow: 'Tentang Kami', title: 'Berakar pada sejarah, bergerak untuk masa depan', subtitle: null, sort: 20, body: { paragraphs: ['Pergerakan Mahasiswa Islam Indonesia (PMII) berdiri pada 17 April 1960 di Surabaya, lahir dari kesadaran mahasiswa Islam untuk memiliki wadah perjuangan yang independen, berhaluan Ahlussunnah wal Jama’ah, dan setia pada Negara Kesatuan Republik Indonesia.', 'PR PMII Sains dan Teknologi UIN Sunan Gunung Djati Cabang Kabupaten Bandung meneruskan amanat tersebut di lingkungan kampus: visi kami adalah terbentuknya pribadi muslim Indonesia yang bertakwa kepada Allah SWT, berbudi luhur, berilmu, cakap, dan bertanggung jawab dalam mengamalkan ilmunya. Misi diwujudkan melalui kaderisasi berjenjang, penguatan tradisi intelektual dan literasi, advokasi kepentingan mahasiswa, serta pengabdian nyata kepada masyarakat.'] } },
  { page: 'home', key: 'trilogy', eyebrow: null, title: 'Tiga nilai dasar', subtitle: null, sort: 30, body: { values: [{ title: 'Taqwa', body: 'Kesadaran untuk selalu dekat dengan Allah SWT, menaati perintah-Nya, dan menjauhi larangan-Nya dalam setiap langkah kehidupan.' }, { title: 'Intelektual', body: 'Kemampuan memahami ilmu, berpikir kritis, dan membaca realitas secara jernih untuk melahirkan gagasan yang bermanfaat.' }, { title: 'Profesional', body: 'Sikap bekerja dengan kompeten, disiplin, bertanggung jawab, berintegritas, dan menjunjung tinggi etika.' }] } },
  { page: 'home', key: 'quote', eyebrow: null, title: 'Teguh Pada Prinsip, Setia Pada Proses', subtitle: 'Mahbub Djunaidi · Ketua Umum PB PMII pertama', sort: 40, body: {} },
  { page: 'sejarah', key: 'article', eyebrow: 'Profil', title: 'Sejarah', subtitle: 'Dari musyawarah mahasiswa Nahdliyin di Surabaya pada 17 April 1960, hingga kerja-kerja kaderisasi di lingkungan UIN Sunan Gunung Djati Bandung hari ini.', sort: 10, body: { sourceFile: 'profil/sejarah.html' } },
  { page: 'kopri', key: 'profile', eyebrow: 'Korps PMII Putri', title: 'KOPRI Rayon Sains dan Teknologi', subtitle: 'Ruang tumbuh kader perempuan PMII Rayon Sains dan Teknologi: belajar berpikir kritis, berani bersuara, dan siap memimpin — di kampus maupun di tengah masyarakat.', sort: 10, body: { sourceFile: 'kopri.html' } },
];

const settings = {
  brand_name: 'PR PMII Sains dan Teknologi UIN Sunan Gunung Djati Cabang Kabupaten Bandung',
  brand_short: 'PR PMII Saintek',
  campus_label: 'UIN SGD Cab. Kab. Bandung',
  tagline: 'Organisasi ekstra kampus yang berlandaskan Islam Ahlussunnah wal Jama\'ah dan Pancasila.',
  motto: 'Taqwa · Intelektual · Profesional',
  description: 'Website resmi PR PMII Sains dan Teknologi UIN Sunan Gunung Djati Cabang Kabupaten Bandung. Organisasi ekstra kampus yang berlandaskan Islam Ahlussunnah wal Jama\'ah dan Pancasila. Taqwa, Intelektual, Profesional.',
  email: 'pmiirayonsains@gmail.com',
  instagram_url: 'https://instagram.com/pmii_sainskaba',
  instagram_handle: '@pmii_sainskaba',
  whatsapp_primary: '+6285215540291',
  whatsapp_primary_name: 'Sahabat Haikal',
  whatsapp_secondary: '+6285320549926',
  whatsapp_secondary_name: 'Sahabat Ramdhan',
  address: 'Jl. Pilar Utara No. 2 (Pager Silver), Cibiru Hilir, Cileunyi, Kab. Bandung, Jawa Barat',
  map_address_short: 'Cileunyi, Kab. Bandung',
  hero_title_lead: 'PR PMII',
  hero_title_highlight: 'Sains dan Teknologi',
  hero_title_tail: 'UIN Sunan Gunung Djati Cabang Kabupaten Bandung',
  hero_eyebrow: 'Salam Pergerakan!',
  stat_founded: '1960',
  stat_members: '50+',
  stat_study_programs: '8',
};

async function seedSettings(database: DbExecutor): Promise<void> {
  await database.query(
    `INSERT INTO site_settings (
      id, brand_name, brand_short, campus_label, tagline, motto, description,
      email, instagram_url, instagram_handle, whatsapp_primary, whatsapp_primary_name,
      whatsapp_secondary, whatsapp_secondary_name, address, map_address_short,
      hero_title_lead, hero_title_highlight, hero_title_tail, hero_eyebrow,
      stat_founded, stat_members, stat_study_programs
    ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    ON CONFLICT (id) DO NOTHING`,
    Object.values(settings),
  );
}

async function seedSections(database: DbExecutor): Promise<void> {
  for (const section of sectionSeed) {
    await database.query(
      `INSERT INTO content_section (page_key, section_key, eyebrow, title, subtitle, body, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (page_key, section_key) DO NOTHING`,
      [section.page, section.key, section.eyebrow, section.title, section.subtitle, section.body, section.sort],
    );
  }
}

async function seedTimeline(database: DbExecutor): Promise<void> {
  const entries = [
    ['17 April 1960', 'PMII dideklarasikan di Surabaya.', 'kuning'],
    ['1960–1961', 'Mahbub Djunaidi memimpin sebagai Ketua Umum PB PMII pertama.', 'pmii'],
    ['14 Juli 1972', 'Deklarasi Independensi PMII di Murnajati, Malang.', 'pmii'],
    ['1988', 'Penegasan interdependensi PMII dengan Nahdlatul Ulama.', 'pmii'],
    ['Hari ini', 'Kaderisasi berjalan di UIN SGD Bandung melalui MAPABA, PKD, PKL, kajian, dan advokasi.', 'kuning'],
  ] as const;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    await database.query(
      `INSERT INTO timeline_entry (page_key, label, body, accent, sort_order)
       SELECT 'sejarah', $1, $2, $3, $4 WHERE NOT EXISTS (
         SELECT 1 FROM timeline_entry WHERE page_key = 'sejarah' AND label = $1
       )`,
      [entry[0], entry[1], entry[2], index],
    );
  }
}

async function seedDocuments(database: DbExecutor): Promise<void> {
  const documents = [
    ['AD/ART PMII Hasil Kongres XXI Palembang 2024', 'Dokumen konstitusi terbaru yang memuat asas, tujuan, keanggotaan, struktur, dan mekanisme permusyawaratan PMII.', 'PDF', 'blue', 'https://drive.google.com/file/d/1cliRt7mu0skWvTvysGT-lypIht02AceM/view?usp=sharing'],
    ['AD/ART PMII Kongres 2021 Balikpapan', 'Dokumen Anggaran Dasar dan Anggaran Rumah Tangga hasil Kongres PMII Balikpapan 2021.', 'PDF', 'blue', 'https://drive.google.com/file/d/1V36aqXEWmzG0qXVuJ0lEiqjZEMqE--JQ/view?usp=sharing'],
    ['Hasil Muspimnas 2019', 'Ketetapan dan hasil Muspimnas PMII tahun 2019 sebagai rujukan organisasi.', 'PDF', 'yellow', 'https://drive.google.com/file/d/1YFZRObof8r8Hd_hSLf-F2Qju-7OaopYG/view?usp=sharing'],
    ['Hasil Muspimnas PMII Tulungagung 2022', 'Hasil Muspimnas PMII Tulungagung tahun 2022 sebagai dokumen rujukan keputusan organisasi.', 'PDF', 'yellow', 'https://drive.google.com/file/d/1jED_dFIJxzuJi2bISmrnlxGUoOtlh9i-/view?usp=sharing'],
    ['PPTA', 'Dokumen PPTA yang tersedia di arsip organisasi.', 'PDF', 'blue', 'https://drive.google.com/file/d/1TcQNMXFCPvxjY85cSnFyUojntdBxBJe8/view?usp=sharing'],
    ['PPTA B5', 'Versi B5 dokumen PPTA dari arsip organisasi.', 'PDF', 'blue', 'https://drive.google.com/file/d/1UKr3UomjfmmkZZEcL_p9bPSH-qP3a5GK/view?usp=sharing'],
    ['GBHO dan TKO Rayon Saintek', 'Landasan gerak dan tata kerja organisasi Rayon Sains dan Teknologi.', 'Dokumen', 'yellow', 'https://drive.google.com/file/d/12Guvda1HbguniF2n_WsC3ZdEGBLl2wBC0lmJJgBNVp4/view?usp=sharing'],
  ] as const;
  for (let index = 0; index < documents.length; index += 1) {
    const document = documents[index]!;
    await database.query(
      `INSERT INTO legal_document (title, description, kind_label, kind_tone, external_url, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [...document, index],
    );
  }
}

async function seedGallery(database: DbExecutor): Promise<void> {
  const albums = [
    ['mapaba-raya-2025', 'MAPABA Raya 2025', 'MAPABA', 'mapaba', '2025-10-12', 'pmii', 42],
    ['ngaji-filsafat-sore', 'Ngaji Filsafat Sore', 'Kajian', 'kajian', '2025-09-03', 'kuning', 18],
    ['bakti-sosial-cibiru', 'Bakti Sosial Cibiru', 'Pengabdian', 'pengabdian', '2025-08-21', 'emerald', 27],
    ['aksi-tolak-kenaikan-ukt', 'Aksi Tolak Kenaikan UKT', 'Aksi', 'aksi', '2025-05-02', 'rose', 35],
    ['pkd-angkatan-xii', 'PKD Angkatan XII', 'Kaderisasi', 'kaderisasi', '2025-03-14', 'pmii', 51],
    ['harlah-pmii-ke-65', 'Harlah PMII ke-65', 'Harlah', 'harlah', '2025-04-17', 'indigo', 63],
  ] as const;
  for (let index = 0; index < albums.length; index += 1) {
    const album = albums[index]!;
    await database.query(
      `INSERT INTO gallery_album (slug, title, category, category_slug, taken_on, gradient_key, photo_count, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (slug) DO NOTHING`,
      [...album, index],
    );
  }
}

type MapabaSeedOptions = {
  quota: number;
  closesAt: string;
  timeZone: string;
  contributionLabel: string;
  faculty: string;
};

async function seedMapaba(database: DbExecutor, options: MapabaSeedOptions): Promise<void> {
  const opensAt = '2026-01-01T00:00:00+07:00';
  await database.query(
    `INSERT INTO mapaba_event (
      id, title, edition, dates_label, location_label, quota, contribution_label,
      opens_at, closes_at, time_zone, faculty
    ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (id) DO NOTHING`,
    [
      'MAPABA Raya 2026',
      'MAPABA SAINTEK Ke-XVII',
      '31 Okt – 2 Nov 2026',
      'Cileunyi, Kab. Bandung',
      options.quota,
      options.contributionLabel,
      opensAt,
      options.closesAt,
      options.timeZone,
      options.faculty,
    ],
  );

  const agendas = [
    { day: 'Hari 1', title: 'Mengenal Diri & Tradisi', items: ['Sejarah PMII dan Ahlussunnah wal Jama\'ah', 'Nilai Dasar Pergerakan (NDP)', 'Keorganisasian dan AD/ART'], tone: 'blue' },
    { day: 'Hari 2', title: 'Membaca Realitas', items: ['Analisis sosial dan pemetaan persoalan kampus', 'Gender, keberagaman, dan keadilan sosial', 'Literasi digital dan advokasi'], tone: 'blue' },
    { day: 'Hari 3', title: 'Bergerak Bersama', items: ['Rencana tindak lanjut kader', 'Baiat dan pelantikan anggota baru', 'Penempatan rayon dan pendampingan'], tone: 'yellow' },
  ];
  for (let i = 0; i < agendas.length; i += 1) {
    const agenda = agendas[i]!;
    await database.query(
      `INSERT INTO mapaba_agenda (event_id, day_label, title, items, tone, sort_order)
       SELECT 1, $1, $2, $3, $4, $5 WHERE NOT EXISTS (
         SELECT 1 FROM mapaba_agenda WHERE event_id = 1 AND day_label = $1
       )`,
      [agenda.day, agenda.title, agenda.items, agenda.tone, i],
    );
  }

  const faqs = [
    ['Apakah harus berlatar belakang NU?', 'Tidak. MAPABA terbuka bagi siapa pun yang bersedia belajar bersama dalam tradisi Ahlussunnah wal Jama\'ah.'],
    ['Apakah kegiatan menginap?', 'Ya, kegiatan berlangsung tiga hari dua malam di lokasi yang disiapkan panitia. Peserta putra dan putri ditempatkan terpisah.'],
    ['Bagaimana jika saya tidak mampu membayar kontribusi?', 'Sampaikan pada kolom motivasi atau hubungi panitia melalui Instagram. Tersedia skema keringanan biaya — tidak ada calon kader yang gugur karena alasan ekonomi.'],
  ];
  for (let i = 0; i < faqs.length; i += 1) {
    const [question, answer] = faqs[i]!;
    await database.query(
      `INSERT INTO mapaba_faq (event_id, question, answer, sort_order)
       SELECT 1, $1, $2, $3 WHERE NOT EXISTS (
         SELECT 1 FROM mapaba_faq WHERE event_id = 1 AND question = $1
       )`,
      [question, answer, i],
    );
  }
}

export async function seedPublicContent(
  database: Database,
  sourceRoot = resolve(process.cwd(), 'reference-original'),
  mapaba: MapabaSeedOptions = {
    quota: 100,
    closesAt: '2026-11-01T23:59:59+07:00',
    timeZone: 'Asia/Jakarta',
    contributionLabel: 'Rp75.000',
    faculty: 'Sains dan Teknologi',
  },
): Promise<void> {
  await ensureReferenceSource(sourceRoot);
  await database.transaction(async (transaction) => {
    await seedSettings(transaction);
    await seedSections(transaction);
    await seedTimeline(transaction);
    await seedDocuments(transaction);
    await seedGallery(transaction);
    await seedMapaba(transaction, mapaba);
  });
}
