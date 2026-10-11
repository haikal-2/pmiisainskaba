import type { Metadata } from 'next';

import { LegacyPage } from '@/components/public/LegacyPage';

export const metadata: Metadata = { title: 'Sejarah' };

export default function HistoryPage() {
  return <LegacyPage page="history" />;
}
