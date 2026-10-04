// ============================================================
// ترقية البيانات بعد تطبيق المخطط — تُشغَّل مع كل ترحيل، وكل خطوة لا تكرر نفسها (idempotent):
//  1) ربط السجلات القديمة بمنشآتها (كانت كلها لمنشأة العينة أو بلا منشأة)
//  2) الفروع والحسابات من حقول JSON داخل سجل العميل إلى جداولها
//  3) حسابات الدخول: جوال + رمز سري. رمز البداية من البيئة (SEED_PIN) — لا رموز في المستودع.
// ============================================================
import { sql, SAMPLE_CR } from './db.js';
import { hashPin, PIN_RE, normPhone, validPhone } from './auth.js';

const MANAGER_ROLE = { 'مستقل': 'owner', 'مانح': 'fr', 'ممنوح بيسك': 'frz', 'ممنوح سوبر': 'frzs' };
const GRANTER_NAME = 'دوار السعادة';

/**
 * حسابات العينة: شخصية لكل دور (الرمز من SEED_PIN). الجوال = أساس من 9 أرقام + خانة الحساب (0 للإدارة، 1…7 للأدوار).
 * الأساس الافتراضي 050000000 معلن في هذا المستودع العام، فيصلح للتجارب المحلية فقط —
 * على البيئة الحية يُضبط SEED_PHONE_BASE بقيمة غير معلنة (05 + 7 أرقام) كي لا تُعرف جوالات الحسابات.
 */
const DEFAULT_PHONE_BASE = '050000000';
const DEMO_ACCOUNTS = [
  { n: 1, role: 'worker', name: 'سالم العتيبي',      client: 'مطاعم البلدة', branch: 'فرع العليا' },
  { n: 2, role: 'ops',    name: 'أحمد الحربي',       client: 'مطاعم البلدة', branch: 'فرع العليا' },
  { n: 3, role: 'owner',  name: 'م. ناصر القحطاني',  client: 'مطاعم البلدة', branch: 'الإدارة' },
  { n: 4, role: 'fin',    name: 'أ. سارة الشمري',    client: 'مطاعم البلدة', branch: 'الإدارة' },
  { n: 5, role: 'frz',    name: 'فهد المطيري',       client: 'مطاعم الريف الشمالي', branch: 'الإدارة' },
  { n: 6, role: 'frzs',   name: 'م. فيصل الدوسري',   client: 'الشرقية للفرنشايز', branch: 'الإدارة' },
  { n: 7, role: 'fr',     name: 'مدير دوار السعادة', client: GRANTER_NAME, branch: 'الإدارة' },
];

async function nextUserId() {
  const [{ id }] = await sql`SELECT COALESCE(MAX(id), 0) + 1 AS id FROM org_users`;
  return Math.max(Number(id), Date.now());
}

