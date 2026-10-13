import type { Metadata } from 'next';

import { LegacyPage } from '@/components/public/LegacyPage';

export const metadata: Metadata = {
  title: 'Sejarah',
  description: 'Sejarah Pergerakan Mahasiswa Islam Indonesia (PMII) dan cabang Sains dan Teknologi UIN Sunan Gunung Djati Cabang Kabupaten Bandung.',
};

export default function HistoryPage() {
  return <LegacyPage page="history" />;
}

