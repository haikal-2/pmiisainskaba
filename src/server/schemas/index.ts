import { z } from 'zod';

import {
  ADVOCACY_CATEGORY,
  ADVOCACY_TICKET_STATUS,
  ADVOCACY_STATUS,
  GALLERY_CATEGORY_FILTERS,
  MAPABA_ANGKATAN,
  MAPABA_GENDER,
  MAPABA_INFO_SOURCE,
  MAPABA_STUDY_PROGRAMS,
} from '@/server/domain/enums';

/**
 * Skema validasi bersama.
 *
 * Modul ini bebas dari `server-only`: skema yang sama dipakai form di browser
 * (validasi bantu) dan Route Handler (validasi otoritatif).
 */

const values = <T extends readonly { value: string }[]>(options: T) =>
  options.map((option) => option.value) as [string, ...string[]];

const trimmed = (max: number) => z.string().trim().min(1).max(max);

/** Telepon mengikuti pattern sumber: 8..20 karakter angka/+/-/spasi/tanda kurung. */
const phone = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{8,20}$/, 'Nomor belum sesuai format yang diminta.');

const whatsapp = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{8,20}$/, 'Nomor belum sesuai format yang diminta.');

const optionalEmail = z
  .union([z.literal(''), z.string().trim().email('Format email tidak valid.').max(120)])
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => /^https?:\/\/[^\s]+$/i.test(value), 'Tautan harus diawali http:// atau https://.');

// ---------------------------------------------------------------------------
// Advokasi
// ---------------------------------------------------------------------------
export const advocacyReportSchema = z.object({
  nama: z.string().trim().max(100).optional().transform((value) => (value && value.length > 0 ? value : null)),
  kontak: phone,
  email: optionalEmail,
  status: z.enum(values(ADVOCACY_STATUS)),
  kategori: z.enum(values(ADVOCACY_CATEGORY)),
  kronologi: z
    .string()
    .trim()
    .min(50, 'Kronologi masalah minimal 50 karakter.')
    .max(4000, 'Kronologi masalah maksimal 4000 karakter.'),
  lampiranUrl: z
    .union([z.literal(''), httpUrl])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  anonim: z.boolean().optional().default(false),
  persetujuan: z.literal(true, { message: 'Pernyataan kebenaran data wajib disetujui.' }),
});

export type AdvocacyReportInput = z.infer<typeof advocacyReportSchema>;

export const advocacyNoteSchema = z.object({
  body: z.string().trim().min(1, 'Catatan tidak boleh kosong.').max(4000),
});

export const advocacyStatusSchema = z.object({
  status: z.enum(values(ADVOCACY_TICKET_STATUS)),
});

// ---------------------------------------------------------------------------
// MAPABA
// ---------------------------------------------------------------------------
export const mapabaRegistrationSchema = z.object({
  namaLengkap: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter.').max(100),
  nim: z
    .string()
    .trim()
    .regex(/^[0-9]{8,15}$/, 'NIM harus 8-15 digit angka.'),
  angkatan: z.enum(MAPABA_ANGKATAN),
  universitas: z.string().trim().min(3, 'Universitas wajib diisi.').max(150),
  // Fakultas selalu berasal dari konfigurasi server; nilai dari klien diabaikan.
  prodi: z.enum(MAPABA_STUDY_PROGRAMS),
  whatsapp,
  email: z.string().trim().email('Format email tidak valid.').max(120),
  jenisKelamin: z.enum(values(MAPABA_GENDER)),
  asalDaerah: z.string().trim().max(100).optional().transform((value) => (value && value.length > 0 ? value : null)),
  motivasi: z
    .string()
    .trim()
    .min(30, 'Motivasi minimal 30 karakter.')
    .max(1000, 'Motivasi maksimal 1000 karakter.'),
  sumberInformasi: z
    .union([z.literal(''), z.enum(values(MAPABA_INFO_SOURCE))])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  riwayatOrganisasi: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  pasFotoUrl: z.string().trim().min(1, 'Pas foto wajib diunggah.').max(1000),
  ktmUrl: z.string().trim().min(1, 'KTM wajib diunggah.').max(1000),
  kesediaan: z.literal(true, { message: 'Kesediaan mengikuti seluruh rangkaian wajib disetujui.' }),
  persetujuanData: z.literal(true, { message: 'Persetujuan pengolahan data wajib disetujui.' }),
});

export type MapabaRegistrationInput = z.infer<typeof mapabaRegistrationSchema>;

