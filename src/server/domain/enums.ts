import 'server-only';

/**
 * Enum dan label domain.
 *
 * Nilai select disalin apa adanya dari website referensi (advokasi.html dan
 * mapaba.html) agar kontrak API dan UI identik dengan sumber.
 */

export const ADVOCACY_STATUS = [
  { value: 'mahasiswa', label: 'Mahasiswa UIN SGD Bandung' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'kader', label: 'Kader PMII' },
  { value: 'masyarakat', label: 'Masyarakat umum' },
] as const;

export const ADVOCACY_CATEGORY = [
  { value: 'akademik', label: 'Akademik' },
  { value: 'fasilitas', label: 'Fasilitas Kampus' },
  { value: 'kekerasan_seksual', label: 'Kekerasan / Pelecehan' },
  { value: 'ukt', label: 'UKT / Biaya Pendidikan' },
  { value: 'perundungan', label: 'Perundungan / Intimidasi' },
  { value: 'kebebasan_berpendapat', label: 'Kebebasan Berpendapat' },
  { value: 'ketenagakerjaan', label: 'Ketenagakerjaan / Magang' },
  { value: 'lainnya', label: 'Lainnya' },
] as const;

/** Status tindak lanjut pengaduan — dikelola admin (jawaban pengguna no. 13). */
export const ADVOCACY_TICKET_STATUS = [
  { value: 'baru', label: 'Baru' },
  { value: 'diverifikasi', label: 'Diverifikasi' },
  { value: 'didampingi', label: 'Didampingi' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'ditutup', label: 'Ditutup' },
] as const;

export const MAPABA_GENDER = [
  { value: 'L', label: 'Laki-laki' },
  { value: 'P', label: 'Perempuan' },
] as const;

export const MAPABA_ANGKATAN = ['2026', '2025', '2024', '2023'] as const;

export const MAPABA_STUDY_PROGRAMS = [
  'Informatika',
  'Matematika',
  'Kimia',
  'Agroteknologi',
  'Teknik Elektro',
  'Biologi',
  'Fisika',
  'Teknik Lingkungan',
] as const;

export const MAPABA_INFO_SOURCE = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'teman', label: 'Teman / senior' },
  { value: 'website', label: 'Website PMII' },
  { value: 'poster', label: 'Poster di kampus' },
  { value: 'lainnya', label: 'Lainnya' },
] as const;

/**
 * Pilihan universitas (jawaban pengguna no. 5): UIN SGD atau perguruan tinggi
 * lain di Kabupaten Bandung. Nilai "lainnya" membuka isian bebas.
 */
export const MAPABA_UNIVERSITY_OPTIONS = [
  { value: 'UIN Sunan Gunung Djati Bandung', label: 'UIN Sunan Gunung Djati Bandung' },
  { value: 'lainnya', label: 'Perguruan tinggi lain di Kabupaten Bandung' },
] as const;

/** Status peserta — tanpa status tambahan (jawaban pengguna no. 8). */
export const MAPABA_REGISTRATION_STATUS = [
  { value: 'baru', label: 'Baru' },
] as const;

export const GALLERY_CATEGORY_FILTERS = [
  { value: 'semua', label: 'Semua' },
  { value: 'mapaba', label: 'MAPABA' },
  { value: 'kajian', label: 'Kajian' },
  { value: 'aksi', label: 'Aksi' },
  { value: 'pengabdian', label: 'Pengabdian' },
] as const;

export const GALLERY_GRADIENT_TONES = [
  'pmii',
  'kuning',
  'emerald',
  'rose',
  'indigo',
] as const;

export type AdvocacyStatusValue = (typeof ADVOCACY_STATUS)[number]['value'];
export type AdvocacyCategoryValue = (typeof ADVOCACY_CATEGORY)[number]['value'];
export type AdvocacyTicketStatusValue = (typeof ADVOCACY_TICKET_STATUS)[number]['value'];
export type MapabaGenderValue = (typeof MAPABA_GENDER)[number]['value'];
export type GalleryGradientTone = (typeof GALLERY_GRADIENT_TONES)[number];

export function labelOf<T extends { value: string; label: string }>(
  options: readonly T[],
  value: string,
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}
