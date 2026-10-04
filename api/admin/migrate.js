// ترحيل إداري: ينشئ المخطط ويعبّئ بيانات العينة ويرقّي البيانات (يعمل على بيئة Vercel حيث تتوفر أسرار القاعدة)
// POST /api/admin/migrate  مع ترويسة  x-migrate-key: <MIGRATE_KEY>
// reset=1 في الجسم يعيد بناء كل الجداول من الصفر
// رمز البداية لحسابات الدخول من متغير البيئة SEED_PIN (لا يُقبل من الطلب ولا يُكتب في المستودع)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { handler, send, readBody, httpError } from '../_lib/http.js';
import { runMigration } from '../_lib/migrate.js';

export default handler(async (req, res) => {
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed');
  const key = Buffer.from(String(req.headers['x-migrate-key'] || '').trim());
  const expected = Buffer.from(String(process.env.MIGRATE_KEY || '').trim());
  if (!expected.length || key.length !== expected.length || !timingSafeEqual(key, expected)) throw httpError(403, 'مفتاح الترحيل غير صحيح');

  const body = await readBody(req);
  const schema = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf8');
  const out = await runMigration({ schema, reset: !!body.reset });
  send(res, 200, { ...out, note: out.seeded ? 'قاعدة جديدة: زُرعت بيانات العينة' : 'البيانات موجودة — طُبّقت الإضافات والترقية فقط' });
});
