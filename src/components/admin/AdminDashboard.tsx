import Link from 'next/link';

import { queryOne } from '@/server/db/pool';
import config from '@/server/config';
import AdminLogoutButton from '@/components/admin/AdminLogoutButton';

export default async function AdminDashboard({ username }: { username: string }) {
  const [registrations, reports, albums, members] = await Promise.all([
    queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM mapaba_registration'),
    queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM advocacy_report'),
    queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM gallery_album'),
    queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM organization_member'),
  ]);
  const stats = [
    ['Pendaftar MAPABA', registrations?.count ?? '0', 'Data peserta privat'],
    ['Laporan Advokasi', reports?.count ?? '0', 'Laporan rahasia'],
    ['Album Galeri', albums?.count ?? '0', 'Album terpublikasi/draft'],
    ['Anggota Struktur', members?.count ?? '0', 'Pengurus organisasi'],
  ];
  const modules = [
    ['Konten & Pengaturan', 'Edit beranda, sejarah, identitas, kontak, dan statistik.', 'konten'],
    ['Struktur Organisasi', 'Kelola BPH, biro, anggota, dan periode kepengurusan.', 'struktur'],
    ['KOPRI', 'Kelola program dan konten KOPRI.', 'kopri'],
    ['Galeri', 'Kelola album, kategori, foto, dan publikasi.', 'galeri'],
    ['Landasan Hukum', 'Kelola judul, keterangan, serta tautan dokumen.', 'dokumen'],
    ['MAPABA', 'Atur event, agenda, FAQ, kuota, dan data pendaftar.', 'mapaba'],
    ['Advokasi', 'Baca laporan, ubah status, serta tulis catatan privat.', 'advokasi'],
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-pmii-950 p-6 text-white shadow-card-hover sm:p-8">
        <div className="flex items-center gap-4">
          <img src="/assets/img/logo-pmii.png" alt="" width="42" height="50" className="h-12 w-auto" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-kuning-300">PR PMII Saintek</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold">Panel Pengurus</h1>
            <p className="mt-1 text-sm text-pmii-100/75">Masuk sebagai {username}</p>
          </div>
        </div>
        <AdminLogoutButton />
      </header>

      <section aria-label="Ringkasan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, caption]) => (
          <article key={label} className="admin-card">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-3 font-display text-3xl font-extrabold text-pmii-950">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{caption}</p>
          </article>
        ))}
      </section>

      <section>
        <div className="mb-4 flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-eyebrow">Pengelolaan</p>
            <h2 className="section-title mt-2 text-2xl">Modul website</h2>
          </div>
          <Link className="btn-outline btn-sm" href="/">Lihat website publik ↗</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map(([title, description, slug]) => (
            <Link key={slug} href={`/${config.adminPath}/${slug}`} className="admin-card group transition hover:-translate-y-0.5 hover:border-pmii-200 hover:shadow-card-hover">
              <p className="font-display text-base font-bold text-pmii-950">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-pmii-700">Buka modul <span aria-hidden="true">→</span></span>
            </Link>
          ))}
        </div>
      </section>

      <p className="border-t border-slate-200 pt-5 text-xs leading-relaxed text-slate-500">
        Data peserta dan pengaduan hanya tersedia pada sesi admin ini. Tidak ada export atau notifikasi email.
      </p>
    </div>
  );
}
