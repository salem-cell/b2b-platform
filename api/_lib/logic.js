// ============================================================
// منطق الأعمال على الخادم — المصدر الوحيد للحقيقة
// كل أمر: تحقق صلاحية الدور + ملكية السجل (منشأة الحساب) → تعديل القاعدة → إشعارات → رسالة
// ctx = سياق الجلسة من سجل الحساب: { role, userId, clientId, name, branch, org, frsId } — docs/SECURITY.md
// ============================================================
import { sql, nextSeq, nowLabel, notify, fmt, fmt0, VAT } from './db.js';
import { httpError } from './http.js';
import { ROLES } from '../../js/data/constants.js';
import { emit, emitOrderConfirmed, sentToOps, enabled as integrationOn } from './integration.js';
import { assertPin, hashPin, normPhone, validPhone } from './auth.js';

const APPROVER_FINAL = ['owner', 'frz', 'frzs'];
const isB2B = (ctx) => ctx.role === 'b2b';
const NOT_FOUND = { order: 'الطلب غير موجود', client: 'العميل غير موجود' };

async function productMap() {
  const rows = await sql`SELECT id, name, unit, price::float, is_out FROM products`;
  return Object.fromEntries(rows.map((p) => [p.id, p]));
}

/** منشأة الحساب — أوامر العملاء لا تعمل لحساب بلا منشأة (فريق B2B) */
function myClient(ctx) {
  if (ctx.clientId == null) throw httpError(403, 'هذا الإجراء لحسابات المنشآت');
  return ctx.clientId;
}

/** هل العميل ضمن شبكة الجلسة: المانح يرى ممنوحيه، والسوبر يرى تابعيه */
async function inNetwork(ctx, clientId) {
  if (ctx.clientId == null) return false;
  if (ctx.role === 'fr') {
    const [f] = await sql`SELECT 1 AS ok FROM frs WHERE client_id = ${clientId} AND granter_id = ${ctx.clientId}`;
    return !!f;
  }
  if (ctx.role === 'frzs' && ctx.frsId != null) {
    const [f] = await sql`SELECT 1 AS ok FROM frs WHERE client_id = ${clientId} AND parent = ${ctx.frsId}`;
    return !!f;
  }
  return false;
}

/** يرفض (كأنه غير موجود) أي عميل خارج نطاق الجلسة: منشأتي، أو شبكتي عند network، أو الكل لـ B2B */
async function assertClientAccess(ctx, clientId, { network = false } = {}) {
  const cid = Number(clientId);
  if (isB2B(ctx) || (ctx.clientId != null && cid === ctx.clientId)) return cid;
  if (network && await inNetwork(ctx, cid)) return cid;
  throw httpError(404, NOT_FOUND.client);
}

async function getOrder(ctx, id) {
  const [o] = await sql`SELECT * FROM orders WHERE id = ${id}`;
  if (!o || (!isB2B(ctx) && Number(o.client_id) !== ctx.clientId)) throw httpError(404, NOT_FOUND.order);
  return o;
}

/** قيد بسجل إجراءات الطلب — باسم الحساب الفعلي */
function logEntry(ctx, txt) {
  return { who: ctx.name, role: ROLES[ctx.role].name, txt, t: nowLabel() };
}

/** وصف نصي لتغييرات الكميات (يدخل في سجل الإجراءات) */
function qtyDiffTxt(items, qty, pm) {
  const parts = [];
  for (const i of items) {
    const nq = Math.max(0, Math.floor(Number(qty?.[i.pid] ?? i.qty)));
    if (nq !== i.qty) parts.push(nq === 0 ? `حذف ${pm[i.pid]?.name || i.pid}` : `${pm[i.pid]?.name || i.pid} من ${i.qty} إلى ${nq}`);
  }
  return parts.length ? `عدّل الكميات: ${parts.join('، ')}` : '';
}

/** طلب أُرسل لنظام العمليات: التنفيذ (تعديل الكميات/التعليق/الإرسال للتوصيل) يُدار هناك */
function opsOwned(o) {
  if (sentToOps(o)) throw httpError(409, `الطلب ${o.id} يُنفَّذ في نظام العمليات (${o.ops_ref || 'قيد الاستلام'}) — التجهيز والتوصيل يُداران من هناك`);
}

/** سعر لحظة الطلب لكل صنف: سعر المنشأة الخاص إن وُجد وإلا سعر القائمة — يُحفظ في سطر الطلب */
async function pricesFor(clientId) {
  const own = await sql`SELECT pid, price::float AS price FROM client_products WHERE client_id = ${clientId}`;
  return Object.fromEntries(own.map((r) => [r.pid, r.price]));
}

async function clientRow(clientId) {
  const [c] = await sql`SELECT * FROM clients WHERE id = ${clientId}`;
  if (!c) throw httpError(404, NOT_FOUND.client);
  return c;
}

async function clientNameOf(cid) {
  const [c] = await sql`SELECT name FROM clients WHERE id = ${cid}`;
  return c ? c.name : `عميل ${cid}`;
}

// ============ المحفظة: واحدة لكل منشأة ============

/** محفظة المنشأة (تُنشأ عند أول استخدام من أرصدة سجل العميل) */
async function walletOf(clientId) {
  let [w] = await sql`SELECT * FROM wallet WHERE client_id = ${clientId}`;
  if (!w) {
    const c = await clientRow(clientId);
    await sql`INSERT INTO wallet (org_cr, bal, cr_limit, used, client_id)
              VALUES (${`c:${clientId}`}, ${Number(c.bal)}, ${Number(c.cr_limit)}, ${Number(c.used)}, ${clientId})
              ON CONFLICT DO NOTHING`;
    [w] = await sql`SELECT * FROM wallet WHERE client_id = ${clientId}`;
  }
  return w;
}

/** حركة على المحفظة (موجب = إضافة) مع قيدها في الكشف — وتبقى أرصدة سجل العميل مطابقة */
async function walletMove(clientId, amount, label) {
  await walletOf(clientId);
  await sql`UPDATE wallet SET bal = bal + ${amount} WHERE client_id = ${clientId}`;
  await sql`UPDATE clients SET bal = bal + ${amount} WHERE id = ${clientId}`;
  await sql`INSERT INTO wallet_tx (org_cr, t, d, amt, client_id) VALUES (${`c:${clientId}`}, ${label}, 'الآن', ${amount}, ${clientId})`;
}

async function assertWalletActive(clientId) {
  const c = await clientRow(clientId);
  if (c.wst === 'frozen') throw httpError(403, 'محفظة المنشأة مجمّدة — لا شحن ولا صرف حتى فك التجميد من B2B');
}

// ============ الطلبات ============

async function ordersSubmit(ctx, { items }) {
  const { role } = ctx;
  if (!['worker', 'ops', 'owner', 'frz', 'frzs'].includes(role)) throw httpError(403, 'هذا الدور لا يستطيع إنشاء طلبات');
  if (!Array.isArray(items) || !items.length) throw httpError(400, 'السلة فارغة');
  const clientId = myClient(ctx);
  const client = await clientRow(clientId);
  if (client.st === 'susp') throw httpError(403, 'حساب منشأتك موقوف — لا يمكن إرسال طلبات');

  const pm = await productMap();
  const own = await pricesFor(clientId);
  const clean = items
    .filter((i) => pm[i.pid] && !pm[i.pid].is_out && Number(i.qty) > 0)
    .map((i) => ({ pid: i.pid, qty: Math.min(999, Math.floor(Number(i.qty))), price: own[i.pid] ?? pm[i.pid].price }));
  if (!clean.length) throw httpError(400, 'لا أصناف صالحة في السلة');

  // فرع الطلب: فرع الحساب (الأول إن تعددت)؛ حسابات الإدارة تطلب للفرع الأول للمنشأة
  let branch = String(ctx.branch || '').split(' · ')[0].trim();
  const myBranches = await sql`SELECT name, st FROM branches WHERE client_id = ${clientId} ORDER BY name`;
  if (!myBranches.some((b) => b.name === branch)) branch = myBranches.find((b) => b.st !== 'off')?.name || branch || 'الإدارة';
  if (myBranches.some((b) => b.name === branch && b.st === 'off')) throw httpError(403, `${branch} موقوف مؤقتًا — لا تُقبل طلبات منه`);

  // مسار الطلب حسب الدور: المالك/الممنوحون → مباشرة إلى B2B؛ مدير العمليات → تعميد المشتريات؛ العامل → المسار الكامل
  const direct = ['owner', 'frz', 'frzs'].includes(role);
  const startSt = direct ? 'b2b' : role === 'ops' ? 'purch' : 'ops';
  const n = nowLabel();
  const stamps = direct ? [n, n, n, n, '', ''] : role === 'ops' ? [n, n, '', '', '', ''] : [n, '', '', '', '', ''];

  const seq = await nextSeq('order');
  const id = `ORD-${seq}`;
  const log = [logEntry(ctx, `أنشأ الطلب (${clean.length} أصناف) وأرسله${direct ? ' مباشرة إلى B2B' : role === 'ops' ? ' لتعميد المشتريات' : ' لتعميد العمليات'}`)];
  await sql`INSERT INTO orders (id, by_user, branch, date_label, st, items, stamps, log, client_id)
            VALUES (${id}, ${ctx.name}, ${branch}, 'الآن', ${startSt},
                    ${JSON.stringify(clean)}, ${JSON.stringify(stamps)}, ${JSON.stringify(log)}, ${clientId})`;
  // طلب معتمد مباشرة (المالك/الممنوح) → يذهب لنظام العمليات للتنفيذ
  if (direct) await emitOrderConfirmed(await getOrder(ctx, id), role);

  if (direct) {
    await notify(['ops', 'fin'], 'اعتمادات', `أرسل ${ctx.name} الطلب ${id} مباشرة إلى B2B`, clientId);
    await notify(['b2b'], 'اعتمادات', `طلب جديد ${id} من ${client.name} — ${branch}`);
  } else {
    await notify(role === 'ops' ? ['owner', 'frz', 'frzs'] : ['ops'], 'اعتمادات',
      role === 'ops' ? `طلب جديد بانتظار تعميدك النهائي — ${id}` : `طلب جديد بانتظار تعميدك — ${id}`, clientId);
  }

  return direct
    ? `أُرسل الطلب ${id} مباشرة إلى B2B — لا يحتاج تعميدًا`
    : role === 'ops' ? `أُرسل الطلب ${id} لتعميد مدير المشتريات مباشرة` : `أُرسل الطلب ${id} لتعميد مدير العمليات`;
}

