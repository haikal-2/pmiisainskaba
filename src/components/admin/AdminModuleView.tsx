'use client';

import { useEffect, useState } from 'react';

export type AdminModuleKey = 'advokasi' | 'mapaba' | 'konten' | 'struktur' | 'kopri' | 'galeri' | 'dokumen';

const API: Record<'advokasi' | 'mapaba', string> = {
  advokasi: '/api/admin/advocacy/reports',
  mapaba: '/api/admin/mapaba/registrations',
};

type RecordItem = Record<string, string | number | boolean | null>;
type PagePayload = {
  data?: { items?: RecordItem[]; total?: number; page?: number };
  error?: { message?: string };
};

const TITLES: Record<AdminModuleKey, string> = {
  advokasi: 'Laporan Advokasi', mapaba: 'Pendaftar MAPABA', konten: 'Konten & Pengaturan',
  struktur: 'Struktur Organisasi', kopri: 'KOPRI', galeri: 'Galeri', dokumen: 'Landasan Hukum',
  };

export default function AdminModuleView({ module }: { module: AdminModuleKey }) {
  const [items, setItems] = useState<RecordItem[]>([]);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (module !== 'advokasi' && module !== 'mapaba') return;
    let cancelled = false;
    fetch(`${API[module]}?page=1&perPage=50&q=${encodeURIComponent(search)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json()) as PagePayload;
        if (!response.ok) throw new Error(payload.error?.message || 'Gagal mengambil data.');
        if (!cancelled) { setItems(payload.data?.items ?? []); setTotal(payload.data?.total ?? 0); setError(''); }
      })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Gagal mengambil data.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [module, search]);

  async function openDetail(item: RecordItem) {
    setSelected(item);
    setDetail(null);
    try {
      const base = module === 'advokasi' ? '/api/admin/advocacy/reports' : '/api/admin/mapaba/registrations';
      const response = await fetch(`${base}/${item.id}`, { cache: 'no-store' });
      const payload = await response.json() as {
        data?: Record<string, unknown>; error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message || 'Gagal memuat detail.');
      setDetail(payload.data ?? null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Gagal memuat detail.'); }
  }

  if (module !== 'advokasi' && module !== 'mapaba') {
    return <EmptyModule module={module} />;
  }

  const columns: [string, string][] = module === 'advokasi'
    ? [['ticket', 'Nomor tiket'], ['reporter_name', 'Pelapor'], ['category', 'Kategori'], ['status', 'Status'], ['created_at', 'Diterima']]
    : [['registration_number', 'Nomor registrasi'], ['full_name', 'Nama'], ['nim', 'NIM'], ['university', 'Universitas'], ['study_program', 'Program studi'], ['created_at', 'Didaftarkan']];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="section-eyebrow">Pengelolaan</p><h1 className="mt-2 font-display text-3xl font-extrabold text-pmii-950">{TITLES[module]}</h1><p className="mt-2 text-sm text-slate-600">{total} data · hanya terlihat oleh admin</p></div>
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setLoading(true); setSearch(q); }}>
          <input className="admin-field min-w-48" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Cari nama / nomor" aria-label="Cari" />
          <button className="admin-button admin-button-primary" type="submit">Cari</button>
        </form>
      </header>
      {error && <p role="alert" className="rounded-xl border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <section className="admin-card overflow-x-auto p-0">
        {loading ? <p className="p-6 text-sm text-slate-500">Memuat data…</p> : items.length === 0 ? <p className="p-6 text-sm text-slate-500">Belum ada data.</p> : (
          <table className="admin-table">
            <thead><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}<th>Aksi</th></tr></thead>
            <tbody>{items.map((item) => <tr key={String(item.id)}>
              {columns.map(([key]) => <td key={key}>{formatValue(item[key] ?? '')}</td>)}
              <td><button type="button" className="font-semibold text-pmii-700 hover:underline" onClick={() => void openDetail(item)}>Detail</button></td>
            </tr>)}</tbody>
          </table>
        )}
      </section>
      {selected && <RecordDetail module={module} item={selected} detail={detail} onClose={() => { setSelected(null); setDetail(null); }} />}
    </div>
  );
}

function formatValue(value: string | number | boolean | null): string {
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  if (value === null) return '—';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return new Date(text).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  return text;
}

function RecordDetail({ module, item, detail, onClose }: { module: 'advokasi' | 'mapaba'; item: RecordItem; detail: Record<string, unknown> | null; onClose: () => void }) {
  const [status, setStatus] = useState(String(item.status ?? 'baru'));
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const report = detail?.report as Record<string, unknown> | undefined;
  const registration = detail?.registration as Record<string, unknown> | undefined;
  const registrationId = Number(registration?.id);
  const fields = module === 'advokasi'
    ? [['Nama pelapor', report?.reporter_name], ['Kontak', report?.contact], ['Email', report?.email], ['Status pelapor', report?.reporter_status], ['Kategori', report?.category], ['Kronologi', report?.chronology], ['Tautan bukti', report?.evidence_url], ['Rahasiakan identitas', report?.confidential]]
    : Object.entries(registration ?? {}).filter(([key]) => key !== 'photo_media_id' && key !== 'ktm_media_id').map(([key, value]) => [key, value]);

  async function updateStatus() {
    const response = await fetch(`/api/admin/advocacy/reports/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    const payload = await response.json() as {
      error?: { message?: string };
    };
    setMessage(response.ok ? 'Status diperbarui.' : payload.error?.message || 'Gagal memperbarui status.');
  }
  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/admin/advocacy/reports/${item.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: note }) });
    const payload = await response.json() as {
      error?: { message?: string };
    };
    if (response.ok) {
      setNote('');
      setMessage('Catatan disimpan. Muat ulang detail untuk melihat catatan.');
    }
    else setMessage(payload.error?.message || 'Gagal menyimpan catatan.');
  }

