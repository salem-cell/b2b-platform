// ============================================================
// منطق الأعمال — كل تحولات الحالة تمر من هنا
// (دورة حياة الطلب، المحفظة، التذاكر، الفرنشايز، المستخدمون…)
// ============================================================
import { getState, setState } from './core/store.js';
import { fmt, fmt0, now, VAT } from './core/format.js';
import { ROLES, SUPER_FR_ID } from './data/constants.js';
import { PRODUCT_MAP, PRODUCTS } from './data/products.js';

let toastTimer = null;

/** توست عابر أعلى الشاشة */
export function say(msg) {
  clearTimeout(toastTimer);
  setState({ toast: msg });
  toastTimer = setTimeout(() => setState({ toast: null }), 2900);
}

/** إجمالي طلب شامل الضريبة */
export function orderTotal(o) {
  return o.items.reduce((s, i) => s + PRODUCT_MAP[i.pid].price * i.qty, 0) * (1 + VAT);
}

export function findOrder(id) {
  return getState().orders.find((o) => o.id === id);
}

/** التنقل بين الصفحات (يغلق أي طبقة مفتوحة) */
export function go(page) {
  setState({ page, drawer: null, modal: null, notifOpen: false });
}

export function closeAll() {
  setState({ drawer: null, modal: null });
}

/** بث إشعار داخلي لأدوار محددة */
function notify(state, roles, msg) {
  const en = { ...state.extraNotifs };
  roles.forEach((r) => { en[r] = [msg, ...(en[r] || [])]; });
  return en;
}

// ---------- الجلسة ----------
export function sendOtp() {
  const st = getState();
  if ((st.phone || '').trim().length < 9) { say('أدخل رقم جوال صحيح'); return; }
  setState({ auth: 'otp' });
  say('أُرسل رمز التحقق — اكتب أي 4 أرقام');
}

export function verifyOtp() {
  if (getState().otp.length === 4) setState({ auth: 'user' });
}

export function pickRole(role) {
  setState({ role, page: 'dash', mTab: 'home', mStack: [], drawer: null, modal: null });
}

export function switchUser() { setState({ role: null, auth: 'user' }); }
export function logout()     { setState({ role: null, auth: 'phone', phone: '', otp: '' }); }

// ---------- السلة والطلب ----------
export function addCart(pid, delta) {
  const cart = { ...getState().cart };
  cart[pid] = (cart[pid] || 0) + delta;
  if (cart[pid] <= 0) delete cart[pid];
  setState({ cart });
}

/** عميل الجلسة الحالية (منشأة المستخدم) */
export function sessionClientId(role) {
  return role === 'frz' ? 2 : role === 'frzs' ? 6 : 1;
}

export function submitOrder() {
  const st = getState();
  const items = Object.keys(st.cart).map((pid) => ({ pid, qty: st.cart[pid] }));
  if (!items.length) { say('السلة فارغة'); return; }
  const client = st.clients.find((c) => c.id === sessionClientId(st.role));
  if (client && client.st === 'susp') { say('حساب منشأتك موقوف — لا يمكن إرسال طلبات'); return; }
  const order = {
    id: `ORD-${st.orderSeq}`, by: ROLES[st.role].user, branch: 'فرع العليا',
    date: 'الآن', st: 'ops', items, stamps: [now(), '', '', '', '', ''],
  };
  setState({
    orders: [order, ...st.orders], cart: {}, modal: null, page: 'orders', mTab: 'orders', mStack: [], orderSeq: st.orderSeq + 1,
    extraNotifs: notify(st, ['ops'], { c: 'اعتمادات', text: `طلب جديد بانتظار تعميدك — ${order.id}`, t: 'الآن' }),
  });
  say(`أُرسل الطلب ${order.id} لتعميد مدير العمليات`);
}

// ---------- التعميد ----------
export function openApprove(id) {
  const o = findOrder(id);
  const qty = {};
  o.items.forEach((i) => { qty[i.pid] = i.qty; });
  setState({ approveQty: qty, modal: { k: 'approve', id }, drawer: null });
}

