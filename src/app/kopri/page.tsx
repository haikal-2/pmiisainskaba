import type { Metadata } from 'next';

import { LegacyPage } from '@/components/public/LegacyPage';

export const metadata: Metadata = {
  title: 'KOPRI Rayon Saintek',
  description: 'Korps Pergerakan Mahasiswa Islam Indonesia (KOPRI) Rayon Sains dan Teknologi UIN Sunan Gunung Djati Cabang Kabupaten Bandung.',
};

export default function KopriPage() {
  return <LegacyPage page="kopri" />;
}

