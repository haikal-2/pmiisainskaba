import type { Metadata } from 'next';

import { LegacyPage } from '@/components/public/LegacyPage';

export const metadata: Metadata = { title: 'MAPABA SAINTEK Ke-XVII' };

export default function MapabaPage() {
  return <LegacyPage page="mapaba" />;
}
