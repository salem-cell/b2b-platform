// اتصال Neon Postgres (سيرفرلس عبر HTTP)
import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL);

/** قيمة تسلسل جديدة (order/ticket/cn/req) */
export async function nextSeq(key) {
  const [row] = await sql`UPDATE seqs SET val = val + 1 WHERE key = ${key} RETURNING val - 1 AS val`;
  return Number(row.val);
}

/** تسمية الوقت الحالي HH:MM (بتوقيت الرياض) */
export function nowLabel() {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Riyadh' }).format(new Date());
}

/** بث إشعار لأدوار محددة */
export async function notify(roles, c, body) {
  for (const role of roles) {
    await sql`INSERT INTO notifs (role, c, body, t) VALUES (${role}, ${c}, ${body}, 'الآن')`;
  }
}

export const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmt0 = (n) => Math.round(Number(n)).toLocaleString('en-US');
export const VAT = 0.15;
export const SAMPLE_CR = '4030-118842';
