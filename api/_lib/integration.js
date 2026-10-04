// ============================================================
// التكامل مع نظام العمليات B2B OPS — docs/INTEGRATION.md
// المبيعات مصدر الحقيقة للعملاء والأسعار والطلب التجاري، والعمليات للمخزون والتنفيذ والتوصيل.
// لا قاعدة بيانات مشتركة: أحداث موقّعة (HMAC) في الاتجاهين + صندوق صادر (outbox) لا يضيع فيه حدث.
// مُطفأ افتراضيًا: بدون OPS_INTEGRATION_ENABLED=true لا يُسجَّل ولا يُرسل شيء، والمنصة تعمل كما كانت.
// ============================================================
import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { sql, nowLabel, notify } from './db.js';

const BACKOFF = [30, 120, 600, 1800, 3600, 10800, 21600, 43200]; // ثوانٍ بعد كل محاولة فاشلة — ثم dead
const NOT_RETRYABLE = [400, 404, 409, 410, 413, 422];
const TIMEOUT_MS = 5000;
const MAX_SKEW = 300;

/** الإعدادات من متغيرات البيئة فقط — لا أسرار في الكود (المستودع عام) */
export function config() {
  return {
    enabled: process.env.OPS_INTEGRATION_ENABLED === 'true',
    base: String(process.env.OPS_API_URL || '').replace(/\/+$/, ''),
    keyId: process.env.OPS_KEY_ID || '',
    secret: process.env.OPS_KEY_SECRET || '',
    // مفتاح سابق أثناء التدوير (اختياري)
    prevKeyId: process.env.OPS_KEY_ID_PREV || '',
    prevSecret: process.env.OPS_KEY_SECRET_PREV || '',
    since: process.env.OPS_INTEGRATION_SINCE || '', // لا يُرسل للعمليات طلب أقدم من هذا التاريخ عند الإصلاح
    // مرحلة التهيئة: OPS_INTEGRATION_ORDERS=false يُبقي مزامنة العملاء/الأصناف والمتاح للبيع ويؤجل تحويل الطلبات
    // للعمليات (يبقى تنفيذها يدويًا في المنصة) إلى أن تُربط الأصناف ويُدخل المخزون هناك
    orders: process.env.OPS_INTEGRATION_ORDERS !== 'false',
  };
}

export function enabled() {
  const c = config();
  return c.enabled && !!c.base && !!c.keyId && !!c.secret;
}

export function sign(secret, ts, method, path, body) {
  const canonical = `${ts}\n${method.toUpperCase()}\n${path}\n${createHash('sha256').update(body).digest('hex')}`;
  return createHmac('sha256', secret).update(canonical).digest('hex');
}

function signedHeaders(method, path, body) {
  const c = config();
  const ts = String(Math.floor(Date.now() / 1000));
  return {
    'Content-Type': 'application/json', Accept: 'application/json',
    'X-B2B-System': 'sales', 'X-B2B-Key-Id': c.keyId, 'X-B2B-Timestamp': ts,
    'X-B2B-Signature': sign(c.secret, ts, method, path, body),
  };
}

/** التحقق من طلب وارد من العمليات (نفس المخطط في الاتجاه المعاكس). path = المسار كما وصل مع الاستعلام */
export function verify(headers, method, path, rawBody) {
  const c = config();
  const h = (k) => String(headers[k.toLowerCase()] || '');
  const system = h('X-B2B-System'); const keyId = h('X-B2B-Key-Id'); const ts = h('X-B2B-Timestamp'); const sig = h('X-B2B-Signature').toLowerCase();
  if (!system || !keyId || !ts || !sig) return { ok: false, code: 'SIGNATURE_MISSING' };
  if (system !== 'ops') return { ok: false, code: 'SYSTEM_UNKNOWN' };
  const secret = keyId === c.keyId ? c.secret : (c.prevKeyId && keyId === c.prevKeyId ? c.prevSecret : '');
  if (!secret) return { ok: false, code: 'KEY_UNKNOWN' };
  if (!/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > MAX_SKEW) return { ok: false, code: 'SIGNATURE_EXPIRED' };
  const expected = Buffer.from(sign(secret, ts, method, path, rawBody));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, code: 'SIGNATURE_INVALID' };
  return { ok: true, system };
}

