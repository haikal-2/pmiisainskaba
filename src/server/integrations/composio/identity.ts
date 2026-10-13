/**
 * Pemetaan identitas aplikasi ke identitas Composio.
 *
 * Repositori ini hanya punya satu identitas terautentikasi — akun admin
 * singleton (`admin_account`, id = 1). Membuat tabel "pengguna Composio"
 * terpisah akan menjadi model identitas kedua, jadi `user_id` Composio cukup
 * diturunkan dari ID admin yang sudah ada. Nilainya stabil antar proses
 * sehingga koneksi aplikasi tidak perlu diotorisasi ulang setiap kali.
 */

const USER_ID_PREFIX = 'pmii-admin-';

export function composioUserIdForAdmin(adminId: number): string {
  if (!Number.isSafeInteger(adminId) || adminId <= 0) {
    throw new Error('ID admin tidak valid untuk identitas Composio.');
  }
  return `${USER_ID_PREFIX}${adminId}`;
}

/** `true` bila nilai berasal dari pemetaan ini, bukan dari sumber lain. */
export function isComposioUserIdForAdmin(userId: string): boolean {
  return /^pmii-admin-\d+$/.test(userId);
}