export function approveQtyDelta(pid, delta) {
  const q = { ...getState().approveQty };
  q[pid] = Math.max(0, (q[pid] || 0) + delta);
  setState({ approveQty: q });
}

export function doApprove() {
  const st = getState();
  const o = findOrder(st.modal.id);
  let changed = false;
  const items = o.items
    .map((i) => { const q = st.approveQty[i.pid]; if (q !== i.qty) changed = true; return { ...i, qty: q }; })
    .filter((i) => i.qty > 0);
  const orders = st.orders.map((x) => {
    if (x.id !== o.id) return x;
    const n = { ...x, items };
    if (x.st === 'ops') { n.st = 'purch'; n.stamps = [...x.stamps]; n.stamps[1] = now(); }
    else if (x.st === 'purch') { n.st = 'b2b'; n.stamps = [...x.stamps]; n.stamps[2] = now(); n.stamps[3] = now(); }
    return n;
  });
  setState({ orders, modal: null });
  say(
    o.st === 'ops'
      ? (changed ? `عُدّلت الكميات وعُمّد ${o.id} — أُشعر مقدّم الطلب ومدير المشتريات` : `عُمّد ${o.id} وأُرسل لمدير المشتريات`)
      : o.st === 'purch'
        ? `التعميد النهائي تم — أُرسل ${o.id} إلى B2B`
        : (changed ? `عُدّل ${o.id} وأُشعر العميل` : `لا تغيير على ${o.id}`),
  );
}

export function confirmReject() {
  const st = getState();
  if ((st.rejectText || '').trim().length < 5) { say('اكتب سبب الرفض أولًا — السبب إلزامي ويصل نصًا لمقدّم الطلب'); return; }
  const o = findOrder(st.modal.id);
  const orders = st.orders.map((x) => x.id === o.id
    ? { ...x, st: 'rej', reason: st.rejectText.trim(), rejAt: (x.st === 'ops' ? 1 : x.st === 'purch' ? 2 : 4) }
    : x);
  setState({
    orders, modal: null, rejectText: '',
    extraNotifs: notify(st, ['worker', 'ops'], { c: 'اعتمادات', text: `رُفض ${o.id} — ${st.rejectText.trim()}`, t: 'الآن' }),
  });
  say(`رُفض ${o.id} وأُرسل السبب لمقدّم الطلب`);
}

// ---------- عمليات B2B على الطلب ----------
export function confirmHold() {
  const st = getState();
  if ((st.holdText || '').trim().length < 5) { say('اكتب سبب التعليق أولًا — يظهر للعميل نصًا'); return; }
  const o = findOrder(st.modal.id);
  const orders = st.orders.map((x) => (x.id === o.id ? { ...x, st: 'hold', holdReason: st.holdText.trim() } : x));
  setState({
    orders, modal: null, holdText: '',
    extraNotifs: notify(st, ['worker', 'ops', 'owner', 'frz'], { c: 'طلبات', text: `علّق B2B الطلب ${o.id} — ${st.holdText.trim()}`, t: 'الآن' }),
  });
  say(`عُلّق ${o.id} — يظهر السبب للعميل ويمكن الاستئناف`);
}

export function resumeOrder(id) {
  setState({ orders: getState().orders.map((x) => (x.id === id ? { ...x, st: 'b2b', holdReason: null } : x)), drawer: null });
  say(`استؤنف تجهيز ${id}`);
}

export function b2bAdvance(id) {
  const st = getState();
  const orders = st.orders.map((x) => {
    if (x.id !== id) return x;
    const n = { ...x, st: 'ship', stamps: [...x.stamps] };
    n.stamps[4] = now();
    return n;
  });
  setState({
    orders, drawer: null,
    extraNotifs: notify(st, ['worker'], { c: 'طلبات', text: `خرج طلبك ${id} للتوصيل — أكّد الاستلام عند وصوله`, t: 'الآن' }),
  });
  say(`أُرسل ${id} للتوصيل`);
}

// ---------- الاستلام والنواقص ----------
export function openReceive(id) {
  const o = findOrder(id);
  const recv = {};
  o.items.forEach((i) => { recv[i.pid] = { short: false, recv: i.qty }; });
  setState({ recv, modal: { k: 'receive', id }, drawer: null });
}

