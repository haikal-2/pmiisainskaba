import 'server-only';

/**
 * Verifikasi CAPTCHA sisi server untuk formulir publik.
 *
 * Mendukung provider yang sama dengan widget klien (reference-original/assets/js/captcha.js):
 * - `turnstile`  : Cloudflare Turnstile
 * - `recaptcha`  : Google reCAPTCHA v2 (checkbox)
 * - `recaptcha3` : Google reCAPTCHA v3 (skor)
 *
 * Kosong = captcha nonaktif (pengembangan lokal). Di production, jika
 * CAPTCHA_PROVIDER diisi tetapi verifikasi gagal, permintaan ditolak.
 */

export type CaptchaProvider = '' | 'turnstile' | 'recaptcha' | 'recaptcha3';

interface CaptchaConfig {
  provider: CaptchaProvider;
  secretKey: string;
}

const VERIFY_ENDPOINTS: Record<Exclude<CaptchaProvider, ''>, string> = {
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  recaptcha: 'https://www.google.com/recaptcha/api/siteverify',
  recaptcha3: 'https://www.google.com/recaptcha/api/siteverify',
};

export function readCaptchaConfig(env: {
  CAPTCHA_PROVIDER?: string;
  CAPTCHA_SECRET_KEY?: string;
  isProduction: boolean;
}): CaptchaConfig {
  const provider = (env.CAPTCHA_PROVIDER?.trim().toLowerCase() || '') as CaptchaProvider;
  const secretKey = env.CAPTCHA_SECRET_KEY?.trim() ?? '';
  if (provider && !VERIFY_ENDPOINTS[provider]) {
    throw new Error(`CAPTCHA_PROVIDER tidak dikenal: "${provider}". Gunakan turnstile, recaptcha, atau recaptcha3.`);
  }
  if (provider && !secretKey && env.isProduction) {
    throw new Error('CAPTCHA_SECRET_KEY wajib diisi di production ketika CAPTCHA_PROVIDER aktif.');
  }
  return { provider, secretKey };
}

/** Verifikasi token captcha. Melempar AppError.validation bila gagal. */
export async function verifyCaptchaToken(
  config: CaptchaConfig,
  token: string,
  remoteIp?: string,
): Promise<void> {
  if (!config.provider) return; // nonaktif (lokal/test)
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error('captcha-missing');
  }
  const body = new URLSearchParams({ secret: config.secretKey, response: trimmed });
  if (remoteIp) body.set('remoteip', remoteIp);
  let success = false;
  try {
    const response = await fetch(VERIFY_ENDPOINTS[config.provider], {
      method: 'POST',
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      score?: number;
    };
    success = payload.success === true;
    // reCAPTCHA v3: token valid tapi skor rendah dianggap bot.
    if (success && config.provider === 'recaptcha3' && typeof payload.score === 'number' && payload.score < 0.5) {
      success = false;
    }
  } catch {
    // Jaringan ke penyedia gagal: gagal tertutup (fail-closed).
    success = false;
  }
  if (!success) {
    throw new Error('captcha-failed');
  }
}
