export type AdminLoginPayload = { username: string; password: string };

export class LoginPayloadError extends Error {
  constructor(readonly kind: 'invalid' | 'too-large' | 'unsupported') {
    super(kind);
    this.name = 'LoginPayloadError';
  }
}

const MAX_LOGIN_BODY_BYTES = 4096;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,64}$/;

export async function readAdminLoginPayload(request: Request): Promise<AdminLoginPayload> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json' && !contentType?.endsWith('+json')) {
    throw new LoginPayloadError('unsupported');
  }
  const contentLength = request.headers.get('content-length');
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_LOGIN_BODY_BYTES)) {
    throw new LoginPayloadError(Number(contentLength) > MAX_LOGIN_BODY_BYTES ? 'too-large' : 'invalid');
  }

  const reader = request.body?.getReader();
  if (!reader) throw new LoginPayloadError('invalid');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_LOGIN_BODY_BYTES) {
        await reader.cancel();
        throw new LoginPayloadError('too-large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  let value: unknown;
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new LoginPayloadError('invalid');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new LoginPayloadError('invalid');
  }
  const payload = value as Record<string, unknown>;
  if (
    typeof payload.username !== 'string' ||
    typeof payload.password !== 'string' ||
    payload.password.length > 200
  ) {
    throw new LoginPayloadError('invalid');
  }
  const username = payload.username.trim();
  if (!USERNAME_PATTERN.test(username)) throw new LoginPayloadError('invalid');
  return { username, password: payload.password };
}
