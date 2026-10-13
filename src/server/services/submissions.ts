import 'server-only';

import { randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';

import { withTransaction } from '@/server/db/pool';
import { AppError, pgConstraint, pgErrorCode } from '@/server/errors';
import {
  buildAdvocacyOutboxPayload,
  buildMapabaOutboxPayload,
  type OutboxIntegration,
} from '@/server/integrations/outbox-payload';
import { logEvent } from '@/server/observability/logger';
import { claimDraftFiles, finalizeDraft, type DraftFileInput } from '@/server/services/uploads';
import type { AdvocacyReportInput, MapabaRegistrationInput } from '@/server/schemas';

/**
 * Penulisan data produk: pengaduan advokasi dan pendaftaran MAPABA.
 *
 * Setiap operasi bernilai (validasi draft, kunci kuota, insert peserta, finalisasi
 * berkas, outbox) berjalan dalam SATU transaksi. Sebelumnya validasi draft dan
 * finalisasi berkas dipanggil terpisah dari route, sehingga kegagalan di antaranya
 * meninggalkan peserta tanpa berkas terkunci. Sekarang rollback menutup seluruh rantai.
 */

export type AdvocacyResult = { ticket: string; createdAt: Date };

export type MapabaResult = {
  registrationNumber: string;
  registrationId: number;
  createdAt: Date;
  mediaIds: readonly number[];
};

function publicTicket(prefix: 'ADV' | 'MPB', date = new Date()): string {
  const year = date.getFullYear();
  const token = randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${year}-${token}`;
}

function isDuplicateConstraint(error: unknown, fragment: string): boolean {
  return pgErrorCode(error) === '23505' && (pgConstraint(error) ?? '').includes(fragment);
}

/**
 * Sisipkan baris outbox di dalam transaksi yang sama dengan data utama.
 * `ON CONFLICT DO NOTHING` membuat pengiriman ulang idempoten.
 */
async function insertOutbox(
  client: PoolClient,
  integration: OutboxIntegration,
  eventKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO integration_outbox (integration, event_key, payload)
     VALUES ($1, $2, $3::jsonb) ON CONFLICT (event_key) DO NOTHING`,
    [integration, eventKey, JSON.stringify(payload)],
  );
}

