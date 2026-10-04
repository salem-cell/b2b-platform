// ============================================================
// إجراءات الواجهة — الخادم هو مصدر الحقيقة:
// كل عملية أعمال = أمر API (js/core/api.js) يعيد لقطة حالة محدّثة.
// التحققات هنا لتجربة استخدام سريعة فقط؛ الخادم يعيد التحقق دائمًا.
// ============================================================
import { getState, setState } from './core/store.js';
import { apiGet, apiPost, applySnapshot, command } from './core/api.js';
import { VAT } from './core/format.js';
import { findAccount, randomPin } from './core/session.js';
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
    if (err.status === 401) { sessionEnded(); return false; }
    say(err.message || 'تعذر الاتصال بالخادم');
    return false;
  }
}

/** الجلسة انتهت أو أُوقف الحساب: عودة لشاشة الدخول */
function sessionEnded() {
  setState({ role: null, me: null, auth: 'login', pin: '', adminKey: '', drawer: null, modal: null, mStack: [], busy: false });
  say('انتهت جلستك — سجّل الدخول من جديد');
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
  setState({ page, drawer: null, modal: null, notifOpen: false, ncSel: null });
}

export function closeAll() {
  setState({ drawer: null, modal: null });
}

/** منشأة الجلسة الحالية (null لفريق B2B) — من هوية الحساب لا من الدور */
export function sessionClientId() {
  const me = getState().me;
  return me ? me.clientId : null;
}

// ---------- الجلسة: جوال + رمز سري ----------
const UI_RESET = { page: 'dash', mTab: 'home', mStack: [], drawer: null, modal: null, cart: {}, notifUnread: 0,
  auth: 'login', pin: '', adminKey: '', npOld: '', npNew: '', npNew2: '', busy: false };

/** عدد إشعارات الحساب عند الدخول (شارة الجرس) */
const unread = (snapshot, role) => Math.min(9, ((snapshot.extraNotifs || {})[role] || []).length);

/** تحميل لقطة الحساب والدخول للواجهة */
async function enter(role) {
  const { snapshot } = await apiGet('state');
  applySnapshot(snapshot, { ...UI_RESET, role, notifUnread: unread(snapshot, role) });
}

export async function login() {
  const st = getState();
  if (st.busy) return;
  if ((st.phone || '').replace(/[^0-9]/g, '').length < 9) { say('أدخل رقم جوالك (05xxxxxxxx)'); return; }
  if ((st.pin || '').length !== 4) { say('الرمز السري 4 أرقام'); return; }
  setState({ busy: true });
  try {
    const r = await apiPost('auth', { action: 'login', phone: st.phone, pin: st.pin, adminKey: st.adminKey || '' });
    if (r.mustChangePin) {
      // رمز مؤقت: يُعيَّن رمز جديد قبل فتح الحساب
      setState({ auth: 'pin', npOld: st.pin, npNew: '', npNew2: '', pin: '', adminKey: '', busy: false });
      return;
    }
    await enter(r.role);
  } catch (err) {
    setState({ busy: false, pin: '' });
    say(err.message || 'تعذر الاتصال بالخادم');
  }
}

function newPinProblem(st) {
  if ((st.npOld || '').length !== 4) return 'اكتب رمزك الحالي (4 أرقام)';
  if ((st.npNew || '').length !== 4) return 'الرمز الجديد 4 أرقام';
  if (st.npNew !== st.npNew2) return 'الرمزان الجديدان غير متطابقين';
  if (st.npNew === st.npOld) return 'اختر رمزًا مختلفًا عن الحالي';
  return null;
}

/** شاشة «عيّن رمزك السري» بعد دخول برمز مؤقت */
export async function submitNewPin() {
  const st = getState();
  if (st.busy) return;
  const problem = newPinProblem(st);
  if (problem) { say(problem); return; }
  setState({ busy: true });
  try {
    await apiPost('auth', { action: 'changePin', oldPin: st.npOld, newPin: st.npNew });
    const s = await apiGet('auth');
    await enter(s.role);
    say('تم حفظ رمزك السري — ادخل به في المرات القادمة');
  } catch (err) {
    setState({ busy: false });
    if (err.status === 401 && /سجّل الدخول/.test(err.message || '')) { sessionEnded(); return; }
    say(err.message || 'تعذر الاتصال بالخادم');
  }
}