export function toggleShort(pid, qty) {
  const r = { ...getState().recv };
  const cur = r[pid];
  r[pid] = { short: !cur.short, recv: !cur.short ? Math.max(0, qty - 1) : qty };
  setState({ recv: r });
}

export function recvQtyDelta(pid, delta, max) {
  const r = { ...getState().recv };
  r[pid] = { ...r[pid], recv: Math.min(max, Math.max(0, r[pid].recv + delta)) };
  setState({ recv: r });
}

export function confirmReceive() {
  const st = getState();
  const o = findOrder(st.modal.id);
  const shorts = o.items.filter((i) => st.recv[i.pid].short);
  let tickets = st.tickets;
  const tid = `TKT-${st.ticketSeq}`;
  if (shorts.length) {
    const val = shorts.reduce((s, i) => s + PRODUCT_MAP[i.pid].price * (i.qty - st.recv[i.pid].recv), 0) * (1 + VAT);
    tickets = [{
      id: tid, ord: o.id, customer: `مطاعم البلدة — ${o.branch}`,
      desc: shorts.map((i) => PRODUCT_MAP[i.pid].name).join(' · '),
      qty: `ناقص ${shorts.map((i) => `${i.qty - st.recv[i.pid].recv} × ${PRODUCT_MAP[i.pid].unit}`).join(' + ')}`,
      val, st: 'open', date: 'الآن',
    }, ...st.tickets];
  }
  const orders = st.orders.map((x) => {
    if (x.id !== o.id) return x;
    const n = { ...x, st: shorts.length ? 'short' : 'done', stamps: [...x.stamps] };
    n.stamps[5] = now();
    if (shorts.length) n.ticket = tid;
    return n;
  });
  const extraNotifs = shorts.length
    ? notify(st, ['b2b'], { c: 'تذاكر', text: `تذكرة نواقص جديدة ${tid} على ${o.id}`, t: 'الآن' })
    : st.extraNotifs;
  setState({
    orders, tickets, extraNotifs,
    notifUnread: st.notifUnread + (shorts.length ? 1 : 0),
    ticketSeq: st.ticketSeq + (shorts.length ? 1 : 0),
    modal: null, page: 'orders', mTab: 'orders', mStack: [],
  });
  say(shorts.length
    ? `أُكّد الاستلام وفُتحت تذكرة نواقص ${tid} — أُرسلت إلى B2B لحلّها`
    : `تم تأكيد استلام ${o.id} بالكامل`);
}

// ---------- التذاكر (B2B) ----------
export function resolveTicket(id) {
  const st = getState();
  const t = st.tickets.find((x) => x.id === id);
  const cn = `CN-${st.cnSeq}`;
  const tickets = st.tickets.map((x) => (x.id === id ? { ...x, st: 'resolved', cn } : x));
  const invoices = [{ id: cn, ref: `نواقص ${t.ord}`, due: 'إشعار دائن', amt: -t.val, rem: 0, st: 'credit' }, ...st.invoices];
  const wallet = {
    ...st.wallet, bal: st.wallet.bal + t.val,
    hist: [{ t: `إشعار دائن ${cn} — تسوية ${t.id}`, d: 'الآن', amt: t.val }, ...st.wallet.hist],
  };
  setState({
    tickets, invoices, wallet, cnSeq: st.cnSeq + 1, modal: null,
    extraNotifs: notify(st, ['worker', 'ops', 'owner', 'frz', 'fin'], {
      c: 'مالية', text: `حُلّت تذكرة النواقص ${t.id} — صدر إشعار دائن ${cn} بقيمة ${fmt(t.val)} ر.س في محفظتك`, t: 'الآن',
    }),
    notifUnread: st.notifUnread + 1,
  });
  say(`صدر إشعار دائن ${cn} بقيمة ${fmt(t.val)} ر.س وأُقفلت ${t.id}`);
}

