import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { randomUUID } from 'node:crypto';

import config from '@/server/config';
import { query, queryOne } from '@/server/db/pool';
import { AppError } from '@/server/errors';
import { assertBlobConfigured, uploadPrivateMapabaFile, verifyImageSignature } from '@/server/storage/blob';

export type UploadDraft = {
  draftId: string;
  token: string;
  expiresAt: Date;
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Draft anonim untuk dua dokumen, token hanya dikembalikan satu kali ke browser. */
export async function createMapabaUploadDraft(): Promise<UploadDraft> {
  assertBlobConfigured();
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
  kind: 'pasFoto' | 'ktm';
  file: File;
}): Promise<{ url: string; pathname: string; mimeType: string; size: number }> {
  const draft = await queryOne<{ id: string; scope: string; expires_at: Date; finalized_at: Date | null }>(
    `SELECT id, scope, expires_at, finalized_at FROM upload_draft
     WHERE id = $1::uuid AND token_hash = $2`,
    [input.draftId, sha256(input.token)],
  );
  if (!draft || draft.scope !== 'mapaba-registration' || draft.finalized_at || draft.expires_at.getTime() <= Date.now()) {
    throw AppError.forbidden('Draft upload tidak valid atau sudah kedaluwarsa.');
  }
  const mimeType = await verifyImageSignature(input.file);
  const blob = await uploadPrivateMapabaFile(input.file, input.kind);
  const allowedPath = blob.pathname;
  await query(
    `UPDATE upload_draft SET allowed_paths = array_append(allowed_paths, $2)
     WHERE id = $1::uuid AND token_hash = $3 AND finalized_at IS NULL`,
    [input.draftId, allowedPath, sha256(input.token)],
  );
  await query(
    `INSERT INTO media_asset (bucket, object_key, visibility, mime_type, byte_size, owner_scope, state)
     VALUES ($1, $2, 'private', $3, $4, $5, 'pending')`,
    [config.privateMapabaBucket, blob.pathname, mimeType, blob.size, `${input.draftId}:${input.kind}`],
  );
  return { url: blob.url, pathname: blob.pathname, mimeType, size: blob.size };
}

/** Validasi bahwa URL file berasal dari draft ini; finalisasi media setelah commit peserta. */
export async function verifyMapabaDraftFiles(
  draftId: string,
  token: string,
  photoUrl: string,
  ktmUrl: string,
): Promise<{ photoMediaId: number; ktmMediaId: number }> {
  const draft = await queryOne<{ allowed_paths: string[]; expires_at: Date; finalized_at: Date | null }>(
    `SELECT allowed_paths, expires_at, finalized_at FROM upload_draft
     WHERE id = $1::uuid AND token_hash = $2`,
    [draftId, sha256(token)],
  );
  if (!draft || draft.finalized_at || draft.expires_at.getTime() <= Date.now()) {
    throw AppError.forbidden('Draft upload tidak valid atau sudah kedaluwarsa.');
  }
  const photoPath = blobPathFromUrl(photoUrl);
  const ktmPath = blobPathFromUrl(ktmUrl);
  if (!draft.allowed_paths.includes(photoPath) || !draft.allowed_paths.includes(ktmPath) || photoPath === ktmPath) {
    throw AppError.forbidden('Berkas tidak berasal dari draft upload ini.');
  }
  const media = await query<{ id: number; object_key: string }>(
    `SELECT id, object_key FROM media_asset
     WHERE object_key = ANY($1::text[]) AND visibility = 'private' AND state = 'pending'`,
    [[photoPath, ktmPath]],
  );
  const photo = media.rows.find((item) => item.object_key === photoPath);
  const ktm = media.rows.find((item) => item.object_key === ktmPath);
  if (!photo || !ktm) throw AppError.forbidden('Metadata berkas tidak ditemukan.');
  return { photoMediaId: photo.id, ktmMediaId: ktm.id };
}

export async function finalizeMapabaDraft(
  draftId: string,
  token: string,
  photoMediaId: number,
  ktmMediaId: number,
  registrationId: number,
): Promise<void> {
  const updated = await query(
    `UPDATE upload_draft SET finalized_at = now()
     WHERE id = $1::uuid AND token_hash = $2 AND finalized_at IS NULL AND expires_at > now()`,
    [draftId, sha256(token)],
  );
  if ((updated.rowCount ?? 0) !== 1) throw AppError.forbidden('Draft upload tidak dapat difinalisasi.');
  await query(
    `UPDATE media_asset SET state = 'finalized', finalized_at = now(), owner_scope = $4
     WHERE id = ANY($1::bigint[]) AND state = 'pending'`,
    [[photoMediaId, ktmMediaId], registrationId, draftId, `registration:${registrationId}`],
  );
}

function blobPathFromUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw AppError.validation('Tautan upload tidak valid.');
  }
  if (!parsed.hostname.endsWith('.blob.vercel-storage.com') || parsed.protocol !== 'https:') {
    throw AppError.validation('Tautan upload tidak dikenali.');
  }
  return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
}
