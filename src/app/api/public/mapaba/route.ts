import { queryOne } from '@/server/db/pool';
import { fail, ok, withNoStore } from '@/server/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const event = await queryOne<{
      title: string;
      edition: string;
      dates_label: string;
      location_label: string;
      quota: number;
      contribution_label: string;
      opens_at: Date;
      closes_at: Date;
      time_zone: string;
      faculty: string;
    }>(
      `SELECT title, edition, dates_label, location_label, quota,
              contribution_label, opens_at, closes_at, time_zone, faculty
       FROM mapaba_event WHERE id = 1 AND published = true`,
    );
    if (!event) return Response.json({ error: { code: 'NOT_FOUND', message: 'Informasi MAPABA belum tersedia.' } }, { status: 404, headers: withNoStore() });
    const [agenda, faq, count] = await Promise.all([
      queryList('SELECT day_label AS day, title, items, tone FROM mapaba_agenda WHERE event_id = 1 ORDER BY sort_order'),
      queryList('SELECT question, answer FROM mapaba_faq WHERE event_id = 1 ORDER BY sort_order'),
      queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM mapaba_registration WHERE event_id = 1'),
    ]);
    return ok({
      event: {
        title: event.title,
        edition: event.edition,
        datesLabel: event.dates_label,
        locationLabel: event.location_label,
        quota: event.quota,
        contributionLabel: event.contribution_label,
        opensAt: event.opens_at,
        closesAt: event.closes_at,
        timeZone: event.time_zone,
        faculty: event.faculty,
        registrationCount: Number.parseInt(count?.count ?? '0', 10),
        remainingQuota: Math.max(0, event.quota - Number.parseInt(count?.count ?? '0', 10)),
        isOpen: Date.now() >= event.opens_at.getTime() && Date.now() <= event.closes_at.getTime() && Number.parseInt(count?.count ?? '0', 10) < event.quota,
      },
      agenda,
      faq,
    }, 200, withNoStore());
  } catch (error) {
    return fail(error, request);
  }
}

async function queryList(sql: string): Promise<Record<string, unknown>[]> {
  const { query } = await import('@/server/db/pool');
  const result = await query(sql);
  return result.rows as Record<string, unknown>[];
}
