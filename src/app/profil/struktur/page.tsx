import type { Metadata } from 'next';

import { LegacyPage } from '@/components/public/LegacyPage';

export const metadata: Metadata = {
  title: 'Struktur Organisasi',
  description: 'Struktur organisasi dan susunan pengurus Perhimpunan Raden PMII Sains dan Teknologi UIN Sunan Gunung Djati Cabang Kabupaten Bandung.',
};

export default function StructurePage() {
  return <LegacyPage page="structure" />;
}

