import type { Metadata } from 'next';

import { LegacyPage } from '@/components/public/LegacyPage';

export const metadata: Metadata = { title: 'Galeri Kegiatan' };

export default function GalleryPage() {
  return <LegacyPage page="gallery" />;
}
