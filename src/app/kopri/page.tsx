import type { Metadata } from 'next';

import { LegacyPage } from '@/components/public/LegacyPage';

export const metadata: Metadata = { title: 'KOPRI Rayon Saintek' };

export default function KopriPage() {
  return <LegacyPage page="kopri" />;
}
