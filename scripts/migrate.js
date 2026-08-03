// ============================================================
// ترحيل محلي (بديل): يتطلب DATABASE_URL في .env.local
// ملاحظة: أسرار قاعدة Vercel «حساسة» ولا تُسحب محليًا —
// الطريقة المعتمدة هي نقطة /api/admin/migrate على الخادم.
// ============================================================
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { PRODUCTS } from '../js/data/products.js';
import { createInitialState } from '../js/data/seed.js';

config({ path: '.env.local' });

const url = process.env.DATABASE_URL;
if (!url || !url.startsWith('postgres')) {
  console.error('DATABASE_URL غير متاح محليًا (أسرار Vercel حساسة) — استخدم POST /api/admin/migrate على النشرة الحية.');
  process.exit(1);
}
const sql = neon(url);

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');

for (const stmt of schema.split(';').map((s) => s.trim()).filter(Boolean)) {
  await sql(stmt);
}
console.log('schema ready');

const [{ count }] = await sql`SELECT count(*)::int AS count FROM products`;
if (count > 0) {
  console.log(`already seeded (${count} products)`);
  process.exit(0);
}

const st = createInitialState();
const CR = '4030-118842';

for (const p of PRODUCTS) {
  await sql`INSERT INTO products (id, name, unit, cat, price, h, img, is_out)
            VALUES (${p.id}, ${p.name}, ${p.unit}, ${p.cat}, ${p.price}, ${p.h}, ${p.img}, ${!!p.out})`;
}
for (const o of st.orders) {
  await sql`INSERT INTO orders (id, by_user, branch, date_label, st, items, stamps, reason, rej_at)
            VALUES (${o.id}, ${o.by}, ${o.branch}, ${o.date}, ${o.st}, ${JSON.stringify(o.items)},
                    ${JSON.stringify(o.stamps)}, ${o.reason || null}, ${o.rejAt ?? null})`;
}
await sql`INSERT INTO wallet (org_cr, bal, cr_limit, used) VALUES (${CR}, ${st.wallet.bal}, ${st.wallet.limit}, ${st.wallet.used})`;
for (const h of [...st.wallet.hist].reverse()) {
  await sql`INSERT INTO wallet_tx (org_cr, t, d, amt, kind) VALUES (${CR}, ${h.t}, ${h.d}, ${h.amt}, 'tx')`;
}
for (const h of [...st.wallet.settle].reverse()) {
  await sql`INSERT INTO wallet_tx (org_cr, t, d, amt, kind) VALUES (${CR}, ${h.t}, ${h.d}, ${h.amt}, 'settle')`;
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

console.log('seed complete');
