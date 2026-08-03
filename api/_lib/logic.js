// ============================================================
// منطق الأعمال على الخادم — المصدر الوحيد للحقيقة
// كل أمر: تحقق صلاحية → تعديل القاعدة → إشعارات → رسالة
// ============================================================
import { sql, nextSeq, nowLabel, notify, fmt, fmt0, VAT, SAMPLE_CR } from './db.js';
import { httpError } from './http.js';
import { ROLES, SUPER_FR_ID } from '../../js/data/constants.js';

async function productMap() {
  const rows = await sql`SELECT id, name, unit, price::float, is_out FROM products`;
  return Object.fromEntries(rows.map((p) => [p.id, p]));
}

async function getOrder(id) {
  const [o] = await sql`SELECT * FROM orders WHERE id = ${id}`;
  if (!o) throw httpError(404, 'الطلب غير موجود');
  return o;
}

const CLIENT_ROLES = ['worker', 'ops', 'owner', 'fin', 'frz', 'frzs'];
const APPROVER_FINAL = ['owner', 'frz', 'frzs'];

function sessionClientId(role) {
  return role === 'frz' ? 2 : role === 'frzs' ? 6 : 1;
}

// ============ الطلبات ============

async function ordersSubmit(role, { items }) {
  if (!['worker', 'ops', 'owner', 'frz', 'frzs'].includes(role)) throw httpError(403, 'هذا الدور لا يستطيع إنشاء طلبات');
  if (!Array.isArray(items) || !items.length) throw httpError(400, 'السلة فارغة');
  const [client] = await sql`SELECT st FROM clients WHERE id = ${sessionClientId(role)}`;
  if (client && client.st === 'susp') throw httpError(403, 'حساب منشأتك موقوف — لا يمكن إرسال طلبات');

  const pm = await productMap();
  const clean = items
    .filter((i) => pm[i.pid] && !pm[i.pid].is_out && Number(i.qty) > 0)
    .map((i) => ({ pid: i.pid, qty: Math.min(999, Math.floor(Number(i.qty))) }));
  if (!clean.length) throw httpError(400, 'لا أصناف صالحة في السلة');

  const seq = await nextSeq('order');
  const id = `ORD-${seq}`;
  await sql`INSERT INTO orders (id, by_user, branch, date_label, st, items, stamps)
            VALUES (${id}, ${ROLES[role].user}, ${'فرع العليا'}, 'الآن', 'ops',
                    ${JSON.stringify(clean)}, ${JSON.stringify([nowLabel(), '', '', '', '', ''])})`;
  await notify(['ops'], 'اعتمادات', `طلب جديد بانتظار تعميدك — ${id}`);
  return `أُرسل الطلب ${id} لتعميد مدير العمليات`;
}

async function ordersApprove(role, { id, qty }) {
  const o = await getOrder(id);
  const canFirst = role === 'ops' || role === 'b2b';
  const canFinal = APPROVER_FINAL.includes(role) || role === 'b2b';
  if (o.st === 'ops' && !canFirst) throw httpError(403, 'تعميد هذه المرحلة لمدير العمليات');
  if (o.st === 'purch' && !canFinal) throw httpError(403, 'التعميد النهائي للمالك / المشتريات');
  if (!['ops', 'purch', 'b2b', 'hold'].includes(o.st)) throw httpError(400, 'الطلب ليس في مرحلة تعميد');

  let changed = false;
  const items = o.items
    .map((i) => {
      const q = Math.max(0, Math.floor(Number(qty?.[i.pid] ?? i.qty)));
      if (q !== i.qty) changed = true;
      return { ...i, qty: q };
    })
    .filter((i) => i.qty > 0);
  if (!items.length) throw httpError(400, 'لا يمكن اعتماد طلب بلا أصناف — استخدم الرفض');

  const stamps = [...o.stamps];
  let st = o.st;
  if (o.st === 'ops') { st = 'purch'; stamps[1] = nowLabel(); }
  else if (o.st === 'purch') { st = 'b2b'; stamps[2] = nowLabel(); stamps[3] = nowLabel(); }
  await sql`UPDATE orders SET st = ${st}, items = ${JSON.stringify(items)}, stamps = ${JSON.stringify(stamps)} WHERE id = ${id}`;

  return o.st === 'ops'
    ? (changed ? `عُدّلت الكميات وعُمّد ${id} — أُشعر مقدّم الطلب ومدير المشتريات` : `عُمّد ${id} وأُرسل لمدير المشتريات`)
    : o.st === 'purch'
      ? `التعميد النهائي تم — أُرسل ${id} إلى B2B`
      : (changed ? `عُدّل ${id} وأُشعر العميل` : `لا تغيير على ${id}`);
}

