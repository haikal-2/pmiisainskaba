export type Environment = Record<string, string | undefined>;

const RESERVED_ADMIN_PATHS = new Set([
  'api', 'assets', 'profil', 'kopri', 'galeri', 'landasan-hukum', 'advokasi',
  'mapaba', '_next', 'favicon.ico', 'robots.txt', 'sitemap.xml',
]);

function required(name: string, value: string | undefined, fallback?: string): string {
  const resolved = value?.trim() || fallback;
  if (!resolved) throw new Error(`Konfigurasi server tidak lengkap: variabel ${name} wajib diisi.`);
  return resolved;
}

function integer(
  env: Environment,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  if (!/^-?\d+$/.test(raw)) {
    throw new Error(`Konfigurasi ${name} harus bilangan bulat ${min}..${max}; diterima "${raw}".`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`Konfigurasi ${name} harus bilangan bulat ${min}..${max}; diterima "${raw}".`);
  }
  return value;
}

function validateAppUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('APP_URL harus berupa origin HTTP(S) yang valid.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  ) {
    throw new Error('APP_URL harus berupa origin HTTP(S), tanpa path, query, atau kredensial.');
  }
  return url.origin;
}

function validateDatabaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL harus berupa URL PostgreSQL yang valid.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error('DATABASE_URL harus berupa URL PostgreSQL dengan host dan nama database.');
  }
  return raw;
}

function readCaptchaConfig(env: {
  CAPTCHA_PROVIDER?: string;
  CAPTCHA_SECRET_KEY?: string;
  isProduction: boolean;
}): { provider: '' | 'turnstile' | 'recaptcha' | 'recaptcha3'; secretKey: string } {
  const provider = (env.CAPTCHA_PROVIDER?.trim().toLowerCase() || '') as '' | 'turnstile' | 'recaptcha' | 'recaptcha3';
  const secretKey = env.CAPTCHA_SECRET_KEY?.trim() ?? '';
  if (provider && !['turnstile', 'recaptcha', 'recaptcha3'].includes(provider)) {
    throw new Error(`CAPTCHA_PROVIDER tidak dikenal: "${provider}". Gunakan turnstile, recaptcha, atau recaptcha3.`);
  }
  if (provider && !secretKey && env.isProduction) {
    throw new Error('CAPTCHA_SECRET_KEY wajib diisi di production ketika CAPTCHA_PROVIDER aktif.');
  }
  return { provider, secretKey };
}

function validateAdminPath(raw: string | undefined): string {
  const value = raw?.trim() || 'admin-secret';
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(value) || RESERVED_ADMIN_PATHS.has(value)) {
    throw new Error(`ADMIN_PATH tidak valid atau bertabrakan dengan route publik: "${value}".`);
  }
  return value;
}

function validateTrustedClientIpHeader(raw: string | undefined): string {
  const value = raw?.trim() ?? '';
  if (!value) return '';
  // Hanya header tunggal, huruf kecil, tanpa spasi ”” tidak ada daftar berantai.
  if (!/^[a-z0-9-]{3,64}$/.test(value)) {
    throw new Error('TRUSTED_CLIENT_IP_HEADER harus satu nama header huruf kecil, tanpa daftar berantai.');
  }
  return value;
}

