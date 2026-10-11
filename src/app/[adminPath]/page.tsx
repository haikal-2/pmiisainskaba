import { notFound } from 'next/navigation';

import config from '@/server/config';
import { getCurrentAdmin } from '@/server/auth/admin';
import AdminLoginForm from '@/components/admin/AdminLoginForm';
import AdminDashboard from '@/components/admin/AdminDashboard';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false, noarchive: true } };

export default async function AdminEntry({ params }: { params: Promise<{ adminPath: string }> }) {
  const { adminPath } = await params;
  if (adminPath !== config.adminPath) notFound();
  const admin = await getCurrentAdmin();
  return (
    <main className="admin-shell min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        {admin ? <AdminDashboard username={admin.username} /> : <AdminLoginForm />}
      </div>
    </main>
  );
}
