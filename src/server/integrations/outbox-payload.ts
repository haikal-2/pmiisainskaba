/**
 * Kontrak payload outbox Google Sheets.
 *
 * Sebelumnya bentuk payload ditulis di `services/submissions.ts` dan dibaca ulang
 * dengan pemetaan terpisah di `integrations/outbox.ts`. Dua tempat itu harus sepakat
 * soal nama kunci, tetapi tidak ada yang menjaganya — perubahan di satu sisi hanya
 * terlihat sebagai kolom kosong di spreadsheet.
 *
 * Modul ini menjadikannya satu kontrak:
 *   * `buildMapabaOutboxPayload` / `buildAdvocacyOutboxPayload` dipakai penulis.
 *   * `parseOutboxPayload` dipakai worker, dan merupakan **satu-satunya** pemetaan
 *     kunci → argumen pengirim.
 *
 * Modul ini bebas `server-only` dan I/O agar kontraknya dapat diuji langsung.
 */

import type { AdvocacyReportPayload, MapabaRegistrationPayload } from './google-sheets';

export const OUTBOX_INTEGRATIONS = ['google-sheets-mapaba', 'google-sheets-advocacy'] as const;

export type OutboxIntegration = (typeof OUTBOX_INTEGRATIONS)[number];

/** Bentuk JSON yang benar-benar disimpan di kolom `integration_outbox.payload`. */
export type MapabaOutboxPayload = {
  registrationNumber: string;
  fullName: string;
  nim: string;
  generation: string | null;
  university: string;
  studyProgram: string;
  faculty: string;
  whatsapp: string;
  email: string;
  gender: string | null;
  originRegion: string | null;
  motivation: string | null;
  source: string | null;
  organizationHistory: string | null;
  createdAt: string;
};

export type AdvocacyOutboxPayload = {
  ticket: string;
  category: string;
  name: string | null;
  contact: string;
  email: string | null;
  status: string;
  chronology: string;
  evidenceUrl: string | null;
  confidential: boolean;
  consent: boolean;
  createdAt: string;
};

export type OutboxPayload = MapabaOutboxPayload | AdvocacyOutboxPayload;

export function buildMapabaOutboxPayload(input: {
  registrationNumber: string;
  fullName: string;
  nim: string;
  generation: string | null;
  university: string;
  studyProgram: string;
  faculty: string;
  whatsapp: string;
  email: string;
  gender: string | null;
  originRegion: string | null;
  motivation: string | null;
  source: string | null;
  organizationHistory: string | null;
  createdAt: Date;
}): MapabaOutboxPayload {
  return { ...input, createdAt: input.createdAt.toISOString() };
}

export function buildAdvocacyOutboxPayload(input: {
  ticket: string;
  category: string;
  name: string | null;
  contact: string;
  email: string | null;
  status: string;
  chronology: string;
  evidenceUrl: string | null;
  confidential: boolean;
  consent: boolean;
  createdAt: Date;
}): AdvocacyOutboxPayload {
  return { ...input, createdAt: input.createdAt.toISOString() };
}

/**
 * Ubah payload MAPABA tersimpan menjadi argumen pengirim. Nilai yang hilang dikosongkan
 * (`''`) persis seperti perilaku sebelumnya, supaya baris lama tetap terkirim dan
 * tidak ada perubahan bentuk di spreadsheet.
 */
export function parseMapabaOutboxPayload(payload: Record<string, unknown>): MapabaRegistrationPayload {
  return {
    registrationNumber: requiredString(payload.registrationNumber),
    fullName: requiredString(payload.fullName),
    nim: requiredString(payload.nim),
    generation: optionalString(payload.generation),
    university: requiredString(payload.university),
    studyProgram: requiredString(payload.studyProgram),
    faculty: optionalString(payload.faculty),
    whatsapp: requiredString(payload.whatsapp),
    email: requiredString(payload.email),
    gender: optionalString(payload.gender),
    originRegion: optionalString(payload.originRegion),
    motivation: optionalString(payload.motivation),
    source: optionalString(payload.source),
    organizationHistory: optionalString(payload.organizationHistory),
    createdAt: payloadDate(payload.createdAt),
  };
}

/** Padanan advokasi dari `parseMapabaOutboxPayload`. */
export function parseAdvocacyOutboxPayload(payload: Record<string, unknown>): AdvocacyReportPayload {
  return {
    ticket: requiredString(payload.ticket),
    category: requiredString(payload.category),
    name: optionalString(payload.name),
    contact: optionalString(payload.contact),
    email: optionalString(payload.email),
    status: optionalString(payload.status),
    chronology: optionalString(payload.chronology),
    evidenceUrl: optionalString(payload.evidenceUrl),
    confidential: typeof payload.confidential === 'boolean' ? payload.confidential : undefined,
    consent: typeof payload.consent === 'boolean' ? payload.consent : undefined,
    createdAt: payloadDate(payload.createdAt),
  };
}

function requiredString(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function optionalString(value: unknown): string | undefined {
  return value === undefined || value === null || value === '' ? undefined : String(value);
}

function payloadDate(value: unknown): Date {
  return new Date(value === undefined || value === null ? new Date().toISOString() : String(value));
}