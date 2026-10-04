// بناء لقطة الحالة التي تتغذى عليها الواجهة — محصورة بنطاق الحساب (docs/SECURITY.md):
//   B2B: كل شيء.   حساب منشأة: بيانات منشأته فقط.   المانح / السوبر: منشأته + ملفات شبكته (بلا طلباتها).
// لا يصل للمتصفح ما لا يحق للحساب رؤيته — التصفية هنا لا في الواجهة.
import { sql } from './db.js';
import { enabled as integrationOn, opsStatusLabel } from './integration.js';

const num = (v) => (v == null ? undefined : Number(v));

export async function snapshot(ctx) {
  const all = ctx.role === 'b2b';
  const cid = ctx.clientId;

  // المنشآت المرئية: منشأتي + شبكتي (ممنوحو المانح، أو تابعو السوبر)
  let net = [];
  if (!all && ctx.role === 'fr') net = (await sql`SELECT client_id FROM frs WHERE granter_id = ${cid} AND client_id IS NOT NULL`).map((r) => Number(r.client_id));
  if (!all && ctx.role === 'frzs' && ctx.frsId != null) net = (await sql`SELECT client_id FROM frs WHERE parent = ${ctx.frsId} AND client_id IS NOT NULL`).map((r) => Number(r.client_id));
  const mine = cid == null ? [] : [cid];
  const ids = [...new Set([...mine, ...net])];

  const [products, orders, walletRows, txs, invoices, tickets, prodReqs, frs, clients, accounts, branchRows, lists, notifs, topupReqs, clientProds, newClients, rolesMatrix, finReqs, colFiles] =
    await Promise.all([
      sql`SELECT id, name, unit, cat, price::float, h, img, is_out FROM products ORDER BY id`,
      sql`SELECT * FROM orders WHERE (${all} OR client_id = ANY(${mine})) ORDER BY created_at DESC`,
      sql`SELECT * FROM wallet WHERE client_id = ANY(${mine})`,
      sql`SELECT * FROM wallet_tx WHERE (${all} OR client_id = ANY(${mine})) ORDER BY id DESC`,
      sql`SELECT id, ref, due, amt::float, rem::float, st, client_id FROM invoices WHERE (${all} OR client_id = ANY(${mine})) ORDER BY created_at DESC, id DESC`,
      sql`SELECT * FROM tickets WHERE (${all} OR client_id = ANY(${mine})) ORDER BY created_at DESC`,
      sql`SELECT * FROM prod_reqs WHERE (${all} OR client_id = ANY(${mine})) ORDER BY id DESC`,
      sql`SELECT id, name, city, cr, orders, spend::float, pay, st, bal::float, active, parent, super, region, client_id FROM frs
          WHERE (${all} OR client_id = ANY(${ids})) ORDER BY id`,
      sql`SELECT id, name, cr, city, orders, spend::float, st, bal::float, cr_limit::float, used::float, wst, type FROM clients
          WHERE (${all} OR id = ANY(${ids})) ORDER BY id`,
      sql`SELECT id, name, email, role, branch, st, client_id, phone, must_change_pin, (pin_hash IS NOT NULL) AS has_pin FROM org_users
          WHERE (${all} OR client_id = ANY(${ids})) ORDER BY id`,
      sql`SELECT client_id, name, city, st, loc FROM branches WHERE (${all} OR client_id = ANY(${ids})) ORDER BY name`,
      sql`SELECT id, name, items FROM saved_lists WHERE client_id IS NOT DISTINCT FROM ${cid} ORDER BY id`,
      sql`SELECT role, c, body, t FROM notifs WHERE role = ${ctx.role} AND (client_id IS NULL OR client_id = ANY(${mine})) ORDER BY id DESC LIMIT 60`,
      sql`SELECT id, org, by_user, amt::float, proof, date_label, client_id FROM topup_reqs WHERE (${all} OR client_id = ANY(${mine})) ORDER BY created_at DESC`,
      sql`SELECT client_id, pid, price::float FROM client_products WHERE (${all} OR client_id = ANY(${ids})) ORDER BY pid`,
      sql`SELECT * FROM new_clients WHERE ${all} ORDER BY created_at DESC`,
      sql`SELECT id, ver, note, meta, cells, cur, draft FROM roles_matrix ORDER BY id DESC`,
      sql`SELECT id, client_id, kind, amt::float, months, to_date, note, st, file_id, date_label FROM fin_reqs WHERE (${all} OR client_id = ANY(${mine})) ORDER BY created_at DESC`,
      sql`SELECT id, client_id, inv, ref, amt::float, orig_amt::float, created, due, late_days, stage, promise, due_hist, log, st FROM col_files
          WHERE (${all} OR client_id = ANY(${mine})) ORDER BY created_at DESC`,
    ]);

  // المتاح للبيع كما يحسبه نظام العمليات (نسخة عرض): الكمية الدقيقة لفريق B2B، وللعميل المستوى فقط
  let opsStock = null;
  if (integrationOn()) {
    const level = (atp) => (atp == null ? null : atp > 20 ? 'ok' : atp > 0 ? 'low' : 'out');
    opsStock = Object.fromEntries((await sql`SELECT pid, mapped, atp, incoming, incoming_eta, as_of FROM ops_stock`).map((r) => [r.pid,
      all ? { mapped: r.mapped, level: level(r.atp), atp: r.atp, incoming: r.incoming, eta: r.incoming_eta, asOf: r.as_of }
        : { mapped: r.mapped, level: level(r.atp), eta: r.atp > 0 ? null : r.incoming_eta }]));
  }

  const account = (u) => ({ id: Number(u.id), name: u.name, email: u.email || undefined, role: u.role, branch: u.branch, st: u.st,
    phone: u.phone || undefined, hasPin: !!u.has_pin, mustChangePin: !!u.must_change_pin, clientId: num(u.client_id) });
  const staffOf = (id) => accounts.filter((u) => Number(u.client_id) === id).map(account);
  const branchesOf = (id) => branchRows.filter((b) => Number(b.client_id) === id).map((b) => ({ name: b.name, city: b.city, st: b.st, loc: b.loc || undefined }));

  const myTx = all ? [] : txs;
  const w = walletRows[0] || (clients.find((c) => Number(c.id) === cid) ? { bal: clients.find((c) => Number(c.id) === cid).bal, cr_limit: clients.find((c) => Number(c.id) === cid).cr_limit, used: clients.find((c) => Number(c.id) === cid).used } : { bal: 0, cr_limit: 0, used: 0 });
  const txShape = (t) => ({ t: t.t, d: t.d, amt: Number(t.amt) });

  // B2B: كشف محفظة كل عميل لملفه (بدل عيّنات الواجهة)
  let walletsByClient;
  if (all) {
    walletsByClient = {};
    for (const t of txs) {
      if (t.client_id == null || t.kind !== 'tx') continue;
      (walletsByClient[Number(t.client_id)] = walletsByClient[Number(t.client_id)] || { hist: [] }).hist.push(txShape(t));
    }
  }

  const myClientRow = clients.find((c) => Number(c.id) === cid);

  return {
    me: { id: ctx.userId, name: ctx.name, role: ctx.role, clientId: cid, org: ctx.org, branch: ctx.branch, phone: ctx.phone, frsId: ctx.frsId ?? undefined,
      cr: myClientRow?.cr, suspended: !!ctx.clientSuspended },
    products: products.map((p) => ({ id: p.id, name: p.name, unit: p.unit, cat: p.cat, price: p.price, h: p.h, img: p.img, out: p.is_out })),
    orders: orders.map((o) => ({
      id: o.id, by: o.by_user, branch: o.branch, date: o.date_label, st: o.st,
      items: o.items, stamps: o.stamps, log: o.log || [], clientId: num(o.client_id),
      ...(o.backorder ? { backorder: true } : {}),
      ...(o.parent_ref ? { parentRef: o.parent_ref } : {}),
      ...(o.reason ? { reason: o.reason } : {}),
      ...(o.hold_reason ? { holdReason: o.hold_reason } : {}),
      ...(o.rej_at != null ? { rejAt: o.rej_at } : {}),
      ...(o.ticket_id ? { ticket: o.ticket_id } : {}),
      // التنفيذ في نظام العمليات (يظهر فقط للطلبات المرسلة له)
      ...(o.ops_sent_at ? { ops: { ref: o.ops_ref, status: o.ops_status, label: opsStatusLabel(o.ops_status), eta: o.ops_eta, events: o.ops_events || [] } } : {}),
    })),
    opsStock,
    wallet: {
      bal: Number(w.bal), limit: Number(w.cr_limit), used: Number(w.used),
      hist: myTx.filter((t) => t.kind === 'tx').map(txShape),
      settle: myTx.filter((t) => t.kind === 'settle').map(txShape),
    },
    ...(walletsByClient ? { walletsByClient } : {}),
    invoices: invoices.map((v) => ({ id: v.id, ref: v.ref, due: v.due, amt: v.amt, rem: v.rem, st: v.st, clientId: num(v.client_id) })),
    tickets: tickets.map((t) => ({
      id: t.id, ord: t.ord, customer: t.customer, desc: t.descr, qty: t.qty, clientId: num(t.client_id),
      val: Number(t.val), st: t.st, date: t.date_label,
      ...(t.cn ? { cn: t.cn } : {}), ...(t.hold_reason ? { holdReason: t.hold_reason } : {}),
    })),
    prodReqs: prodReqs.map((r) => ({
      id: r.id, name: r.name, unit: r.unit, by: r.by_org, user: r.by_user, note: r.note, date: r.date_label, st: r.st, clientId: num(r.client_id),
      ...(r.price != null ? { price: Number(r.price) } : {}),
      ...(r.kind === 'cat' ? { kind: 'cat', items: (r.items || []).map((it) => ({ pid: it.pid, ...(it.price != null ? { price: Number(it.price) } : {}) })) } : {}),
    })),
    topupReqs: topupReqs.map((r) => ({ id: r.id, org: r.org, by: r.by_user, amt: r.amt, proof: r.proof, date: r.date_label, clientId: num(r.client_id) })),
    frs: frs.map((f) => ({ ...f, parent: f.parent == null ? undefined : Number(f.parent), id: Number(f.id), clientId: num(f.client_id), client_id: undefined })),
    clients: clients.map((c) => ({
      id: Number(c.id), name: c.name, cr: c.cr, city: c.city, orders: c.orders, spend: c.spend, st: c.st, bal: c.bal, limit: c.cr_limit, used: c.used, wst: c.wst,
      branches: branchesOf(Number(c.id)), staff: staffOf(Number(c.id)), type: c.type || 'مستقل',
    })),
    clientProds: clientProds.map((r) => ({ clientId: Number(r.client_id), pid: r.pid, price: r.price })),
    newClients: newClients.map((r) => ({
      id: r.id, name: r.name, activity: r.activity, model: r.model, city: r.city, cities: r.cities,
      branchesN: r.branches_n, cr: r.cr, vat: r.vat, docs: r.docs, mgrName: r.mgr_name, mgrRole: r.mgr_role,
      mgrContact: r.mgr_contact, cats: r.cats, monthly: r.monthly, payment: r.payment, st: r.st,
      clientId: r.client_id == null ? undefined : Number(r.client_id), date: r.date_label,
    })),
    rolesMatrix: rolesMatrix.map((m) => ({ id: Number(m.id), ver: m.ver, note: m.note, meta: m.meta, cells: m.cells, cur: m.cur, draft: m.draft })),
    finReqs: finReqs.map((r) => ({
      id: r.id, clientId: Number(r.client_id), kind: r.kind, st: r.st, date: r.date_label,
      ...(r.amt != null ? { amt: r.amt } : {}), ...(r.months != null ? { months: Number(r.months) } : {}),
      ...(r.to_date ? { toDate: r.to_date } : {}), ...(r.note ? { note: r.note } : {}), ...(r.file_id ? { fileId: r.file_id } : {}),
    })),
    colFiles: colFiles.map((f) => ({
      id: f.id, clientId: Number(f.client_id), inv: f.inv, ref: f.ref, amt: f.amt, origAmt: f.orig_amt,
      created: f.created, due: f.due, lateDays: Number(f.late_days), stage: Number(f.stage),
      promise: f.promise || undefined, dueHist: f.due_hist || [], log: f.log || [], st: f.st,
    })),
    // حسابات منشأتي (ولـ B2B: فريق B2B) — حسابات كل عميل داخل clients[].staff
    users: accounts.filter((u) => (cid == null ? u.client_id == null : Number(u.client_id) === cid)).map(account),
    branches: cid == null ? [] : branchesOf(cid),
    lists: lists.map((l) => ({ id: Number(l.id), name: l.name, items: l.items })),
    extraNotifs: { [ctx.role]: notifs.map((n) => ({ c: n.c, text: n.body, t: n.t })) },
  };
}
