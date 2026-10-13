import type { Metadata } from 'next';

import { LegacyPage } from '@/components/public/LegacyPage';

export const metadata: Metadata = {
  title: 'Layanan Advokasi',
  description: 'Laporkan permasalahan akademik, kesejahteraan, dan hak mahasiswa kepada Tim Advokasi PMII Saintek UIN SGD Cabang Kabupaten Bandung. Respons 2x24 jam kerja, bisa anonim.',
  openGraph: { images: [{ url: '/assets/img/og-image.jpg', width: 1200, height: 630, alt: 'Advokasi PMII Saintek' }] },
};

export default function AdvocacyPage() {
  return <LegacyPage page="advocacy" />;
}