async function ordersApprove(ctx, { id, qty }) {
  const { role } = ctx;
  const o = await getOrder(ctx, id);
  const cid = Number(o.client_id) || null;
  const canFirst = role === 'ops' || role === 'b2b';
  const canFinal = APPROVER_FINAL.includes(role) || role === 'b2b';
  if (o.st === 'ops' && !canFirst) throw httpError(403, 'تعميد هذه المرحلة لمدير العمليات');
  if (o.st === 'purch' && !canFinal) throw httpError(403, 'التعميد النهائي للمالك / المشتريات');
  if (!['ops', 'purch', 'b2b', 'hold'].includes(o.st)) throw httpError(400, 'الطلب ليس في مرحلة تعميد');
  if (o.st === 'b2b' || o.st === 'hold') {
    // بعد وصول الطلب إلى B2B: التعديل لفريق B2B فقط (وإن كان في نظام العمليات فمن هناك)
    if (!isB2B(ctx)) throw httpError(403, 'الطلب لدى B2B — لا يُعدَّل من المنشأة بعد التعميد النهائي');
    opsOwned(o);
  }
  const pm = await productMap();

  // الأصناف المحذوفة تبقى بكمية صفر — تظهر للجميع ويمكن لأي معمِّد لاحق إرجاعها
  let changed = false;
  const items = o.items.map((i) => {
    const q = Math.max(0, Math.floor(Number(qty?.[i.pid] ?? i.qty)));
    if (q !== i.qty) changed = true;
    return { ...i, qty: q };
  });
  const liveCount = items.filter((i) => i.qty > 0).length;
  const dtx = qtyDiffTxt(o.items, qty, pm);

  // B2B ينقص كميات طلب قيد التجهيز → إصدار جزئي + طلب نواقص تابع تلقائيًا
  if ((o.st === 'b2b' || o.st === 'hold') && changed) {
    const shortage = o.items
      .map((i) => ({ ...i, qty: i.qty - Math.max(0, Math.floor(Number(qty?.[i.pid] ?? i.qty))) }))
      .filter((i) => i.qty > 0);
    if (shortage.length && !liveCount) throw httpError(400, 'كل الكميات صفر — علّق الطلب أو ارفضه بدل الإصدار الجزئي');
    if (shortage.length) {
      const childId = `${o.id}-B`;
      const stamps = [...o.stamps];
      stamps[4] = nowLabel();
      const parentLog = [...o.log, logEntry(ctx, `${dtx ? `${dtx} — ` : ''}أصدر المتوفر للتوصيل وأنشأ طلب النواقص التابع ${childId}`)];
      await sql`UPDATE orders SET st = 'ship', items = ${JSON.stringify(items)},
                stamps = ${JSON.stringify(stamps)}, log = ${JSON.stringify(parentLog)} WHERE id = ${o.id}`;
      await sql`INSERT INTO orders (id, by_user, branch, date_label, st, items, stamps, log, backorder, parent_ref, hold_reason, client_id)
                VALUES (${childId}, ${o.by_user}, ${o.branch}, ${`اليوم ${nowLabel()}`}, 'hold',
                        ${JSON.stringify(shortage)}, ${JSON.stringify(o.stamps)},
                        ${JSON.stringify([logEntry(ctx, `أُنشئ تلقائيًا كطلب نواقص تابع لـ ${o.id}`)])},
                        true, ${o.id}, 'بانتظار توفر الأصناف الناقصة — فور التوفر يُرسل للتوصيل بفاتورة مستقلة', ${cid})`;
      await notify(['worker', 'ops', 'owner', 'frz', 'frzs', 'fin'], 'طلبات',
        `أصدر B2B المتوفر من ${o.id} للتوصيل، وأُنشئ طلب نواقص تابع ${childId} يُرسل فور التوفر`, cid);
      return `أُرسل المتوفر من ${o.id} للتوصيل وأُنشئ طلب النواقص التابع ${childId}`;
    }
  }

  if (!liveCount) throw httpError(400, 'لا يمكن اعتماد طلب بلا أصناف — استخدم الرفض');

  const stamps = [...o.stamps];
  let st = o.st;
  if (o.st === 'ops') { st = 'purch'; stamps[1] = nowLabel(); }
  else if (o.st === 'purch') { st = 'b2b'; stamps[2] = nowLabel(); stamps[3] = nowLabel(); }
  const actTxt = o.st === 'ops' ? 'عمّد الطلب وأرسله لتعميد المشتريات'
    : o.st === 'purch' ? 'عمّد الطلب نهائيًا وأرسله إلى B2B' : 'عدّل الطلب أثناء التجهيز';
  const log = [...o.log, logEntry(ctx, dtx ? `${dtx} ثم ${actTxt}` : actTxt)];
  await sql`UPDATE orders SET st = ${st}, items = ${JSON.stringify(items)},
            stamps = ${JSON.stringify(stamps)}, log = ${JSON.stringify(log)}, updated_at = now() WHERE id = ${id}`;
  // التعميد النهائي → يذهب لنظام العمليات للتنفيذ
  if (o.st === 'purch' && st === 'b2b') {
    await emitOrderConfirmed(await getOrder(ctx, id), role);
    await notify(['b2b'], 'اعتمادات', `طلب معتمد ${id} من ${await clientNameOf(cid)} — ${o.branch}`);
  }
  if (o.st === 'ops') await notify(['owner', 'frz', 'frzs'], 'اعتمادات', `طلب بانتظار تعميدك النهائي — ${id}`, cid);

  if ((o.st === 'b2b' || o.st === 'hold') && changed) {
    await notify(['worker', 'ops', 'owner', 'frz', 'frzs'], 'طلبات', `عدّل B2B كميات الطلب ${id} — يستمر التجهيز دون إعادة تعميد`, cid);
  }
  return o.st === 'ops'
    ? (changed ? `عُدّلت الكميات وعُمّد ${id} — أُشعر مقدّم الطلب ومدير المشتريات` : `عُمّد ${id} وأُرسل لمدير المشتريات`)
    : o.st === 'purch'
      ? `التعميد النهائي تم — أُرسل ${id} إلى B2B`
      : (changed ? `عُدّل ${id} وأُشعر العميل` : `لا تغيير على ${id}`);
}

async function ordersReject(ctx, { id, reason }) {
  const { role } = ctx;
  if (!['ops', 'owner', 'frz', 'frzs', 'b2b'].includes(role)) throw httpError(403, 'لا صلاحية للرفض');
  const text = (reason || '').trim();
  if (text.length < 5) throw httpError(400, 'سبب الرفض إلزامي (5 أحرف على الأقل) ويصل نصًا لمقدّم الطلب');
  const o = await getOrder(ctx, id);
  if (['ship', 'done', 'short', 'rej'].includes(o.st)) throw httpError(400, 'لا يمكن رفض طلب خرج للتوصيل أو انتهى');
  if (role === 'ops' && o.st !== 'ops') throw httpError(403, 'رفض مدير العمليات لطلبات مرحلته فقط');
  const rejAt = o.st === 'ops' ? 1 : o.st === 'purch' ? 2 : 4;
  const log = [...o.log, logEntry(ctx, `رفض الطلب — ${text}`)];
  await sql`UPDATE orders SET st = 'rej', reason = ${text}, rej_at = ${rejAt}, log = ${JSON.stringify(log)}, updated_at = now() WHERE id = ${id}`;
  // طلب في يد العمليات: يُطلب الإلغاء هناك (يُفرج الحجز قبل التجهيز، وبعده يلزم قرار ويُبلَّغ الرد)
  if (sentToOps(o)) await emit('sales_order.cancelled', id, { id, reason: text });
  await notify(['worker', 'ops'], 'اعتمادات', `رُفض ${id} — ${text}`, Number(o.client_id) || null);
  return `رُفض ${id} وأُرسل السبب لمقدّم الطلب`;
}

async function ordersHold(ctx, { id, reason }) {
  if (!isB2B(ctx)) throw httpError(403, 'تعليق الطلبات صلاحية B2B');
  const text = (reason || '').trim();
  if (text.length < 5) throw httpError(400, 'سبب التعليق إلزامي — يظهر للعميل نصًا');
  const o = await getOrder(ctx, id);
  if (o.st !== 'b2b') throw httpError(400, 'يُعلَّق الطلب وهو قيد التجهيز لدى B2B فقط');
  opsOwned(o);
  const log = [...o.log, logEntry(ctx, `علّق الطلب — ${text}`)];
  await sql`UPDATE orders SET st = 'hold', hold_reason = ${text}, log = ${JSON.stringify(log)} WHERE id = ${id}`;
  await notify(['worker', 'ops', 'owner', 'frz', 'frzs'], 'طلبات', `علّق B2B الطلب ${id} — ${text}`, Number(o.client_id) || null);
  return `عُلّق ${id} — يظهر السبب للعميل ويمكن الاستئناف`;
}

async function ordersResume(ctx, { id }) {
  if (!isB2B(ctx)) throw httpError(403, 'استئناف الطلبات صلاحية B2B');
  const o = await getOrder(ctx, id);
  opsOwned(o);
  const log = [...o.log, logEntry(ctx, 'استأنف تجهيز الطلب')];
  await sql`UPDATE orders SET st = 'b2b', hold_reason = NULL, log = ${JSON.stringify(log)} WHERE id = ${id} AND st = 'hold'`;
  return `استؤنف تجهيز ${id}`;
}

