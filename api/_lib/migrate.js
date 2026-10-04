// ============================================================
// الترحيل: المخطط (إضافات فقط) + بيانات العينة لقاعدة فارغة + ترقية البيانات (upgrade.js).
// مصدر واحد تستعمله نقطة /api/admin/migrate والسكربت المحلي scripts/migrate.js.
// ============================================================
import { sql, SAMPLE_CR } from './db.js';
import { upgradeData } from './upgrade.js';
import { PRODUCTS } from '../../js/data/products.js';
import { createInitialState } from '../../js/data/seed.js';

const ALL_TABLES = [
  'sessions', 'login_throttle', 'seqs', 'notifs', 'saved_lists', 'branches', 'org_users', 'roles_matrix', 'new_clients',
  'client_products', 'col_files', 'fin_reqs', 'topup_reqs', 'clients', 'frs', 'prod_reqs', 'tickets', 'invoices',
  'wallet_tx', 'wallet', 'orders', 'products',
  'integration_outbox', 'integration_inbox', 'integration_subjects', 'integration_hashes', 'ops_stock',
];

/**
 * @param {{schema: string, reset?: boolean, seedPin?: string, adminPhone?: string}} opts
 * @returns {Promise<{ok: true, seeded: boolean, accounts: number, notes: string[]}>}
 */
export async function runMigration({ schema, reset = false, seedPin, adminPhone }) {
  if (reset) {
    for (const t of ALL_TABLES) await sql(`DROP TABLE IF EXISTS ${t} CASCADE`);
  }
  for (const stmt of schema.split(';').map((x) => x.trim()).filter(Boolean)) {
    await sql(stmt);
  }

  const st = createInitialState();

  // بذور v5 — تُزرع حتى على قاعدة قائمة، كلٌّ فقط إن كان جدوله فارغًا
  const [{ count: rmCount }] = await sql`SELECT count(*)::int AS count FROM roles_matrix`;
  if (!rmCount) {
    for (const m of st.rolesMatrix) {
      await sql`INSERT INTO roles_matrix (ver, note, meta, cells, cur, draft)
                VALUES (${m.ver}, ${m.note}, ${m.meta}, ${JSON.stringify(m.cells)}, ${m.cur}, ${m.draft})`;
    }
  }
  const [{ count: ncCount }] = await sql`SELECT count(*)::int AS count FROM new_clients`;
  if (!ncCount) {
    for (const r of st.newClients) {
      await sql`INSERT INTO new_clients (id, name, activity, model, city, cities, branches_n, cr, vat, docs,
                                         mgr_name, mgr_role, mgr_contact, cats, monthly, payment, st, date_label)
                VALUES (${r.id}, ${r.name}, ${r.activity}, ${r.model}, ${r.city}, ${r.cities}, ${r.branchesN},
                        ${r.cr}, ${r.vat}, ${JSON.stringify(r.docs)}, ${r.mgrName}, ${r.mgrRole}, ${r.mgrContact},
                        ${JSON.stringify(r.cats)}, ${r.monthly}, ${r.payment}, ${r.st}, ${r.date})`;
    }
    await sql`UPDATE seqs SET val = ${st.ncSeq} WHERE key = 'nc'`;
  }
  const [{ count: cpCount }] = await sql`SELECT count(*)::int AS count FROM client_products`;
  if (!cpCount) {
    for (const cp of st.clientProds) {
      await sql`INSERT INTO client_products (client_id, pid, price) VALUES (${cp.clientId}, ${cp.pid}, ${cp.price})
                ON CONFLICT (client_id, pid) DO NOTHING`;
    }
  }
  const [{ count: colCount }] = await sql`SELECT count(*)::int AS count FROM col_files`;
  if (!colCount) {
    for (const f of st.colFiles) {
      await sql`INSERT INTO col_files (id, client_id, inv, ref, amt, orig_amt, created, due, late_days, stage, promise, due_hist, log, st)
                VALUES (${f.id}, ${f.clientId}, ${f.inv}, ${f.ref}, ${f.amt}, ${f.origAmt}, ${f.created}, ${f.due},
                        ${f.lateDays}, ${f.stage}, ${f.promise ? JSON.stringify(f.promise) : null},
                        ${JSON.stringify(f.dueHist)}, ${JSON.stringify(f.log)}, ${f.st})`;
    }
    for (const r of st.finReqs) {
      await sql`INSERT INTO fin_reqs (id, client_id, kind, amt, months, to_date, note, st, file_id, date_label)
                VALUES (${r.id}, ${r.clientId}, ${r.kind}, ${r.amt ?? null}, ${r.months ?? null}, ${r.toDate ?? null},
                        ${r.note || ''}, ${r.st}, ${r.fileId ?? null}, ${r.date})`;
    }
  }

  const [{ count }] = await sql`SELECT count(*)::int AS count FROM products`;
  const seeded = !count;
  if (seeded) await seedSample(st);

  // ترقية البيانات: تعمل على القاعدة الجديدة والقائمة معًا
  const up = await upgradeData({ seedPin, adminPhone });
  return { ok: true, seeded, accounts: up.accounts, notes: up.notes, summary: up.summary };
}

/** بيانات العينة لقاعدة فارغة (بصيغتها الأصلية — upgrade.js يربطها بمنشآتها بعد ذلك) */
async function seedSample(st) {
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
}
