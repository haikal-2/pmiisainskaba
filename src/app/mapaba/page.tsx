import type { Metadata } from 'next';

import { LegacyPage } from '@/components/public/LegacyPage';

export const metadata: Metadata = {
  title: 'MAPABA SAINTEK Ke-XVII — Pendaftaran Mahasiswa Baru PMII',
  description: 'Pendaftaran MAPABA (Masa Pengenalan Alam Baik) PMII Sains dan Teknologi UIN Sunan Gunung Djati Cabang Kabupaten Bandung. Daftar online, unggah berkas, dan amankan kuota 100 peserta.',
  openGraph: { images: [{ url: '/assets/img/og-image.jpg', width: 1200, height: 630, alt: 'MAPABA SAINTEK' }] },
};

export default function MapabaPage() {
  return <LegacyPage page="mapaba" />;
}

