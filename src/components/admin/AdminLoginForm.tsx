'use client';
import Image from 'next/image';
import { useState, type FormEvent } from 'react';

export default function AdminLoginForm() {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
        cache: 'no-store',
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message || 'Login gagal.');
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Login gagal.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-3xl border-slate-200 bg-white p-8 shadow-card sm:p-10">
      <div className="flex items-center gap-4">
        <Image src="/assets/img/logo-32.png" alt="Logo PMII" width={48} height={48} className="h-12 w-12" />
        <div>
          <p className="font-display text-lg font-extrabold text-pmii-950">Panel Pengurus</p>
          <p className="text-xs text-slate-500">PR PMII Saintek · Akses terbatas</p>
        </div>
      </div>
      <h1 className="mt-8 font-display text-2xl font-extrabold text-pmii-950">Masuk ke panel admin</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">Gunakan kredensial admin yang diberikan. Halaman ini tidak menyediakan pendaftaran akun.</p>
      <form className="mt-7 space-y-5" onSubmit={submit}>
        <div>
          <label htmlFor="username" className="label">Username</label>
          <input id="username" name="username" className="input" required minLength={3} maxLength={64} autoComplete="username" />
        </div>
        <div>
          <label htmlFor="password" className="label">Kata sandi</label>
          <input id="password" name="password" type="password" className="input" required maxLength={200} autoComplete="current-password" />
        </div>
        {error && <p role="alert" className="rounded-xl border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={pending} type="submit">{pending ? 'Memeriksa…' : 'Masuk'}</button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">Area privat · akses dicatat untuk keamanan.</p>
    </section>
  );
}
