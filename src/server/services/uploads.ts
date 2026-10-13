import 'server-only';

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

import config from '@/server/config';
import { query, queryOne } from '@/server/db/pool';
import { AppError } from '@/server/errors';
import { verifyImageSignature } from '@/server/storage/blob';
import { putPrivateImage } from '@/server/storage/private-storage';
import { toPrivatePathname, type MapabaMediaKind } from '@/server/storage/reference';

/**
 * Siklus hidup berkas privat MAPABA:
 *
 *   draft (token sekali pakai) → unggah 1..2 berkas pending → klaim & finalisasi ke peserta.
 *
 * Yang penting di sini:
 *   * Database menyimpan **pathname kanonik**, bukan URL. Tidak ada `local-upload:/`
 *     yang bocor ke klien maupun ke Google Sheets.
 *   * Klaim + finalisasi berjalan di dalam transaksi pendaftaran (lihat
 *     `createMapabaRegistrationWithMedia`) supaya tidak ada peserta tersimpan
 *     tanpa berkas, atau berkas terkunci tanpa peserta.
 */

export type UploadDraft = { draftId: string; token: string; expiresAt: Date };

export type UploadedMediaReference = {
  pathname: string;
  mimeType: string;
  size: number;
};

export type DraftFileInput = { reference: unknown; kind: MapabaMediaKind };

export type ClaimedMedia = { photoMediaId: number; ktmMediaId: number };

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Draft anonim untuk dua dokumen; token hanya dikembalikan satu kali ke browser. */
export async function createMapabaUploadDraft(): Promise<UploadDraft> {
  const token = randomBytes(32).toString('base64url');
  const draftId = randomUUID();
  const expiresAt = new Date(Date.now() + config.uploadDraftTtlSeconds * 1000);
  await query(
    `INSERT INTO upload_draft (id, token_hash, scope, allowed_paths, expires_at)
     VALUES ($1::uuid, $2, 'mapaba-registration', '{}', $3)`,
    [draftId, sha256(token), expiresAt],
  );
  return { draftId, token, expiresAt };
}

export async function uploadMapabaDraftFile(input: {
  draftId: string;
  token: string;
  kind: MapabaMediaKind;
  file: File;
}): Promise<UploadedMediaReference> {
  const draft = await queryOne<{ id: string; scope: string; expires_at: Date; finalized_at: Date | null }>(
    `SELECT id, scope, expires_at, finalized_at FROM upload_draft
     WHERE id = $1::uuid AND token_hash = $2`,
    [input.draftId, sha256(input.token)],
  );
  if (!draft || draft.scope !== 'mapaba-registration' || draft.finalized_at || draft.expires_at.getTime() <= Date.now()) {
    throw AppError.forbidden('Draft upload tidak valid atau sudah kedaluwarsa.');
  }

  const mimeType = await verifyImageSignature(input.file);
  const stored = await putPrivateImage({
    kind: input.kind,
    file: input.file,
    contentType: mimeType,
    randomHex: randomBytes(24).toString('hex'),
  });

  await query(
    `UPDATE upload_draft SET allowed_paths = array_append(allowed_paths, $2)
     WHERE id = $1::uuid AND token_hash = $3 AND finalized_at IS NULL`,
    [input.draftId, stored.pathname, sha256(input.token)],
  );
  await query(
    `INSERT INTO media_asset (bucket, object_key, visibility, mime_type, byte_size, owner_scope, state)
     VALUES ($1, $2, 'private', $3, $4, $5, 'pending')`,
    [config.privateMapabaBucket, stored.pathname, mimeType, stored.size, `${input.draftId}:${input.kind}`],
  );

  return { pathname: stored.pathname, mimeType, size: stored.size };
}

/**
 * Kunci baris draft, pastikan berkas benar milik draft ini, dan ambil id `media_asset`.
 * Dipanggil di dalam transaksi pendaftaran; tidak ada commit tersendiri di sini.
 */
export async function claimDraftFiles(
  client: PoolClient,
  input: { draftId: string; token: string; files: readonly DraftFileInput[] },
): Promise<ClaimedMedia> {
  const paths = new Map<MapabaMediaKind, string>();
  for (const file of input.files) {
    let pathname: string;
    try {
      pathname = toPrivatePathname(file.reference);
    } catch {
      throw AppError.validation(`Tautan berkas ${file.kind} tidak dikenali.`);
    }
    paths.set(file.kind, pathname);
  }
  const photoPath = paths.get('pasFoto');
  const ktmPath = paths.get('ktm');
  if (!photoPath || !ktmPath) throw AppError.validation('Pas foto dan KTM wajib diunggah.');
  if (photoPath === ktmPath) throw AppError.validation('Pas foto dan KTM tidak boleh berkas yang sama.');

  const draft = await client.query<{ allowed_paths: string[]; expires_at: Date; finalized_at: Date | null }>(
    `SELECT allowed_paths, expires_at, finalized_at FROM upload_draft
     WHERE id = $1::uuid AND token_hash = $2 AND scope = 'mapaba-registration'
     FOR UPDATE`,
    [input.draftId, sha256(input.token)],
  );
  const row = draft.rows[0];
  if (!row || row.finalized_at || row.expires_at.getTime() <= Date.now()) {
    throw AppError.forbidden('Draft upload tidak valid atau sudah kedaluwarsa.');
  }
  if (!row.allowed_paths.includes(photoPath) || !row.allowed_paths.includes(ktmPath)) {
    throw AppError.forbidden('Berkas tidak berasal dari draft upload ini.');
  }

  const media = await client.query<{ id: number; object_key: string }>(
    `SELECT id, object_key FROM media_asset
     WHERE object_key = ANY($1::text[]) AND visibility = 'private' AND state = 'pending'
     FOR UPDATE`,
    [[photoPath, ktmPath]],
  );
  const photo = media.rows.find((item) => item.object_key === photoPath);
  const ktm = media.rows.find((item) => item.object_key === ktmPath);
  if (!photo || !ktm) throw AppError.forbidden('Metadata berkas tidak ditemukan.');

  return { photoMediaId: photo.id, ktmMediaId: ktm.id };
}

/** Tandai draft terpakai dan kunci berkas ke peserta; idempoten di level draft. */
export async function finalizeDraft(  client: PoolClient,
  input: { draftId: string; token: string; mediaIds: readonly number[]; registrationId: number },
): Promise<void> {
  const updated = await client.query(
    `UPDATE upload_draft SET finalized_at = now()
     WHERE id = $1::uuid AND token_hash = $2 AND finalized_at IS NULL AND expires_at > now()`,
    [input.draftId, sha256(input.token)],
  );
  if ((updated.rowCount ?? 0) !== 1) throw AppError.forbidden('Draft upload tidak dapat difinalisasi.');

  await client.query(
    `UPDATE media_asset
     SET state = 'finalized', finalized_at = now(), owner_scope = $2
     WHERE id = ANY($1::bigint[]) AND state = 'pending'`,
    [input.mediaIds, `registration:${input.registrationId}`],
  );
}