/** طلب موقّع إلى العمليات. يعيد {status, body} أو يرمي عند انقطاع الشبكة/المهلة */
export async function opsFetch(method, path, payload) {
  const body = payload === undefined ? '' : JSON.stringify(payload);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(config().base + path, { method, headers: signedHeaders(method, path, body), body: body || undefined, signal: ctl.signal });
    const text = await r.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* غير JSON */ }
    return { status: r.status, body: json, text };
  } finally {
    clearTimeout(timer);
  }
}

// ───────────── الصادر: تسجيل الحدث ثم إرساله ─────────────

/**
 * يسجّل حدثًا في صندوق الصادر (لا يُرسل هنا). subject = الكيان (رقم الطلب/العميل/المنتج)،
 * والتسلسل لكل subject يضمن أن العمليات تطبّق الأحداث بترتيبها. يعيد معرّف الحدث أو null إن كان التكامل مطفأ.
 */
export async function emit(type, subject, data, correlation = subject) {
  if (!enabled()) return null;
  const [{ last_seq: seq }] = await sql`INSERT INTO integration_subjects (source, subject, last_seq) VALUES ('sales', ${subject}, 1)
    ON CONFLICT (source, subject) DO UPDATE SET last_seq = integration_subjects.last_seq + 1 RETURNING last_seq`;
  const id = `evt_${randomUUID()}`;
  await sql`INSERT INTO integration_outbox (id, type, subject, seq, correlation, data)
            VALUES (${id}, ${type}, ${subject}, ${Number(seq)}, ${correlation}, ${JSON.stringify(data)})`;
  return id;
}

function envelope(row) {
  return {
    id: row.id, type: row.type, source: 'sales', subject: row.subject, sequence: Number(row.seq),
    time: new Date(row.created_at).toISOString(), schemaVersion: 1, correlationId: row.correlation, data: row.data,
  };
}

/** يرسل المستحق من الصادر (أو معرّفات محددة) — كل حدث بقفل قصير حتى لا يُرسل مرتين في نفس اللحظة */
export async function flush({ ids = null, limit = 50, budgetMs = 4000 } = {}) {
  const stats = { sent: 0, failed: 0, dead: 0 };
  if (!enabled()) return stats;
  const t0 = Date.now();
  const due = ids
    ? await sql`SELECT * FROM integration_outbox WHERE id = ANY(${ids}) AND st IN ('pending','failed') AND next_at <= now() ORDER BY created_at`
    : await sql`SELECT * FROM integration_outbox WHERE st IN ('pending','failed') AND next_at <= now() ORDER BY next_at, created_at LIMIT ${limit}`;
  for (const row of due) {
    if (Date.now() - t0 > budgetMs) break;
    const claimed = await sql`UPDATE integration_outbox SET next_at = now() + interval '60 seconds'
      WHERE id = ${row.id} AND st IN ('pending','failed') AND next_at <= now() RETURNING id`;
    if (!claimed.length) continue;
    let status = null; let error = null; let result = null;
    try {
      const r = await opsFetch('POST', '/api/v1/events', envelope(row));
      status = r.status;
      result = r.body?.results?.[0] || null;
      if (r.status >= 300) error = `HTTP ${r.status} ${r.body?.code || r.text.slice(0, 200)}`;
      else if (result?.status === 'rejected') { status = 422; error = `rejected ${result.code}: ${result.message || ''}`; }
    } catch (e) {
      error = String(e?.name === 'AbortError' ? 'timeout' : e?.message || e).slice(0, 300);
    }
    const attempts = Number(row.attempts) + 1;
    if (!error) {
      await sql`UPDATE integration_outbox SET st = 'sent', attempts = ${attempts}, sent_at = now(), last_error = NULL, result = ${JSON.stringify(result)} WHERE id = ${row.id}`;
      stats.sent++;
      continue;
    }
    if (NOT_RETRYABLE.includes(status) || attempts > BACKOFF.length) {
      await sql`UPDATE integration_outbox SET st = 'dead', attempts = ${attempts}, last_error = ${error}, result = ${JSON.stringify(result)} WHERE id = ${row.id}`;
      await notify(['b2b'], 'تكامل', `تعذّر إرسال ${row.type} (${row.subject}) لنظام العمليات: ${error}`);
      stats.dead++;
    } else {
      const delay = BACKOFF[attempts - 1] + Math.floor(Math.random() * (BACKOFF[attempts - 1] / 10));
      await sql`UPDATE integration_outbox SET st = 'failed', attempts = ${attempts}, last_error = ${error}, next_at = now() + (${delay} || ' seconds')::interval WHERE id = ${row.id}`;
      stats.failed++;
    }
  }
  return stats;
}

