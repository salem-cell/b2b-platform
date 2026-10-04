// ============================================================
// ترحيل محلي (بديل): يتطلب DATABASE_URL في .env.local (أو LOCAL_PG_URL لقاعدة Postgres محلية)
// ملاحظة: أسرار قاعدة Vercel «حساسة» ولا تُسحب محليًا —
// الطريقة المعتمدة هي نقطة /api/admin/migrate على الخادم.
// رمز البداية لحسابات الدخول: SEED_PIN في البيئة (4 أرقام) — و PIN_PEPPER يجب أن يطابق ما على الخادم.
//   node scripts/migrate.js            إضافات المخطط + ترقية البيانات (لا يحذف شيئًا)
//   node scripts/migrate.js --reset    يعيد بناء كل الجداول من الصفر (قاعدة تجارب فقط)
// ============================================================
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';

config({ path: '.env.local' });

const url = process.env.LOCAL_PG_URL || process.env.DATABASE_URL;
if (!url || !url.startsWith('postgres')) {
  console.error('DATABASE_URL غير متاح محليًا (أسرار Vercel حساسة) — استخدم POST /api/admin/migrate على النشرة الحية.');
  process.exit(1);
}

// الاستيراد بعد تحميل البيئة: db.js يقرأ عنوان القاعدة عند تحميله
const { runMigration } = await import('../api/_lib/migrate.js');
const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const out = await runMigration({ schema, reset: process.argv.includes('--reset') });
console.log(out.seeded ? 'schema ready + sample data seeded' : 'schema ready (data already present)');
console.log(`login accounts prepared: ${out.accounts}`);
for (const n of out.notes) console.log(`note: ${n}`);
process.exit(0);
