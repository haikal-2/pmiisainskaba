import 'server-only';

import { google } from 'googleapis';

import config from '@/server/config';
import { AppError } from '@/server/errors';

export type AdvocacyReportPayload = {
  ticket: string;
  category: string;
  name?: string | null;
  contact?: string | null;
  email?: string | null;
  status?: string | null;
  chronology?: string | null;
  evidenceUrl?: string | null;
  confidential?: boolean | null;
  consent?: boolean | null;
  createdAt: Date | string;
};

export type MapabaRegistrationPayload = {
  registrationNumber: string;
  fullName: string;
  nim: string;
  generation?: string | null;
  university: string;
  faculty?: string | null;
  studyProgram: string;
  whatsapp: string;
  email: string;
  gender?: string | null;
  originRegion?: string | null;
  motivation?: string | null;
  source?: string | null;
  organizationHistory?: string | null;
  photoUrl?: string | null;
  ktmUrl?: string | null;
  createdAt: Date | string;
};

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function sheetsClient() {
  const { spreadsheetId, clientEmail, privateKey } = config.googleSheets;
  if (!spreadsheetId || !clientEmail || !privateKey) {
    throw new AppError(
      'DEPENDENCY_UNAVAILABLE',
      'Integrasi Google Sheets belum dikonfigurasi. Data utama sudah tersimpan; hubungi pengelola.',
    );
  }
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
  });
  return google.sheets({ version: 'v4', auth });
}

async function appendRow(sheetName: string, values: readonly (string | number | boolean | null)[]) {
  const sheets = sheetsClient();
  const escapedSheetName = `'${sheetName.replace(/'/g, "''")}'`;
  return sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheets.spreadsheetId,
    range: `${escapedSheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values.map((value) => value ?? '')] },
  });
}

/**
 * Kirim laporan advokasi ke Google Sheets via Google Apps Script Webhook (real-time).
 * Jika webhook tidak dikonfigurasi, jatuh kembali ke Google Sheets API via service account.
 */
export async function sendAdvocacyToSheets(input: AdvocacyReportPayload): Promise<void> {
  const webhookUrl = config.googleSheets.advocacyWebhookUrl;
  const dateObj = typeof input.createdAt === 'string' ? new Date(input.createdAt) : input.createdAt;
  const isoDate = dateObj.toISOString();
  const formattedDate = dateObj.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  if (webhookUrl) {
    const payload = {
      nomorTiket: input.ticket,
      ticket: input.ticket,
      nama: input.name ?? '',
      name: input.name ?? '',
      kontak: input.contact ?? '',
      contact: input.contact ?? '',
      email: input.email ?? '',
      status: input.status ?? '',
      kategori: input.category,
      category: input.category,
      kronologi: input.chronology ?? '',
      chronology: input.chronology ?? '',
      lampiranUrl: input.evidenceUrl ?? '',
      evidenceUrl: input.evidenceUrl ?? '',
      anonim: input.confidential ? 'Ya' : 'Tidak',
      confidential: input.confidential ?? false,
      persetujuan: input.consent ? 'Ya' : 'Tidak',
      consent: input.consent ?? true,
      waktu: isoDate,
      createdAt: isoDate,
      tanggal: formattedDate,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Advokasi Webhook HTTP error ${response.status}`);
    }
    return;
  }

  // Fallback ke Google Sheets API service account jika webhook URL dikosongkan
  await appendRow(config.googleSheets.advocacySheet, [
    input.ticket,
    input.category,
    'Baru',
    isoDate,
  ]);
}

/**
 * Kirim pendaftaran MAPABA ke Google Sheets via Google Apps Script Webhook (real-time).
 * Jika webhook tidak dikonfigurasi, jatuh kembali ke Google Sheets API via service account.
 */
export async function sendMapabaToSheets(input: MapabaRegistrationPayload): Promise<void> {
  const webhookUrl = config.googleSheets.mapabaWebhookUrl;
  const dateObj = typeof input.createdAt === 'string' ? new Date(input.createdAt) : input.createdAt;
  const isoDate = dateObj.toISOString();
  const formattedDate = dateObj.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  if (webhookUrl) {
    const payload = {
      nomorRegistrasi: input.registrationNumber,
      registrationNumber: input.registrationNumber,
      namaLengkap: input.fullName,
      fullName: input.fullName,
      nim: input.nim,
      angkatan: input.generation ?? '',
      generation: input.generation ?? '',
      universitas: input.university,
      university: input.university,
      fakultas: input.faculty ?? 'Sains dan Teknologi',
      faculty: input.faculty ?? 'Sains dan Teknologi',
      prodi: input.studyProgram,
      studyProgram: input.studyProgram,
      whatsapp: input.whatsapp,
      email: input.email,
      jenisKelamin: input.gender ?? '',
      gender: input.gender ?? '',
      asalDaerah: input.originRegion ?? '',
      originRegion: input.originRegion ?? '',
      motivasi: input.motivation ?? '',
      sumberInformasi: input.source ?? '',
      riwayatOrganisasi: input.organizationHistory ?? '',
      pasFotoUrl: input.photoUrl ?? '',
      ktmUrl: input.ktmUrl ?? '',
      waktu: isoDate,
      createdAt: isoDate,
      tanggal: formattedDate,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`MAPABA Webhook HTTP error ${response.status}`);
    }
    return;
  }

  // Fallback ke Google Sheets API service account jika webhook URL dikosongkan
  await appendRow(config.googleSheets.mapabaSheet, [
    input.registrationNumber,
    input.fullName,
    input.nim,
    input.university,
    input.studyProgram,
    input.whatsapp,
    input.email,
    isoDate,
  ]);
}