// ───────────── بناء أحداث الكيانات ─────────────

/** العميل كما تعرفه المبيعات (مصدر الحقيقة) مع فروعه بمفاتيح ثابتة {clientId}:{اسم الفرع} */
export async function customerPayload(clientId) {
  const [c] = await sql`SELECT * FROM clients WHERE id = ${clientId}`;
  if (!c) return null;
  // فروع المنشأة النشطة من جدول الفروع (مصدرها الوحيد بعد فصل بيانات المنشآت)
  const branches = await sql`SELECT name, city, loc FROM branches WHERE client_id = ${clientId} AND st <> 'off' ORDER BY name`;
  return {
    id: String(c.id), name: c.name, cr: c.cr, city: c.city, type: c.type || null, active: c.st !== 'susp',
    creditLimit: Number(c.cr_limit),
    branches: branches.map((b) => ({ key: `${c.id}:${b.name}`, name: b.name, city: b.city || c.city, address: b.loc?.addr || null })),
  };
}

/** الطلب المعتمد تجاريًا → أمر تنفيذ في العمليات (بأسعار لحظة الطلب) */
export async function emitOrderConfirmed(order, role) {
  if (!enabled() || !config().orders) return null;
  // طلب بلا منشأة (مثل طلب واتساب من رقم غير مسجّل) لا يُرسل آليًا — يعالجه فريق B2B يدويًا
  if (order.client_id == null) return null;
  const clientId = String(order.client_id);
  const lines = (order.items || []).filter((i) => Number(i.qty) > 0).map((i, n) => ({
    lineNo: n + 1, productId: i.pid, qty: Math.floor(Number(i.qty)), unitPrice: Number(i.price ?? 0), discountPct: 0,
  }));
  if (!lines.length) return null;
  const net = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const vat = Math.round(net * 0.15 * 100) / 100;
  const id = await emit('sales_order.confirmed', order.id, {
    id: order.id, customerId: clientId, branch: { key: `${clientId}:${order.branch}`, name: order.branch },
    lines, vatPct: 15, totals: { net: Math.round(net * 100) / 100, vat, gross: Math.round((net + vat) * 100) / 100 },
    priority: 'normal', salesRep: order.by_user, notes: null, confirmedAt: new Date().toISOString(), confirmedByRole: role,
  });
  await sql`UPDATE orders SET ops_sent_at = now(), ops_status = 'sent', updated_at = now() WHERE id = ${order.id}`;
  return id;
}

/** الطلب أُرسل للعمليات؟ عندها تصبح خطوات التنفيذ (تعليق/إرسال/إصدار جزئي) من صلاحية العمليات */
export const sentToOps = (o) => !!o?.ops_sent_at;

// ───────────── الوارد من العمليات ─────────────

const STATUS_AR = {
  sent: 'أُرسل للعمليات', reserved: 'محجوز في المستودع', backordered: 'بانتظار توفر المخزون', partially_reserved: 'محجوز جزئيًا — الباقي بانتظار التوريد',
  released: 'صدر أمر التجهيز', picking: 'قيد التجهيز', picked: 'اكتمل التجهيز', packed: 'مُعبأ وجاهز للتحميل', loaded: 'حُمّل على الشاحنة',
  out_for_delivery: 'خرج للتوصيل', delivered: 'سُلّم (إثبات تسليم)', delivered_partial: 'سُلّم جزئيًا', delivery_failed: 'فشل التسليم',
  cancelled: 'أُلغي في العمليات', cancel_rejected: 'تعذّر الإلغاء — التنفيذ بدأ', returned: 'أُعيد',
};
export const opsStatusLabel = (s) => STATUS_AR[s] || s || '';