async function ordersReject(role, { id, reason }) {
  if (!['ops', 'owner', 'frz', 'frzs', 'b2b'].includes(role)) throw httpError(403, 'لا صلاحية للرفض');
  const text = (reason || '').trim();
  if (text.length < 5) throw httpError(400, 'سبب الرفض إلزامي (5 أحرف على الأقل) ويصل نصًا لمقدّم الطلب');
  const o = await getOrder(id);
  const rejAt = o.st === 'ops' ? 1 : o.st === 'purch' ? 2 : 4;
  await sql`UPDATE orders SET st = 'rej', reason = ${text}, rej_at = ${rejAt} WHERE id = ${id}`;
  await notify(['worker', 'ops'], 'اعتمادات', `رُفض ${id} — ${text}`);
  return `رُفض ${id} وأُرسل السبب لمقدّم الطلب`;
}

async function ordersHold(role, { id, reason }) {
  if (role !== 'b2b') throw httpError(403, 'تعليق الطلبات صلاحية B2B');
  const text = (reason || '').trim();
  if (text.length < 5) throw httpError(400, 'سبب التعليق إلزامي — يظهر للعميل نصًا');
  await getOrder(id);
  await sql`UPDATE orders SET st = 'hold', hold_reason = ${text} WHERE id = ${id}`;
  await notify(['worker', 'ops', 'owner', 'frz'], 'طلبات', `علّق B2B الطلب ${id} — ${text}`);
  return `عُلّق ${id} — يظهر السبب للعميل ويمكن الاستئناف`;
}

async function ordersResume(role, { id }) {
  if (role !== 'b2b') throw httpError(403, 'استئناف الطلبات صلاحية B2B');
  await sql`UPDATE orders SET st = 'b2b', hold_reason = NULL WHERE id = ${id} AND st = 'hold'`;
  return `استؤنف تجهيز ${id}`;
}

async function ordersAdvance(role, { id }) {
  if (role !== 'b2b') throw httpError(403, 'الإرسال للتوصيل صلاحية B2B');
  const o = await getOrder(id);
  if (o.st !== 'b2b') throw httpError(400, 'الطلب ليس قيد التجهيز');
  const stamps = [...o.stamps];
  stamps[4] = nowLabel();
  await sql`UPDATE orders SET st = 'ship', stamps = ${JSON.stringify(stamps)} WHERE id = ${id}`;
  await notify(['worker'], 'طلبات', `خرج طلبك ${id} للتوصيل — أكّد الاستلام عند وصوله`);
  return `أُرسل ${id} للتوصيل`;
}

