import type { Metadata } from 'next';
import { LegacyPage } from '@/components/public/LegacyPage';
export const metadata: Metadata = {
  title: 'PR PMII Sains dan Teknologi UIN Sunan Gunung Djati Cabang Kabupaten Bandung',
  description: "Website resmi PR PMII Sains dan Teknologi UIN Sunan Gunung Djati Cabang Kabupaten Bandung. Organisasi ekstra kampus yang berlandaskan Islam Ahlussunnah wal Jama'ah dan Pancasila. Taqwa, Intelektual, Profesional.",
};

export default function HomePage() {
  return <LegacyPage page="home" />;
}

