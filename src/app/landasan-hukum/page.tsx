import type { Metadata } from 'next';

import { LegacyPage } from '@/components/public/LegacyPage';

export const metadata: Metadata = {
  title: 'Landasan Hukum',
  description: 'Landasan hukum dan dasar pergerakan PMII Sains dan Teknologi UIN Sunan Gunung Djati Cabang Kabupaten Bandung.',
};

export default function LegalPage() {
  return <LegacyPage page="legal" />;
}