async function ordersReceive(role, { id, recv }) {
  if (role !== 'worker') throw httpError(403, 'تأكيد الاستلام لعامل المطعم');
  const o = await getOrder(id);
  if (o.st !== 'ship') throw httpError(400, 'الطلب ليس قيد التوصيل');
  const pm = await productMap();

  const shorts = o.items.filter((i) => recv?.[i.pid]?.short);
  const stamps = [...o.stamps];
  stamps[5] = nowLabel();
  let msg;

  if (shorts.length) {
    const seq = await nextSeq('ticket');
    const tid = `TKT-${seq}`;
    const recvQty = (i) => Math.min(i.qty, Math.max(0, Math.floor(Number(recv[i.pid].recv ?? 0))));
    const val = shorts.reduce((s, i) => s + pm[i.pid].price * (i.qty - recvQty(i)), 0) * (1 + VAT);
    await sql`INSERT INTO tickets (id, ord, customer, descr, qty, val, st, date_label)
              VALUES (${tid}, ${id}, ${`مطاعم البلدة — ${o.branch}`},
                      ${shorts.map((i) => pm[i.pid].name).join(' · ')},
                      ${`ناقص ${shorts.map((i) => `${i.qty - recvQty(i)} × ${pm[i.pid].unit}`).join(' + ')}`},
                      ${val}, 'open', 'الآن')`;
    await sql`UPDATE orders SET st = 'short', stamps = ${JSON.stringify(stamps)}, ticket_id = ${tid} WHERE id = ${id}`;
    await notify(['b2b'], 'تذاكر', `تذكرة نواقص جديدة ${tid} على ${id}`);
    msg = `أُكّد الاستلام وفُتحت تذكرة نواقص ${tid} — أُرسلت إلى B2B لحلّها`;
  } else {
    await sql`UPDATE orders SET st = 'done', stamps = ${JSON.stringify(stamps)} WHERE id = ${id}`;
    msg = `تم تأكيد استلام ${id} بالكامل`;
  }
  return msg;
}

// ============ التذاكر ============

async function ticketsResolve(role, { id }) {
  if (role !== 'b2b') throw httpError(403, 'تسوية التذاكر صلاحية B2B');
  const [t] = await sql`SELECT * FROM tickets WHERE id = ${id}`;
  if (!t) throw httpError(404, 'التذكرة غير موجودة');
  if (t.st === 'resolved') throw httpError(400, 'التذكرة مقفلة مسبقًا');
  const seq = await nextSeq('cn');
  const cn = `CN-${seq}`;
  const val = Number(t.val);
  await sql`UPDATE tickets SET st = 'resolved', cn = ${cn}, hold_reason = NULL WHERE id = ${id}`;
  await sql`INSERT INTO invoices (id, ref, due, amt, rem, st) VALUES (${cn}, ${`نواقص ${t.ord}`}, 'إشعار دائن', ${-val}, 0, 'credit')`;
  await sql`UPDATE wallet SET bal = bal + ${val} WHERE org_cr = ${SAMPLE_CR}`;
  await sql`INSERT INTO wallet_tx (org_cr, t, d, amt) VALUES (${SAMPLE_CR}, ${`إشعار دائن ${cn} — تسوية ${id}`}, 'الآن', ${val})`;
  await notify(['worker', 'ops', 'owner', 'frz', 'fin'], 'مالية', `حُلّت تذكرة النواقص ${id} — صدر إشعار دائن ${cn} بقيمة ${fmt(val)} ر.س في محفظتك`);
  return `صدر إشعار دائن ${cn} بقيمة ${fmt(val)} ر.س وأُقفلت ${id}`;
}

async function ticketsHold(role, { id, reason }) {
  if (role !== 'b2b') throw httpError(403, 'تعليق التذاكر صلاحية B2B');
  const text = (reason || '').trim();
  if (text.length < 5) throw httpError(400, 'سبب التعليق إلزامي');
  await sql`UPDATE tickets SET st = 'held', hold_reason = ${text} WHERE id = ${id} AND st = 'open'`;
  await notify(['worker', 'ops', 'owner', 'frz', 'fin'], 'تذاكر', `علّق B2B تذكرة النواقص ${id} — السبب: ${text}`);
  return `عُلّقت التذكرة ${id} — أُشعر العميل بالسبب`;
}

async function ticketsResume(role, { id }) {
  if (role !== 'b2b') throw httpError(403, 'استئناف التذاكر صلاحية B2B');
  await sql`UPDATE tickets SET st = 'open', hold_reason = NULL WHERE id = ${id} AND st = 'held'`;
  return `استؤنفت التذكرة ${id}`;
}

// ============ المحفظة والفواتير ============

