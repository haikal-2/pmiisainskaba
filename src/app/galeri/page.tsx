import type { Metadata } from 'next';

import { LegacyPage } from '@/components/public/LegacyPage';

export const metadata: Metadata = {
  title: 'Galeri Kegiatan',
  description: 'Dokumentasi kegiatan PMII Sains dan Teknologi UIN Sunan Gunung Djati Cabang Kabupaten Bandung: MAPABA, kajian, pengabdian masyarakat, dan advokasi.',
};

export default function GalleryPage() {
  return <LegacyPage page="gallery" />;
}