export function confirmTicketHold() {
  const st = getState();
  if ((st.tHoldText || '').trim().length < 5) { say('اكتب سبب التعليق أولًا'); return; }
  const id = st.modal.id;
  setState({
    tickets: st.tickets.map((x) => (x.id === id ? { ...x, st: 'held', holdReason: st.tHoldText.trim() } : x)),
    modal: { k: 'ticket', id }, tHoldText: '',
    extraNotifs: notify(st, ['worker', 'ops', 'owner', 'frz', 'fin'], {
      c: 'تذاكر', text: `علّق B2B تذكرة النواقص ${id} — السبب: ${st.tHoldText.trim()}`, t: 'الآن',
    }),
    notifUnread: st.notifUnread + 1,
  });
  say(`عُلّقت التذكرة ${id} — أُشعر العميل بالسبب`);
}

export function resumeTicket(id) {
  setState({ tickets: getState().tickets.map((x) => (x.id === id ? { ...x, st: 'open', holdReason: null } : x)) });
  say(`استؤنفت التذكرة ${id}`);
}

// ---------- المحفظة والفواتير ----------
export function payInvoice(id) {
  const st = getState();
  const inv = st.invoices.find((x) => x.id === id);
  const wallet = {
    ...st.wallet, bal: st.wallet.bal - inv.rem,
    hist: [{ t: `سداد فاتورة ${inv.id} من المحفظة`, d: 'الآن', amt: -inv.rem }, ...st.wallet.hist],
  };
  setState({
    wallet,
    invoices: st.invoices.map((x) => (x.id === id ? { ...x, st: 'paid', rem: 0, due: 'سُددت الآن' } : x)),
  });
  say(`سُددت ${inv.id} من المحفظة — الرصيد الجديد ${fmt(wallet.bal)} ر.س`);
}

export function confirmTopup() {
  const st = getState();
  const wallet = {
    ...st.wallet, bal: st.wallet.bal + st.topupAmt,
    hist: [{ t: `شحن المحفظة — ${st.topupMethod}`, d: 'الآن', amt: st.topupAmt }, ...st.wallet.hist],
  };
  setState({ wallet, modal: null });
  say(`تم شحن ${fmt0(st.topupAmt)} ر.س — صدر إيصال PDF`);
}

// ---------- اللستات المحفوظة ----------
export function addListToCart(index) {
  const st = getState();
  const cart = { ...st.cart };
  const list = st.lists[index];
  list.items.forEach(([pid, q]) => { if (PRODUCT_MAP[pid]) cart[pid] = (cart[pid] || 0) + q; });
  setState({ cart });
  say(`أُضيفت أصناف «${list.name}» إلى السلة`);
}

export function listQtyDelta(pid, delta) {
  const q = { ...(getState().lnQty || {}) };
  q[pid] = (q[pid] || 0) + delta;
  if (q[pid] <= 0) delete q[pid];
  setState({ lnQty: q });
}

export function saveList() {
  const st = getState();
  const items = Object.keys(st.lnQty || {}).map((pid) => [pid, st.lnQty[pid]]);
  if (!items.length) { say('أضف صنفًا واحدًا على الأقل بعلامة +'); return; }
  if (!(st.lnName || '').trim()) { say('اكتب اسم اللستة أولًا'); return; }
  setState({ lists: [...st.lists, { name: st.lnName.trim(), items }], modal: null, lnQty: {}, lnName: '', lnSearch: '' });
  say(`حُفظت لستة «${st.lnName.trim()}» — تجدها فوق الكتالوج`);
}

// ---------- اقتراحات المنتجات ----------
export function submitRequest() {
  const st = getState();
  if (!(st.reqName || '').trim()) { say('اكتب اسم المنتج المطلوب أولًا'); return; }
  const req = {
    id: `REQ-${st.reqSeq}`, name: st.reqName.trim(), unit: (st.reqUnit || '').trim(),
    by: st.role === 'fr' ? 'دوار السعادة — المانح' : 'مطاعم البلدة',
    user: ROLES[st.role].user, note: (st.reqNote || '').trim() || '—', date: 'الآن', st: 'pend',
  };
  setState({ prodReqs: [req, ...st.prodReqs], reqSeq: st.reqSeq + 1, modal: null, reqName: '', reqUnit: '', reqNote: '' });
  say(`أُرسل اقتراحك ${req.id} لفريق B2B — يراجعه ويسعّره خلال يوم عمل`);
}

