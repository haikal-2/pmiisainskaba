import 'server-only';

import { randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';

import config from '@/server/config';
import { withTransaction } from '@/server/db/pool';
import { AppError, pgConstraint, pgErrorCode } from '@/server/errors';
import type { AdvocacyReportInput, MapabaRegistrationInput } from '@/server/schemas';

function publicTicket(prefix: 'ADV' | 'MPB', date = new Date()): string {
  const year = date.getFullYear();
  const token = randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${year}-${token}`;
}

function isDuplicateConstraint(error: unknown, fragment: string): boolean {
  return pgErrorCode(error) === '23505' && (pgConstraint(error) ?? '').includes(fragment);
}

async function insertOutbox(
  client: PoolClient,
  integration: 'google-sheets-mapaba' | 'google-sheets-advocacy',
  eventKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO integration_outbox (integration, event_key, payload)
     VALUES ($1, $2, $3::jsonb) ON CONFLICT (event_key) DO NOTHING`,
    [integration, eventKey, JSON.stringify(payload)],
  );
}

export async function createAdvocacyReport(input: AdvocacyReportInput): Promise<{
  ticket: string;
  createdAt: Date;
}> {
  const ticket = publicTicket('ADV');
  const result = await withTransaction(async (client) => {
    const created = await client.query<{ id: string; created_at: Date }>(
      `INSERT INTO advocacy_report (
        ticket, reporter_name, contact, email, reporter_status, category,
        chronology, evidence_url, confidential, consent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, created_at`,
      [
        ticket,
        input.nama,
        input.kontak,
        input.email,
        input.status,
        input.kategori,
        input.kronologi,
        input.lampiranUrl,
        input.anonim ?? false,
        input.persetujuan,
      ],
    );
    const row = created.rows[0];
    if (!row) throw new Error('Laporan tidak dapat disimpan.');
    await insertOutbox(client, 'google-sheets-advocacy', ticket, {
      ticket,
      category: input.kategori,
      createdAt: row.created_at.toISOString(),
    });
    return { id: row.id, createdAt: row.created_at };
  });
  return { ticket, createdAt: result.createdAt };
}

export async function createMapabaRegistration(
  input: MapabaRegistrationInput,
  media: { photoMediaId: number; ktmMediaId: number },
): Promise<{ registrationNumber: string; createdAt: Date; registrationId: number }> {
  const registrationNumber = publicTicket('MPB');
  try {
    return await withTransaction(async (client) => {
      // Kunci event agar dua request bersamaan tidak melewati kuota.
      const eventResult = await client.query<{
        id: number;
        quota: number;
        closes_at: Date;
        opens_at: Date;
        faculty: string;
      }>(
        `SELECT id, quota, opens_at, closes_at, faculty
         FROM mapaba_event WHERE id = 1 FOR UPDATE`,
      );
      const event = eventResult.rows[0];
      if (!event) throw AppError.conflict('Pendaftaran MAPABA belum dikonfigurasi.');

      const now = Date.now();
      if (now < event.opens_at.getTime() || now > event.closes_at.getTime()) {
        throw new AppError('REGISTRATION_CLOSED', 'Pendaftaran MAPABA sedang ditutup.');
      }

      const countResult = await client.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM mapaba_registration WHERE event_id = $1',
        [event.id],
      );
      const count = Number.parseInt(countResult.rows[0]?.count ?? '0', 10);
      if (count >= event.quota) throw new AppError('QUOTA_EXCEEDED', 'Kuota pendaftaran MAPABA telah terpenuhi.');

      const created = await client.query<{ id: number; created_at: Date }>(
        `INSERT INTO mapaba_registration (
          event_id, registration_number, full_name, nim, angkatan,
          university, faculty, study_program, whatsapp, email, gender,
          origin_region, motivation, info_source, organization_history,
          photo_media_id, ktm_media_id, consent_program, consent_data
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, $18, $19
        ) RETURNING created_at`,
        [
          event.id,
          registrationNumber,
          input.namaLengkap,
          input.nim,
          input.angkatan,
          input.universitas,
          event.faculty, // nilai server, bukan fakultas dari client
          input.prodi,
          input.whatsapp,
          input.email.toLowerCase(),
          input.jenisKelamin,
          input.asalDaerah,
          input.motivasi,
          input.sumberInformasi,
          input.riwayatOrganisasi,
          media.photoMediaId,
          media.ktmMediaId,
          input.kesediaan,
          input.persetujuanData,
        ],
      );
      const createdAt = created.rows[0]?.created_at;
      const registrationId = created.rows[0]?.id;
      if (!createdAt || !registrationId) throw new Error('Pendaftaran tidak dapat disimpan.');
      await insertOutbox(client, 'google-sheets-mapaba', registrationNumber, {
        registrationNumber,
        fullName: input.namaLengkap,
        nim: input.nim,
        university: input.universitas,
        studyProgram: input.prodi,
        whatsapp: input.whatsapp,
        email: input.email.toLowerCase(),
        createdAt: createdAt.toISOString(),
      });
      return { registrationNumber, createdAt, registrationId };
    });
  } catch (error) {
    if (isDuplicateConstraint(error, 'nim')) throw AppError.conflict('NIM ini sudah pernah digunakan untuk pendaftaran MAPABA.');
    if (isDuplicateConstraint(error, 'email')) throw AppError.conflict('Email ini sudah pernah digunakan untuk pendaftaran MAPABA.');
    if (pgErrorCode(error) === '23505') throw AppError.conflict('Data ini sudah pernah digunakan untuk pendaftaran MAPABA.');
    throw error;
  }
}

export function mapabaRegistrationClosesAt(): string {
  return config.mapaba.closesAt;
}