/** تغيير الرمز من داخل الحساب (نافذة) */
export async function changeMyPin() {
  const st = getState();
  const problem = newPinProblem(st);
  if (problem) { say(problem); return; }
  try {
    const r = await apiPost('auth', { action: 'changePin', oldPin: st.npOld, newPin: st.npNew });
    setState({ modal: null, npOld: '', npNew: '', npNew2: '' });
    say(r.msg || 'تم تغيير الرمز السري');
  } catch (err) { say(err.message || 'تعذر الاتصال بالخادم'); }
}

export async function logout() {
  try { await apiPost('auth', { action: 'logout' }); } catch { /* الجلسة محلية على أي حال */ }
  setState({ ...UI_RESET, role: null, me: null, phone: '' });
}

/** استرجاع جلسة قائمة عند فتح الصفحة (يبقي النظام لايف بعد التحديث) */
export async function restoreSession() {
  try {
    const s = await apiGet('auth');
    if (!s.role) return;
    if (s.mustChangePin) { setState({ auth: 'pin', npOld: '', npNew: '', npNew2: '' }); return; }
    const { snapshot } = await apiGet('state');
    applySnapshot(snapshot, { role: s.role, notifUnread: unread(snapshot, s.role) });
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
  if (st.topupMethod === 'تحويل بنكي' && !st.tuProof) { say('أرفق صورة الحوالة أولًا — إلزامية للتحويل البنكي'); return; }
  await run('wallet.topup', { amt: st.topupAmt, method: st.topupMethod, proof: st.tuProof },
    { modal: null, tuProof: false });
}

// ---------- التعميدات المالية (B2B) ----------
export async function approveTopup(id) {
  await run('fintu.approve', { id });
}

export async function rejectTopup(id) {
  await run('fintu.reject', { id });
}

// ---------- تسعير الاقتراحات ----------
export function openReqPrice(id) {
  setState({ modal: { k: 'reqPrice', id }, reqPrice: 64 });
}

export async function confirmReqPrice() {
  const st = getState();
  await run('reqs.price', { id: st.modal.id, price: st.reqPrice }, { modal: null });
}

export async function clientAcceptReq(id) {
  await run('reqs.clientAccept', { id });
}

export async function clientDeclineReq(id) {
  await run('reqs.clientDecline', { id });
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

/** زر B2B «تسعير وإرسال للعميل» — يفتح نافذة التسعير */
export function approveRequest(id) {
  openReqPrice(id);
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
    ? st.frs.filter((f) => f.parent === (st.me || {}).frsId)
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
const phoneOk = (v) => String(v || '').replace(/[^0-9]/g, '').length >= 9;

export async function addUser() {
  const st = getState();
  const team = st.role === 'b2b';   // فريق B2B: بلا فروع ولا دور منشأة
  const role = st.role === 'ops' ? 'worker' : st.usRole;
  if (!(st.usName || '').trim()) { say('اكتب اسم المستخدم أولًا'); return; }
  if (!phoneOk(st.usPhone)) { say('أدخل رقم جوال المستخدم (05xxxxxxxx) — به يسجّل الدخول'); return; }
  if ((st.usPin || '').length !== 4) { say('عيّن رمزًا مؤقتًا من 4 أرقام تبلّغه للمستخدم'); return; }
  if (!team && ['worker', 'ops'].includes(role) && !(st.usBranches || []).length) { say('حدد فرعًا واحدًا على الأقل يتبعه المستخدم'); return; }
  await run('users.add', { name: st.usName, phone: st.usPhone, pin: st.usPin, userRole: role, branches: team ? [] : st.usBranches },
    { usName: '', usPhone: '', usPin: '', usBranches: [], modal: null });
}

/** B2B / المانح من ملف العميل: حساب جديد لدى العميل (فعّال فورًا برمز مؤقت) */
export async function clientAddStaff() {
  const st = getState();
  const c = st.clients.find((x) => x.id === st.clientSel);
  if (!c) return;
  if (!(st.clStaffName || '').trim()) { say('اكتب اسم صاحب الحساب أولًا'); return; }
  if (!phoneOk(st.clStaffPhone)) { say('أدخل رقم جواله (05xxxxxxxx) — به يسجّل الدخول'); return; }
  if ((st.clStaffPin || '').length !== 4) { say('عيّن رمزًا مؤقتًا من 4 أرقام تبلّغه له'); return; }
  await run('users.add', { name: st.clStaffName, phone: st.clStaffPhone, pin: st.clStaffPin, userRole: st.clStaffRole || 'worker', clientId: c.id },
    { clStaffName: '', clStaffPhone: '', clStaffPin: '' });
}

/** رمز مؤقت جديد لحساب (نسي رمزه أو قُفل) */
export async function resetUserPin() {
  const st = getState();
  if ((st.uePin || '').length !== 4) { say('اكتب رمزًا مؤقتًا من 4 أرقام أو اضغط «رمز عشوائي»'); return; }
  await run('users.resetPin', { id: st.modal.id, pin: st.uePin });
}

export async function saveUserPhone() {
  const st = getState();
  if (!phoneOk(st.uePhone)) { say('أدخل رقم جوال صحيحًا (05xxxxxxxx)'); return; }
  await run('users.setPhone', { id: st.modal.id, phone: st.uePhone });
}

/** يملأ حقل رمز مؤقت برمز عشوائي غير بديهي */
export function fillRandomPin(field) {
  setState({ [field]: randomPin() });
}

export async function toggleAccount(id) {
  const u = findAccount(getState(), id);
  if (u) await run('users.setStatus', { id: u.id, st: u.st === 'ok' ? 'off' : 'ok' });
}

export async function setUserStatus(id, status) {
  await run('users.setStatus', { id, st: status });
}

export async function saveUserEdit() {
  const st = getState();
  if (!(st.ueBranches || []).length) { say('حدد فرعًا واحدًا على الأقل'); return; }
  await run('users.update', { id: st.modal.id, userRole: st.ueRole, branches: st.ueBranches });
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

// ---------- v5: العملاء الجدد، إنشاء عميل، كتالوج العميل، مصفوفة الأنواع، إدارة الكتالوج ----------

export function openClientNew() {
  setState({ modal: { k: 'cnNew' }, cnName: '', cnCr: '', cnCity: '', cnType: 'مستقل', cnGranter: null, cnRegion: '' });
}

export async function createClient() {
  const st = getState();
  await run('clients.create', {
    name: st.cnName, cr: st.cnCr, city: st.cnCity, type: st.cnType,
    granterId: st.cnGranter, region: st.cnRegion,
  }, { modal: null, page: 'clients' });
}

export async function ncApprove(id) {
  await run('nc.approve', { id });
}

export async function ncReject(id) {
  await run('nc.reject', { id });
}

export function openClProdAdd() {
  setState({ modal: { k: 'clProdAdd' }, cpSearch: '' });
}

export async function clProdAdd(pid) {
  await run('clients.prodAdd', { id: getState().clientSel, pid });
}

export async function clProdStep(arg) {
  const [pid, d] = arg.split('|');
  await run('clients.prodStep', { id: getState().clientSel, pid, delta: Number(d) });
}

export async function clProdDel(pid) {
  await run('clients.prodDel', { id: getState().clientSel, pid });
}

export async function rmToggleCell(arg) {
  const [r, c] = arg.split('|');
  await run('roles.set', { row: Number(r), col: Number(c) });
}

export async function rmPublish() {
  await run('roles.publish', {});
}

export async function rmDiscard() {
  await run('roles.discard', {});
}

export async function cadStepPrice(arg) {
  const [pid, d] = arg.split('|');
  await run('products.setPrice', { pid, delta: Number(d) });
}

export async function cadDelete(pid) {
  await run('products.delete', { pid });
}

export function openCadNew() {
  setState({ modal: { k: 'cadNew' }, cadnName: '', cadnUnit: '', cadnPrice: '', cadnCat: 'مواد غذائية' });
}

export async function cadCreate() {
  const st = getState();
  await run('products.add', { name: st.cadnName, unit: st.cadnUnit, price: st.cadnPrice, cat: st.cadnCat }, { modal: null });
}

// ---------- v6: سلة الإضافة من الكتالوج + تسعيرها + إدارة سعر/صورة المنتج ----------

export function bktAdd(pid) {
  setState({ bkt: { ...(getState().bkt || {}), [pid]: true } });
  say('أُضيف للسلة — راجعها من الشريط أسفل الكتالوج');
}

export function bktRm(pid) {
  const bkt = { ...(getState().bkt || {}) };
  delete bkt[pid];
  setState({ bkt });
}

export async function bktSend() {
  const st = getState();
  const pids = Object.keys(st.bkt || {});
  if (!pids.length) { say('السلة فارغة — أضف منتجات أولًا'); return; }
  await run('reqs.bktSend', { pids }, { modal: null, bkt: {} });
}

/** B2B يفتح نافذة تسعير طلب السلة — تُهيّأ الأسعار بخصم الاتفاق ٥٪ */
export function openRcp(id) {
  const r = getState().prodReqs.find((x) => x.id === id);
  if (!r) return;
  const pre = {};
  for (const it of r.items || []) {
    const p = PRODUCT_MAP[it.pid];
    pre[`rcp_${it.pid}`] = String(Math.round((p ? p.price * 0.95 : 0) * 100) / 100);
  }
  setState({ modal: { k: 'rcp', id }, ...pre });
}

export async function rcpConfirm(id) {
  const st = getState();
  const r = st.prodReqs.find((x) => x.id === id);
  if (!r) return;
  const prices = {};
  for (const it of r.items || []) {
    const v = parseFloat(st[`rcp_${it.pid}`]);
    if (v > 0) prices[it.pid] = Math.round(v * 100) / 100;
  }
  await run('reqs.rcpConfirm', { id, prices }, { modal: null });
}

/** كتابة السعر الأساسي مباشرة في إدارة الكتالوج (Enter أو مغادرة الحقل) */
export async function cadCommitPrice(pid) {
  const st = getState();
  const key = `cadP_${pid}`;
  const raw = st[key];
  if (raw == null) return;
  const cur = (PRODUCT_MAP[pid] || {}).price;
  const v = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  if (!(v > 0) || Math.abs(v - cur) < 0.005) { setState({ [key]: null }); return; }
  await run('products.setPriceVal', { pid, price: Math.round(v * 100) / 100 }, { [key]: null });
}

export function openImgEdit(pid) {
  setState({ modal: { k: 'imgEdit' }, imgPid: pid, imgUrl: (PRODUCT_MAP[pid] || {}).img || '' });
}

export async function imgSave() {
  const st = getState();
  await run('products.setImg', { pid: st.imgPid, img: st.imgUrl }, { modal: null, imgUrl: '' });
}

export async function imgDelete(pid) {
  await run('products.delImg', { pid: pid || getState().imgPid }, { modal: null, imgUrl: '' });
}

// ---------- v7: الأجل والمهلة وملفات التحصيل ----------

export function openColFile(id, back) {
  setState({ page: 'coldet', colSel: id, colBack: back, dhOpen: false, drawer: null, modal: null });
}

export async function waSend() {
  const st = getState();
  await run('finreqs.ajel', { amt: st.waAmt, months: st.waMonths, note: st.waNote },
    { modal: null, waAmt: '', waNote: '', waMonths: 1 });
}

export async function wdSend() {
  const st = getState();
  await run('finreqs.delay', { fileId: st.colSel, date: st.wdDate, note: st.wdNote },
    { modal: null, wdDate: '', wdNote: '' });
}

export async function wpSend() {
  const st = getState();
  await run('finreqs.promise', { fileId: st.colSel, date: st.wpDate, amt: st.wpAmt },
    { modal: null, wpDate: '', wpAmt: '' });
}

export async function wpaConfirm(id) {
  const st = getState();
  await run('col.pay', { id, amt: st.wpaAmt, fromWallet: true }, { modal: null, wpaAmt: '' });
}

export async function frqApprove(id) {
  await run('finreqs.approve', { id });
}

export async function frqReject(id) {
  await run('finreqs.reject', { id });
}

export async function cpConfirm(id) {
  const st = getState();
  await run('col.pay', { id, amt: st.cpAmt, fromWallet: false }, { modal: null, cpAmt: '' });
}

export async function ccpSend(id) {
  const st = getState();
  await run('col.promise', { id, date: st.ccpDate, amt: st.ccpAmt }, { modal: null, ccpDate: '', ccpAmt: '' });
}

export async function colRemind(id) {
  await run('col.remind', { id });
}

export async function ccrConfirm(id) {
  const st = getState();
  await run('col.reschedule', { id, date: st.ccrDate, why: st.ccrWhy }, { modal: null, ccrDate: '', ccrWhy: '' });
}

export async function colEscalate(id) {
  await run('col.escalate', { id });
}

export async function nlSave() {
  const st = getState();
  await run('clients.setLimit', { id: st.clientSel, limit: st.nlAmt }, { modal: null, nlAmt: '' });
}

export async function ctConfirm() {
  const st = getState();
  await run('clients.topup', { id: st.clientSel, amt: st.ctAmt }, { modal: null, ctAmt: '' });
}
