import type { Metadata } from 'next';

import { LegacyPage } from '@/components/public/LegacyPage';

export const metadata: Metadata = { title: 'Struktur Organisasi' };

export default function StructurePage() {
  return <LegacyPage page="structure" />;
}
