import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OUTBOX_INTEGRATIONS,
  buildAdvocacyOutboxPayload,
  buildMapabaOutboxPayload,
  parseAdvocacyOutboxPayload,
  parseMapabaOutboxPayload,
} from '../../src/server/integrations/outbox-payload';

/**
 * Kontrak payload outbox.
 *
 * Penulis (`build*`) dan pembaca (`parse*`) harus sepakat soal nama kunci. Modul ini
 * bebas `server-only`/I/O sehingga kontrak round-trip diuji langsung — inilah yang
 * mencegah perubahan nama kolom hanya terlihat sebagai kolom kosong di spreadsheet.
 */

const CREATED_AT = new Date('2026-03-04T05:06:07.000Z');

test('the two outbox integration names are exactly the ones the worker recognizes', () => {
  assert.deepEqual([...OUTBOX_INTEGRATIONS], ['google-sheets-mapaba', 'google-sheets-advocacy']);
});

test('a MAPABA payload round-trips through build and parse without changing meaning', () => {
  const payload = buildMapabaOutboxPayload({
    registrationNumber: 'MAPABA-2026-0007',
    fullName: 'Siti Aminah',
    nim: '22123456',
    generation: '2024',
    university: 'UIN Sunan Kalijaga',
    studyProgram: 'Teknik Informatika',
    faculty: 'Sains dan Teknologi',
    whatsapp: '081234567890',
    email: 'siti@example.com',
    gender: 'Perempuan',
    originRegion: 'Yogyakarta',
    motivation: 'Ingin berkontribusi',
    source: 'Instagram',
    organizationHistory: 'OSIS',
    createdAt: CREATED_AT,
  });

  assert.equal(payload.createdAt, '2026-03-04T05:06:07.000Z');

  const parsed = parseMapabaOutboxPayload(payload as unknown as Record<string, unknown>);
  assert.deepEqual(parsed, {
    registrationNumber: 'MAPABA-2026-0007',
    fullName: 'Siti Aminah',
    nim: '22123456',
    generation: '2024',
    university: 'UIN Sunan Kalijaga',
    studyProgram: 'Teknik Informatika',
    faculty: 'Sains dan Teknologi',
    whatsapp: '081234567890',
    email: 'siti@example.com',
    gender: 'Perempuan',
    originRegion: 'Yogyakarta',
    motivation: 'Ingin berkontribusi',
    source: 'Instagram',
    organizationHistory: 'OSIS',
    createdAt: new Date('2026-03-04T05:06:07.000Z'),
  });
});

test('parseMapabaOutboxPayload blanks required fields and drops empty optional ones', () => {
  // Baris lama/malformed: field wajib menjadi string kosong, opsional menjadi undefined.
  const parsed = parseMapabaOutboxPayload({
    registrationNumber: 'MAPABA-2026-0008',
    fullName: 'Budi',
    nim: '0001',
    university: 'UIN',
    studyProgram: 'SI',
    faculty: '',
    whatsapp: '0800',
    email: 'budi@example.com',
    gender: '',
    originRegion: '',
    motivation: null,
    source: undefined,
    organizationHistory: null,
    createdAt: 'not-a-date',
  });

  assert.equal(parsed.generation, undefined);
  assert.equal(parsed.faculty, undefined);
  assert.equal(parsed.gender, undefined);
  assert.equal(parsed.motivation, undefined);
  assert.equal(parsed.source, undefined);
  assert.equal(parsed.organizationHistory, undefined);
  // Tanggal tak valid menjadi Invalid Date, bukan melempar; worker tetap menangani barisnya.
  assert.ok(parsed.createdAt instanceof Date);
  assert.equal(Number.isNaN(parsed.createdAt.getTime()), true);
});

test('parseMapabaOutboxPayload coerces missing required fields to empty strings', () => {
  const parsed = parseMapabaOutboxPayload({});
  assert.equal(parsed.registrationNumber, '');
  assert.equal(parsed.fullName, '');
  assert.equal(parsed.nim, '');
  assert.equal(parsed.university, '');
  assert.equal(parsed.studyProgram, '');
  assert.equal(parsed.whatsapp, '');
  assert.equal(parsed.email, '');
});

test('an advocacy payload round-trips and preserves confidentiality booleans', () => {
  const payload = buildAdvocacyOutboxPayload({
    ticket: 'ADV-2026-0003',
    category: 'Akademik',
    name: null,
    contact: '087700112233',
    email: 'pelapor@example.com',
    status: 'Baru',
    chronology: 'Kronologi singkat',
    evidenceUrl: null,
    confidential: true,
    consent: true,
    createdAt: CREATED_AT,
  });

  const parsed = parseAdvocacyOutboxPayload(payload as unknown as Record<string, unknown>);
  assert.deepEqual(parsed, {
    ticket: 'ADV-2026-0003',
    category: 'Akademik',
    name: undefined,
    contact: '087700112233',
    email: 'pelapor@example.com',
    status: 'Baru',
    chronology: 'Kronologi singkat',
    evidenceUrl: undefined,
    confidential: true,
    consent: true,
    createdAt: new Date('2026-03-04T05:06:07.000Z'),
  });
});

test('parseAdvocacyOutboxPayload only accepts real booleans and falls back to now without createdAt', () => {
  const parsed = parseAdvocacyOutboxPayload({
    ticket: 'ADV-2026-0004',
    category: 'Umum',
    confidential: 'yes',
    consent: 0,
  });

  assert.equal(parsed.confidential, undefined);
  assert.equal(parsed.consent, undefined);
  assert.equal(parsed.name, undefined);
  assert.equal(parsed.contact, undefined);
  // Tanpa createdAt, dipakai waktu sekarang agar baris tetap dapat dikirim.
  assert.ok(parsed.createdAt instanceof Date);
  assert.equal(Number.isNaN(parsed.createdAt.getTime()), false);
});