function eventText(e) {
  const d = e.data || {};
  switch (e.type) {
    case 'order.accepted': return `استلمته العمليات (${d.opsOrder}) — ${d.availability === 'full' ? 'المخزون متوفر بالكامل' : d.availability === 'partial' ? 'متوفر جزئيًا' : 'غير متوفر حاليًا'}`;
    case 'order.backordered': return `بانتظار توفر ${(d.lines || []).length} صنف${d.eta ? ` — متوقع ${d.eta}` : ''}`;
    case 'procurement.required': return 'رُفع احتياج توريد للنواقص';
    case 'order.reserved': return d.completedBackorder ? 'وصل المخزون واكتمل الحجز' : 'حُجز المخزون';
    case 'shipment.dispatched': return `خرج للتوصيل — رحلة ${d.trip}${d.driver ? ` · السائق ${d.driver}` : ''}${d.vehicle ? ` · ${d.vehicle}` : ''}`;
    case 'delivery.completed': return `سُلّم${d.receiver ? ` — المستلم ${d.receiver}` : ''} · ${d.pod}`;
    case 'delivery.partial': return `تسليم جزئي — ${d.deliveredQty} سُلّم و${d.returnedQty} يعود · ${d.pod}`;
    case 'delivery.failed': return `فشل التسليم — ${d.reasonAr || d.reason || ''}`;
    case 'order.cancelled': return 'أُلغي في العمليات وأُفرج عن الحجز';
    case 'order.cancel_rejected': return `تعذّر الإلغاء — ${d.reason || 'التنفيذ بدأ'}`;
    case 'return.created': return `فُتح مرتجع ${d.return}${d.reasonAr ? ` — ${d.reasonAr}` : ''}`;
    case 'return.approved': return `اعتُمد المرتجع ${d.return}`;
    case 'return.received': return `استُلم المرتجع ${d.return} في المستودع للفحص`;
    case 'return.inspect': return `يُفحص المرتجع ${d.return}`;
    case 'return.closed': return `أُقفل المرتجع ${d.return} — ${d.decisionAr || d.decision || ''}`;
    case 'return.rejected': return `رُفض المرتجع ${d.return}`;
    default: return opsStatusLabel(d.status) || e.type;
  }
}

function opsLog(txt) {
  return { who: 'نظام العمليات', role: 'B2B OPS', txt, t: nowLabel() };
}

/**
 * يطبّق حدثًا من العمليات على الطلب: حالة التنفيذ + رحلته، وتنتقل الحالة التجارية فقط عند الخروج للتوصيل وفشل التسليم.
 * @returns {{status:string, code?:string, message?:string}}
 */
