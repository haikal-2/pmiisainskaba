import type { Metadata } from 'next';

import { LegacyPage } from '@/components/public/LegacyPage';

export const metadata: Metadata = { title: 'Landasan Hukum' };

export default function LegalPage() {
  return <LegacyPage page="legal" />;
}
