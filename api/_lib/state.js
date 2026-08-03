// بناء لقطة الحالة الكاملة التي تتغذى عليها الواجهة
import { sql, SAMPLE_CR } from './db.js';

export async function snapshot() {
  const [products, orders, walletRows, txs, invoices, tickets, prodReqs, frs, clients, users, branches, lists, notifs] =
    await Promise.all([
      sql`SELECT id, name, unit, cat, price::float, h, img, is_out FROM products ORDER BY id`,
      sql`SELECT * FROM orders ORDER BY created_at DESC`,
      sql`SELECT * FROM wallet WHERE org_cr = ${SAMPLE_CR}`,
      sql`SELECT * FROM wallet_tx WHERE org_cr = ${SAMPLE_CR} ORDER BY id DESC`,
      sql`SELECT id, ref, due, amt::float, rem::float, st FROM invoices ORDER BY created_at DESC, id DESC`,
      sql`SELECT * FROM tickets ORDER BY created_at DESC`,
      sql`SELECT * FROM prod_reqs ORDER BY id DESC`,
      sql`SELECT id, name, city, cr, orders, spend::float, pay, st, bal::float, active, parent, super, region FROM frs ORDER BY id`,
      sql`SELECT id, name, cr, city, orders, spend::float, st, bal::float, cr_limit::float, used::float, wst, branches, staff FROM clients ORDER BY id`,
      sql`SELECT * FROM org_users ORDER BY id`,
      sql`SELECT * FROM branches`,
      sql`SELECT id, name, items FROM saved_lists ORDER BY id`,
      sql`SELECT role, c, body, t FROM notifs ORDER BY id DESC LIMIT 200`,
    ]);

  const w = walletRows[0] || { bal: 0, cr_limit: 0, used: 0 };
  const extraNotifs = {};
  for (const n of notifs) {
    (extraNotifs[n.role] = extraNotifs[n.role] || []).push({ c: n.c, text: n.body, t: n.t });
  }

  return {
    products: products.map((p) => ({ id: p.id, name: p.name, unit: p.unit, cat: p.cat, price: p.price, h: p.h, img: p.img, out: p.is_out })),
    orders: orders.map((o) => ({
      id: o.id, by: o.by_user, branch: o.branch, date: o.date_label, st: o.st,
      items: o.items, stamps: o.stamps,
      ...(o.reason ? { reason: o.reason } : {}),
      ...(o.hold_reason ? { holdReason: o.hold_reason } : {}),
      ...(o.rej_at != null ? { rejAt: o.rej_at } : {}),
      ...(o.ticket_id ? { ticket: o.ticket_id } : {}),
    })),
    wallet: {
      bal: Number(w.bal), limit: Number(w.cr_limit), used: Number(w.used),
      hist: txs.filter((t) => t.kind === 'tx').map((t) => ({ t: t.t, d: t.d, amt: Number(t.amt) })),
      settle: txs.filter((t) => t.kind === 'settle').map((t) => ({ t: t.t, d: t.d, amt: Number(t.amt) })),
    },
    invoices,
    tickets: tickets.map((t) => ({
      id: t.id, ord: t.ord, customer: t.customer, desc: t.descr, qty: t.qty,
      val: Number(t.val), st: t.st, date: t.date_label,
      ...(t.cn ? { cn: t.cn } : {}), ...(t.hold_reason ? { holdReason: t.hold_reason } : {}),
    })),
    prodReqs: prodReqs.map((r) => ({ id: r.id, name: r.name, unit: r.unit, by: r.by_org, user: r.by_user, note: r.note, date: r.date_label, st: r.st })),
    frs: frs.map((f) => ({ ...f, parent: f.parent == null ? undefined : Number(f.parent), id: Number(f.id) })),
    clients: clients.map((c) => ({ id: Number(c.id), name: c.name, cr: c.cr, city: c.city, orders: c.orders, spend: c.spend, st: c.st, bal: c.bal, limit: c.cr_limit, used: c.used, wst: c.wst, branches: c.branches, staff: c.staff })),
    users: users.map((u) => ({ id: Number(u.id), name: u.name, email: u.email || undefined, role: u.role, branch: u.branch, st: u.st })),
    branches: branches.map((b) => ({ name: b.name, city: b.city, st: b.st, loc: b.loc || undefined })),
    lists: lists.map((l) => ({ id: Number(l.id), name: l.name, items: l.items })),
    extraNotifs,
  };
}