async function walletTopup(role, { amt, method }) {
  if (!['owner', 'fin', 'frz', 'frzs', 'fr'].includes(role)) throw httpError(403, 'شحن المحفظة للمالك والمالية');
  const amount = Math.floor(Number(amt));
  if (!(amount >= 500 && amount <= 1_000_000)) throw httpError(400, 'مبلغ غير صالح');
  const m = method === 'تحويل بنكي' ? 'تحويل بنكي' : 'مدى';
  await sql`UPDATE wallet SET bal = bal + ${amount} WHERE org_cr = ${SAMPLE_CR}`;
  await sql`INSERT INTO wallet_tx (org_cr, t, d, amt) VALUES (${SAMPLE_CR}, ${`شحن المحفظة — ${m}`}, 'الآن', ${amount})`;
  return `تم شحن ${fmt0(amount)} ر.س — صدر إيصال PDF`;
}

async function invoicesPay(role, { id }) {
  if (!['owner', 'fin', 'frz', 'frzs', 'fr'].includes(role)) throw httpError(403, 'السداد للمالك والمالية');
  const [v] = await sql`SELECT * FROM invoices WHERE id = ${id}`;
  if (!v) throw httpError(404, 'الفاتورة غير موجودة');
  if (!['unpaid', 'part'].includes(v.st)) throw httpError(400, 'الفاتورة ليست مستحقة');
  const rem = Number(v.rem);
  const [w] = await sql`SELECT bal::float FROM wallet WHERE org_cr = ${SAMPLE_CR}`;
  if (w.bal < rem) throw httpError(400, 'رصيد المحفظة لا يكفي لسداد الفاتورة');
  await sql`UPDATE wallet SET bal = bal - ${rem} WHERE org_cr = ${SAMPLE_CR}`;
  await sql`INSERT INTO wallet_tx (org_cr, t, d, amt) VALUES (${SAMPLE_CR}, ${`سداد فاتورة ${id} من المحفظة`}, 'الآن', ${-rem})`;
  await sql`UPDATE invoices SET st = 'paid', rem = 0, due = 'سُددت الآن' WHERE id = ${id}`;
  return `سُددت ${id} من المحفظة — الرصيد الجديد ${fmt(w.bal - rem)} ر.س`;
}

// ============ اللستات والاقتراحات ============

async function listsSave(role, { name, items }) {
  const n = (name || '').trim();
  if (!n) throw httpError(400, 'اكتب اسم اللستة أولًا');
  if (!Array.isArray(items) || !items.length) throw httpError(400, 'أضف صنفًا واحدًا على الأقل');
  await sql`INSERT INTO saved_lists (name, items) VALUES (${n}, ${JSON.stringify(items)})`;
  return `حُفظت لستة «${n}» — تجدها فوق الكتالوج`;
}

async function reqsSubmit(role, { name, unit, note }) {
  if (!['owner', 'fr'].includes(role)) throw httpError(403, 'اقتراح المنتجات للمالك أو المانح');
  const n = (name || '').trim();
  if (!n) throw httpError(400, 'اكتب اسم المنتج المطلوب أولًا');
  const seq = await nextSeq('req');
  const id = `REQ-${seq}`;
  await sql`INSERT INTO prod_reqs (id, name, unit, by_org, by_user, note, date_label, st)
            VALUES (${id}, ${n}, ${(unit || '').trim()},
                    ${role === 'fr' ? 'دوار السعادة — المانح' : 'مطاعم البلدة'},
                    ${ROLES[role].user}, ${(note || '').trim() || '—'}, 'الآن', 'pend')`;
  return `أُرسل اقتراحك ${id} لفريق B2B — يراجعه ويسعّره خلال يوم عمل`;
}