async function ordersAdvance(ctx, { id }) {
  if (!isB2B(ctx)) throw httpError(403, 'الإرسال للتوصيل صلاحية B2B');
  const o = await getOrder(ctx, id);
  const cid = Number(o.client_id) || null;
  // طلب النواقص التابع يُرسل من حالة التعليق فور توفر أصنافه، وتصدر له فاتورة مستقلة
  if (!(o.st === 'b2b' || (o.backorder && o.st === 'hold'))) throw httpError(400, 'الطلب ليس قيد التجهيز');
  opsOwned(o);
  const stamps = [...o.stamps];
  stamps[4] = nowLabel();
  const log = [...o.log, logEntry(ctx, o.backorder ? 'اعتمد توفر الأصناف وأرسل الطلب للتوصيل بفاتورة مستقلة' : 'أرسل الطلب للتوصيل')];
  await sql`UPDATE orders SET st = 'ship', hold_reason = NULL, stamps = ${JSON.stringify(stamps)}, log = ${JSON.stringify(log)} WHERE id = ${id}`;

  let invMsg = '';
  if (o.backorder) {
    const pm = await productMap();
    const total = o.items.reduce((s, i) => s + (i.price ?? pm[i.pid]?.price ?? 0) * i.qty, 0) * (1 + VAT);
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM invoices`;
    const invId = `INV-${9330 + count}`;
    await sql`INSERT INTO invoices (id, ref, due, amt, rem, st, client_id)
              VALUES (${invId}, ${`${id} — نواقص ${o.parent_ref || ''}`}, 'الاستحقاق 10 أغسطس', ${total}, ${total}, 'unpaid', ${cid})`;
    invMsg = ` وصدرت فاتورته المستقلة ${invId}`;
    await notify(['worker', 'ops', 'owner', 'frz', 'frzs', 'fin'], 'طلبات',
      `توفرت نواقص ${o.parent_ref || ''} — خرج ${id} للتوصيل وصدرت فاتورته ${invId}`, cid);
  } else {
    await notify(['worker'], 'طلبات', `خرج طلبك ${id} للتوصيل — أكّد الاستلام عند وصوله`, cid);
  }
  return `أُرسل ${id} للتوصيل${invMsg}`;
}

async function ordersReceive(ctx, { id, recv }) {
  if (ctx.role !== 'worker') throw httpError(403, 'تأكيد الاستلام لعامل المطعم');
  const o = await getOrder(ctx, id);
  const cid = Number(o.client_id) || null;
  if (o.st !== 'ship') throw httpError(400, 'الطلب ليس قيد التوصيل');
  const pm = await productMap();

  const shorts = o.items.filter((i) => i.qty > 0 && recv?.[i.pid]?.short);
  const stamps = [...o.stamps];
  stamps[5] = nowLabel();
  // إقرار الاستلام يُبلَّغ للعمليات وتُقارن الكميات بإثبات التسليم
  if (sentToOps(o)) {
    const got = (i) => (recv?.[i.pid]?.short ? Math.min(i.qty, Math.max(0, Math.floor(Number(recv[i.pid].recv ?? 0)))) : i.qty);
    await emit('sales_order.received', id, { id, result: shorts.length ? 'short' : 'done',
      lines: o.items.filter((i) => i.qty > 0).map((i) => ({ productId: i.pid, receivedQty: got(i) })) });
  }
  const log = [...o.log, logEntry(ctx, shorts.length ? 'أكّد الاستلام بنواقص وفُتحت تذكرة' : 'أكّد الاستلام الكامل')];
  await sql`UPDATE orders SET log = ${JSON.stringify(log)} WHERE id = ${id}`;
  let msg;

  if (shorts.length) {
    const seq = await nextSeq('ticket');
    const tid = `TKT-${seq}`;
    const recvQty = (i) => Math.min(i.qty, Math.max(0, Math.floor(Number(recv[i.pid].recv ?? 0))));
    const priceOf = (i) => i.price ?? pm[i.pid]?.price ?? 0;
    const val = shorts.reduce((s, i) => s + priceOf(i) * (i.qty - recvQty(i)), 0) * (1 + VAT);
    await sql`INSERT INTO tickets (id, ord, customer, descr, qty, val, st, date_label, client_id)
              VALUES (${tid}, ${id}, ${`${ctx.org} — ${o.branch}`},
                      ${shorts.map((i) => pm[i.pid]?.name || i.pid).join(' · ')},
                      ${`ناقص ${shorts.map((i) => `${i.qty - recvQty(i)} × ${pm[i.pid]?.unit || ''}`).join(' + ')}`},
                      ${val}, 'open', 'الآن', ${cid})`;
    await sql`UPDATE orders SET st = 'short', stamps = ${JSON.stringify(stamps)}, ticket_id = ${tid}, updated_at = now() WHERE id = ${id}`;
    await notify(['b2b'], 'تذاكر', `تذكرة نواقص جديدة ${tid} على ${id}`);
    msg = `أُكّد الاستلام وفُتحت تذكرة نواقص ${tid} — أُرسلت إلى B2B لحلّها`;
  } else {
    await sql`UPDATE orders SET st = 'done', stamps = ${JSON.stringify(stamps)}, updated_at = now() WHERE id = ${id}`;
    msg = `تم تأكيد استلام ${id} بالكامل`;
  }
  return msg;
}

// ============ التذاكر ============

async function ticketOf(id) {
  const [t] = await sql`SELECT * FROM tickets WHERE id = ${id}`;
  if (!t) throw httpError(404, 'التذكرة غير موجودة');
  return t;
}

async function ticketsResolve(ctx, { id }) {
  if (!isB2B(ctx)) throw httpError(403, 'تسوية التذاكر صلاحية B2B');
  const t = await ticketOf(id);
  if (t.st === 'resolved') throw httpError(400, 'التذكرة مقفلة مسبقًا');
  const cid = Number(t.client_id) || null;
  if (cid == null) throw httpError(400, 'التذكرة غير مرتبطة بمنشأة — لا يمكن إصدار إشعار دائن');
  const seq = await nextSeq('cn');
  const cn = `CN-${seq}`;
  const val = Number(t.val);
  await sql`UPDATE tickets SET st = 'resolved', cn = ${cn}, hold_reason = NULL WHERE id = ${id}`;
  await sql`INSERT INTO invoices (id, ref, due, amt, rem, st, client_id) VALUES (${cn}, ${`نواقص ${t.ord}`}, 'إشعار دائن', ${-val}, 0, 'credit', ${cid})`;
  await walletMove(cid, val, `إشعار دائن ${cn} — تسوية ${id}`);
  await notify(['worker', 'ops', 'owner', 'frz', 'frzs', 'fin'], 'مالية', `حُلّت تذكرة النواقص ${id} — صدر إشعار دائن ${cn} بقيمة ${fmt(val)} ر.س في محفظتك`, cid);
  return `صدر إشعار دائن ${cn} بقيمة ${fmt(val)} ر.س وأُقفلت ${id}`;
}

async function ticketsHold(ctx, { id, reason }) {
  if (!isB2B(ctx)) throw httpError(403, 'تعليق التذاكر صلاحية B2B');
  const text = (reason || '').trim();
  if (text.length < 5) throw httpError(400, 'سبب التعليق إلزامي');
  const t = await ticketOf(id);
  await sql`UPDATE tickets SET st = 'held', hold_reason = ${text} WHERE id = ${id} AND st = 'open'`;
  await notify(['worker', 'ops', 'owner', 'frz', 'frzs', 'fin'], 'تذاكر', `علّق B2B تذكرة النواقص ${id} — السبب: ${text}`, Number(t.client_id) || null);
  return `عُلّقت التذكرة ${id} — أُشعر العميل بالسبب`;
}

async function ticketsResume(ctx, { id }) {
  if (!isB2B(ctx)) throw httpError(403, 'استئناف التذاكر صلاحية B2B');
  await sql`UPDATE tickets SET st = 'open', hold_reason = NULL WHERE id = ${id} AND st = 'held'`;
  return `استؤنفت التذكرة ${id}`;
}

// ============ المحفظة والفواتير ============

async function walletTopup(ctx, { amt, method, proof }) {
  if (!['owner', 'fin', 'frz', 'frzs', 'fr'].includes(ctx.role)) throw httpError(403, 'شحن المحفظة للمالك والمالية');
  const cid = myClient(ctx);
  const amount = Math.floor(Number(amt));
  if (!(amount >= 500 && amount <= 1_000_000)) throw httpError(400, 'مبلغ غير صالح');
  await assertWalletActive(cid);

  // التحويل البنكي: صورة الحوالة إلزامية، ويذهب الطلب لتعميد B2B قبل إضافة المبلغ
  if (method === 'تحويل بنكي') {
    if (!proof) throw httpError(400, 'أرفق صورة الحوالة أولًا — إلزامية للتحويل البنكي');
    const seq = await nextSeq('tu');
    const id = `TU-${seq}`;
    await sql`INSERT INTO topup_reqs (id, org, by_user, amt, proof, date_label, client_id)
              VALUES (${id}, ${ctx.org}, ${ctx.name}, ${amount}, ${`حوالة-${seq}.jpg`}, 'الآن', ${cid})`;
    await notify(['b2b'], 'مالية', `طلب شحن محفظة بتحويل بنكي ${id} — ${fmt0(amount)} ر.س من ${ctx.org}`);
    return `أُرسل طلب الشحن ${id} — تضاف ${fmt0(amount)} ر.س فور تعميد B2B للتحويل`;
  }

  await walletMove(cid, amount, 'شحن المحفظة — مدى');
  return `تم شحن ${fmt0(amount)} ر.س فورًا — صدر إيصال PDF`;
}

// ============ التعميدات المالية (B2B) ============

async function fintuApprove(ctx, { id }) {
  if (!isB2B(ctx)) throw httpError(403, 'تعميد التحويلات صلاحية B2B');
  const [r] = await sql`SELECT * FROM topup_reqs WHERE id = ${id}`;
  if (!r) throw httpError(404, 'طلب الشحن غير موجود');
  if (r.client_id == null) throw httpError(400, 'طلب الشحن غير مرتبط بمنشأة');
  const amount = Number(r.amt);
  const cid = Number(r.client_id);
  // الحذف أولًا وبشرط وجود الصف: تعميد مزدوج لا يضيف المبلغ مرتين
  const gone = await sql`DELETE FROM topup_reqs WHERE id = ${id} RETURNING id`;
  if (!gone.length) throw httpError(409, 'طلب الشحن عُولج مسبقًا');
  await walletMove(cid, amount, 'شحن المحفظة — تحويل بنكي (عمّده B2B)');
  await notify(['owner', 'fin', 'frz', 'frzs', 'fr'], 'مالية', `عمّد B2B التحويل البنكي ${id} — أُضيفت ${fmt0(amount)} ر.س للمحفظة`, cid);
  return `عُمّد التحويل ${id} وأُضيف المبلغ إلى محفظة ${r.org}`;
}

async function fintuReject(ctx, { id }) {
  if (!isB2B(ctx)) throw httpError(403, 'رفض التحويلات صلاحية B2B');
  const [r] = await sql`SELECT * FROM topup_reqs WHERE id = ${id}`;
  if (!r) throw httpError(404, 'طلب الشحن غير موجود');
  await sql`DELETE FROM topup_reqs WHERE id = ${id}`;
  await notify(['owner', 'fin', 'frz', 'frzs', 'fr'], 'مالية', `رفض B2B التحويل البنكي ${id} — لم يصل المبلغ للحساب البنكي، تواصلوا مع الدعم`, Number(r.client_id) || null);
  return `رُفض التحويل ${id} وأُشعر العميل`;
}

async function invoicesPay(ctx, { id }) {
  if (!['owner', 'fin', 'frz', 'frzs', 'fr'].includes(ctx.role)) throw httpError(403, 'السداد للمالك والمالية');
  const cid = myClient(ctx);
  const [v] = await sql`SELECT * FROM invoices WHERE id = ${id}`;
  if (!v || Number(v.client_id) !== cid) throw httpError(404, 'الفاتورة غير موجودة');
  if (!['unpaid', 'part'].includes(v.st)) throw httpError(400, 'الفاتورة ليست مستحقة');
  await assertWalletActive(cid);
  const rem = Number(v.rem);
  const w = await walletOf(cid);
  if (Number(w.bal) < rem) throw httpError(400, 'رصيد المحفظة لا يكفي لسداد الفاتورة');
  const paid = await sql`UPDATE invoices SET st = 'paid', rem = 0, due = 'سُددت الآن' WHERE id = ${id} AND st IN ('unpaid', 'part') RETURNING id`;
  if (!paid.length) throw httpError(409, 'الفاتورة سُددت مسبقًا');
  await walletMove(cid, -rem, `سداد فاتورة ${id} من المحفظة`);
  return `سُددت ${id} من المحفظة — الرصيد الجديد ${fmt(Number(w.bal) - rem)} ر.س`;
}

// ============ اللستات والاقتراحات ============

async function listsSave(ctx, { name, items }) {
  const n = (name || '').trim();
  if (!n) throw httpError(400, 'اكتب اسم اللستة أولًا');
  if (!Array.isArray(items) || !items.length) throw httpError(400, 'أضف صنفًا واحدًا على الأقل');
  await sql`INSERT INTO saved_lists (name, items, client_id) VALUES (${n.slice(0, 80)}, ${JSON.stringify(items.slice(0, 200))}, ${ctx.clientId})`;
  return `حُفظت لستة «${n}» — تجدها فوق الكتالوج`;
}

async function reqsSubmit(ctx, { name, unit, note }) {
  if (!['owner', 'fr'].includes(ctx.role)) throw httpError(403, 'اقتراح المنتجات للمالك أو المانح');
  const cid = myClient(ctx);
  const n = (name || '').trim();
  if (!n) throw httpError(400, 'اكتب اسم المنتج المطلوب أولًا');
  const seq = await nextSeq('req');
  const id = `REQ-${seq}`;
  await sql`INSERT INTO prod_reqs (id, name, unit, by_org, by_user, note, date_label, st, client_id)
            VALUES (${id}, ${n}, ${(unit || '').trim()}, ${ctx.role === 'fr' ? `${ctx.org} — المانح` : ctx.org},
                    ${ctx.name}, ${(note || '').trim() || '—'}, 'الآن', 'pend', ${cid})`;
  await notify(['b2b'], 'اعتمادات', `اقتراح منتج جديد ${id} — «${n}» من ${ctx.org}`);
  return `أُرسل اقتراحك ${id} لفريق B2B — يراجعه ويسعّره خلال يوم عمل`;
}

async function reqOf(id) {
  const [r] = await sql`SELECT * FROM prod_reqs WHERE id = ${id}`;
  if (!r) throw httpError(404, 'الاقتراح غير موجود');
  return r;
}

/** اقتراح يخص منشأة الجلسة (أو أي اقتراح لـ B2B) */
async function myReq(ctx, id) {
  const r = await reqOf(id);
  if (!isB2B(ctx) && Number(r.client_id) !== ctx.clientId) throw httpError(404, 'الاقتراح غير موجود');
  return r;
}

/** B2B يسعّر الاقتراح ويعيده للعميل لاعتماد السعر قبل الإضافة */
async function reqsPrice(ctx, { id, price }) {
  if (!isB2B(ctx)) throw httpError(403, 'تسعير الاقتراحات صلاحية B2B');
  const p = Number(price);
  if (!(p > 0 && p <= 100000)) throw httpError(400, 'سعر غير صالح');
  const r = await reqOf(id);
  if (!['pend', 'priced'].includes(r.st)) throw httpError(400, 'الاقتراح مغلق — لا يُسعَّر');
  await sql`UPDATE prod_reqs SET st = 'priced', price = ${p} WHERE id = ${id}`;
  await notify(['owner', 'fin', 'frz', 'frzs', 'fr'], 'اعتمادات',
    `سعّر B2B اقتراحك «${r.name}» بـ ${fmt(p)} ر.س — بانتظار اعتمادك`, Number(r.client_id) || null);
  return `سُعّر «${r.name}» وأُرسل للعميل للاعتماد`;
}

/** العميل يعتمد السعر المقترح — يُضاف المنتج للكتالوج بالسعر المتفق عليه */
async function reqsClientAccept(ctx, { id }) {
  if (!['owner', 'fr', 'frz', 'frzs'].includes(ctx.role)) throw httpError(403, 'اعتماد السعر لمقدّم الاقتراح');
  const cid = myClient(ctx);
  const r = await myReq(ctx, id);
  if (r.st !== 'priced') throw httpError(400, 'الاقتراح ليس بانتظار اعتماد السعر');

  // طلب سلة (v6): تنزل كل المنتجات في كتالوج العميل الخاص بالأسعار المتفق عليها
  if (r.kind === 'cat') {
    for (const it of r.items || []) {
      if (it.price == null) continue;
      await sql`INSERT INTO client_products (client_id, pid, price) VALUES (${cid}, ${it.pid}, ${Number(it.price)})
                ON CONFLICT (client_id, pid) DO UPDATE SET price = ${Number(it.price)}`;
    }
    await sql`UPDATE prod_reqs SET st = 'ok' WHERE id = ${id}`;
    await notify(['b2b'], 'اعتمادات', `اعتمد العميل أسعار طلب الإضافة ${id} — نزلت المنتجات في كتالوجه الخاص`);
    return `اعتمدت الأسعار — نزلت ${(r.items || []).length} منتجات في «منتجاتي» بأسعارك الخاصة`;
  }

  const [{ count }] = await sql`SELECT count(*)::int AS count FROM products`;
  const pid = `P-6${String(count).padStart(3, '0')}`;
  await sql`INSERT INTO products (id, name, unit, cat, price, h, img)
            VALUES (${pid}, ${r.name}, ${r.unit || 'حبة'}, 'مواد غذائية', ${Number(r.price) || 64}, 210, '')`;
  await sql`UPDATE prod_reqs SET st = 'ok' WHERE id = ${id}`;
  await notify(['b2b'], 'اعتمادات', `اعتمد العميل تسعير «${r.name}» — أُضيف للكتالوج`);
  return `اعتمدت السعر — أُضيف «${r.name}» في منتجاتي فورًا`;
}

// ============ سلة الإضافة من الكتالوج (v6) ============

/** العميل يرسل سلة منتجات من كتالوج B2B كطلب إضافة واحد */
async function reqsBktSend(ctx, { pids }) {
  if (!['owner', 'frz', 'frzs'].includes(ctx.role)) throw httpError(403, 'طلب الإضافة لمدير حساب المنشأة');
  if (!Array.isArray(pids) || !pids.length) throw httpError(400, 'السلة فارغة — أضف منتجات من كتالوج B2B أولًا');
  const cid = myClient(ctx);
  const pm = await productMap();

  // استبعاد ما هو ضمن كتالوج العميل مسبقًا أو ضمن طلب إضافة مفتوح
  const mine = new Set((await sql`SELECT pid FROM client_products WHERE client_id = ${cid}`).map((x) => x.pid));
  const open = await sql`SELECT items FROM prod_reqs WHERE kind = 'cat' AND client_id = ${cid} AND st IN ('pend', 'priced')`;
  for (const o of open) for (const it of o.items || []) mine.add(it.pid);
  const clean = [...new Set(pids)].filter((p) => pm[p] && !mine.has(p));
  if (!clean.length) throw httpError(400, 'كل منتجات السلة ضمن كتالوجك أو بطلب سابق بانتظار B2B');

  const seq = await nextSeq('req');
  const id = `REQ-${seq}`;
  const names = clean.slice(0, 3).map((p) => pm[p].name).join('، ');
  await sql`INSERT INTO prod_reqs (id, name, unit, by_org, by_user, note, date_label, st, kind, items, client_id)
            VALUES (${id}, ${`طلب إضافة من الكتالوج — ${clean.length} منتجات`}, '', ${ctx.org}, ${ctx.name},
                    ${`${names}${clean.length > 3 ? '…' : ''}`}, 'الآن', 'pend', 'cat',
                    ${JSON.stringify(clean.map((p) => ({ pid: p })))}, ${cid})`;
  await notify(['b2b'], 'اعتمادات', `طلب إضافة من الكتالوج ${id} — ${clean.length} منتجات من ${ctx.org} بانتظار تسعيرك`);
  return `أُرسل طلب الإضافة ${id} (${clean.length} منتجات) — يسعّره B2B ثم تعتمد الأسعار لتنزل في منتجاتك`;
}

/** B2B يسعّر كل منتج في طلب السلة ويعيده للعميل للاعتماد */
async function reqsRcpConfirm(ctx, { id, prices }) {
  if (!isB2B(ctx)) throw httpError(403, 'تسعير طلبات الإضافة صلاحية B2B');
  const r = await reqOf(id);
  if (r.kind !== 'cat') throw httpError(400, 'هذا ليس طلب إضافة من الكتالوج');
  const pm = await productMap();
  const items = (r.items || []).filter((it) => pm[it.pid]).map((it) => {
    const p = Number(prices?.[it.pid]);
    const val = p > 0 && p <= 100000 ? Math.round(p * 100) / 100 : Math.round(pm[it.pid].price * (1 - 0.05) * 100) / 100;
    return { pid: it.pid, price: val };
  });
  await sql`UPDATE prod_reqs SET st = 'priced', items = ${JSON.stringify(items)} WHERE id = ${id}`;
  await notify(['owner', 'fin', 'frz', 'frzs', 'fr'], 'اعتمادات', `سعّر B2B طلب الإضافة ${id} — راجع الأسعار الخاصة واعتمدها لتنزل في منتجاتك`, Number(r.client_id) || null);
  return `أُرسلت الأسعار الخاصة لطلب ${id} للعميل للاعتماد`;
}

async function reqsClientDecline(ctx, { id }) {
  if (!['owner', 'fr', 'frz', 'frzs'].includes(ctx.role)) throw httpError(403, 'رفض السعر لمقدّم الاقتراح');
  const r = await myReq(ctx, id);
  if (r.st !== 'priced') throw httpError(400, 'الاقتراح ليس بانتظار اعتماد السعر');
  await sql`UPDATE prod_reqs SET st = 'no' WHERE id = ${id}`;
  await notify(['b2b'], 'اعتمادات', `رفض العميل تسعير «${r.name}» (${fmt(Number(r.price) || 0)} ر.س) — أُغلق الاقتراح`);
  return 'رفضت السعر — وصل الإشعار لفريق B2B';
}

async function reqsReject(ctx, { id }) {
  if (!isB2B(ctx)) throw httpError(403, 'رفض الاقتراحات صلاحية B2B');
  const r = await reqOf(id);
  await sql`UPDATE prod_reqs SET st = 'no' WHERE id = ${id}`;
  await notify(['owner', 'fin', 'frz', 'frzs', 'fr'], 'اعتمادات', `اعتذر B2B عن الاقتراح «${r.name}»`, Number(r.client_id) || null);
  return 'رُفض الاقتراح وأُشعر العميل';
}

// ============ الفرنشايز ============

/** ينشئ عميلًا جديدًا ومحفظته الافتتاحية؛ يعيد المعرّف */
async function newClient({ name, cr, city, type = null }) {
  const id = Date.now();
  await sql`INSERT INTO clients (id, name, cr, city, st, bal, cr_limit, used, wst, branches, staff, type)
            VALUES (${id}, ${name}, ${cr}, ${city || '—'}, 'ok', 0, 20000, 0, 'ok', '[]', '[]', ${type})`;
  return id;
}

async function frsCreate(ctx, { name, cr, kind, region }) {
  const { role } = ctx;
  if (!['fr', 'frzs', 'b2b'].includes(role)) throw httpError(403, 'إنشاء الممنوحين للمانح أو السوبر');
  const n = (name || '').trim(), c = (cr || '').trim();
  if (!n || !c) throw httpError(400, 'أدخل اسم المنشأة ورقم السجل التجاري');
  const isSuper = role === 'fr' && kind === 'super';
  const reg = (region || '').trim();
  if (isSuper && !reg) throw httpError(400, 'حدد منطقة امتياز الممنوح السوبر');
  let parent = null; let granter = null; let city = isSuper ? reg : '—';
  if (role === 'frzs') {
    // السوبر ينشئ تابعًا له: الأب = سجله في الشبكة، والمانح = مانحه
    const [mine] = await sql`SELECT id, granter_id, region FROM frs WHERE client_id = ${myClient(ctx)}`;
    if (!mine) throw httpError(403, 'حسابك غير مسجّل كممنوح سوبر');
    parent = Number(mine.id); granter = mine.granter_id == null ? null : Number(mine.granter_id); city = mine.region || '—';
  } else if (role === 'fr') {
    granter = myClient(ctx);
  }
  const id = await newClient({ name: n, cr: c, city: '—', type: isSuper ? 'ممنوح سوبر' : 'ممنوح بيسك' });
  await sql`INSERT INTO frs (id, name, city, cr, st, active, parent, super, region, client_id, granter_id)
            VALUES (${id}, ${n}, ${city}, ${c}, 'new', true, ${parent}, ${isSuper}, ${isSuper ? reg : null}, ${id}, ${granter})`;
  await notify(['b2b'], 'اعتمادات', `ممنوح جديد «${n}» بانتظار تعميدك — أنشأه ${ctx.org}`);
  return isSuper
    ? `أُنشئ ممنوح سوبر لمنطقة «${reg}» — تعميده وتفعيله بيد B2B أدمن`
    : 'أُنشئ الممنوح — تعميده وتفعيله بيد B2B أدمن';
}

async function frsApprove(ctx, { id }) {
  if (!isB2B(ctx)) throw httpError(403, 'تعميد الممنوحين وتفعيلهم حصريًا بيد B2B');
  const [f] = await sql`SELECT name FROM frs WHERE id = ${id}`;
  if (!f) throw httpError(404, 'الممنوح غير موجود');
  await sql`UPDATE frs SET st = 'ok' WHERE id = ${id}`;
  return `عمّد B2B الممنوح «${f.name}» — فُعّل حسابه وأُنشئت محفظته المستقلة`;
}

async function frsToggle(ctx, { id }) {
  if (!['fr', 'b2b'].includes(ctx.role)) throw httpError(403, 'لا صلاحية');
  const [f] = await sql`SELECT name, active, granter_id FROM frs WHERE id = ${id}`;
  if (!f || (!isB2B(ctx) && Number(f.granter_id) !== ctx.clientId)) throw httpError(404, 'الممنوح غير موجود');
  await sql`UPDATE frs SET active = ${!f.active} WHERE id = ${id}`;
  return f.active ? `أُوقف حساب ${f.name}` : `أُعيد تفعيل ${f.name}`;
}

async function frsAddSub(ctx, { clientId, name, cr }) {
  if (!['b2b', 'fr'].includes(ctx.role)) throw httpError(403, 'لا صلاحية');
  const sid = await assertClientAccess(ctx, clientId, { network: true });
  const [parent] = await sql`SELECT id, region, granter_id FROM frs WHERE client_id = ${sid} AND super = true`;
  if (!parent) throw httpError(400, 'هذا العميل ليس ممنوحًا سوبر');
  const n = (name || '').trim(), c = (cr || '').trim();
  if (!n || !c) throw httpError(400, 'أدخل اسم منشأة الممنوح التابع ورقم سجله التجاري');
  const id = await newClient({ name: n, cr: c, city: parent.region || '—', type: 'ممنوح بيسك' });
  await sql`INSERT INTO frs (id, name, city, cr, st, active, parent, client_id, granter_id)
            VALUES (${id}, ${n}, ${parent.region || '—'}, ${c}, 'new', true, ${parent.id}, ${id}, ${parent.granter_id})`;
  return `أُنشئ الممنوح التابع «${n}» ضمن ${parent.region || 'منطقة السوبر'} — تعميده وتفعيله بيد B2B أدمن`;
}

// ============ العملاء (B2B) ============

async function clientsToggleAccount(ctx, { id }) {
  if (!isB2B(ctx)) throw httpError(403, 'إيقاف العملاء صلاحية B2B');
  const c = await clientRow(id);
  const susp = c.st === 'susp';
  await sql`UPDATE clients SET st = ${susp ? 'ok' : 'susp'} WHERE id = ${id}`;
  return susp ? `أُعيد تفعيل ${c.name}` : `أُوقف ${c.name} — لا يستطيع الطلب حتى إعادة التفعيل`;
}

async function clientsToggleWallet(ctx, { id }) {
  if (!isB2B(ctx)) throw httpError(403, 'تجميد المحافظ صلاحية B2B');
  const c = await clientRow(id);
  const frozen = c.wst === 'frozen';
  await sql`UPDATE clients SET wst = ${frozen ? 'ok' : 'frozen'} WHERE id = ${id}`;
  return frozen ? `فُك تجميد محفظة ${c.name}` : `جُمّدت محفظة ${c.name} — لا شحن ولا صرف حتى فك التجميد`;
}

/**
 * فروع عميل من ملفه (B2B، أو المانح/السوبر لشبكته): القائمة المرسلة تصبح فروعه — يُضاف الجديد ويُزال المحذوف.
 * الحسابات تُدار بأوامر users.* (لم تعد قائمة أسماء داخل سجل العميل).
 */
async function clientsPatch(ctx, { id, branches }, msg) {
  if (!['b2b', 'fr', 'frzs'].includes(ctx.role)) throw httpError(403, 'لا صلاحية');
  const cid = await assertClientAccess(ctx, id, { network: true });
  const c = await clientRow(cid);
  if (Array.isArray(branches)) {
    const want = branches.filter((b) => b && String(b.name || '').trim()).slice(0, 200)
      .map((b) => ({ name: String(b.name).trim().slice(0, 80), city: String(b.city || c.city || '—').slice(0, 60), loc: b.loc || null }));
    const names = want.map((b) => b.name);
    const have = await sql`SELECT name FROM branches WHERE client_id = ${cid}`;
    for (const h of have) if (!names.includes(h.name)) await sql`DELETE FROM branches WHERE client_id = ${cid} AND name = ${h.name}`;
    for (const b of want) {
      await sql`INSERT INTO branches (client_id, name, city, st, loc) VALUES (${cid}, ${b.name}, ${b.city}, 'ok', ${b.loc ? JSON.stringify(b.loc) : null})
                ON CONFLICT (client_id, name) DO NOTHING`;
    }
  }
  return msg || 'تم التحديث';
}

/** أنواع العملاء الأربعة في المنصة */
const CLIENT_TYPES = ['مستقل', 'مانح', 'ممنوح بيسك', 'ممنوح سوبر'];

/** B2B ينشئ عميلًا جديدًا مكتمل النوع (من لوحة العملاء أو باعتماد طلب تسجيل) */
async function clientsCreate(ctx, { name, cr, city, type, granterId, region }) {
  if (!isB2B(ctx)) throw httpError(403, 'إنشاء العملاء صلاحية B2B');
  const n = (name || '').trim(), c = (cr || '').trim();
  if (!n || !c) throw httpError(400, 'أدخل اسم المنشأة ورقم السجل التجاري');
  const ty = CLIENT_TYPES.includes(type) ? type : 'مستقل';
  if (ty === 'ممنوح سوبر' && !(region || '').trim()) throw httpError(400, 'حدد منطقة امتياز الممنوح السوبر');

  const id = await newClient({ name: n, cr: c, city: (city || '').trim() || '—', type: ty });
  if (ty !== 'مستقل' && ty !== 'مانح') {
    // granterId = عميل المانح الذي اختير في نافذة الإنشاء
    await sql`INSERT INTO frs (id, name, city, cr, st, active, super, region, client_id, granter_id)
              VALUES (${id}, ${n}, ${(city || '').trim() || '—'}, ${c}, 'new', true,
                      ${ty === 'ممنوح سوبر'}, ${ty === 'ممنوح سوبر' ? (region || '').trim() : null}, ${id}, ${Number(granterId) || null})`;
  }
  return `أُنشئ العميل «${n}» من نوع ${ty} — أنشئ حساب مدير المنشأة من ملفه ليستطيع الدخول`;
}

// ============ كتالوج العميل الخاص (أسعار متفق عليها) ============

/** خصم الاتفاق الافتراضي عند إضافة منتج لكتالوج عميل */
const AGREEMENT_DISC = 0.05;

async function clientsProdAdd(ctx, { id, pid }) {
  if (!isB2B(ctx)) throw httpError(403, 'كتالوج العملاء صلاحية B2B');
  const [p] = await sql`SELECT name, price::float FROM products WHERE id = ${pid}`;
  if (!p) throw httpError(404, 'المنتج غير موجود');
  await clientRow(id);
  const price = Math.round(p.price * (1 - AGREEMENT_DISC) * 100) / 100;
  await sql`INSERT INTO client_products (client_id, pid, price) VALUES (${id}, ${pid}, ${price})
            ON CONFLICT (client_id, pid) DO NOTHING`;
  return `أُضيف «${p.name}» لكتالوج العميل بسعر اتفاق ${fmt(price)} ر.س (خصم ٥٪)`;
}

async function clientsProdStep(ctx, { id, pid, delta }) {
  if (!isB2B(ctx)) throw httpError(403, 'كتالوج العملاء صلاحية B2B');
  const d = Number(delta) > 0 ? 0.5 : -0.5;
  const [row] = await sql`UPDATE client_products SET price = GREATEST(0.5, price + ${d})
                          WHERE client_id = ${id} AND pid = ${pid} RETURNING price::float`;
  if (!row) throw httpError(404, 'المنتج ليس في كتالوج العميل');
  return `سعر العميل الخاص الآن ${fmt(row.price)} ر.س`;
}

async function clientsProdDel(ctx, { id, pid }) {
  if (!isB2B(ctx)) throw httpError(403, 'كتالوج العملاء صلاحية B2B');
  await sql`DELETE FROM client_products WHERE client_id = ${id} AND pid = ${pid}`;
  return 'حُذف المنتج من كتالوج العميل — يعود لسعر الكتالوج الأساسي';
}

// ============ العملاء الجدد (طلبات «سجّل منشأتك») ============

async function ncApprove(ctx, { id }) {
  if (!isB2B(ctx)) throw httpError(403, 'اعتماد المنشآت الجديدة صلاحية B2B');
  const [r] = await sql`SELECT * FROM new_clients WHERE id = ${id}`;
  if (!r) throw httpError(404, 'طلب التسجيل غير موجود');
  if (r.st !== 'pend') throw httpError(400, 'الطلب ليس قيد المراجعة');
  const ty = CLIENT_TYPES.includes(r.model) ? r.model : 'مستقل';
  const cid = await newClient({ name: r.name, cr: r.cr || `CR-${id}`, city: r.city || '—', type: ty });
  await sql`UPDATE new_clients SET st = 'ok', client_id = ${cid} WHERE id = ${id}`;
  await notify(['b2b'], 'اعتمادات', `اعتُمدت منشأة «${r.name}» (${id}) وأُنشئ حسابها كعميل ${ty}`);
  return `اعتُمدت «${r.name}» — أُنشئ حساب العميل وحدّه الائتماني الافتتاحي 20,000 ر.س؛ أنشئ حساب مديرها من ملف العميل`;
}

async function ncReject(ctx, { id }) {
  if (!isB2B(ctx)) throw httpError(403, 'رفض المنشآت الجديدة صلاحية B2B');
  const [r] = await sql`SELECT name, st FROM new_clients WHERE id = ${id}`;
  if (!r) throw httpError(404, 'طلب التسجيل غير موجود');
  if (r.st !== 'pend') throw httpError(400, 'الطلب ليس قيد المراجعة');
  await sql`UPDATE new_clients SET st = 'no' WHERE id = ${id}`;
  return `رُفض طلب تسجيل «${r.name}» — أُشعر مسؤول الحساب`;
}

// ============ مصفوفة الأنواع واليوزرات (إصدارات منشورة) ============

/** دورة علامات الخلية: ممكّن → جزئي → مدير → غير متاح */
const RM_MARKS = ['on', 'part', 'admin', 'off'];

async function rmDraftRow() {
  const [d] = await sql`SELECT * FROM roles_matrix WHERE draft = true ORDER BY id DESC LIMIT 1`;
  return d;
}

async function rolesSet(ctx, { row, col }) {
  if (!isB2B(ctx)) throw httpError(403, 'تعديل مصفوفة الصلاحيات صلاحية B2B');
  const r = Number(row), c = Number(col);
  if (!(r >= 0 && r < 4 && c >= 0 && c < 8)) throw httpError(400, 'خلية غير صالحة');
  let draft = await rmDraftRow();
  if (!draft) {
    const [cur] = await sql`SELECT * FROM roles_matrix WHERE cur = true ORDER BY id DESC LIMIT 1`;
    if (!cur) throw httpError(400, 'لا يوجد إصدار منشور للبناء عليه');
    const nextVer = `${cur.ver.split('.')[0]}.${Number(cur.ver.split('.')[1] || 0) + 1}`;
    const [d] = await sql`INSERT INTO roles_matrix (ver, note, meta, cells, draft)
                          VALUES (${nextVer}, 'مسودة قيد التحرير', ${`مسودة على أساس v${cur.ver}`}, ${JSON.stringify(cur.cells)}, true)
                          RETURNING *`;
    draft = d;
  }
  const cells = draft.cells;
  cells[r][c] = RM_MARKS[(RM_MARKS.indexOf(cells[r][c]) + 1) % RM_MARKS.length];
  await sql`UPDATE roles_matrix SET cells = ${JSON.stringify(cells)} WHERE id = ${draft.id}`;
  return 'عُدّلت الخلية في المسودة — انشر الإصدار ليسري على الحسابات';
}

async function rolesPublish(ctx, { note }) {
  if (!isB2B(ctx)) throw httpError(403, 'نشر الإصدارات صلاحية B2B');
  const draft = await rmDraftRow();
  if (!draft) throw httpError(400, 'لا توجد مسودة للنشر — عدّل خلية أولًا');
  await sql`UPDATE roles_matrix SET cur = false WHERE cur = true`;
  await sql`UPDATE roles_matrix SET cur = true, draft = false,
            note = ${(note || '').trim() || 'تحديث صلاحيات الأنواع'},
            meta = ${`نُشر ${nowLabel()} — فريق B2B`} WHERE id = ${draft.id}`;
  await notify(['owner', 'ops', 'fr', 'frz', 'frzs'], 'اعتمادات', `نُشر إصدار جديد v${draft.ver} من مصفوفة الأنواع والصلاحيات — يسري فورًا`);
  return `نُشر الإصدار v${draft.ver} — سرت الصلاحيات على كل الحسابات`;
}

async function rolesDiscard(ctx) {
  if (!isB2B(ctx)) throw httpError(403, 'إدارة المسودات صلاحية B2B');
  await sql`DELETE FROM roles_matrix WHERE draft = true`;
  return 'أُهملت المسودة — عاد الإصدار المنشور كما هو';
}

// ============ الأجل والمهلة وملفات التحصيل (v7) ============

const COL_STAGES = ['تواصل ودي', 'مطالبة رسمية', 'إنذار نهائي', 'تجميد الائتمان', 'إحالة قانونية'];
const FINREQ_ROLES = ['owner', 'fin', 'frz', 'frzs'];

/** ملف تحصيل ضمن نطاق الجلسة (ملف منشأتي، أو أي ملف لـ B2B) */
async function getColFile(ctx, id) {
  const [f] = await sql`SELECT * FROM col_files WHERE id = ${id}`;
  if (!f || (!isB2B(ctx) && Number(f.client_id) !== ctx.clientId)) throw httpError(404, 'ملف التحصيل غير موجود');
  return f;
}

function colLog(f, txt) {
  return [...(f.log || []), { t: txt, d: `اليوم ${nowLabel()}` }];
}

/** العميل يطلب أجل سداد بمبلغ ومدة */
async function finreqsAjel(ctx, { amt, months, note }) {
  if (!FINREQ_ROLES.includes(ctx.role)) throw httpError(403, 'طلب الأجل لمدير حساب المنشأة أو ماليتها');
  const amount = Math.floor(Number(amt));
  const m = Math.floor(Number(months));
  if (!(amount >= 1000 && amount <= 5_000_000)) throw httpError(400, 'أدخل مبلغ أجل صالحًا (1,000 ر.س فأكثر)');
  if (![1, 2, 3].includes(m)) throw httpError(400, 'اختر مدة الأجل: شهر أو شهران أو ثلاثة');
  const cid = myClient(ctx);
  const seq = await nextSeq('frq');
  const id = `FRQ-${seq}`;
  await sql`INSERT INTO fin_reqs (id, client_id, kind, amt, months, note, st)
            VALUES (${id}, ${cid}, 'ajel', ${amount}, ${m}, ${(note || '').trim()}, 'pend')`;
  await notify(['b2b'], 'مالية', `طلب أجل ${id} — ${fmt0(amount)} ر.س لمدة ${m === 1 ? 'شهر' : m === 2 ? 'شهرين' : '3 أشهر'} من ${ctx.org}`);
  return `أُرسل طلب الأجل ${id} لفريق B2B — عند الموافقة يُفتح دين آجل باستحقاق محدد`;
}

/** العميل يطلب مهلة/تأجيل سداد على ملف تحصيل قائم */
async function finreqsDelay(ctx, { fileId, date, note }) {
  if (!FINREQ_ROLES.includes(ctx.role)) throw httpError(403, 'طلب المهلة لمدير حساب المنشأة أو ماليتها');
  const f = await getColFile(ctx, fileId);
  if (f.st !== 'open') throw httpError(400, 'الملف مغلق — لا مهل عليه');
  if ((f.due_hist || []).length >= 5) throw httpError(400, 'استُنفدت الجدولة (5/5) — لا يمكن طلب مهلة إضافية');
  const d = (date || '').trim();
  if (!d) throw httpError(400, 'اختر التاريخ المقترح من التقويم');
  const seq = await nextSeq('frq');
  const id = `FRQ-${seq}`;
  await sql`INSERT INTO fin_reqs (id, client_id, kind, to_date, note, st, file_id)
            VALUES (${id}, ${Number(f.client_id)}, 'delay', ${d}, ${(note || '').trim()}, 'pend', ${fileId})`;
  await sql`UPDATE col_files SET log = ${JSON.stringify(colLog(f, `طلب العميل مهلة سداد حتى ${d} — بانتظار قرار B2B (${id})`))} WHERE id = ${fileId}`;
  await notify(['b2b'], 'مالية', `طلب مهلة ${id} على ملف التحصيل ${fileId} حتى ${d} — بانتظار قرارك`);
  return `أُرسل طلب المهلة ${id} — يجمّد B2B التصعيد حتى التاريخ المقترح عند الموافقة`;
}

/** العميل يسجل وعد سداد بتاريخ — يُقيد فورًا ويُراقب */
async function finreqsPromise(ctx, { fileId, date, amt }) {
  if (!FINREQ_ROLES.includes(ctx.role)) throw httpError(403, 'وعد السداد لمدير حساب المنشأة أو ماليتها');
  const f = await getColFile(ctx, fileId);
  if (f.st !== 'open') throw httpError(400, 'الملف مغلق');
  const d = (date || '').trim();
  const amount = Math.floor(Number(amt));
  if (!d) throw httpError(400, 'اختر تاريخ الوعد من التقويم');
  if (!(amount > 0)) throw httpError(400, 'أدخل المبلغ الموعود');
  const seq = await nextSeq('frq');
  const id = `FRQ-${seq}`;
  await sql`INSERT INTO fin_reqs (id, client_id, kind, amt, to_date, st, file_id)
            VALUES (${id}, ${Number(f.client_id)}, 'promise', ${amount}, ${d}, 'ok', ${fileId})`;
  await sql`UPDATE col_files SET promise = ${JSON.stringify({ date: d, amt: amount })},
            log = ${JSON.stringify(colLog(f, `سجّل العميل وعد سداد ${fmt0(amount)} ر.س بتاريخ ${d} — يُراقب تلقائيًا`))} WHERE id = ${fileId}`;
  await notify(['b2b'], 'مالية', `وعد سداد جديد على ${fileId} — ${fmt0(amount)} ر.س بتاريخ ${d}`);
  return `سُجّل وعد السداد وأُبلغ B2B — الالتزام به يوقف التصعيد`;
}

/** B2B يقرر طلبات الأجل والمهلة */
async function finreqsApprove(ctx, { id }) {
  if (!isB2B(ctx)) throw httpError(403, 'قرار الأجل والمهلة صلاحية B2B');
  const [r] = await sql`SELECT * FROM fin_reqs WHERE id = ${id}`;
  if (!r) throw httpError(404, 'الطلب غير موجود');
  if (r.st !== 'pend') throw httpError(400, 'الطلب مقرر مسبقًا');
  const cid = Number(r.client_id);
  const name = await clientNameOf(cid);

  if (r.kind === 'ajel') {
    const seq = await nextSeq('col');
    const fileId = `COL-${seq}`;
    const m = Number(r.months) || 1;
    const dueDate = new Date(Date.now() + m * 30 * 86400000);
    const due = dueDate.toISOString().slice(0, 10);
    const log = [{ t: `فُتح الدين بموافقة B2B على طلب الأجل ${id} — ${fmt0(Number(r.amt))} ر.س حتى ${due}`, d: `اليوم ${nowLabel()}` }];
    await sql`INSERT INTO col_files (id, client_id, inv, ref, amt, orig_amt, created, due, stage, log)
              VALUES (${fileId}, ${cid}, ${`أجل ${id}`}, ${(r.note || '').trim() || 'مشتريات آجلة معتمدة'},
                      ${Number(r.amt)}, ${Number(r.amt)}, ${new Date().toISOString().slice(0, 10)}, ${due}, 1, ${JSON.stringify(log)})`;
    await sql`UPDATE fin_reqs SET st = 'ok', file_id = ${fileId} WHERE id = ${id}`;
    await notify(['owner', 'fin', 'frz', 'frzs'], 'مالية', `وافق B2B على طلب الأجل ${id} — فُتح الملف ${fileId} باستحقاق ${due}`, cid);
    return `اعتُمد الأجل — فُتح ملف الدين ${fileId} لعميل «${name}» باستحقاق ${due}`;
  }

  if (r.kind === 'delay') {
    const f = await getColFile(ctx, r.file_id);
    if ((f.due_hist || []).length >= 5) throw httpError(400, 'استُنفدت الجدولة (5/5) على هذا الملف');
    const hist = [...(f.due_hist || []), { old: f.due, to: r.to_date, why: (r.note || '').trim() || 'مهلة معتمدة من B2B', d: `اليوم ${nowLabel()}` }];
    await sql`UPDATE col_files SET due = ${r.to_date}, late_days = 0, due_hist = ${JSON.stringify(hist)},
              log = ${JSON.stringify(colLog(f, `وافق B2B على المهلة ${id} — الاستحقاق الجديد ${r.to_date} وجُمّد التصعيد حتى حينه`))} WHERE id = ${f.id}`;
    await sql`UPDATE fin_reqs SET st = 'ok' WHERE id = ${id}`;
    await notify(['owner', 'fin', 'frz', 'frzs'], 'مالية', `وافق B2B على المهلة ${id} — استحقاق ${f.id} أصبح ${r.to_date}`, cid);
    return `اعتُمدت المهلة — استحقاق ${f.id} الجديد ${r.to_date} (جدولة ${hist.length}/5)`;
  }
  throw httpError(400, 'وعود السداد تُسجل مباشرة ولا تحتاج قرارًا');
}

async function finreqsReject(ctx, { id }) {
  if (!isB2B(ctx)) throw httpError(403, 'قرار الأجل والمهلة صلاحية B2B');
  const [r] = await sql`SELECT * FROM fin_reqs WHERE id = ${id}`;
  if (!r) throw httpError(404, 'الطلب غير موجود');
  if (r.st !== 'pend') throw httpError(400, 'الطلب مقرر مسبقًا');
  await sql`UPDATE fin_reqs SET st = 'no' WHERE id = ${id}`;
  await notify(['owner', 'fin', 'frz', 'frzs'], 'مالية', `اعتذر B2B عن ${r.kind === 'ajel' ? 'طلب الأجل' : 'طلب المهلة'} ${id} — تواصلوا مع مسؤول حسابكم`, Number(r.client_id));
  return `رُفض الطلب ${id} وأُشعر العميل`;
}

/** تسجيل دفعة على ملف تحصيل — من B2B (تحصيل يدوي) أو من العميل (من محفظته) */
async function colPay(ctx, { id, amt, fromWallet }) {
  const isClient = FINREQ_ROLES.includes(ctx.role);
  if (!isClient && !isB2B(ctx)) throw httpError(403, 'لا صلاحية');
  const f = await getColFile(ctx, id);
  const cid = Number(f.client_id);
  if (f.st !== 'open') throw httpError(400, 'الملف مغلق مسبقًا');
  const amount = Math.round(Number(amt) * 100) / 100;
  if (!(amount > 0)) throw httpError(400, 'أدخل مبلغ الدفعة');
  if (amount > Number(f.amt)) throw httpError(400, `الدفعة أكبر من المستحق (${fmt(Number(f.amt))} ر.س)`);

  // سداد العميل من محفظته: خصم فعلي من رصيد المحفظة
  if (isClient && fromWallet !== false) {
    await assertWalletActive(cid);
    const w = await walletOf(cid);
    if (Number(w.bal) < amount) throw httpError(400, 'رصيد المحفظة لا يكفي لهذه الدفعة');
    await walletMove(cid, -amount, `دفعة تحصيل — ملف ${id}`);
  }

  const rem = Math.round((Number(f.amt) - amount) * 100) / 100;
  const closed = rem <= 0;
  const who = isClient ? 'سدد العميل' : 'سجّل B2B';
  const log = colLog(f, closed
    ? `${who} دفعة ${fmt(amount)} ر.س — سُدد الملف بالكامل وأُغلق ✓`
    : `${who} دفعة ${fmt(amount)} ر.س — المتبقي ${fmt(rem)} ر.س`);
  await sql`UPDATE col_files SET amt = ${Math.max(0, rem)}, st = ${closed ? 'closed' : 'open'},
            promise = ${closed ? null : (f.promise ? JSON.stringify(f.promise) : null)}, log = ${JSON.stringify(log)} WHERE id = ${id}`;
  if (closed) {
    await notify(['b2b'], 'مالية', `سُدد ملف التحصيل ${id} بالكامل وأُغلق ✓`);
    await notify(['owner', 'fin', 'frz', 'frzs'], 'مالية', `سُدد ملف التحصيل ${id} بالكامل وأُغلق ✓`, cid);
  }
  return closed ? `سُددت الدفعة وأُغلق الملف ${id} بالكامل ✓` : `سُجلت دفعة ${fmt(amount)} ر.س — المتبقي ${fmt(rem)} ر.س`;
}

/** B2B يسجل وعد سداد متفقًا عليه مع العميل */
async function colPromise(ctx, { id, date, amt }) {
  if (!isB2B(ctx)) throw httpError(403, 'صلاحية B2B');
  const f = await getColFile(ctx, id);
  const d = (date || '').trim();
  const amount = Math.floor(Number(amt));
  if (!d || !(amount > 0)) throw httpError(400, 'أدخل تاريخ الوعد ومبلغه');
  await sql`UPDATE col_files SET promise = ${JSON.stringify({ date: d, amt: amount })},
            log = ${JSON.stringify(colLog(f, `سجّل B2B وعد سداد متفقًا عليه — ${fmt0(amount)} ر.س بتاريخ ${d}`))} WHERE id = ${id}`;
  return `سُجّل الوعد — يُراقب تلقائيًا ويُصعّد الملف عند الإخلاف`;
}

async function colRemind(ctx, { id }) {
  if (!isB2B(ctx)) throw httpError(403, 'صلاحية B2B');
  const f = await getColFile(ctx, id);
  await sql`UPDATE col_files SET log = ${JSON.stringify(colLog(f, 'أُرسل تذكير سداد للعميل (إشعار بالتطبيق)'))} WHERE id = ${id}`;
  await notify(['owner', 'fin', 'frz', 'frzs'], 'مالية', `تذكير سداد — المستحق على الملف ${id}: ${fmt(Number(f.amt))} ر.س`, Number(f.client_id));
  return 'أُرسل التذكير ووُثّق في سجل الملف';
}

/** B2B يجدول الاستحقاق (بحد أقصى 5 جدولات) */
async function colReschedule(ctx, { id, date, why }) {
  if (!isB2B(ctx)) throw httpError(403, 'صلاحية B2B');
  const f = await getColFile(ctx, id);
  if (f.st !== 'open') throw httpError(400, 'الملف مغلق');
  if ((f.due_hist || []).length >= 5) throw httpError(400, 'استُنفدت الجدولة (5/5) — صعّد الملف أو حصّل الدين');
  const d = (date || '').trim();
  if (!d) throw httpError(400, 'اختر تاريخ الاستحقاق الجديد');
  const hist = [...(f.due_hist || []), { old: f.due, to: d, why: (why || '').trim() || 'جدولة من B2B', d: `اليوم ${nowLabel()}` }];
  await sql`UPDATE col_files SET due = ${d}, late_days = 0, due_hist = ${JSON.stringify(hist)},
            log = ${JSON.stringify(colLog(f, `جدول B2B الاستحقاق إلى ${d} (جدولة ${hist.length}/5)`))} WHERE id = ${id}`;
  return `جُدول الاستحقاق إلى ${d} — (${hist.length}/5)`;
}

/** تصعيد مرحلة الملف — المرحلة الرابعة تجمّد ائتمان العميل تلقائيًا */
async function colEscalate(ctx, { id }) {
  if (!isB2B(ctx)) throw httpError(403, 'صلاحية B2B');
  const f = await getColFile(ctx, id);
  if (f.st !== 'open') throw httpError(400, 'الملف مغلق');
  if (f.stage >= 5) throw httpError(400, 'الملف في المرحلة القانونية بالفعل');
  const next = f.stage + 1;
  let extra = '';
  if (next === 4) {
    await sql`UPDATE clients SET wst = 'frozen' WHERE id = ${Number(f.client_id)}`;
    extra = ' — جُمّدت محفظة العميل وائتمانه تلقائيًا';
  }
  await sql`UPDATE col_files SET stage = ${next},
            log = ${JSON.stringify(colLog(f, `صُعّد الملف إلى مرحلة «${COL_STAGES[next - 1]}»${extra}`))} WHERE id = ${id}`;
  await notify(['owner', 'fin', 'frz', 'frzs'], 'مالية', `صُعّد ملف التحصيل ${id} إلى «${COL_STAGES[next - 1]}»${extra}`, Number(f.client_id));
  return `صُعّد الملف إلى «${COL_STAGES[next - 1]}»${extra}`;
}

/** B2B يعدل الحد الائتماني للعميل (لا يقل عن المستخدم) */
async function clientsSetLimit(ctx, { id, limit }) {
  if (!isB2B(ctx)) throw httpError(403, 'تعديل الحدود صلاحية B2B');
  const c = await clientRow(id);
  const l = Math.floor(Number(limit));
  if (!(l > 0)) throw httpError(400, 'أدخل حدًا صالحًا');
  if (l < Number(c.used)) throw httpError(400, `لا يقبل حدًا أقل من المستخدم (${fmt0(Number(c.used))} ر.س)`);
  await walletOf(Number(id));
  await sql`UPDATE clients SET cr_limit = ${l} WHERE id = ${id}`;
  await sql`UPDATE wallet SET cr_limit = ${l} WHERE client_id = ${id}`;
  return `حُدّث الحد الائتماني لـ «${c.name}» إلى ${fmt0(l)} ر.س — يسري فورًا`;
}

/** B2B يشحن محفظة عميل مباشرة (قيد دفعة مستلمة خارج المنصة) */
async function clientsTopup(ctx, { id, amt }) {
  if (!isB2B(ctx)) throw httpError(403, 'شحن محافظ العملاء صلاحية B2B');
  const c = await clientRow(id);
  const amount = Math.floor(Number(amt));
  if (!(amount >= 100 && amount <= 5_000_000)) throw httpError(400, 'أدخل مبلغًا صالحًا (100 ر.س فأكثر)');
  await walletMove(Number(id), amount, 'شحن المحفظة — قيد مباشر من B2B');
  await notify(['owner', 'fin', 'frz', 'frzs', 'fr'], 'مالية', `أضاف B2B ${fmt0(amount)} ر.س لمحفظة ${c.name} — قيد مباشر`, Number(id));
  return `أُضيفت ${fmt0(amount)} ر.س لمحفظة «${c.name}» فورًا`;
}

// ============ الكتالوج ============

async function productsSetPrice(ctx, { pid, delta }) {
  if (!isB2B(ctx)) throw httpError(403, 'تسعير الكتالوج صلاحية B2B');
  const d = Number(delta) > 0 ? 0.5 : -0.5;
  const [p] = await sql`UPDATE products SET price = GREATEST(0.5, price + ${d})
                        WHERE id = ${pid} RETURNING name, price::float`;
  if (!p) throw httpError(404, 'المنتج غير موجود');
  return `سعر «${p.name}» الأساسي الآن ${fmt(p.price)} ر.س — مرجع تسعير كل العملاء`;
}

/** v6: كتابة السعر الأساسي مباشرة (حقل الإدخال في إدارة الكتالوج) */
async function productsSetPriceVal(ctx, { pid, price }) {
  if (!isB2B(ctx)) throw httpError(403, 'تسعير الكتالوج صلاحية B2B');
  const p = Math.round(Number(price) * 100) / 100;
  if (!(p > 0 && p <= 100000)) throw httpError(400, 'أدخل سعرًا صالحًا');
  const [row] = await sql`UPDATE products SET price = ${p} WHERE id = ${pid} RETURNING name`;
  if (!row) throw httpError(404, 'المنتج غير موجود');
  return `سعر «${row.name}» الأساسي الآن ${fmt(p)} ر.س — مرجع تسعير كل العملاء`;
}

/** v6: إضافة / تغيير صورة المنتج (رابط صورة) */
async function productsSetImg(ctx, { pid, img }) {
  if (!isB2B(ctx)) throw httpError(403, 'إدارة الكتالوج صلاحية B2B');
  const url = String(img || '').trim();
  if (!/^https:\/\/.+/.test(url) || url.length > 500) throw httpError(400, 'ألصق رابط صورة صحيحًا يبدأ بـ https://');
  const [row] = await sql`UPDATE products SET img = ${url} WHERE id = ${pid} RETURNING name`;
  if (!row) throw httpError(404, 'المنتج غير موجود');
  return `حُدّثت صورة «${row.name}» — تظهر فورًا في كتالوج كل العملاء`;
}

async function productsDelImg(ctx, { pid }) {
  if (!isB2B(ctx)) throw httpError(403, 'إدارة الكتالوج صلاحية B2B');
  const [row] = await sql`UPDATE products SET img = '' WHERE id = ${pid} RETURNING name`;
  if (!row) throw httpError(404, 'المنتج غير موجود');
  return `أُزيلت صورة «${row.name}» — تظهر خلفيته اللونية الاحتياطية`;
}

async function productsAdd(ctx, { name, unit, price, cat }) {
  if (!isB2B(ctx)) throw httpError(403, 'إدارة الكتالوج صلاحية B2B');
  const n = (name || '').trim();
  const p = Number(price);
  if (!n) throw httpError(400, 'اكتب اسم المنتج أولًا');
  if (!(p > 0 && p <= 100000)) throw httpError(400, 'أدخل سعرًا صالحًا');
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM products`;
  const pid = `P-6${String(count).padStart(3, '0')}`;
  await sql`INSERT INTO products (id, name, unit, cat, price, h, img)
            VALUES (${pid}, ${n}, ${(unit || '').trim() || 'حبة'}, ${(cat || '').trim() || 'مواد غذائية'}, ${p}, 205, '')`;
  return `أُضيف «${n}» للكتالوج الأساسي (${pid}) بسعر ${fmt(p)} ر.س`;
}

async function productsDelete(ctx, { pid }) {
  if (!isB2B(ctx)) throw httpError(403, 'إدارة الكتالوج صلاحية B2B');
  const [p] = await sql`SELECT name FROM products WHERE id = ${pid}`;
  if (!p) throw httpError(404, 'المنتج غير موجود');
  await sql`DELETE FROM products WHERE id = ${pid}`;
  await sql`DELETE FROM client_products WHERE pid = ${pid}`;
  return `حُذف «${p.name}» نهائيًا من الكتالوج ومن كتالوجات العملاء الخاصة`;
}

async function productsToggle(ctx, { pid }) {
  if (!isB2B(ctx)) throw httpError(403, 'إدارة الكتالوج صلاحية B2B');
  const [p] = await sql`SELECT name, is_out FROM products WHERE id = ${pid}`;
  if (!p) throw httpError(404, 'المنتج غير موجود');
  await sql`UPDATE products SET is_out = ${!p.is_out} WHERE id = ${pid}`;
  return p.is_out ? `عاد «${p.name}» للتوفر` : `أُوقف «${p.name}» مؤقتًا — يختفي من كتالوج العملاء`;
}

// ============ الحسابات (جوال + رمز سري) ============

const USER_MANAGERS = ['ops', 'owner', 'fr', 'frz', 'frzs', 'b2b'];
/** دور مدير حساب المنشأة حسب نوعها */
const MANAGER_ROLE = { 'مستقل': 'owner', 'مانح': 'fr', 'ممنوح بيسك': 'frz', 'ممنوح سوبر': 'frzs' };

/** منشأة الهدف لأمر حسابات: منشأتي، أو عميل من ملفه (B2B، أو المانح/السوبر لشبكته) */
async function targetClient(ctx, clientId) {
  if (clientId == null || clientId === '') return ctx.clientId; // null لفريق B2B
  return assertClientAccess(ctx, clientId, { network: true });
}

/** حساب ضمن نطاق من يديره */
async function managedUser(ctx, id) {
  const [u] = await sql`SELECT * FROM org_users WHERE id = ${id}`;
  if (!u) throw httpError(404, 'المستخدم غير موجود');
  const cid = u.client_id == null ? null : Number(u.client_id);
  const mine = cid === ctx.clientId;
  if (!isB2B(ctx) && !mine && !(cid != null && await inNetwork(ctx, cid))) throw httpError(404, 'المستخدم غير موجود');
  if (ctx.role === 'ops' && u.role !== 'worker') throw httpError(403, 'صلاحيتك تتيح إدارة حسابات العمال فقط');
  // مدير الحساب لا يديره من هم دونه: حسابات المدراء لـ B2B (أو لمانح الشبكة)
  if (!isB2B(ctx) && mine && ['owner', 'fr', 'frz', 'frzs'].includes(u.role) && Number(u.id) !== ctx.userId) {
    throw httpError(403, 'حساب مدير المنشأة يُدار من B2B');
  }
  return u;
}

async function usersAdd(ctx, { name, phone, pin, email, userRole, branches, clientId }) {
  if (!USER_MANAGERS.includes(ctx.role)) throw httpError(403, 'لا صلاحية');
  const n = (name || '').trim();
  if (!n) throw httpError(400, 'اكتب اسم المستخدم أولًا');
  const p = normPhone(phone);
  if (!validPhone(p)) throw httpError(400, 'أدخل رقم جوال المستخدم (05xxxxxxxx) — به يسجّل الدخول');
  assertPin(pin);
  const cid = await targetClient(ctx, clientId);
  const fromProfile = cid !== ctx.clientId; // B2B أو الشبكة من ملف العميل
  const mail = (email || '').trim();
  if (mail && !mail.includes('@')) throw httpError(400, 'أدخل إيميلًا صحيحًا أو اتركه فارغًا');

  let finalRole;
  if (cid == null) {
    finalRole = 'b2b'; // فريق B2B — ينشئه B2B فقط (ctx.clientId null)
  } else if (userRole === 'mgr') {
    if (!isB2B(ctx)) throw httpError(403, 'حساب مدير المنشأة ينشئه B2B');
    finalRole = MANAGER_ROLE[(await clientRow(cid)).type] || 'owner';
  } else {
    finalRole = ctx.role === 'ops' ? 'worker' : (['worker', 'ops', 'fin'].includes(userRole) ? userRole : 'worker');
  }
  let branch = 'الإدارة';
  if (cid != null && Array.isArray(branches) && branches.length) branch = branches.map((b) => String(b).trim()).filter(Boolean).slice(0, 20).join(' · ');
  else if (cid != null && ['worker', 'ops'].includes(finalRole)) {
    if (!fromProfile) throw httpError(400, 'حدد فرعًا واحدًا على الأقل');
    const [b] = await sql`SELECT name FROM branches WHERE client_id = ${cid} ORDER BY name LIMIT 1`;
    branch = b ? b.name : 'الإدارة';
  }
  const [dup] = await sql`SELECT 1 AS x FROM org_users WHERE phone = ${p}`;
  if (dup) throw httpError(409, 'هذا الجوال مسجّل لحساب آخر');
  // حساب تنشئه المنشأة لنفسها يبدأ «بانتظار التفعيل»؛ وما يُنشأ من ملف العميل فعّال فورًا
  const st = fromProfile || isB2B(ctx) ? 'ok' : 'pend';
  await sql`INSERT INTO org_users (id, name, email, role, branch, st, client_id, phone, pin_hash, must_change_pin)
            VALUES (${Date.now()}, ${n.slice(0, 80)}, ${mail || null}, ${finalRole}, ${branch}, ${st}, ${cid}, ${p}, ${hashPin(pin)}, true)`;
  return st === 'ok'
    ? `أُنشئ حساب ${n} — يدخل بجواله ${p} والرمز المؤقت، ويُطلب منه تغييره عند أول دخول`
    : `أُنشئ حساب ${n} — فعّله ليستطيع الدخول بجواله ${p} والرمز المؤقت`;
}

async function usersSetStatus(ctx, { id, st }) {
  if (!USER_MANAGERS.includes(ctx.role)) throw httpError(403, 'لا صلاحية');
  if (!['ok', 'off'].includes(st)) throw httpError(400, 'حالة غير صالحة');
  const u = await managedUser(ctx, id);
  if (Number(u.id) === ctx.userId) throw httpError(400, 'لا يمكنك إيقاف حسابك');
  if (st === 'ok' && !u.pin_hash) throw httpError(400, 'عيّن رمزًا سريًا للحساب أولًا (إعادة تعيين الرمز)');
  await sql`UPDATE org_users SET st = ${st} WHERE id = ${id}`;
  if (st === 'off') await sql`DELETE FROM sessions WHERE user_id = ${id}`;
  return st === 'ok' ? `فُعّل حساب ${u.name}` : `أُوقف ${u.name} — لا يستطيع الدخول`;
}

async function usersUpdate(ctx, { id, userRole, branches }) {
  if (!USER_MANAGERS.includes(ctx.role)) throw httpError(403, 'لا صلاحية');
  if (!Array.isArray(branches) || !branches.length) throw httpError(400, 'حدد فرعًا واحدًا على الأقل');
  const u = await managedUser(ctx, id);
  // أدوار الفريق فقط تتبدل هنا؛ حسابات المدراء و B2B تبقى على دورها
  const staff = ['worker', 'ops', 'fin'];
  const finalRole = staff.includes(u.role) && staff.includes(userRole) && ctx.role !== 'ops' ? userRole : u.role;
  await sql`UPDATE org_users SET role = ${finalRole}, branch = ${branches.map((b) => String(b).trim()).filter(Boolean).slice(0, 20).join(' · ')} WHERE id = ${id}`;
  return `حُدّثت صلاحيات ${u.name} — الدور والفروع سرت فورًا`;
}

/** رمز مؤقت جديد لحساب (نسي رمزه أو قُفل): يُلغي جلساته ويفك القفل ويُلزمه بتغييره عند الدخول */
async function usersResetPin(ctx, { id, pin }) {
  if (!USER_MANAGERS.includes(ctx.role)) throw httpError(403, 'لا صلاحية');
  assertPin(pin);
  const u = await managedUser(ctx, id);
  if (Number(u.id) === ctx.userId) throw httpError(400, 'غيّر رمزك من «تغيير الرمز السري»');
  if (!u.phone) throw httpError(400, 'أضف رقم جوال للحساب أولًا');
  await sql`UPDATE org_users SET pin_hash = ${hashPin(pin)}, must_change_pin = true WHERE id = ${id}`;
  await sql`DELETE FROM sessions WHERE user_id = ${id}`;
  await sql`DELETE FROM login_throttle WHERE key = ${`p:${u.phone}`}`;
  return `عُيّن رمز مؤقت لـ ${u.name} وفُكّ قفل حسابه — يُطلب منه تغييره عند أول دخول`;
}

/** جوال حساب قديم بلا جوال (أو تصحيحه) */
async function usersSetPhone(ctx, { id, phone }) {
  if (!USER_MANAGERS.includes(ctx.role)) throw httpError(403, 'لا صلاحية');
  const p = normPhone(phone);
  if (!validPhone(p)) throw httpError(400, 'أدخل رقم جوال صحيحًا (05xxxxxxxx)');
  const u = await managedUser(ctx, id);
  const [dup] = await sql`SELECT 1 AS x FROM org_users WHERE phone = ${p} AND id <> ${id}`;
  if (dup) throw httpError(409, 'هذا الجوال مسجّل لحساب آخر');
  await sql`UPDATE org_users SET phone = ${p} WHERE id = ${id}`;
  await sql`DELETE FROM sessions WHERE user_id = ${id}`;
  return `حُدّث جوال ${u.name} إلى ${p}`;
}

// ============ الفروع (لكل منشأة) ============

const BRANCH_MANAGERS = ['owner', 'fr', 'frz', 'frzs'];

async function branchesAdd(ctx, { name, loc }) {
  if (!BRANCH_MANAGERS.includes(ctx.role)) throw httpError(403, isB2B(ctx) ? 'فروع العملاء تُدار من ملف العميل' : 'لا صلاحية');
  const cid = myClient(ctx);
  const n = (name || '').trim();
  if (!n) throw httpError(400, 'اكتب اسم الفرع أولًا');
  if (!loc || typeof loc.x !== 'number' || !loc.addr) throw httpError(400, 'حدد موقع الفرع على الخريطة أولًا — الموقع إلزامي');
  const c = await clientRow(cid);
  const ins = await sql`INSERT INTO branches (client_id, name, city, st, loc) VALUES (${cid}, ${n.slice(0, 80)}, ${c.city || 'الرياض'}, 'ok', ${JSON.stringify(loc)})
                        ON CONFLICT (client_id, name) DO NOTHING RETURNING name`;
  if (!ins.length) throw httpError(409, 'يوجد فرع بهذا الاسم');
  return 'أُضيف الفرع بموقعه — اربط به المستخدمين من جدول الفريق';
}

async function branchesToggle(ctx, { name }) {
  if (!BRANCH_MANAGERS.includes(ctx.role)) throw httpError(403, 'لا صلاحية');
  const cid = myClient(ctx);
  const [b] = await sql`SELECT st FROM branches WHERE client_id = ${cid} AND name = ${name}`;
  if (!b) throw httpError(404, 'الفرع غير موجود');
  const off = b.st === 'off';
  await sql`UPDATE branches SET st = ${off ? 'ok' : 'off'} WHERE client_id = ${cid} AND name = ${name}`;
  return off ? `أُعيد تفعيل ${name} — يستطيع الطلب من جديد` : `أُوقف ${name} مؤقتًا — لن تُقبل طلبات جديدة منه`;
}

async function branchesDelete(ctx, { name }) {
  if (!BRANCH_MANAGERS.includes(ctx.role)) throw httpError(403, 'لا صلاحية');
  const cid = myClient(ctx);
  const gone = await sql`DELETE FROM branches WHERE client_id = ${cid} AND name = ${name} RETURNING name`;
  if (!gone.length) throw httpError(404, 'الفرع غير موجود');
  return `حُذف ${name} نهائيًا — طلباته السابقة باقية في السجل`;
}

// ============ التكامل مع نظام العمليات ============

/** B2B: دورة تكامل يدوية — يرسل العملاء/الأصناف المتغيرة والأحداث المتأخرة ويحدّث المتاح للبيع */
async function integrationSync(ctx) {
  if (!isB2B(ctx)) throw httpError(403, 'التكامل صلاحية B2B');
  if (!integrationOn()) throw httpError(400, 'التكامل مع نظام العمليات غير مفعّل على هذه البيئة');
  const { runCycle } = await import('./integration.js');
  const r = await runCycle();
  return `مزامنة العمليات: ${r.master.customers} عميل و${r.master.products} صنف تغيّروا، أُرسل ${r.delivered.sent} حدث`
    + (r.delivered.failed || r.delivered.dead ? ` (تعثّر ${r.delivered.failed + r.delivered.dead})` : '')
    + (r.stock.error ? ` — تعذّر تحديث المتاح: ${r.stock.error}` : ` — حُدّث المتاح لـ ${r.stock.updated} صنف`);
}

// ============ الموجه ============

export const COMMANDS = {
  'orders.submit': ordersSubmit,
  'orders.approve': ordersApprove,
  'orders.reject': ordersReject,
  'orders.hold': ordersHold,
  'orders.resume': ordersResume,
  'orders.advance': ordersAdvance,
  'orders.receive': ordersReceive,
  'tickets.resolve': ticketsResolve,
  'tickets.hold': ticketsHold,
  'tickets.resume': ticketsResume,
  'wallet.topup': walletTopup,
  'fintu.approve': fintuApprove,
  'fintu.reject': fintuReject,
  'invoices.pay': invoicesPay,
  'lists.save': listsSave,
  'reqs.submit': reqsSubmit,
  'reqs.price': reqsPrice,
  'reqs.clientAccept': reqsClientAccept,
  'reqs.clientDecline': reqsClientDecline,
  'reqs.reject': reqsReject,
  'reqs.bktSend': reqsBktSend,
  'reqs.rcpConfirm': reqsRcpConfirm,
  'finreqs.ajel': finreqsAjel,
  'finreqs.delay': finreqsDelay,
  'finreqs.promise': finreqsPromise,
  'finreqs.approve': finreqsApprove,
  'finreqs.reject': finreqsReject,
  'col.pay': colPay,
  'col.promise': colPromise,
  'col.remind': colRemind,
  'col.reschedule': colReschedule,
  'col.escalate': colEscalate,
  'clients.setLimit': clientsSetLimit,
  'clients.topup': clientsTopup,
  'frs.create': frsCreate,
  'frs.approve': frsApprove,
  'frs.toggle': frsToggle,
  'frs.addSub': frsAddSub,
  'clients.toggleAccount': clientsToggleAccount,
  'clients.toggleWallet': clientsToggleWallet,
  'clients.patch': (ctx, p) => clientsPatch(ctx, p, p.msg),
  'clients.create': clientsCreate,
  'clients.prodAdd': clientsProdAdd,
  'clients.prodStep': clientsProdStep,
  'clients.prodDel': clientsProdDel,
  'nc.approve': ncApprove,
  'nc.reject': ncReject,
  'roles.set': rolesSet,
  'roles.publish': rolesPublish,
  'roles.discard': rolesDiscard,
  'products.toggle': productsToggle,
  'products.setPrice': productsSetPrice,
  'products.setPriceVal': productsSetPriceVal,
  'products.setImg': productsSetImg,
  'products.delImg': productsDelImg,
  'products.add': productsAdd,
  'products.delete': productsDelete,
  'users.add': usersAdd,
  'users.setStatus': usersSetStatus,
  'users.update': usersUpdate,
  'users.resetPin': usersResetPin,
  'users.setPhone': usersSetPhone,
  'branches.add': branchesAdd,
  'branches.toggle': branchesToggle,
  'branches.delete': branchesDelete,
  'integration.sync': integrationSync,
};