export function parseServerConfig(env: Environment) {
  const isProduction = env.NODE_ENV === 'production';
  const databaseUrl = validateDatabaseUrl(required('DATABASE_URL', env.DATABASE_URL));
  const rateLimitHashSalt = env.RATE_LIMIT_HASH_SALT?.trim() || (isProduction ? '' : 'dev-only-salt-change-me');
  if (!rateLimitHashSalt) {
    throw new Error('Konfigurasi server tidak lengkap: variabel RATE_LIMIT_HASH_SALT wajib diisi di production.');
  }
  const appUrl = validateAppUrl(env.APP_URL?.trim() || 'http://localhost:3000');

  return {
    isProduction,
    appUrl,
    databaseUrl,
    migrationDatabaseUrl: validateDatabaseUrl(
      env.MIGRATION_DATABASE_URL?.trim() || databaseUrl,
    ),
    databasePoolMax: integer(env, 'DATABASE_POOL_MAX', 5, 1, 50),
    databaseSsl: (env.DATABASE_SSL ?? (isProduction ? 'require' : 'disable')).trim().toLowerCase() !== 'disable',
    adminPath: validateAdminPath(env.ADMIN_PATH),
    adminSessionTtlSeconds: integer(env, 'ADMIN_SESSION_TTL_SECONDS', 604800, 300, 7776000),
    uploadDraftTtlSeconds: integer(env, 'UPLOAD_DRAFT_TTL_SECONDS', 7200, 300, 86400),
    // Kosong = header forwarding tidak dipercaya; rate limit memakai bucket bersama.
    // Isi hanya bila proxy platform menimpa header ini (mis. `x-real-ip` di Vercel).
    trustedClientIpHeader: validateTrustedClientIpHeader(env.TRUSTED_CLIENT_IP_HEADER),
    adminMinPasswordLength: integer(env, 'ADMIN_MIN_PASSWORD_LENGTH', 12, 8, 200),
    // Wajib diisi agar job terjadwal (worker outbox) dapat dijalankan; kosong = endpoint cron menolak.
    cronSecret: env.CRON_SECRET?.trim() ?? '',
    blobReadWriteToken: env.BLOB_READ_WRITE_TOKEN?.trim() ?? '',
    publicAssetsBucket: env.PUBLIC_ASSETS_BUCKET?.trim() || 'public-assets',
    privateMapabaBucket: env.PRIVATE_MAPABA_BUCKET?.trim() || 'private-mapaba',
    maxUploadBytes: integer(env, 'MAX_UPLOAD_BYTES', 3 * 1024 * 1024, 64 * 1024, 10 * 1024 * 1024),
    mapaba: {
      quota: integer(env, 'MAPABA_QUOTA', 100, 1, 100000),
      closesAt: env.MAPABA_CLOSES_AT?.trim() || '2026-11-03T23:59:59+07:00',
      timeZone: env.MAPABA_TIME_ZONE?.trim() || 'Asia/Jakarta',
      contributionLabel: env.MAPABA_CONTRIBUTION_LABEL?.trim() || 'Rp75.000',
      faculty: env.MAPABA_FACULTY?.trim() || 'Sains dan Teknologi',
    },
    googleSheets: {
      // Tanpa nilai bawaan yang menunjuk endpoint produksi. Endpoint webhook hanya
      // boleh datang dari environment (lihat `.env.example`). Nilai bawaan pernah
      // membuat test ikut mengirim data peserta ke spreadsheet sungguhan ”” test
      // memakai `tests/empty.env` justru supaya integrasi eksternal tidak aktif.
      advocacyWebhookUrl: env.GOOGLE_SHEETS_ADVOKASI_WEBHOOK_URL?.trim() ?? '',
      mapabaWebhookUrl: env.GOOGLE_SHEETS_MAPABA_WEBHOOK_URL?.trim() ?? '',
      spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? '',
      clientEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? '',
      privateKey: (env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim(),
      mapabaSheet: env.GOOGLE_SHEETS_MAPABA_TAB?.trim() || 'MAPABA',
      advocacySheet: env.GOOGLE_SHEETS_ADVOCACY_TAB?.trim() || 'Advokasi',
    },
    composio: {
      // Opsional: integrasi Composio tidak aktif sampai kuncinya diisi.
      // Kunci tidak pernah dicetak atau masuk database.
      apiKey: env.COMPOSIO_API_KEY?.trim() ?? '',
    },
    rateLimit: { hashSalt: rateLimitHashSalt },
    captcha: readCaptchaConfig({
      CAPTCHA_PROVIDER: env.CAPTCHA_PROVIDER,
      CAPTCHA_SECRET_KEY: env.CAPTCHA_SECRET_KEY,
      isProduction,
    }),
  } as const;
}

export type ServerConfig = ReturnType<typeof parseServerConfig>;

