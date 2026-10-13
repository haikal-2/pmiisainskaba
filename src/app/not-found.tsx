import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Halaman Tidak Ditemukan',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <p className="font-display text-6xl font-extrabold text-pmii-700 sm:text-8xl">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold text-pmii-950 sm:text-3xl">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-3 max-w-md text-sm text-slate-600 sm:text-base">
        Halaman yang kamu tuju tidak ada atau sudah dipindahkan. Silakan kembali ke beranda
        atau lanjutkan menjelajah dari menu navigasi.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn-primary">
          Kembali ke Beranda
        </Link>
        <Link href="/mapaba" className="btn-outline">
          Pendaftaran MAPABA
        </Link>
      </div>
    </main>
  );
}