export function approveRequest(id) {
  const st = getState();
  const r = st.prodReqs.find((x) => x.id === id);
  const np = { id: `P-6${String(PRODUCTS.length).padStart(3, '0')}`, name: r.name, unit: r.unit || 'حبة', cat: 'مواد غذائية', price: 64, h: 210, img: '', out: false };
  PRODUCTS.push(np);
  PRODUCT_MAP[np.id] = np;
  setState({ prodReqs: st.prodReqs.map((x) => (x.id === id ? { ...x, st: 'ok' } : x)) });
  say(`أُضيف «${r.name}» للكتالوج وسُعّر — يظهر للعملاء الآن`);
}

export function rejectRequest(id) {
  setState({ prodReqs: getState().prodReqs.map((x) => (x.id === id ? { ...x, st: 'no' } : x)) });
  say('رُفض الاقتراح وأُشعر العميل');
}

// ---------- الفرنشايز ----------
export function sendInvite() {
  const st = getState();
  if (!st.frName.trim() || !st.frCr.trim()) { say('أدخل اسم المنشأة ورقم السجل التجاري'); return; }
  const isSuper = st.role === 'fr' && st.frKind === 'super';
  if (isSuper && !(st.frRegion || '').trim()) { say('حدد منطقة امتياز الممنوح السوبر'); return; }
  const name = st.frName.trim(), cr = st.frCr.trim(), id = Date.now();
  const city = st.role === 'frzs' ? 'المنطقة الشرقية' : isSuper ? st.frRegion.trim() : '—';
  setState({
    frs: [...st.frs, {
      id, name, city, cr, orders: 0, spend: 0, pay: 0, st: 'new', bal: 0, active: true,
      parent: st.role === 'frzs' ? SUPER_FR_ID : undefined,
      super: isSuper || undefined,
      region: isSuper ? st.frRegion.trim() : undefined,
    }],
    clients: [...st.clients, { id, name, cr, city: '—', orders: 0, spend: 0, st: 'ok', bal: 0, limit: 20000, used: 0, wst: 'ok', branches: [], staff: [] }],
    modal: null, frName: '', frCr: '', frKind: 'normal', frRegion: '',
  });
  say(isSuper
    ? `أُنشئ ممنوح سوبر لمنطقة «${st.frRegion.trim()}» — تعميده وتفعيله بيد B2B أدمن`
    : 'أُنشئ الممنوح — تعميده وتفعيله بيد B2B أدمن');
}

/** إنشاء ممنوح تابع من داخل ملف الممنوح السوبر (لدى B2B أو المانح) */
export function addSubFranchisee() {
  const st = getState();
  const client = st.clients.find((x) => x.id === st.clientSel);
  const frEntry = st.frs.find((f) => f.name === client.name);
  const name = (st.clSubName || '').trim(), cr = (st.clSubCr || '').trim();
  if (!name || !cr) { say('أدخل اسم منشأة الممنوح التابع ورقم سجله التجاري'); return; }
  const id = Date.now();
  setState({
    frs: [...st.frs, { id, name, city: frEntry.region || '—', cr, orders: 0, spend: 0, pay: 0, st: 'new', bal: 0, active: true, parent: frEntry.id }],
    clients: [...st.clients, { id, name, cr, city: frEntry.region || '—', orders: 0, spend: 0, st: 'ok', bal: 0, limit: 20000, used: 0, wst: 'ok', branches: [], staff: [] }],
    clSubName: '', clSubCr: '',
  });
  say(`أُنشئ الممنوح التابع «${name}» ضمن ${frEntry.region || 'منطقة السوبر'} — تعميده وتفعيله بيد B2B أدمن`);
}

export function approveFranchisee(id) {
  const st = getState();
  const f = st.frs.find((x) => x.id === id);
  setState({ frs: st.frs.map((x) => (x.id === id ? { ...x, st: 'ok' } : x)) });
  say(`عمّد B2B الممنوح «${f.name}» — فُعّل حسابه وأُنشئت محفظته المستقلة`);
}