return (
  <div className="legacy-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
    <section className="legacy-modal-content w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-card-hover">
      <div className="flex items-start justify-between gap-4"><div><p className="section-eyebrow">Data privat</p><h2 id="detail-title" className="mt-2 font-display text-xl font-bold text-pmii-950">{String(item.ticket ?? item.registration_number ?? 'Detail')}</h2></div><button className="btn-outline btn-sm" onClick={onClose} type="button">Tutup</button></div>
      {!detail ? <p className="mt-6 text-sm text-slate-500">Memuat detail…</p> : <div className="mt-6 space-y-4">
        <dl className="grid gap-3 sm:grid-cols-2">{fields.map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-semibold uppercase text-slate-500">{String(label)}</dt><dd className="mt-1 break-words whitespace-pre-wrap text-sm text-slate-800">{formatValue(value as string | number | boolean | null)}</dd></div>)}</dl>
        {module === 'mapaba' && Number.isSafeInteger(registrationId) && registrationId > 0 && <div className="flex flex-wrap gap-3">
          <a className="admin-button admin-button-primary" href={`/api/admin/mapaba/registrations/${registrationId}/media/photo`} target="_blank" rel="noreferrer">Lihat pas foto</a>
          <a className="admin-button admin-button-primary" href={`/api/admin/mapaba/registrations/${registrationId}/media/ktm`} target="_blank" rel="noreferrer">Lihat KTM</a>
        </div>}
        {module === 'advokasi' && <>
          <div className="flex flex-wrap items-end gap-3"><label className="flex-1 text-sm font-semibold">Status tindak lanjut<select className="admin-field mt-1" value={status} onChange={(event) => setStatus(event.target.value)}><option value="baru">Baru</option><option value="diverifikasi">Diverifikasi</option><option value="didampingi">Didampingi</option><option value="selesai">Selesai</option><option value="ditutup">Ditutup</option></select></label><button type="button" className="admin-button admin-button-primary" onClick={() => void updateStatus()}>Simpan status</button></div>
          <form onSubmit={(event) => void addNote(event)} className="space-y-2"><label className="text-sm font-semibold">Catatan privat<textarea className="admin-field mt-1-h-24" value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} required /></label><button className="admin-button admin-button-primary" type="submit">Tambah catatan</button></form>
          {(detail.notes as Array<Record<string, unknown>> | undefined)?.map((entry) => <p key={String(entry.id)} className="rounded-xl border-slate-200 p-3 text-sm">{String(entry.body)}</p>)}
        </>}
        {message && <p role="status" className="text-sm text-pmii-700">{message}</p>}
      </div>}
    </section>
  </div>
);
}

function EmptyModule({ module }: { module: AdminModuleKey }) {
  return <section className="admin-card"><p className="section-eyebrow">Pengelolaan</p><h1 className="mt-2 font-display text-3xl font-extrabold text-pmii-950">{TITLES[module]}</h1><p className="mt-3 text-sm leading-relaxed text-slate-600">Editor untuk modul ini memerlukan antarmuka admin tersendiri. Konten publik tetap diambil dari source referensi yang sudah diunduh.</p><p className="mt-4 rounded-xl border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Pengelolaan CRUD untuk modul ini belum tersedia.</p></section>;
}
