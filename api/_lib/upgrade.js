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

/** حسابات العينة: شخصية لكل دور، بجوالات تجريبية ثابتة (الرمز من SEED_PIN) */
const DEMO_ACCOUNTS = [
  { phone: '0500000001', role: 'worker', name: 'سالم العتيبي',      client: 'مطاعم البلدة', branch: 'فرع العليا' },
  { phone: '0500000002', role: 'ops',    name: 'أحمد الحربي',       client: 'مطاعم البلدة', branch: 'فرع العليا' },
  { phone: '0500000003', role: 'owner',  name: 'م. ناصر القحطاني',  client: 'مطاعم البلدة', branch: 'الإدارة' },
  { phone: '0500000004', role: 'fin',    name: 'أ. سارة الشمري',    client: 'مطاعم البلدة', branch: 'الإدارة' },
  { phone: '0500000005', role: 'frz',    name: 'فهد المطيري',       client: 'مطاعم الريف الشمالي', branch: 'الإدارة' },
  { phone: '0500000006', role: 'frzs',   name: 'م. فيصل الدوسري',   client: 'الشرقية للفرنشايز', branch: 'الإدارة' },
  { phone: '0500000007', role: 'fr',     name: 'مدير دوار السعادة', client: GRANTER_NAME, branch: 'الإدارة' },
];

async function nextUserId() {
  const [{ id }] = await sql`SELECT COALESCE(MAX(id), 0) + 1 AS id FROM org_users`;
  return Math.max(Number(id), Date.now());
}

export async function upgradeData({ seedPin = process.env.SEED_PIN, adminPhone = process.env.ADMIN_PHONE } = {}) {
  const out = { accounts: 0, notes: [] };
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
      await sql`UPDATE clients SET branches = '[]', staff = '[]' WHERE id = ${cid}`; // المصدر الآن الجداول
    }
  }

  // ── 4) حسابات الدخول ──
  if (!seedPin) {
    out.notes.push('SEED_PIN غير مضبوط — لم يُعيَّن رمز لأي حساب جديد (الحسابات بلا رمز لا تستطيع الدخول)');
    return out;
  }
  if (!PIN_RE.test(String(seedPin))) { out.notes.push('SEED_PIN يجب أن يكون 4 أرقام — تُجوهل'); return out; }

  // حساب إدارة B2B (دخوله يتطلب أيضًا ADMIN_KEY)
  const aPhone = normPhone(adminPhone || '0500000000');
  if (validPhone(aPhone)) {
    const [admin] = await sql`SELECT id FROM org_users WHERE role = 'b2b' ORDER BY id LIMIT 1`;
    if (!admin) {
      await sql`INSERT INTO org_users (id, name, role, branch, st, client_id, phone, pin_hash, must_change_pin)
                VALUES (${await nextUserId()}, 'فريق العمليات B2B', 'b2b', 'الإدارة', 'ok', NULL, ${aPhone}, ${hashPin(seedPin)}, false)`;
      out.accounts++;
    }
  }
  if (sampleId == null) return out; // قاعدة بلا بيانات العينة: لا شخصيات تجريبية

  for (const d of DEMO_ACCOUNTS) {
    const [c] = await sql`SELECT id FROM clients WHERE name = ${d.client}`;
    if (!c) continue;
    const cid = Number(c.id);
    const [taken] = await sql`SELECT 1 AS x FROM org_users WHERE phone = ${d.phone}`;
    if (taken) continue; // سبق إعداده — لا يُمسّ رمزه
    // الشخصية الموجودة باسمها، وإلا مدير المنشأة بلا جوال، وإلا حساب جديد
    let [u] = await sql`SELECT id FROM org_users WHERE client_id = ${cid} AND name = ${d.name} AND phone IS NULL`;
    if (!u && ['owner', 'fr', 'frz', 'frzs'].includes(d.role)) {
      [u] = await sql`SELECT id FROM org_users WHERE client_id = ${cid} AND role = ${d.role} AND phone IS NULL ORDER BY id LIMIT 1`;
    }
    if (u) {
      await sql`UPDATE org_users SET phone = ${d.phone}, pin_hash = ${hashPin(seedPin)}, must_change_pin = false, role = ${d.role}, st = 'ok' WHERE id = ${u.id}`;
    } else {
      await sql`INSERT INTO org_users (id, name, role, branch, st, client_id, phone, pin_hash, must_change_pin)
                VALUES (${await nextUserId()}, ${d.name}, ${d.role}, ${d.branch}, 'ok', ${cid}, ${d.phone}, ${hashPin(seedPin)}, false)`;
    }
    out.accounts++;
  }
  return out;
}