export function toggleFranchisee(id) {
  const st = getState();
  const f = st.frs.find((x) => x.id === id);
  setState({ frs: st.frs.map((x) => (x.id === id ? { ...x, active: !x.active } : x)) });
  say(f.active ? `أُوقف حساب ${f.name}` : `أُعيد تفعيل ${f.name}`);
}

// ---------- العملاء (B2B) ----------
export function toggleClientAccount(id) {
  const st = getState();
  const c = st.clients.find((x) => x.id === id);
  const susp = c.st === 'susp';
  setState({ clients: st.clients.map((x) => (x.id === id ? { ...x, st: susp ? 'ok' : 'susp' } : x)) });
  say(susp ? `أُعيد تفعيل ${c.name}` : `أُوقف ${c.name} — لا يستطيع الطلب حتى إعادة التفعيل`);
}

export function toggleClientWallet(id) {
  const st = getState();
  const c = st.clients.find((x) => x.id === id);
  const frozen = c.wst === 'frozen';
  setState({ clients: st.clients.map((x) => (x.id === id ? { ...x, wst: frozen ? 'ok' : 'frozen' } : x)) });
  say(frozen ? `فُك تجميد محفظة ${c.name}` : `جُمّدت محفظة ${c.name} — لا شحن ولا صرف حتى فك التجميد`);
}

export function openClientProfile(id, walletView = false, prev = null) {
  setState({ page: 'clientdet', clientSel: id, clientPrev: prev, clWalletOpen: walletView, drawer: null, modal: null });
}

/** رجوع من ملف العميل: لملف السوبر الأب إن وُجد، وإلا لقائمة العملاء/الممنوحين */
export function backFromClientProfile() {
  const st = getState();
  if (st.clientPrev) {
    setState({ clientSel: st.clientPrev, clientPrev: null, clWalletOpen: false });
    return;
  }
  go((st.role === 'fr' || st.role === 'frzs') ? 'frs' : 'clients');
}

/** شبكة الفرنشايز حسب دور الجلسة:
 *  myFrs: من يظهر في «إدارة الممنوحين» — المانح: المستوى الأعلى فقط؛ السوبر: تابعوه؛ B2B: الكل.
 *  netFrs: من يدخل في التحليلات — المانح: الشبكة كاملة؛ غيره مثل myFrs. */
export function franchiseScope(st) {
  const myFrs = st.role === 'frzs'
    ? st.frs.filter((f) => f.parent === SUPER_FR_ID)
    : st.role === 'fr'
      ? st.frs.filter((f) => !f.parent)
      : st.frs;
  const netFrs = st.role === 'fr' ? st.frs : myFrs;
  return { myFrs, netFrs };
}

/** تسمية الممنوح في القوائم التحليلية (يُظهر التبعية أو صفة السوبر) */
export function frTag(st, f) {
  if (f.parent) {
    const parent = st.frs.find((x) => x.id === f.parent);
    return `${f.name} — تابع لـ ${parent ? parent.name : ''}`;
  }
  return f.super ? `${f.name} — سوبر` : f.name;
}

/** تعديل عميل داخل ملفه (فروع/فريق) */
export function updateClient(id, fn) {
  const st = getState();
  setState({ clients: st.clients.map((x) => (x.id === id ? fn(x) : x)) });
}

// ---------- إدارة الكتالوج (B2B) ----------
export function toggleProductAvailability(pid) {
  const p = PRODUCT_MAP[pid];
  p.out = !p.out;
  setState({});   // إعادة رسم
  say(p.out ? `أُوقف «${p.name}» مؤقتًا — يختفي من كتالوج العملاء` : `عاد «${p.name}» للتوفر`);
}

// ---------- المستخدمون والفروع ----------
export function addUser() {
  const st = getState();
  if (!(st.usName || '').trim()) { say('اكتب اسم المستخدم أولًا'); return; }
  if (!(st.usEmail || '').trim().includes('@')) { say('أدخل إيميلًا صحيحًا'); return; }
  if ((st.usPass || '').length < 6) { say('كلمة السر 6 أحرف على الأقل'); return; }
  if (!(st.usBranches || []).length) { say('حدد فرعًا واحدًا على الأقل يتبعه المستخدم'); return; }
  const name = st.usName.trim();
  setState({
    users: [...st.users, {
      id: Date.now(), name, email: st.usEmail.trim(),
      role: st.role === 'ops' ? 'worker' : st.usRole,
      branch: st.usBranches.join(' · '), st: 'pend',
    }],
    usName: '', usEmail: '', usPass: '', usBranches: [], modal: null,
  });
  say(`أُنشئ حساب ${name} — فعّله ليستطيع الدخول بالإيميل وكلمة السر`);
}