export async function applyOpsEvent(e) {
  if (!e?.id || !e?.type || !e?.subject || e.source !== 'ops') return { status: 'rejected', code: 'INVALID_ENVELOPE' };
  const ins = await sql`INSERT INTO integration_inbox (event_id, type, subject, seq, st, data)
    VALUES (${e.id}, ${e.type}, ${e.subject}, ${e.sequence ?? null}, 'applied', ${JSON.stringify(e)}) ON CONFLICT (event_id) DO NOTHING RETURNING event_id`;
  if (!ins.length) return { status: 'duplicate' };
  const mark = (st, error = null) => sql`UPDATE integration_inbox SET st = ${st}, error = ${error} WHERE event_id = ${e.id}`;
  if (e.type === 'integration.ping') return { status: 'processed' };
  if (e.type === 'inventory.changed') {
    const d = e.data || {};
    await sql`INSERT INTO ops_stock (pid, mapped, atp, incoming, incoming_eta, as_of) VALUES (${e.subject}, true, ${d.atp ?? null}, ${d.incoming ?? null}, ${d.incomingEta ?? null}, now())
              ON CONFLICT (pid) DO UPDATE SET mapped = true, atp = EXCLUDED.atp, incoming = EXCLUDED.incoming, incoming_eta = EXCLUDED.incoming_eta, as_of = now()`;
    return { status: 'processed' };
  }
  // ترتيب الأحداث لكل طلب: حدث أقدم من آخر ما طُبّق لا يُطبّق
  if (e.sequence != null) {
    const [s] = await sql`SELECT last_seq FROM integration_subjects WHERE source = 'ops' AND subject = ${e.subject}`;
    if (s && Number(e.sequence) <= Number(s.last_seq)) { await mark('stale'); return { status: 'stale' }; }
  }
  const [o] = await sql`SELECT * FROM orders WHERE id = ${e.subject}`;
  if (!o) { await mark('rejected', 'ORDER_UNKNOWN'); return { status: 'rejected', code: 'ORDER_UNKNOWN', message: `order ${e.subject} not found` }; }

  const d = e.data || {};
  const status = e.type === 'order.cancel_rejected' ? 'cancel_rejected' : (d.status || o.ops_status);
  const events = [...(o.ops_events || []), { type: e.type, status, text: eventText(e), at: e.time || new Date().toISOString(), seq: e.sequence ?? null }];
  let st = o.st; let holdReason = o.hold_reason; const stamps = [...(o.stamps || [])]; const log = [...(o.log || [])];
  const notes = [];
  if (e.type === 'shipment.dispatched' && ['b2b', 'hold'].includes(o.st)) {
    st = 'ship'; holdReason = null; stamps[4] = nowLabel(); log.push(opsLog(eventText(e)));
    notes.push([['worker'], 'طلبات', `خرج طلبك ${o.id} للتوصيل — أكّد الاستلام عند وصوله`]);
  } else if (e.type === 'delivery.completed' || e.type === 'delivery.partial') {
    log.push(opsLog(eventText(e)));
    notes.push([['worker'], 'طلبات', `${e.type === 'delivery.partial' ? 'سُلّم جزء من' : 'سُلّم'} طلبك ${o.id} — أكّد الاستلام في المنصة`]);
  } else if (e.type === 'delivery.failed' && o.st === 'ship') {
    st = 'hold'; holdReason = `فشل التسليم: ${d.reasonAr || d.reason || 'غير محدد'} — تعود البضاعة للمستودع`; log.push(opsLog(eventText(e)));
    notes.push([['b2b', 'ops'], 'طلبات', `فشل تسليم ${o.id} — ${d.reasonAr || d.reason || ''}`]);
  } else if (e.type === 'order.cancelled' && o.st !== 'rej') {
    st = 'hold'; holdReason = 'أُلغي في نظام العمليات — يلزم قرار تجاري'; log.push(opsLog(eventText(e)));
    notes.push([['b2b'], 'طلبات', `ألغت العمليات تنفيذ ${o.id} — يلزم قرار`]);
  } else if (e.type === 'order.cancel_rejected') {
    log.push(opsLog(eventText(e)));
    notes.push([['b2b'], 'طلبات', `تعذّر إلغاء ${o.id} في العمليات — التنفيذ بدأ، تواصل مع فريق العمليات`]);
  } else if (e.type === 'return.created' || e.type === 'return.closed') {
    log.push(opsLog(eventText(e)));
    notes.push([['b2b', 'owner'], 'طلبات', `${o.id}: ${eventText(e)}`]);
  } else if (e.type === 'order.backordered') {
    log.push(opsLog(eventText(e)));
    notes.push([['b2b', 'owner'], 'طلبات', `${o.id}: ${eventText(e)}`]);
  }
  await sql`UPDATE orders SET st = ${st}, hold_reason = ${holdReason}, stamps = ${JSON.stringify(stamps)}, log = ${JSON.stringify(log)},
            ops_ref = ${d.opsOrder || o.ops_ref}, ops_status = ${status}, ops_eta = ${d.eta !== undefined ? d.eta : o.ops_eta},
            ops_events = ${JSON.stringify(events)}, updated_at = now() WHERE id = ${o.id}`;
  if (e.sequence != null) {
    await sql`INSERT INTO integration_subjects (source, subject, last_seq) VALUES ('ops', ${e.subject}, ${e.sequence})
              ON CONFLICT (source, subject) DO UPDATE SET last_seq = GREATEST(integration_subjects.last_seq, EXCLUDED.last_seq)`;
  }
  for (const [roles, c, body] of notes) await notify(roles, c, body);
  return { status: 'processed' };
}

// ───────────── دورة دورية: إرسال المتأخر + إصلاح ما فات + تحديث المتاح ─────────────

export async function runCycle() {
  if (!enabled()) return { ran: false, reason: 'integration disabled' };
  const c = config();
  // طلب معتمد تجاريًا (b2b) لم يُسجَّل له حدث — مثلًا انقطع التنفيذ بين التحديث والتسجيل: يُرسل الآن
  const since = c.since || '1970-01-01';
  const missed = await sql`SELECT * FROM orders WHERE st = 'b2b' AND ops_sent_at IS NULL AND client_id IS NOT NULL AND created_at >= ${since}::timestamptz ORDER BY created_at LIMIT 50`;
  if (c.orders) for (const o of missed) await emitOrderConfirmed(o, 'repair');
  const master = await syncMasterData();
  const delivered = await flush({ limit: 100, budgetMs: 20000 });
  // تعذّر قراءة المتاح (مثل بدء بارد للعمليات يتجاوز المهلة) لا يُفشل الدورة — يُعاد في الدورة التالية
  let stock;
  try { stock = await refreshStock(); } catch (e) { stock = { updated: 0, error: e.message || 'unreachable' }; }
  return { ran: true, repaired: c.orders ? missed.length : 0, master, delivered, stock };
}

