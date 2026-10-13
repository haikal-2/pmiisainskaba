'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Halaman error global (app/error.tsx). Menangkap error render/runtime di
 * sisi klien maupun server component dan menampilkannya dengan branding
 * situs, bukan layar error default Next.js.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Catat ke console; integrasi error reporting (mis. Sentry) dapat
    // ditambahkan di sini tanpa mengubah UI.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <p className="font-display text-6xl font-extrabold text-pmii-700 sm:text-8xl">500</p>
      <h1 className="mt-4 font-display text-2xl font-bold text-pmii-950 sm:text-3xl">
        Terjadi kesalahan
      </h1>
      <p className="mt-3 max-w-md text-sm text-slate-600 sm:text-base">
        Maaf, ada gangguan saat memproses halaman ini. Silakan coba lagi; jika masalah
        berlanjut, muat ulang halaman setelah beberapa saat.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Coba Lagi
        </button>
        <Link href="/" className="btn-outline">
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}