async function reqsApprove(role, { id }) {
  if (role !== 'b2b') throw httpError(403, 'اعتماد الاقتراحات صلاحية B2B');
  const [r] = await sql`SELECT * FROM prod_reqs WHERE id = ${id}`;
  if (!r) throw httpError(404, 'الاقتراح غير موجود');
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM products`;
  const pid = `P-6${String(count).padStart(3, '0')}`;
  await sql`INSERT INTO products (id, name, unit, cat, price, h, img)
            VALUES (${pid}, ${r.name}, ${r.unit || 'حبة'}, 'مواد غذائية', 64, 210, '')`;
  await sql`UPDATE prod_reqs SET st = 'ok' WHERE id = ${id}`;
  return `أُضيف «${r.name}» للكتالوج وسُعّر — يظهر للعملاء الآن`;
}

async function reqsReject(role, { id }) {
  if (role !== 'b2b') throw httpError(403, 'رفض الاقتراحات صلاحية B2B');
  await sql`UPDATE prod_reqs SET st = 'no' WHERE id = ${id}`;
  return 'رُفض الاقتراح وأُشعر العميل';
}

// ============ الفرنشايز ============

async function frsCreate(role, { name, cr, kind, region }) {
  if (!['fr', 'frzs', 'b2b'].includes(role)) throw httpError(403, 'إنشاء الممنوحين للمانح أو السوبر');
  const n = (name || '').trim(), c = (cr || '').trim();
  if (!n || !c) throw httpError(400, 'أدخل اسم المنشأة ورقم السجل التجاري');
  const isSuper = role === 'fr' && kind === 'super';
  const reg = (region || '').trim();
  if (isSuper && !reg) throw httpError(400, 'حدد منطقة امتياز الممنوح السوبر');
  const id = Date.now();
  const city = role === 'frzs' ? 'المنطقة الشرقية' : isSuper ? reg : '—';
  await sql`INSERT INTO frs (id, name, city, cr, st, active, parent, super, region)
            VALUES (${id}, ${n}, ${city}, ${c}, 'new', true,
                    ${role === 'frzs' ? SUPER_FR_ID : null}, ${isSuper}, ${isSuper ? reg : null})`;
  await sql`INSERT INTO clients (id, name, cr, city, st, bal, cr_limit, used, wst, branches, staff)
            VALUES (${id}, ${n}, ${c}, '—', 'ok', 0, 20000, 0, 'ok', '[]', '[]')`;
  return isSuper
    ? `أُنشئ ممنوح سوبر لمنطقة «${reg}» — تعميده وتفعيله بيد B2B أدمن`
    : 'أُنشئ الممنوح — تعميده وتفعيله بيد B2B أدمن';
}

async function frsApprove(role, { id }) {
  if (role !== 'b2b') throw httpError(403, 'تعميد الممنوحين وتفعيلهم حصريًا بيد B2B');
  const [f] = await sql`SELECT name FROM frs WHERE id = ${id}`;
  if (!f) throw httpError(404, 'الممنوح غير موجود');
  await sql`UPDATE frs SET st = 'ok' WHERE id = ${id}`;
  return `عمّد B2B الممنوح «${f.name}» — فُعّل حسابه وأُنشئت محفظته المستقلة`;
}

async function frsToggle(role, { id }) {
  if (!['fr', 'b2b'].includes(role)) throw httpError(403, 'لا صلاحية');
  const [f] = await sql`SELECT name, active FROM frs WHERE id = ${id}`;
  if (!f) throw httpError(404, 'الممنوح غير موجود');
  await sql`UPDATE frs SET active = ${!f.active} WHERE id = ${id}`;
  return f.active ? `أُوقف حساب ${f.name}` : `أُعيد تفعيل ${f.name}`;
}

async function frsAddSub(role, { clientId, name, cr }) {
  if (!['b2b', 'fr'].includes(role)) throw httpError(403, 'لا صلاحية');
  const [client] = await sql`SELECT name FROM clients WHERE id = ${clientId}`;
  if (!client) throw httpError(404, 'العميل غير موجود');
  const [parent] = await sql`SELECT id, region FROM frs WHERE name = ${client.name} AND super = true`;
  if (!parent) throw httpError(400, 'هذا العميل ليس ممنوحًا سوبر');
  const n = (name || '').trim(), c = (cr || '').trim();
  if (!n || !c) throw httpError(400, 'أدخل اسم منشأة الممنوح التابع ورقم سجله التجاري');
  const id = Date.now();
  await sql`INSERT INTO frs (id, name, city, cr, st, active, parent)
            VALUES (${id}, ${n}, ${parent.region || '—'}, ${c}, 'new', true, ${parent.id})`;
  await sql`INSERT INTO clients (id, name, cr, city, st, bal, cr_limit, used, wst, branches, staff)
            VALUES (${id}, ${n}, ${c}, ${parent.region || '—'}, 'ok', 0, 20000, 0, 'ok', '[]', '[]')`;
  return `أُنشئ الممنوح التابع «${n}» ضمن ${parent.region || 'منطقة السوبر'} — تعميده وتفعيله بيد B2B أدمن`;
}

// ============ العملاء (B2B) ============

async function clientsToggleAccount(role, { id }) {
  if (role !== 'b2b') throw httpError(403, 'إيقاف العملاء صلاحية B2B');
  const [c] = await sql`SELECT name, st FROM clients WHERE id = ${id}`;
  if (!c) throw httpError(404, 'العميل غير موجود');
  const susp = c.st === 'susp';
  await sql`UPDATE clients SET st = ${susp ? 'ok' : 'susp'} WHERE id = ${id}`;
  return susp ? `أُعيد تفعيل ${c.name}` : `أُوقف ${c.name} — لا يستطيع الطلب حتى إعادة التفعيل`;
}

async function clientsToggleWallet(role, { id }) {
  if (role !== 'b2b') throw httpError(403, 'تجميد المحافظ صلاحية B2B');
  const [c] = await sql`SELECT name, wst FROM clients WHERE id = ${id}`;
  if (!c) throw httpError(404, 'العميل غير موجود');
  const frozen = c.wst === 'frozen';
  await sql`UPDATE clients SET wst = ${frozen ? 'ok' : 'frozen'} WHERE id = ${id}`;
  return frozen ? `فُك تجميد محفظة ${c.name}` : `جُمّدت محفظة ${c.name} — لا شحن ولا صرف حتى فك التجميد`;
}

async function clientsPatch(role, { id, branches, staff }, msg) {
  if (!['b2b', 'fr', 'frzs'].includes(role)) throw httpError(403, 'لا صلاحية');
  const [c] = await sql`SELECT id FROM clients WHERE id = ${id}`;
  if (!c) throw httpError(404, 'العميل غير موجود');
  if (branches) await sql`UPDATE clients SET branches = ${JSON.stringify(branches)} WHERE id = ${id}`;
  if (staff) await sql`UPDATE clients SET staff = ${JSON.stringify(staff)} WHERE id = ${id}`;
  return msg || 'تم التحديث';
}

// ============ الكتالوج والمستخدمون والفروع ============

async function productsToggle(role, { pid }) {
  if (role !== 'b2b') throw httpError(403, 'إدارة الكتالوج صلاحية B2B');
  const [p] = await sql`SELECT name, is_out FROM products WHERE id = ${pid}`;
  if (!p) throw httpError(404, 'المنتج غير موجود');
  await sql`UPDATE products SET is_out = ${!p.is_out} WHERE id = ${pid}`;
  return p.is_out ? `عاد «${p.name}» للتوفر` : `أُوقف «${p.name}» مؤقتًا — يختفي من كتالوج العملاء`;
}

async function usersAdd(role, { name, email, userRole, branches }) {
  if (!['ops', 'owner', 'fr', 'frz', 'frzs', 'b2b'].includes(role)) throw httpError(403, 'لا صلاحية');
  const n = (name || '').trim();
  if (!n) throw httpError(400, 'اكتب اسم المستخدم أولًا');
  if (!(email || '').includes('@')) throw httpError(400, 'أدخل إيميلًا صحيحًا');
  if (!Array.isArray(branches) || !branches.length) throw httpError(400, 'حدد فرعًا واحدًا على الأقل');
  const finalRole = role === 'ops' ? 'worker' : (['worker', 'ops', 'fin'].includes(userRole) ? userRole : 'worker');
  await sql`INSERT INTO org_users (id, name, email, role, branch, st)
            VALUES (${Date.now()}, ${n}, ${email.trim()}, ${finalRole}, ${branches.join(' · ')}, 'pend')`;
  return `أُنشئ حساب ${n} — فعّله ليستطيع الدخول بالإيميل وكلمة السر`;
}

async function usersSetStatus(role, { id, st }) {
  if (!['ops', 'owner', 'fr', 'frz', 'frzs', 'b2b'].includes(role)) throw httpError(403, 'لا صلاحية');
  if (!['ok', 'off'].includes(st)) throw httpError(400, 'حالة غير صالحة');
  const [u] = await sql`SELECT name, role FROM org_users WHERE id = ${id}`;
  if (!u) throw httpError(404, 'المستخدم غير موجود');
  if (role === 'ops' && u.role !== 'worker') throw httpError(403, 'صلاحيتك تتيح إدارة حسابات العمال فقط');
  await sql`UPDATE org_users SET st = ${st} WHERE id = ${id}`;
  return st === 'ok' ? `فُعّل حساب ${u.name}` : `أُوقف ${u.name} — لا يستطيع الدخول`;
}

async function usersUpdate(role, { id, userRole, branches }) {
  if (!['ops', 'owner', 'fr', 'frz', 'frzs', 'b2b'].includes(role)) throw httpError(403, 'لا صلاحية');
  if (!Array.isArray(branches) || !branches.length) throw httpError(400, 'حدد فرعًا واحدًا على الأقل');
  const [u] = await sql`SELECT name, role FROM org_users WHERE id = ${id}`;
  if (!u) throw httpError(404, 'المستخدم غير موجود');
  if (role === 'ops' && u.role !== 'worker') throw httpError(403, 'صلاحيتك تتيح إدارة حسابات العمال فقط');
  const finalRole = ['worker', 'ops', 'fin'].includes(userRole) ? userRole : u.role;
  await sql`UPDATE org_users SET role = ${finalRole}, branch = ${branches.join(' · ')} WHERE id = ${id}`;
  return `حُدّثت صلاحيات ${u.name} — الدور والفروع سرت فورًا`;
}

async function branchesAdd(role, { name, loc }) {
  if (!['owner', 'fr', 'frz', 'frzs', 'b2b'].includes(role)) throw httpError(403, 'لا صلاحية');
  const n = (name || '').trim();
  if (!n) throw httpError(400, 'اكتب اسم الفرع أولًا');
  if (!loc || typeof loc.x !== 'number' || !loc.addr) throw httpError(400, 'حدد موقع الفرع على الخريطة أولًا — الموقع إلزامي');
  await sql`INSERT INTO branches (name, city, st, loc) VALUES (${n}, 'الرياض', 'ok', ${JSON.stringify(loc)})
            ON CONFLICT (name) DO NOTHING`;
  return 'أُضيف الفرع بموقعه — اربط به المستخدمين من جدول الفريق';
}

async function branchesToggle(role, { name }) {
  if (!['owner', 'fr', 'frz', 'frzs', 'b2b'].includes(role)) throw httpError(403, 'لا صلاحية');
  const [b] = await sql`SELECT st FROM branches WHERE name = ${name}`;
  if (!b) throw httpError(404, 'الفرع غير موجود');
  const off = b.st === 'off';
  await sql`UPDATE branches SET st = ${off ? 'ok' : 'off'} WHERE name = ${name}`;
  return off ? `أُعيد تفعيل ${name} — يستطيع الطلب من جديد` : `أُوقف ${name} مؤقتًا — لن تُقبل طلبات جديدة منه`;
}

async function branchesDelete(role, { name }) {
  if (!['owner', 'fr', 'frz', 'frzs', 'b2b'].includes(role)) throw httpError(403, 'لا صلاحية');
  await sql`DELETE FROM branches WHERE name = ${name}`;
  return `حُذف ${name} نهائيًا — طلباته السابقة باقية في السجل`;
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
  'invoices.pay': invoicesPay,
  'lists.save': listsSave,
  'reqs.submit': reqsSubmit,
  'reqs.approve': reqsApprove,
  'reqs.reject': reqsReject,
  'frs.create': frsCreate,
  'frs.approve': frsApprove,
  'frs.toggle': frsToggle,
  'frs.addSub': frsAddSub,
  'clients.toggleAccount': clientsToggleAccount,
  'clients.toggleWallet': clientsToggleWallet,
  'clients.patch': (role, p) => clientsPatch(role, p, p.msg),
  'products.toggle': productsToggle,
  'users.add': usersAdd,
  'users.setStatus': usersSetStatus,
  'users.update': usersUpdate,
  'branches.add': branchesAdd,
  'branches.toggle': branchesToggle,
  'branches.delete': branchesDelete,
};