export async function createAdvocacyReport(input: AdvocacyReportInput): Promise<AdvocacyResult> {
  const ticket = publicTicket('ADV');
  const createdAt = await withTransaction(async (client) => {
    const created = await client.query<{ created_at: Date }>(
      `INSERT INTO advocacy_report (
        ticket, reporter_name, contact, email, reporter_status, category,
        chronology, evidence_url, confidential, consent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING created_at`,
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

    // Pengiriman ke Google Sheets TIDAK dilakukan di sini. Hanya worker outbox yang
    // mengirim (lihat integrations/outbox.ts), sehingga request pengguna tidak pernah
    // menunggu jaringan eksternal dan tidak ada pengiriman ganda.
    await insertOutbox(
      client,
      'google-sheets-advocacy',
      ticket,
      buildAdvocacyOutboxPayload({
        ticket,
        category: input.kategori,
        name: input.nama,
        contact: input.kontak,
        email: input.email,
        status: input.status,
        chronology: input.kronologi,
        evidenceUrl: input.lampiranUrl,
        confidential: input.anonim ?? false,
        consent: input.persetujuan,
        createdAt: row.created_at,
      }),
    );
    return row.created_at;
  });

  return { ticket, createdAt };
}

export async function createMapabaRegistrationWithMedia(input: {
  data: MapabaRegistrationInput;
  draft: { draftId: string; token: string };
  files: readonly DraftFileInput[];
}): Promise<MapabaResult> {
  const registrationNumber = publicTicket('MPB');
  try {
    return await withTransaction(async (client) => {
      // 1. Kunci event agar dua request bersamaan tidak melewati kuota.
      const eventResult = await client.query<{
        id: number;
        quota: number;
        closes_at: Date;
        opens_at: Date;
        faculty: string;
      }>(`SELECT id, quota, opens_at, closes_at, faculty FROM mapaba_event WHERE id = 1 FOR UPDATE`);
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

      // 2. Kunci draft dan ambil id media; gagal di sini membatalkan seluruh transaksi.
      const media = await claimDraftFiles(client, {
        draftId: input.draft.draftId,
        token: input.draft.token,
        files: input.files,
      });

      // 3. Insert peserta; faculty memakai nilai server, bukan fakultas dari klien.
      const created = await client.query<{ id: number; created_at: Date }>(
        `INSERT INTO mapaba_registration (
          event_id, registration_number, full_name, nim, angkatan,
          university, faculty, study_program, whatsapp, email, gender,
          origin_region, motivation, info_source, organization_history,
          photo_media_id, ktm_media_id, consent_program, consent_data
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, $18, $19
        ) RETURNING id, created_at`,
        [
          event.id,
          registrationNumber,
          input.data.namaLengkap,
          input.data.nim,
          input.data.angkatan,
          input.data.universitas,
          event.faculty,
          input.data.prodi,
          input.data.whatsapp,
          input.data.email.toLowerCase(),
          input.data.jenisKelamin,
          input.data.asalDaerah,
          input.data.motivasi,
          input.data.sumberInformasi,
          input.data.riwayatOrganisasi,
          media.photoMediaId,
          media.ktmMediaId,
          input.data.kesediaan,
          input.data.persetujuanData,
        ],
      );
      const createdAt = created.rows[0]?.created_at;
      const registrationId = created.rows[0]?.id;
      if (!createdAt || !registrationId) throw new Error('Pendaftaran tidak dapat disimpan.');

      // 4. Finalisasi draft + kunci berkas ke peserta, masih dalam transaksi yang sama.
      await finalizeDraft(client, {
        draftId: input.draft.draftId,
        token: input.draft.token,
        mediaIds: [media.photoMediaId, media.ktmMediaId],
        registrationId,
      });

      // 5. Outbox. Tidak ada URL berkas privat yang dikirim ke luar; hanya identitas
      //    tiket. Admin membuka berkas lewat endpoint ber-otorisasi.
      await insertOutbox(
        client,
        'google-sheets-mapaba',
        registrationNumber,
        buildMapabaOutboxPayload({
          registrationNumber,
          fullName: input.data.namaLengkap,
          nim: input.data.nim,
          generation: input.data.angkatan,
          university: input.data.universitas,
          studyProgram: input.data.prodi,
          faculty: event.faculty,
          whatsapp: input.data.whatsapp,
          email: input.data.email.toLowerCase(),
          gender: input.data.jenisKelamin,
          originRegion: input.data.asalDaerah,
          motivation: input.data.motivasi,
          source: input.data.sumberInformasi,
          organizationHistory: input.data.riwayatOrganisasi,
          createdAt,
        }),
      );

      return {
        registrationNumber,
        registrationId,
        createdAt,
        mediaIds: [media.photoMediaId, media.ktmMediaId],
      };
    });
  } catch (error) {
    if (isDuplicateConstraint(error, 'nim')) throw AppError.conflict('NIM ini sudah pernah digunakan untuk pendaftaran MAPABA.');
    if (isDuplicateConstraint(error, 'email')) throw AppError.conflict('Email ini sudah pernah digunakan untuk pendaftaran MAPABA.');
    if (pgErrorCode(error) === '23505') throw AppError.conflict('Data ini sudah pernah digunakan untuk pendaftaran MAPABA.');
    if (isAppErrorWithCode(error, 'QUOTA_EXCEEDED') || isAppErrorWithCode(error, 'REGISTRATION_CLOSED')) {
      logEvent('info', 'mapaba.registration.rejected', { detail: error.code });
    }
    throw error;
  }
}

function isAppErrorWithCode(error: unknown, code: string): error is AppError {
  return error instanceof AppError && error.code === code;
}
