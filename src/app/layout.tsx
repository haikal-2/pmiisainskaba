import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Sora } from 'next/font/google';

import '@/styles/reference.css';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
  weight: ['600', '700', '800'],
});

export const metadata: Metadata = {
  title: {
    default: 'PR PMII Sains dan Teknologi UIN Sunan Gunung Djati Cabang Kabupaten Bandung',
    template: '%s | PR PMII Saintek',
  },
  description:
    "Website resmi PR PMII Sains dan Teknologi UIN Sunan Gunung Djati Cabang Kabupaten Bandung. Organisasi ekstra kampus yang berlandaskan Islam Ahlussunnah wal Jama'ah dan Pancasila. Taqwa, Intelektual, Profesional.",
  keywords: [
    'PMII UIN Bandung',
    'PMII Kabupaten Bandung',
    'PR PMII Saintek',
    'Pergerakan Mahasiswa Islam Indonesia',
    'MAPABA UIN Bandung',
    'KOPRI PMII',
  ],
  authors: [{ name: 'PR PMII Saintek UIN SGD Cabang Kabupaten Bandung' }],
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  manifest: '/site.webmanifest',
  icons: { icon: '/assets/img/logo-pmii.png', apple: '/assets/img/logo-pmii.png' },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    siteName: 'PR PMII Saintek UIN SGD',
    title: 'PR PMII Sains dan Teknologi UIN Sunan Gunung Djati Cabang Kabupaten Bandung',
    description:
      "Website resmi PR PMII Sains dan Teknologi UIN Sunan Gunung Djati Cabang Kabupaten Bandung. Taqwa, Intelektual, Profesional.",
    images: [{ url: '/assets/img/logo-pmii.png', alt: 'Lambang PMII Saintek' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#122a8f',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`scroll-smooth ${plusJakarta.variable} ${sora.variable}`}>
      <body>{children}</body>
    </html>
  );
}
