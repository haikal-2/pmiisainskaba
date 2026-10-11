import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import config from '@/server/config';
import { getCurrentAdmin } from '@/server/auth/admin';
import AdminModuleView, { type AdminModuleKey } from '@/components/admin/AdminModuleView';
import AdminLogoutButton from '@/components/admin/AdminLogoutButton';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false, noarchive: true } };

const MODULES = new Set<AdminModuleKey>(['advokasi', 'mapaba', 'konten', 'struktur', 'kopri', 'galeri', 'dokumen']);

  export default async function AdminModulePage({ params }: { params: Promise<{ adminPath: string; module: string }> }) {
    const { adminPath, module } = await params;
if (adminPath !== config.adminPath || !MODULES.has(module as AdminModuleKey)) notFound();
const admin = await getCurrentAdmin();
if (!admin) redirect(`/${config.adminPath}`);
return (
  <main className="admin-shell min-h-screen px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex-wrap items-center justify-between gap-4 rounded-3xl bg-pmii-950 p-5 text-white">
        <Link href={`/${config.adminPath}`} className="flex items-center gap-3"><img src="/assets/img/logo-pmii.png" alt="" className="h-10 w-auto" /><span className="font-display font-bold">Panel Pengurus</span></Link>
        <div className="flex items-center gap-3"><Link href="/" className="text-sm text-pmii-100 hover:text-white">Website publik ↗</Link><AdminLogoutButton /></div>
      </header>
      <AdminModuleView module={module as AdminModuleKey} />
    </div>
  </main>
);
}
