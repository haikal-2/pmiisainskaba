'use client';

import { useState } from 'react';

export default function AdminLogoutButton() {
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true);
    try {
      await fetch('/api/auth/admin/logout', { method: 'POST', cache: 'no-store' });
      window.location.reload();
    } finally {
      setPending(false);
    }
  }
  return <button type="button" onClick={logout} disabled={pending} className="btn-outline border-white/25 bg-white/10 text-white hover:bg-white/20">{pending ? 'Keluar…' : 'Keluar'}</button>;
}
