import type { Metadata } from 'next';

import { LegacyPage } from '@/components/public/LegacyPage';

export const metadata: Metadata = { title: 'Layanan Advokasi' };

export default function AdvocacyPage() {
  return <LegacyPage page="advocacy" />;
}
