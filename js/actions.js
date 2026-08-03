// ============================================================
// إجراءات الواجهة — الخادم هو مصدر الحقيقة:
// كل عملية أعمال = أمر API (js/core/api.js) يعيد لقطة حالة محدّثة.
// التحققات هنا لتجربة استخدام سريعة فقط؛ الخادم يعيد التحقق دائمًا.
// ============================================================
import { getState, setState } from './core/store.js';
import { apiGet, apiPost, applySnapshot, command } from './core/api.js';
import { VAT } from './core/format.js';
import { SUPER_FR_ID } from './data/constants.js';
import { PRODUCT_MAP } from './data/products.js';

let toastTimer = null;

/** توست عابر أعلى الشاشة */
export function say(msg) {
  clearTimeout(toastTimer);
  setState({ toast: msg });
  toastTimer = setTimeout(() => setState({ toast: null }), 2900);
}

/** تنفيذ أمر خادم مع توست النتيجة (نجاحًا أو خطأ) */
async function run(cmd, payload = {}, extra = {}) {
  try {
    say(await command(cmd, payload, extra));
    return true;
  } catch (err) {
    say(err.message || 'تعذر الاتصال بالخادم');
    return false;
  }
}

/** إجمالي طلب شامل الضريبة */
export function orderTotal(o) {
  return o.items.reduce((s, i) => s + ((PRODUCT_MAP[i.pid] || {}).price || 0) * i.qty, 0) * (1 + VAT);
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

/** عميل الجلسة الحالية (منشأة المستخدم) */
export function sessionClientId(role) {
  return role === 'frz' ? 2 : role === 'frzs' ? 6 : 1;
}

// ---------- الجلسة ----------
export function sendOtp() {
  const st = getState();
  if ((st.phone || '').trim().length < 9) { say('أدخل رقم جوال صحيح'); return; }
  setState({ auth: 'otp' });
  say('أُرسل رمز التحقق — اكتب أي 4 أرقام');
}

export async function verifyOtp() {
  const st = getState();
  if (st.otp.length !== 4) return;
  try {
    await apiPost('auth', { action: 'verify', phone: st.phone, otp: st.otp });
    setState({ auth: 'user' });
  } catch (err) { say(err.message); }
}

export async function pickRole(role) {
  try {
    await apiPost('auth', { action: 'role', role });
    const { snapshot } = await apiGet('state');
    applySnapshot(snapshot, { role, page: 'dash', mTab: 'home', mStack: [], drawer: null, modal: null, notifUnread: 2 });
  } catch (err) { say(err.message); }
}

export function switchUser() { setState({ role: null, auth: 'user', drawer: null, modal: null, mStack: [] }); }

export async function logout() {
  try { await apiPost('auth', { action: 'logout' }); } catch { /* الجلسة محلية على أي حال */ }
  setState({ role: null, auth: 'phone', phone: '', otp: '', cart: {}, drawer: null, modal: null, mStack: [], mTab: 'home' });
}

/** استرجاع جلسة قائمة عند فتح الصفحة (يبقي النظام لايف بعد التحديث) */
export async function restoreSession() {
  try {
    const s = await apiGet('auth');
    if (!s.role) return;
    const { snapshot } = await apiGet('state');
    applySnapshot(snapshot, { role: s.role, notifUnread: 2 });
  } catch { /* لا جلسة — تبقى شاشة الدخول */ }
}

// ---------- السلة والطلب ----------
export function addCart(pid, delta) {
  const cart = { ...getState().cart };
  cart[pid] = (cart[pid] || 0) + delta;
  if (cart[pid] <= 0) delete cart[pid];
  setState({ cart });
}

export async function submitOrder() {
  const st = getState();
  const items = Object.keys(st.cart).map((pid) => ({ pid, qty: st.cart[pid] }));
  if (!items.length) { say('السلة فارغة'); return; }
  await run('orders.submit', { items }, { cart: {}, modal: null, page: 'orders', mTab: 'orders', mStack: [] });
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

export async function doApprove() {
  const st = getState();
  await run('orders.approve', { id: st.modal.id, qty: st.approveQty }, { modal: null });
}

export async function confirmReject() {
  const st = getState();
  if ((st.rejectText || '').trim().length < 5) { say('اكتب سبب الرفض أولًا — السبب إلزامي ويصل نصًا لمقدّم الطلب'); return; }
  await run('orders.reject', { id: st.modal.id, reason: st.rejectText }, { modal: null, rejectText: '' });
}

// ---------- عمليات B2B على الطلب ----------
export async function confirmHold() {
  const st = getState();
  if ((st.holdText || '').trim().length < 5) { say('اكتب سبب التعليق أولًا — يظهر للعميل نصًا'); return; }
  await run('orders.hold', { id: st.modal.id, reason: st.holdText }, { modal: null, holdText: '' });
}

export async function resumeOrder(id) {
  await run('orders.resume', { id }, { drawer: null });
}

export async function b2bAdvance(id) {
  await run('orders.advance', { id }, { drawer: null });
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

export async function confirmReceive() {
  const st = getState();
  await run('orders.receive', { id: st.modal.id, recv: st.recv },
    { modal: null, page: 'orders', mTab: 'orders', mStack: [], notifUnread: st.notifUnread + 1 });
}

// ---------- التذاكر (B2B) ----------
export async function resolveTicket(id) {
  const st = getState();
  await run('tickets.resolve', { id }, { modal: null, notifUnread: st.notifUnread + 1 });
}

export async function confirmTicketHold() {
  const st = getState();
  if ((st.tHoldText || '').trim().length < 5) { say('اكتب سبب التعليق أولًا'); return; }
  await run('tickets.hold', { id: st.modal.id, reason: st.tHoldText },
    { modal: { k: 'ticket', id: st.modal.id }, tHoldText: '' });
}

export async function resumeTicket(id) {
  await run('tickets.resume', { id });
}

// ---------- المحفظة والفواتير ----------
export async function payInvoice(id) {
  await run('invoices.pay', { id });
}

export async function confirmTopup() {
  const st = getState();
  await run('wallet.topup', { amt: st.topupAmt, method: st.topupMethod }, { modal: null });
}

// ---------- اللستات المحفوظة ----------
export function addListToCart(index) {
  const st = getState();
  const cart = { ...st.cart };
  const list = st.lists[index];
  list.items.forEach(([pid, q]) => { if (PRODUCT_MAP[pid] && !PRODUCT_MAP[pid].out) cart[pid] = (cart[pid] || 0) + q; });
  setState({ cart });
  say(`أُضيفت أصناف «${list.name}» إلى السلة`);
}

export function listQtyDelta(pid, delta) {
  const q = { ...(getState().lnQty || {}) };
  q[pid] = (q[pid] || 0) + delta;
  if (q[pid] <= 0) delete q[pid];
  setState({ lnQty: q });
}

export async function saveList() {
  const st = getState();
  const items = Object.keys(st.lnQty || {}).map((pid) => [pid, st.lnQty[pid]]);
  if (!items.length) { say('أضف صنفًا واحدًا على الأقل بعلامة +'); return; }
  if (!(st.lnName || '').trim()) { say('اكتب اسم اللستة أولًا'); return; }
  await run('lists.save', { name: st.lnName, items }, { modal: null, lnQty: {}, lnName: '', lnSearch: '' });
}

// ---------- اقتراحات المنتجات ----------
export async function submitRequest() {
  const st = getState();
  if (!(st.reqName || '').trim()) { say('اكتب اسم المنتج المطلوب أولًا'); return; }
  await run('reqs.submit', { name: st.reqName, unit: st.reqUnit, note: st.reqNote },
    { modal: null, reqName: '', reqUnit: '', reqNote: '' });
}

export async function approveRequest(id) {
  await run('reqs.approve', { id });
}

export async function rejectRequest(id) {
  await run('reqs.reject', { id });
}

// ---------- الفرنشايز ----------
export async function sendInvite() {
  const st = getState();
  if (!st.frName.trim() || !st.frCr.trim()) { say('أدخل اسم المنشأة ورقم السجل التجاري'); return; }
  const isSuper = st.role === 'fr' && st.frKind === 'super';
  if (isSuper && !(st.frRegion || '').trim()) { say('حدد منطقة امتياز الممنوح السوبر'); return; }
  await run('frs.create', { name: st.frName, cr: st.frCr, kind: st.frKind, region: st.frRegion },
    { modal: null, frName: '', frCr: '', frKind: 'normal', frRegion: '' });
}

export async function addSubFranchisee() {
  const st = getState();
  if (!(st.clSubName || '').trim() || !(st.clSubCr || '').trim()) { say('أدخل اسم منشأة الممنوح التابع ورقم سجله التجاري'); return; }
  await run('frs.addSub', { clientId: st.clientSel, name: st.clSubName, cr: st.clSubCr },
    { clSubName: '', clSubCr: '' });
}

export async function approveFranchisee(id) {
  await run('frs.approve', { id });
}

export async function toggleFranchisee(id) {
  await run('frs.toggle', { id });
}

// ---------- العملاء (B2B) ----------
export async function toggleClientAccount(id) {
  await run('clients.toggleAccount', { id });
}

export async function toggleClientWallet(id) {
  await run('clients.toggleWallet', { id });
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

/** تحديث فروع/فريق عميل على الخادم */
export async function patchClient(id, patch, msg, extra = {}) {
  await run('clients.patch', { id, ...patch, msg }, extra);
}

/** شبكة الفرنشايز حسب دور الجلسة */
export function franchiseScope(st) {
  const myFrs = st.role === 'frzs'
    ? st.frs.filter((f) => f.parent === SUPER_FR_ID)
    : st.role === 'fr'
      ? st.frs.filter((f) => !f.parent)
      : st.frs;
  const netFrs = st.role === 'fr' ? st.frs : myFrs;
  return { myFrs, netFrs };
}

/** تسمية الممنوح في القوائم التحليلية */
export function frTag(st, f) {
  if (f.parent) {
    const parent = st.frs.find((x) => x.id === f.parent);
    return `${f.name} — تابع لـ ${parent ? parent.name : ''}`;
  }
  return f.super ? `${f.name} — سوبر` : f.name;
}

// ---------- إدارة الكتالوج (B2B) ----------
export async function toggleProductAvailability(pid) {
  await run('products.toggle', { pid });
}

// ---------- المستخدمون والفروع ----------
export async function addUser() {
  const st = getState();
  if (!(st.usName || '').trim()) { say('اكتب اسم المستخدم أولًا'); return; }
  if (!(st.usEmail || '').trim().includes('@')) { say('أدخل إيميلًا صحيحًا'); return; }
  if ((st.usPass || '').length < 6) { say('كلمة السر 6 أحرف على الأقل'); return; }
  if (!(st.usBranches || []).length) { say('حدد فرعًا واحدًا على الأقل يتبعه المستخدم'); return; }
  await run('users.add', { name: st.usName, email: st.usEmail, userRole: st.usRole, branches: st.usBranches },
    { usName: '', usEmail: '', usPass: '', usBranches: [], modal: null });
}

export async function setUserStatus(id, status) {
  await run('users.setStatus', { id, st: status });
}

export async function saveUserEdit() {
  const st = getState();
  if (!(st.ueBranches || []).length) { say('حدد فرعًا واحدًا على الأقل'); return; }
  await run('users.update', { id: st.modal.id, userRole: st.ueRole, branches: st.ueBranches }, { modal: null });
}

export async function addBranch() {
  const st = getState();
  if (!(st.brName || '').trim()) { say('اكتب اسم الفرع أولًا'); return; }
  if (!st.brLoc) {
    say('حدد موقع الفرع على الخريطة أولًا — الموقع إلزامي');
    setState({ modal: { k: 'mapPick' }, mapTarget: 'br', mapPin: null, mapSearch: '' });
    return;
  }
  await run('branches.add', { name: st.brName, loc: st.brLoc }, { brName: '', brLoc: null, modal: null });
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

export async function toggleBranch(name) {
  await run('branches.toggle', { name });
}

export async function deleteBranch(name) {
  await run('branches.delete', { name }, { modal: null });
}

// ---------- الإشعارات ----------
export function toggleNotif() { setState({ notifOpen: !getState().notifOpen }); }
export function markAllRead() {
  setState({ notifUnread: 0, notifOpen: false });
  say('عُلّمت كل الإشعارات كمقروءة');
}
