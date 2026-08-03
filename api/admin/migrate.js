// ترحيل إداري: ينشئ المخطط ويعبّئ بيانات العينة (يعمل على بيئة Vercel حيث تتوفر أسرار القاعدة)
// POST /api/admin/migrate  مع ترويسة  x-migrate-key: <MIGRATE_KEY>
// reset=1 في الجسم يعيد بناء كل الجداول من الصفر
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from '../_lib/db.js';
import { handler, send, readBody, httpError } from '../_lib/http.js';
import { PRODUCTS } from '../../js/data/products.js';
import { createInitialState } from '../../js/data/seed.js';

const SAMPLE_CR = '4030-118842';

export default handler(async (req, res) => {
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed');
  const key = String(req.headers['x-migrate-key'] || '').trim();
  const expected = String(process.env.MIGRATE_KEY || '').trim();
  if (!expected || key !== expected) throw httpError(403, 'مفتاح الترحيل غير صحيح');

  const body = await readBody(req);

  const schema = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf8');

  if (body.reset) {
    for (const t of ['sessions', 'seqs', 'notifs', 'saved_lists', 'branches', 'org_users', 'clients', 'frs', 'prod_reqs', 'tickets', 'invoices', 'wallet_tx', 'wallet', 'orders', 'products']) {
      await sql.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }
  }

  for (const stmt of schema.split(';').map((x) => x.trim()).filter(Boolean)) {
    await sql.query(stmt);
  }

  const [{ count }] = await sql`SELECT count(*)::int AS count FROM products`;
  if (count > 0) return send(res, 200, { ok: true, seeded: false, note: `البيانات موجودة (${count} منتج)` });

  const st = createInitialState();

  for (const p of PRODUCTS) {
    await sql`INSERT INTO products (id, name, unit, cat, price, h, img, is_out)
              VALUES (${p.id}, ${p.name}, ${p.unit}, ${p.cat}, ${p.price}, ${p.h}, ${p.img}, ${!!p.out})`;
  }
  for (const o of st.orders) {
    await sql`INSERT INTO orders (id, by_user, branch, date_label, st, items, stamps, reason, rej_at)
              VALUES (${o.id}, ${o.by}, ${o.branch}, ${o.date}, ${o.st}, ${JSON.stringify(o.items)},
                      ${JSON.stringify(o.stamps)}, ${o.reason || null}, ${o.rejAt ?? null})`;
  }
  await sql`INSERT INTO wallet (org_cr, bal, cr_limit, used) VALUES (${SAMPLE_CR}, ${st.wallet.bal}, ${st.wallet.limit}, ${st.wallet.used})`;
  for (const h of [...st.wallet.hist].reverse()) {
    await sql`INSERT INTO wallet_tx (org_cr, t, d, amt, kind) VALUES (${SAMPLE_CR}, ${h.t}, ${h.d}, ${h.amt}, 'tx')`;
  }
  for (const h of [...st.wallet.settle].reverse()) {
    await sql`INSERT INTO wallet_tx (org_cr, t, d, amt, kind) VALUES (${SAMPLE_CR}, ${h.t}, ${h.d}, ${h.amt}, 'settle')`;
  }
  for (const v of st.invoices) {
    await sql`INSERT INTO invoices (id, ref, due, amt, rem, st) VALUES (${v.id}, ${v.ref}, ${v.due}, ${v.amt}, ${v.rem}, ${v.st})`;
  }
  for (const t of st.tickets) {
    await sql`INSERT INTO tickets (id, ord, customer, descr, qty, val, st, cn, date_label)
              VALUES (${t.id}, ${t.ord}, ${t.customer}, ${t.desc}, ${t.qty}, ${t.val}, ${t.st}, ${t.cn || null}, ${t.date})`;
  }
  for (const r of st.prodReqs) {
    await sql`INSERT INTO prod_reqs (id, name, unit, by_org, by_user, note, date_label, st)
              VALUES (${r.id}, ${r.name}, ${r.unit || ''}, ${r.by}, ${r.user || ''}, ${r.note}, ${r.date}, ${r.st})`;
  }
  for (const f of st.frs) {
    await sql`INSERT INTO frs (id, name, city, cr, orders, spend, pay, st, bal, active, parent, super, region)
              VALUES (${f.id}, ${f.name}, ${f.city}, ${f.cr}, ${f.orders}, ${f.spend}, ${f.pay}, ${f.st},
                      ${f.bal}, ${f.active}, ${f.parent ?? null}, ${!!f.super}, ${f.region ?? null})`;
  }
  for (const c of st.clients) {
    await sql`INSERT INTO clients (id, name, cr, city, orders, spend, st, bal, cr_limit, used, wst, branches, staff)
              VALUES (${c.id}, ${c.name}, ${c.cr}, ${c.city}, ${c.orders}, ${c.spend}, ${c.st}, ${c.bal},
                      ${c.limit}, ${c.used}, ${c.wst}, ${JSON.stringify(c.branches)}, ${JSON.stringify(c.staff)})`;
  }
  for (const u of st.users) {
    await sql`INSERT INTO org_users (id, name, email, role, branch, st)
              VALUES (${u.id}, ${u.name}, ${u.email || null}, ${u.role}, ${u.branch}, ${u.st})`;
  }
  for (const b of st.branches) {
    await sql`INSERT INTO branches (name, city, st, loc) VALUES (${b.name}, ${b.city}, 'ok', ${b.loc ? JSON.stringify(b.loc) : null})`;
  }
  for (const l of st.lists) {
    await sql`INSERT INTO saved_lists (name, items) VALUES (${l.name}, ${JSON.stringify(l.items)})`;
  }
  await sql`INSERT INTO seqs (key, val) VALUES ('order', ${st.orderSeq}), ('ticket', ${st.ticketSeq}), ('cn', ${st.cnSeq}), ('req', ${st.reqSeq})`;

  send(res, 200, { ok: true, seeded: true });
});
