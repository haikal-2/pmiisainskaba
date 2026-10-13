import { NextResponse } from 'next/server';

/**
 * Header keamanan global (Next.js 16 proxy, dulunya middleware).
 *
 * CSP memakai 'unsafe-inline' untuk script/style karena App Router menyematkan
 * data RSC lewat <script> inline dan halaman referensi memakai atribut style
 * inline. Tidak ada skrip/style pihak ketiga yang dimuat saat ini; bila
 * provider captcha atau analitik diaktifkan, perbarui directive di bawah.
 */
export function proxy() {
  const response = NextResponse.next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