export async function upgradeData({ seedPin = process.env.SEED_PIN, adminPhone = process.env.ADMIN_PHONE, phoneBase = process.env.SEED_PHONE_BASE } = {}) {
  const out = { accounts: 0, notes: [], summary: null };
  const [sample] = await sql`SELECT id FROM clients WHERE cr = ${SAMPLE_CR} ORDER BY id LIMIT 1`;
  const sampleId = sample ? Number(sample.id) : null;

  // ── 1) شبكة الفرنشايز: عميل المانح + ربط كل ممنوح بعميله ومانحه ──
  let [granter] = await sql`SELECT id FROM clients WHERE type = 'مانح' OR name LIKE ${`%${GRANTER_NAME}%`} ORDER BY id LIMIT 1`;
  const [{ count: frsCount }] = await sql`SELECT count(*)::int AS count FROM frs`;
  if (!granter && frsCount > 0 && sampleId != null) {
    const id = Date.now();
    await sql`INSERT INTO clients (id, name, cr, city, st, bal, cr_limit, used, wst, branches, staff, type)
              VALUES (${id}, ${GRANTER_NAME}, 'CR-GRANTER', 'الرياض', 'ok', 0, 100000, 0, 'ok', '[]', '[]', 'مانح')`;
    granter = { id };
  }
  await sql`UPDATE frs f SET client_id = c.id FROM clients c WHERE f.client_id IS NULL AND c.cr = f.cr`;
  if (granter) await sql`UPDATE frs SET granter_id = ${Number(granter.id)} WHERE granter_id IS NULL`;
  // نوع العميل للسجلات الأقدم من عمود النوع
  await sql`UPDATE clients c SET type = CASE WHEN f.super THEN 'ممنوح سوبر' ELSE 'ممنوح بيسك' END FROM frs f WHERE c.type IS NULL AND f.client_id = c.id`;
  await sql`UPDATE clients SET type = 'مانح' WHERE type IS NULL AND name LIKE ${`%${GRANTER_NAME}%`}`;
  await sql`UPDATE clients SET type = 'مستقل' WHERE type IS NULL`;

  // ── 2) السجلات القديمة → منشآتها ──
  if (sampleId != null) {
    for (const d of DEMO_ACCOUNTS.filter((a) => ['frz', 'frzs'].includes(a.role))) {
      const [c] = await sql`SELECT id FROM clients WHERE name = ${d.client}`;
      if (c) await sql`UPDATE orders SET client_id = ${Number(c.id)} WHERE client_id IS NULL AND by_user = ${d.name}`;
    }
    // طلبات واتساب من أرقام غير مسجّلة تبقى بلا منشأة (يعالجها فريق B2B)
    await sql`UPDATE orders SET client_id = ${sampleId} WHERE client_id IS NULL AND branch <> 'واتس اب'`;
    await sql`UPDATE tickets t SET client_id = o.client_id FROM orders o WHERE t.client_id IS NULL AND o.id = t.ord`;
    await sql`UPDATE tickets SET client_id = ${sampleId} WHERE client_id IS NULL`;
    await sql`UPDATE invoices SET client_id = ${sampleId} WHERE client_id IS NULL`;
    await sql`UPDATE topup_reqs SET client_id = ${sampleId} WHERE client_id IS NULL`;
    await sql`UPDATE saved_lists SET client_id = ${sampleId} WHERE client_id IS NULL`;
    if (granter) await sql`UPDATE prod_reqs SET client_id = ${Number(granter.id)} WHERE client_id IS NULL AND by_org LIKE ${`%${GRANTER_NAME}%`}`;
    await sql`UPDATE prod_reqs SET client_id = ${sampleId} WHERE client_id IS NULL`;
    await sql`UPDATE org_users SET client_id = ${sampleId} WHERE client_id IS NULL AND role <> 'b2b'`;
    await sql`UPDATE wallet SET client_id = ${sampleId} WHERE client_id IS NULL AND org_cr = ${SAMPLE_CR}`;
    await sql`UPDATE wallet_tx SET client_id = ${sampleId} WHERE client_id IS NULL AND org_cr = ${SAMPLE_CR}`;
  }

  // ── 3) الفروع والحسابات من JSON سجل العميل إلى جداولها ──
  const clients = await sql`SELECT id, name, city, type, branches, staff FROM clients ORDER BY id`;
  for (const c of clients) {
    const cid = Number(c.id);
    for (const b of Array.isArray(c.branches) ? c.branches : []) {
      if (!b?.name) continue;
      await sql`INSERT INTO branches (client_id, name, city, st, loc) VALUES (${cid}, ${String(b.name)}, ${b.city || c.city || '—'}, 'ok', ${b.loc ? JSON.stringify(b.loc) : null})
                ON CONFLICT (client_id, name) DO NOTHING`;
    }
    for (const s of Array.isArray(c.staff) ? c.staff : []) {
      if (!s?.name) continue;
      const [have] = await sql`SELECT 1 AS x FROM org_users WHERE client_id = ${cid} AND name = ${String(s.name)}`;
      if (have) continue;
      const role = s.role === 'owner' ? (MANAGER_ROLE[c.type] || 'owner') : (['worker', 'ops', 'fin'].includes(s.role) ? s.role : 'worker');
      await sql`INSERT INTO org_users (id, name, role, branch, st, client_id) VALUES (${await nextUserId()}, ${String(s.name)}, ${role}, ${s.branch || 'الإدارة'}, ${s.st === 'off' ? 'off' : 'ok'}, ${cid})`;
    }
    if ((Array.isArray(c.branches) && c.branches.length) || (Array.isArray(c.staff) && c.staff.length)) {
      // المصدر الآن الجداول؛ الأصل يُحفظ في legacy للرجوع إليه
      await sql`UPDATE clients SET legacy = jsonb_build_object('branches', branches, 'staff', staff), branches = '[]', staff = '[]' WHERE id = ${cid}`;
    }
  }

  out.summary = await summary();

  // ── 4) حسابات الدخول ──
  if (!seedPin) {
    out.notes.push('SEED_PIN غير مضبوط — لم يُعيَّن رمز لأي حساب جديد (الحسابات بلا رمز لا تستطيع الدخول)');
    return out;
  }
  if (!PIN_RE.test(String(seedPin))) { out.notes.push('SEED_PIN يجب أن يكون 4 أرقام — تُجوهل'); return out; }

  const base = /^05[0-9]{7}$/.test(String(phoneBase || '')) ? String(phoneBase) : DEFAULT_PHONE_BASE;
  if (phoneBase && base !== phoneBase) out.notes.push('SEED_PHONE_BASE يجب أن يكون 05 متبوعًا بـ 7 أرقام — استُعمل الأساس الافتراضي');

  // SEED_PIN_TEMPORARY=true (البيئة الحية): رمز البداية مؤقت — كل حساب يعيّن رمزه الخاص عند أول دخول
  const temp = process.env.SEED_PIN_TEMPORARY === 'true';

  // حساب إدارة B2B (دخوله يتطلب أيضًا ADMIN_KEY)
  const aPhone = normPhone(adminPhone || `${base}0`);
  if (validPhone(aPhone)) {
    const [admin] = await sql`SELECT id FROM org_users WHERE role = 'b2b' ORDER BY id LIMIT 1`;
    if (!admin) {
      await sql`INSERT INTO org_users (id, name, role, branch, st, client_id, phone, pin_hash, must_change_pin)
                VALUES (${await nextUserId()}, 'فريق العمليات B2B', 'b2b', 'الإدارة', 'ok', NULL, ${aPhone}, ${hashPin(seedPin)}, ${temp})`;
      out.accounts++;
    }
  }
  if (sampleId == null) return out; // قاعدة بلا بيانات العينة: لا شخصيات تجريبية
  // تُزرع حسابات العينة مرة واحدة فقط: بعد وجود أي حساب دخول لمنشأة تُدار الحسابات من الواجهة
  const [{ count: haveLogins }] = await sql`SELECT count(*)::int AS count FROM org_users WHERE client_id IS NOT NULL AND phone IS NOT NULL`;
  if (haveLogins > 0) return out;

  for (const d of DEMO_ACCOUNTS) {
    const [c] = await sql`SELECT id FROM clients WHERE name = ${d.client}`;
    if (!c) continue;
    const cid = Number(c.id);
    const phone = `${base}${d.n}`;
    // الشخصية الموجودة باسمها، وإلا مدير المنشأة بلا جوال، وإلا حساب جديد
    let [u] = await sql`SELECT id FROM org_users WHERE client_id = ${cid} AND name = ${d.name} AND phone IS NULL`;
    if (!u && ['owner', 'fr', 'frz', 'frzs'].includes(d.role)) {
      [u] = await sql`SELECT id FROM org_users WHERE client_id = ${cid} AND role = ${d.role} AND phone IS NULL ORDER BY id LIMIT 1`;
    }
    if (u) {
      await sql`UPDATE org_users SET phone = ${phone}, pin_hash = ${hashPin(seedPin)}, must_change_pin = ${temp}, role = ${d.role}, st = 'ok' WHERE id = ${u.id}`;
    } else {
      await sql`INSERT INTO org_users (id, name, role, branch, st, client_id, phone, pin_hash, must_change_pin)
                VALUES (${await nextUserId()}, ${d.name}, ${d.role}, ${d.branch}, 'ok', ${cid}, ${phone}, ${hashPin(seedPin)}, ${temp})`;
    }
    out.accounts++;
  }
  out.summary = await summary();
  return out;
}

/** أعداد للتحقق بعد الترقية (لا بيانات) */
async function summary() {
  const [r] = await sql`SELECT
    (SELECT count(*)::int FROM clients) AS clients,
    (SELECT count(*)::int FROM orders) AS orders,
    (SELECT count(*)::int FROM orders WHERE client_id IS NULL) AS orders_without_client,
    (SELECT count(*)::int FROM org_users) AS accounts,
    (SELECT count(*)::int FROM org_users WHERE phone IS NOT NULL AND pin_hash IS NOT NULL) AS accounts_with_login,
    (SELECT count(*)::int FROM branches) AS branches,
    (SELECT count(*)::int FROM wallet WHERE client_id IS NOT NULL) AS client_wallets`;
  return r;
}
