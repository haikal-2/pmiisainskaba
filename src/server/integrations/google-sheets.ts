import 'server-only';

import { google } from 'googleapis';

import config from '@/server/config';
import { AppError } from '@/server/errors';

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

function appendRow(sheetName: string, values: readonly (string | number | boolean | null)[]) {
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
 * Tiket advokasi disalin ke Sheets setelah transaksi database commit.
 * Sheet hanya menerima data ringkas (nomor, kategori, status, waktu), bukan
 * kronologi, identitas, atau kontak sensitif.
 */
export async function appendAdvocacyTicket(input: {
  ticket: string;
  category: string;
  createdAt: Date;
}): Promise<void> {
  await appendRow(config.googleSheets.advocacySheet, [
    input.ticket,
    input.category,
    'Baru',
    input.createdAt.toISOString(),
  ]);
}

/** MAPABA: hanya nomor registrasi, nama, NIM, dan kontak yang diperlukan panitia. */
export async function appendMapabaRegistration(input: {
  registrationNumber: string;
  fullName: string;
  nim: string;
  university: string;
  studyProgram: string;
  whatsapp: string;
  email: string;
  createdAt: Date;
}): Promise<void> {
  await appendRow(config.googleSheets.mapabaSheet, [
    input.registrationNumber,
    input.fullName,
    input.nim,
    input.university,
    input.studyProgram,
    input.whatsapp,
    input.email,
    input.createdAt.toISOString(),
  ]);
}