export function setUserStatus(id, status, msg) {
  setState({ users: getState().users.map((x) => (x.id === id ? { ...x, st: status } : x)) });
  if (msg) say(msg);
}

export function saveUserEdit() {
  const st = getState();
  const branches = st.ueBranches || [];
  if (!branches.length) { say('حدد فرعًا واحدًا على الأقل'); return; }
  const user = st.users.find((x) => x.id === st.modal.id);
  setState({
    users: st.users.map((x) => (x.id === st.modal.id ? { ...x, role: st.ueRole || x.role, branch: branches.join(' · ') } : x)),
    modal: null,
  });
  say(`حُدّثت صلاحيات ${user ? user.name : 'المستخدم'} — الدور والفروع سرت فورًا`);
}

export function addBranch() {
  const st = getState();
  if (!(st.brName || '').trim()) { say('اكتب اسم الفرع أولًا'); return; }
  if (!st.brLoc) {
    say('حدد موقع الفرع على الخريطة أولًا — الموقع إلزامي');
    setState({ modal: { k: 'mapPick' }, mapTarget: 'br', mapPin: null, mapSearch: '' });
    return;
  }
  setState({ branches: [...st.branches, { name: st.brName.trim(), city: 'الرياض', loc: st.brLoc }], brName: '', brLoc: null });
  say('أُضيف الفرع بموقعه — اربط به المستخدمين من جدول الفريق');
}

// ---------- الخرائط ومواقع الفروع ----------

/** اسم الحي التقريبي من إحداثيات الخريطة (محاكاة geocoding) */
export function mapDistrict(x, y) {
  if (y < 30) return x < 45 ? 'حي النرجس' : 'حي الياسمين';
  if (y < 73) return x < 30 ? 'حي السليمانية' : x < 70 ? 'حي العليا' : 'حي الملز';
  return x < 50 ? 'حي الروضة' : 'حي المروج';
}

/** كائن موقع كامل من دبوس الخريطة */
export function locFromPin(pin) {
  return {
    x: pin.x, y: pin.y,
    addr: `${mapDistrict(pin.x, pin.y)}، الرياض`,
    coords: `${(24.60 + pin.y * 0.0021).toFixed(4)}°N, ${(46.60 + pin.x * 0.0028).toFixed(4)}°E`,
  };
}

export function confirmMapPick() {
  const st = getState();
  if (!st.mapPin) { say('انقر على الخريطة لإسقاط الدبوس أولًا'); return; }
  const loc = locFromPin(st.mapPin);
  setState(st.mapTarget === 'cl' ? { clBrLoc: loc, modal: null } : { brLoc: loc, modal: null });
  say('تم تثبيت موقع الفرع — أكمل الإضافة');
}

export function toggleBranch(name) {
  const st = getState();
  const b = st.branches.find((x) => x.name === name);
  const off = b.st === 'off';
  setState({ branches: st.branches.map((x) => (x.name === name ? { ...x, st: off ? 'ok' : 'off' } : x)) });
  say(off
    ? `أُعيد تفعيل ${name} — يستطيع الطلب من جديد`
    : `أُوقف ${name} مؤقتًا — لن تُقبل طلبات جديدة منه`);
}

export function deleteBranch(name) {
  setState({ branches: getState().branches.filter((x) => x.name !== name), modal: null });
  say(`حُذف ${name} نهائيًا — طلباته السابقة باقية في السجل`);
}

// ---------- الإشعارات ----------
export function toggleNotif() { setState({ notifOpen: !getState().notifOpen }); }
export function markAllRead() {
  setState({ notifUnread: 0, notifOpen: false });
  say('عُلّمت كل الإشعارات كمقروءة');
}