export const mapabaUploadRequestSchema = z.object({
  kind: z.enum(['pasFoto', 'ktm']),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  byteSize: z.number().int().positive(),
});

export const mapabaEventSchema = z.object({
  title: trimmed(120),
  edition: trimmed(120),
  datesLabel: trimmed(120),
  locationLabel: trimmed(160),
  quota: z.number().int().min(1).max(100000),
  contributionLabel: trimmed(40),
  opensAt: z.string().trim().min(1),
  closesAt: z.string().trim().min(1),
  timeZone: trimmed(64),
  faculty: trimmed(120),
  published: z.boolean(),
});

// ---------------------------------------------------------------------------
// Konten
// ---------------------------------------------------------------------------
const jsonRecord = z.record(z.string(), z.unknown());

export const siteSettingsSchema = z.object({
  brandName: trimmed(160),
  brandShort: trimmed(80),
  campusLabel: trimmed(120),
  tagline: trimmed(200),
  motto: trimmed(160),
  description: trimmed(400),
  email: z.string().trim().email(),
  instagramUrl: z.string().trim().url(),
  instagramHandle: trimmed(80),
  whatsappPrimary: phone,
  whatsappPrimaryName: trimmed(80),
  whatsappSecondary: phone,
  whatsappSecondaryName: trimmed(80),
  address: trimmed(300),
  mapAddressShort: trimmed(160),
  heroTitleLead: trimmed(80),
  heroTitleHighlight: trimmed(120),
  heroTitleTail: trimmed(160),
  heroEyebrow: trimmed(80),
  statFounded: trimmed(20),
  statMembers: trimmed(20),
  statStudyPrograms: trimmed(20),
});

export const contentSectionSchema = z.object({
  eyebrow: z.string().trim().max(80).nullable().optional(),
  title: z.string().trim().max(240).nullable().optional(),
  subtitle: z.string().trim().max(600).nullable().optional(),
  body: jsonRecord.optional(),
  sortOrder: z.number().int().min(-1000).max(1000).optional(),
  published: z.boolean().optional(),
  version: z.number().int().min(1),
});

export const timelineEntrySchema = z.object({
  label: trimmed(80),
  body: trimmed(600),
  accent: z.enum(['pmii', 'kuning']),
  sortOrder: z.number().int().min(-1000).max(1000),
  published: z.boolean(),
});

export const organizationMemberSchema = z.object({
  fullName: trimmed(120),
  role: trimmed(120),
  initials: z.string().trim().min(1).max(4),
  groupId: z.number().int().positive(),
  photoMediaId: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().min(-1000).max(1000),
  published: z.boolean(),
});

export const organizationGroupSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Slug hanya huruf kecil, angka, dan tanda hubung.'),
  name: trimmed(160),
  period: trimmed(60),
  kind: z.enum(['bph', 'biro', 'kopri']),
  sortOrder: z.number().int().min(-1000).max(1000),
  published: z.boolean(),
});

export const kopriProgramSchema = z.object({
  title: trimmed(160),
  body: trimmed(600),
  linkLabel: z.string().trim().max(120).nullable().optional(),
  linkUrl: z.string().trim().max(500).nullable().optional(),
  iconKey: trimmed(40),
  sortOrder: z.number().int().min(-1000).max(1000),
  published: z.boolean(),
});

export const galleryAlbumSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  title: trimmed(160),
  category: trimmed(80),
  categorySlug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  takenOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus format YYYY-MM-DD.')
    .nullable()
    .optional(),
  gradientKey: z.enum(['pmii', 'kuning', 'emerald', 'rose', 'indigo']),
  sortOrder: z.number().int().min(-1000).max(1000),
  published: z.boolean(),
});

export const legalDocumentSchema = z.object({
  title: trimmed(200),
  description: trimmed(600),
  kindLabel: trimmed(40),
  kindTone: z.enum(['blue', 'yellow']),
  iconKey: trimmed(40),
  externalUrl: z
    .string()
    .trim()
    .url()
    .refine((value) => value.startsWith('https://'), 'Tautan dokumen wajib https://'),
  sortOrder: z.number().int().min(-1000).max(1000),
  published: z.boolean(),
});

export const galleryFilterSchema = z.object({
  category: z.enum(values(GALLERY_CATEGORY_FILTERS)).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  perPage: z.coerce.number().int().min(1).max(48).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
  status: z.string().trim().max(40).optional(),
  q: z.string().trim().max(120).optional(),
});

/** Buang kunci tak dikenal lalu kembalikan error per-kolom. */
export function flattenFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}