/** المتاح للبيع لكل الأصناف من العمليات (للعرض في الكتالوج — العمليات تحسب، المبيعات تعرض فقط) */
export async function refreshStock() {
  const pids = (await sql`SELECT id FROM products ORDER BY id`).map((r) => r.id);
  let updated = 0;
  for (let i = 0; i < pids.length; i += 100) {
    const chunk = pids.slice(i, i + 100);
    // الفاصلة تُرسل مُرمَّزة (%2C): بعض المنصات (Vercel) تعيد ترميز الفاصلة الخام في المسار فيختلف المسار الموقَّع عمّا يصل
    const r = await opsFetch('GET', `/api/v1/inventory/availability?products=${encodeURIComponent(chunk.join(','))}`);
    if (r.status !== 200) return { updated, error: `HTTP ${r.status}` };
    for (const it of r.body.items || []) {
      await sql`INSERT INTO ops_stock (pid, mapped, atp, incoming, incoming_eta, as_of) VALUES (${it.productId}, ${!!it.mapped}, ${it.atp ?? null}, ${it.incoming ?? null}, ${it.incomingEta ?? null}, now())
                ON CONFLICT (pid) DO UPDATE SET mapped = EXCLUDED.mapped, atp = EXCLUDED.atp, incoming = EXCLUDED.incoming, incoming_eta = EXCLUDED.incoming_eta, as_of = now()`;
      updated++;
    }
  }
  return { updated };
}

/**
 * مزامنة البيانات الأساسية بالبصمة: يُرسل للعمليات كل عميل/صنف تغيّر محتواه منذ آخر إرسال (أو لم يُرسل قط)،
 * فلا يفوت تعديل أيًّا كان الأمر الذي أحدثه. تعمل بعد أوامر العملاء/الأصناف وفي كل دورة دورية.
 */
export async function syncMasterData() {
  const out = { customers: 0, products: 0 };
  if (!enabled()) return out;
  const known = Object.fromEntries((await sql`SELECT entity || ':' || id AS k, hash FROM integration_hashes`).map((r) => [r.k, r.hash]));
  const digest = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex');
  for (const { id } of await sql`SELECT id FROM clients ORDER BY id`) {
    const p = await customerPayload(id);
    const h = digest(p);
    const k = `customer:${id}`;
    if (known[k] === h) continue;
    await emit(known[k] ? 'customer.updated' : 'customer.created', p.id, p);
    await sql`INSERT INTO integration_hashes (entity, id, hash) VALUES ('customer', ${String(id)}, ${h}) ON CONFLICT (entity, id) DO UPDATE SET hash = EXCLUDED.hash`;
    out.customers++;
  }
  const products = await sql`SELECT id, name, unit, cat, price::float AS price, is_out FROM products ORDER BY id`;
  const live = new Set();
  for (const p of products) {
    live.add(p.id);
    const data = { id: p.id, name: p.name, unit: p.unit, category: p.cat, price: p.price, active: !p.is_out };
    const h = digest(data);
    const k = `product:${p.id}`;
    if (known[k] === h) continue;
    await emit(known[k] ? 'product.updated' : 'product.created', p.id, data);
    await sql`INSERT INTO integration_hashes (entity, id, hash) VALUES ('product', ${p.id}, ${h}) ON CONFLICT (entity, id) DO UPDATE SET hash = EXCLUDED.hash`;
    out.products++;
  }
  // صنف حُذف من المنصة: يُبلَّغ كغير نشط (أوامره القائمة تبقى صحيحة في العمليات)
  for (const k of Object.keys(known).filter((x) => x.startsWith('product:'))) {
    const pid = k.slice(8);
    if (live.has(pid)) continue;
    await emit('product.updated', pid, { id: pid, active: false, deleted: true });
    await sql`DELETE FROM integration_hashes WHERE entity = 'product' AND id = ${pid}`;
    out.products++;
  }
  return out;
}

/** أوامر المنصة التي قد تغيّر عميلًا أو صنفًا — بعدها تُشغَّل syncMasterData */
export const MASTER_DATA_COMMANDS = /^(clients|frs|nc|branches|products|reqs)\./;
