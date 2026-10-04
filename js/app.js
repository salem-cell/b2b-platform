// ============================================================
// نقطة الدخول: التهيئة، حلقة الرسم، وموجّه الأحداث المفوَّض
// كل عنصر تفاعلي يحمل data-action (+ data-arg / data-arg2)
// وكل حقل إدخال يحمل data-input باسم حقل الحالة
// ============================================================
import { initState, getState, setState, subscribe } from './core/store.js';
import { patchDOM, esc } from './core/dom.js';
import { createInitialState } from './data/seed.js';
import * as A from './actions.js';
import { findAccount } from './core/session.js';
import { renderLogin } from './pages/login.js';
import { renderShell } from './pages/shell.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderCatalog } from './pages/catalog.js';
import { renderOrders, renderApprovals } from './pages/orders.js';
import { renderFinance, renderFintu, renderColDet } from './pages/finance.js';
import { renderAnalytics, renderFranchisees } from './pages/network.js';
import { renderTickets, renderRequests, renderClients, renderCatalogAdmin, renderNewClients, renderNcDet, renderRolesMatrix } from './pages/b2b.js';
import { renderUsers, renderBranches, renderSettings, renderClientProfile } from './pages/org.js';
import { renderDrawer } from './overlays/drawer.js';
import { renderModal } from './overlays/modals.js';
import { renderMobileApp } from './mobile/index.js';
import { openLegalDocument } from './legal.js';

// ---------- خريطة الصفحات ----------
const PAGES_RENDER = {
  dash: renderDashboard,
  catalog: renderCatalog,
  orders: renderOrders,
  approvals: renderApprovals,
  wallet: renderFinance,
  fintu: renderFintu,
  coldet: renderColDet,
  analytics: renderAnalytics,
  frs: renderFranchisees,
  tickets: renderTickets,
  reqs: renderRequests,
  clients: renderClients,
  newclients: (st) => (st.ncSel ? renderNcDet(st) : renderNewClients(st)),
  roles: renderRolesMatrix,
  cadmin: renderCatalogAdmin,
  users: renderUsers,
  branches: renderBranches,
  settings: renderSettings,
  clientdet: renderClientProfile,
};

function renderToast(st) {
  if (!st.toast) return '';
  return `<div class="toast-wrap"><div class="toast">${esc(st.toast)}</div></div>`;
}

// واجهة الجوال (تصميم B2B App) تحت 820px — نفس الحالة والإجراءات
const mobileQuery = window.matchMedia('(max-width: 820px)');

function renderApp(st) {
  if (mobileQuery.matches) return renderMobileApp(st);
  if (!st.role) return renderLogin(st) + renderToast(st);
  const pageFn = PAGES_RENDER[st.page] || renderDashboard;
  return renderShell(st, pageFn(st)) + renderDrawer(st) + renderModal(st) + renderToast(st);
}

// ---------- سجل الإجراءات (data-action → دالة) ----------
const ACTIONS = {
  // تنقل وجلسة
  go: (el) => A.go(el.dataset.arg),
  login: () => A.login(),
  submitNewPin: () => A.submitNewPin(),
  openPinChange: () => setState({ modal: { k: 'pinChange' }, npOld: '', npNew: '', npNew2: '', notifOpen: false }),
  changeMyPin: () => A.changeMyPin(),
  logout: () => A.logout(),
  closeAll: () => A.closeAll(),
  goWallet: () => { A.go('wallet'); setState({ finSeg: 'w' }); },
  goInvoices: () => { A.go('wallet'); setState({ finSeg: 'i' }); },
  backClients: () => A.backFromClientProfile(),

  // إشعارات
  toggleNotif: () => A.toggleNotif(),
  markAllRead: () => A.markAllRead(),

  // كتالوج وسلة ولستات
  setCat: (el) => setState({ cat: el.dataset.arg }),
  cartInc: (el) => A.addCart(el.dataset.arg, 1),
  cartDec: (el) => A.addCart(el.dataset.arg, -1),
  openCart: () => setState({ modal: { k: 'cart' } }),
  submitOrder: () => A.submitOrder(),
  addListToCart: (el) => A.addListToCart(Number(el.dataset.arg)),
  openListNew: () => setState({ modal: { k: 'listNew' }, lnQty: {}, lnName: '', lnSearch: '' }),
  saveCartAsList: () => setState({ modal: { k: 'listNew' }, lnQty: { ...getState().cart }, lnName: '', lnSearch: '' }),
  listInc: (el) => A.listQtyDelta(el.dataset.arg, 1),
  listDec: (el) => A.listQtyDelta(el.dataset.arg, -1),
  saveList: () => A.saveList(),

  // طلبات وتعميد
  setOrdFilter: (el) => setState({ ordFilter: el.dataset.arg }),
  openOrderDrawer: (el) => setState({ drawer: { k: 'order', id: el.dataset.arg } }),
  openApprove: (el) => A.openApprove(el.dataset.arg),
  approveInc: (el) => A.approveQtyDelta(el.dataset.arg, 1),
  approveDec: (el) => A.approveQtyDelta(el.dataset.arg, -1),
  doApprove: () => A.doApprove(),
  openReject: (el) => setState({ modal: { k: 'reject', id: el.dataset.arg }, rejectText: '' }),
  confirmReject: () => A.confirmReject(),
  openHold: (el) => setState({ modal: { k: 'hold', id: el.dataset.arg }, holdText: '' }),
  confirmHold: () => A.confirmHold(),
  resumeOrder: (el) => A.resumeOrder(el.dataset.arg),
  b2bAdvance: (el) => A.b2bAdvance(el.dataset.arg),

  // استلام ونواقص
  openReceive: (el) => A.openReceive(el.dataset.arg),
  toggleShort: (el) => A.toggleShort(el.dataset.arg, Number(el.dataset.arg2)),
  recvInc: (el) => A.recvQtyDelta(el.dataset.arg, 1, Number(el.dataset.arg2)),
  recvDec: (el) => A.recvQtyDelta(el.dataset.arg, -1, Number(el.dataset.arg2)),
  confirmReceive: () => A.confirmReceive(),

  // تذاكر
  openTicket: (el) => setState({ modal: { k: 'ticket', id: el.dataset.arg } }),
  resolveTicket: (el) => A.resolveTicket(el.dataset.arg),
  openTicketHold: (el) => setState({ modal: { k: 'tHold', id: el.dataset.arg }, tHoldText: '' }),
  confirmTicketHold: () => A.confirmTicketHold(),
  resumeTicket: (el) => A.resumeTicket(el.dataset.arg),

  // مالية
  setFinSeg: (el) => setState({ finSeg: el.dataset.arg }),
  setInvFilter: (el) => setState({ invFilter: el.dataset.arg }),
  payInvoice: (el) => A.payInvoice(el.dataset.arg),
  invoicePdf: (el) => A.say(`فُتحت فاتورة ${el.dataset.arg} — PDF`),
  openTopup: () => setState({ modal: { k: 'topup' } }),
  setTopupAmt: (el) => setState({ topupAmt: Number(el.dataset.arg) }),
  topupInc: () => setState({ topupAmt: getState().topupAmt + 500 }),
  topupDec: () => setState({ topupAmt: Math.max(500, getState().topupAmt - 500) }),
  setTopupMethod: (el) => setState({ topupMethod: el.dataset.arg }),
  confirmTopup: () => A.confirmTopup(),

  // تقارير المانح
  reportPdf: () => A.say('جارٍ تجهيز تقرير PDF — يصلك إشعار عند الجاهزية'),
  reportXls: () => A.say('جارٍ تجهيز ملف Excel — يصلك إشعار عند الجاهزية'),

  // التعميدات المالية (B2B) وتسعير الاقتراحات وتفاصيل الفاتورة
  approveTopup: (el) => A.approveTopup(el.dataset.arg),
  rejectTopup: (el) => A.rejectTopup(el.dataset.arg),
  viewProof: (el) => A.say(`فُتحت صورة الحوالة ${el.dataset.arg} — معاينة`),
  toggleTuProof: () => setState({ tuProof: !getState().tuProof }),
  tuCopy: (el) => {
    const [which, value] = el.dataset.arg.split('|');
    const done = () => {
      setState({ tuCopied: which });
      setTimeout(() => { if (getState().tuCopied === which) setState({ tuCopied: null }); }, 2200);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(value).then(done, done);
    else done();
  },
  reqPriceInc: () => setState({ reqPrice: Math.min(100000, getState().reqPrice + 1) }),
  reqPriceDec: () => setState({ reqPrice: Math.max(1, getState().reqPrice - 1) }),
  confirmReqPrice: () => A.confirmReqPrice(),
  clientAcceptReq: (el) => A.clientAcceptReq(el.dataset.arg),
  clientDeclineReq: (el) => A.clientDeclineReq(el.dataset.arg),
  openInvoice: (el) => setState({ modal: { k: 'invDet', id: el.dataset.arg } }),
  openOrderFromInvoice: (el) => setState({ modal: null, drawer: { k: 'order', id: el.dataset.arg } }),

  // فرنشايز
  openFrNew: () => setState({ modal: { k: 'frNew' }, frKind: 'normal', frRegion: '' }),
  setFrKind: (el) => setState({ frKind: el.dataset.arg }),
  sendInvite: () => A.sendInvite(),
  addSubFranchisee: () => A.addSubFranchisee(),
  openSubProfile: (el) => {
    const st = getState();
    const f = st.frs.find((x) => x.id === Number(el.dataset.arg));
    const client = f && st.clients.find((x) => x.name === f.name);
    if (client) A.openClientProfile(client.id, false, st.clientSel);
    else A.say('لم يُفعَّل حسابه بعد — بانتظار تعميد B2B');
  },
  approveFranchisee: (el) => A.approveFranchisee(Number(el.dataset.arg)),
  toggleFranchisee: (el) => A.toggleFranchisee(Number(el.dataset.arg)),
  openFranchisee: (el) => {
    const st = getState();
    const f = st.frs.find((x) => x.id === Number(el.dataset.arg));
    const client = f && st.clients.find((x) => x.name === f.name);
    if (client) A.openClientProfile(client.id);
    else setState({ frSel: Number(el.dataset.arg), modal: { k: 'fr' } });
  },

  // اقتراحات المنتجات
  setReqCat: (el) => setState({ reqCat: el.dataset.arg }),
  openReqNew: () => setState({ modal: { k: 'reqNew' } }),
  submitRequest: () => A.submitRequest(),
  approveRequest: (el) => A.approveRequest(el.dataset.arg),
  rejectRequest: (el) => A.rejectRequest(el.dataset.arg),

  // عملاء (B2B)
  openClientProfile: (el) => A.openClientProfile(Number(el.dataset.arg)),
  openClientWallet: (el) => A.openClientProfile(Number(el.dataset.arg), true),
  toggleClientAccount: (el) => A.toggleClientAccount(Number(el.dataset.arg)),
  toggleClientWallet: (el) => A.toggleClientWallet(Number(el.dataset.arg)),
  toggleClientWalletView: () => setState({ clWalletOpen: !getState().clWalletOpen }),
  setClStaffRole: (el) => setState({ clStaffRole: el.dataset.arg }),
  clientAddBranch: () => {
    const st = getState();
    const name = (st.clBrName || '').trim();
    if (!name) { A.say('اكتب اسم الفرع أولًا'); return; }
    if (!st.clBrLoc) {
      A.say('حدد موقع الفرع على الخريطة أولًا — الموقع إلزامي');
      setState({ modal: { k: 'mapPick' }, mapTarget: 'cl', mapPin: null, mapSearch: '' });
      return;
    }
    const c = st.clients.find((x) => x.id === st.clientSel);
    A.patchClient(c.id, { branches: [...c.branches, { name, city: c.city, loc: st.clBrLoc }] },
      `أُضيف ${name} لفروع ${c.name}`, { clBrName: '', clBrLoc: null });
  },
  clientDelBranch: (el) => {
    const st = getState();
    const c = st.clients.find((x) => x.id === st.clientSel);
    const bi = Number(el.dataset.arg);
    A.patchClient(c.id, { branches: c.branches.filter((_, i) => i !== bi) }, `أُزيل ${c.branches[bi].name}`);
  },
  clientAddStaff: () => A.clientAddStaff(),
  toggleAccount: (el) => A.toggleAccount(Number(el.dataset.arg)),
  genPin: (el) => A.fillRandomPin(el.dataset.arg),
  resetUserPin: () => A.resetUserPin(),
  saveUserPhone: () => A.saveUserPhone(),

  // إدارة الكتالوج (B2B)
  toggleProductAvailability: (el) => A.toggleProductAvailability(el.dataset.arg),
  setCadCat: (el) => setState({ cadCat: el.dataset.arg }),
  openCadNew: () => A.openCadNew(),
  setCadnCat: (el) => setState({ cadnCat: el.dataset.arg }),
  cadCreate: () => A.cadCreate(),
  cadStepPrice: (el) => A.cadStepPrice(el.dataset.arg),
  cadDelete: (el) => A.cadDelete(el.dataset.arg),
  cadCommitPrice: (el) => A.cadCommitPrice(el.dataset.arg),
  openImgEdit: (el) => A.openImgEdit(el.dataset.arg),
  imgSave: () => A.imgSave(),
  imgDelete: (el) => A.imgDelete(el.dataset.arg),

  // v6: سلة الإضافة من الكتالوج + تسعيرها لدى B2B
  bktAdd: (el) => A.bktAdd(el.dataset.arg),
  bktRm: (el) => A.bktRm(el.dataset.arg),
  openBkt: () => setState({ modal: { k: 'bkt' } }),
  bktSend: () => A.bktSend(),
  openRcp: (el) => A.openRcp(el.dataset.arg),
  rcpConfirm: (el) => A.rcpConfirm(el.dataset.arg),

  // v7: الأجل والمهلة وملفات التحصيل
  openColDet: (el) => A.openColFile(el.dataset.arg, 'fintu'),
  openColView: (el) => A.openColFile(el.dataset.arg, 'wallet'),
  openColDetFromClient: (el) => A.openColFile(el.dataset.arg, 'clientdet'),
  colBackGo: (el) => setState({ page: el.dataset.arg, colSel: null }),
  toggleDh: () => setState({ dhOpen: !getState().dhOpen }),
  openWcAjel: () => setState({ modal: { k: 'wcAjel' }, waAmt: '', waNote: '', waMonths: 1 }),
  setWaMonths: (el) => setState({ waMonths: Number(el.dataset.arg) }),
  waSend: () => A.waSend(),
  openWcDelay: (el) => setState({ modal: { k: 'wcDelay' }, colSel: el.dataset.arg, wdDate: '', wdNote: '' }),
  wdSend: () => A.wdSend(),
  openWcProm: (el) => setState({ modal: { k: 'wcProm' }, colSel: el.dataset.arg, wpDate: '', wpAmt: '' }),
  wpSend: () => A.wpSend(),
  openWcPay: (el) => setState({ modal: { k: 'wcPay', id: el.dataset.arg }, wpaAmt: '' }),
  wpaConfirm: (el) => A.wpaConfirm(el.dataset.arg),
  frqApprove: (el) => A.frqApprove(el.dataset.arg),
  frqReject: (el) => A.frqReject(el.dataset.arg),
  openColPay: (el) => setState({ modal: { k: 'colPay', id: el.dataset.arg }, cpAmt: '' }),
  cpConfirm: (el) => A.cpConfirm(el.dataset.arg),
  openCcProm: (el) => setState({ modal: { k: 'ccProm', id: el.dataset.arg }, ccpDate: '', ccpAmt: '' }),
  ccpSend: (el) => A.ccpSend(el.dataset.arg),
  colRemind: (el) => A.colRemind(el.dataset.arg),
  openCcRes: (el) => setState({ modal: { k: 'ccRes', id: el.dataset.arg }, ccrDate: '', ccrWhy: '' }),
  ccrConfirm: (el) => A.ccrConfirm(el.dataset.arg),
  colEscalate: (el) => A.colEscalate(el.dataset.arg),
  openClLimit: () => setState({ modal: { k: 'clLimit' }, nlAmt: '' }),
  nlSave: () => A.nlSave(),
  openClTopup: () => setState({ modal: { k: 'clTopup' }, ctAmt: '' }),
  ctConfirm: () => A.ctConfirm(),
  openLegal: (el) => setState({ modal: { k: 'legal', id: el.dataset.arg } }),
  legalDownload: (el) => {
    if (openLegalDocument(getState(), el.dataset.arg)) A.say('جُهّز ملف القضية — من حوار الطباعة اختر «حفظ PDF» لتسليم المحامي');
    else A.say('ملف التحصيل غير موجود');
  },

  // v5: إنشاء عميل + كتالوج العميل الخاص
  openClientNew: () => A.openClientNew(),
  setCnType: (el) => setState({ cnType: el.dataset.arg, cnGranter: null, cnRegion: '' }),
  setCnGranter: (el) => setState({ cnGranter: Number(el.dataset.arg) }),
  createClient: () => A.createClient(),
  openClProdAdd: () => A.openClProdAdd(),
  clProdAdd: (el) => A.clProdAdd(el.dataset.arg),
  clProdStep: (el) => A.clProdStep(el.dataset.arg),
  clProdDel: (el) => A.clProdDel(el.dataset.arg),

  // v5: العملاء الجدد (طلبات التسجيل)
  openNcDet: (el) => setState({ ncSel: el.dataset.arg, page: 'newclients' }),
  closeNcDet: () => setState({ ncSel: null }),
  ncApprove: (el) => A.ncApprove(el.dataset.arg),
  ncReject: (el) => A.ncReject(el.dataset.arg),

  // v5: مصفوفة الأنواع واليوزرات
  rmToggleCell: (el) => A.rmToggleCell(el.dataset.arg),
  rmPublish: () => A.rmPublish(),
  rmDiscard: () => A.rmDiscard(),

  // الخرائط ومواقع الفروع
  openMapPickBr: () => {
    const st = getState();
    setState({ modal: { k: 'mapPick' }, mapTarget: 'br', mapPin: st.brLoc ? { x: st.brLoc.x, y: st.brLoc.y } : null, mapSearch: '' });
  },
  openMapPickCl: () => {
    const st = getState();
    setState({ modal: { k: 'mapPick' }, mapTarget: 'cl', mapPin: st.clBrLoc ? { x: st.clBrLoc.x, y: st.clBrLoc.y } : null, mapSearch: '' });
  },
  mapClick: (el, e) => {
    const r = el.getBoundingClientRect();
    const x = Math.round((r.right - e.clientX) / r.width * 100);   // نسبة من اليمين (RTL)
    const y = Math.round((e.clientY - r.top) / r.height * 100);
    setState({ mapPin: { x: Math.max(2, Math.min(98, x)), y: Math.max(4, Math.min(96, y)) } });
  },
  confirmMapPick: () => A.confirmMapPick(),
  openBranchDet: (el) => setState({ modal: { k: 'brDet' }, brDetName: el.dataset.arg }),
  openMapView: (el) => {
    const b = getState().branches.find((x) => x.name === el.dataset.arg);
    if (b && b.loc) setState({ modal: { k: 'mapView' }, mapView: { name: b.name, ...b.loc } });
  },
  backToBranchDet: (el) => setState({ modal: { k: 'brDet' }, brDetName: el.dataset.arg }),
  toggleBranch: (el) => A.toggleBranch(el.dataset.arg),
  deleteBranch: (el) => A.deleteBranch(el.dataset.arg),
  openOrderFromBranch: (el) => setState({ modal: null, drawer: { k: 'order', id: el.dataset.arg } }),

  // مستخدمون وفروع
  openUserNew: () => setState({ modal: { k: 'userNew' }, usName: '', usPhone: '', usPin: '', usBranches: [] }),
  addUser: () => A.addUser(),
  openUserEdit: (el) => {
    if (el.dataset.can !== '1') { A.say('صلاحيتك تتيح إدارة حسابات العمال فقط'); return; }
    const u = findAccount(getState(), el.dataset.arg);
    if (!u) return;
    setState({ modal: { k: 'userEdit', id: u.id }, ueRole: u.role, uePhone: u.phone || '', uePin: '',
      ueBranches: (u.branch || '').split(' · ').filter((b) => b && b !== 'الإدارة') });
  },
  setUeRole: (el) => setState({ ueRole: el.dataset.arg }),
  toggleUeBranch: (el) => {
    const cur = getState().ueBranches || [];
    const name = el.dataset.arg;
    setState({ ueBranches: cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name] });
  },
  saveUserEdit: () => A.saveUserEdit(),
  setUsRole: (el) => setState({ usRole: el.dataset.arg }),
  toggleUsBranch: (el) => {
    const cur = getState().usBranches || [];
    const name = el.dataset.arg;
    setState({ usBranches: cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name] });
  },
  confirmUser: (el) => A.setUserStatus(Number(el.dataset.arg), 'ok'),
  holdUser: (el) => A.setUserStatus(Number(el.dataset.arg), 'off'),
  toggleUser: (el) => A.toggleAccount(Number(el.dataset.arg)),
  addBranch: () => A.addBranch(),

  // متفرقات
  rowSoon: () => A.say('هذه الشاشة ضمن الدفعة التالية من النموذج'),

  // تنقّل الجوال
  mGo: (el) => setState({ mTab: el.dataset.arg, mStack: [], drawer: null, modal: null, notifOpen: false }),
  mBack: () => {
    const st = getState();
    if (st.modal) { setState({ modal: null }); return; }
    if (st.drawer) { setState({ drawer: null }); return; }
    if (st.mStack.length) setState({ mStack: st.mStack.slice(0, -1) });
  },
  mPushLists: () => setState({ mStack: [...getState().mStack, { s: 'lists' }] }),
  mPushMyReqs: () => setState({ mStack: [...getState().mStack, { s: 'myReqs' }] }),
  mPushCadmin: () => setState({ mStack: [...getState().mStack, { s: 'cadmin' }] }),
  mPushBranches: () => setState({ mStack: [...getState().mStack, { s: 'branches' }] }),
  mPushUsers: () => setState({ mStack: [...getState().mStack, { s: 'users' }] }),
  mPushFintu: () => setState({ mStack: [...getState().mStack, { s: 'fintu' }] }),
  goInvoicesM: () => setState({ mTab: 'wallet', finSeg: 'i', mStack: [], modal: null }),
  mOpenBrNew: () => setState({ modal: { k: 'brNewM' } }),
};

// ---------- تحويلات حقول الإدخال الخاصة ----------
const digits4 = (v) => v.replace(/[^0-9]/g, '').slice(0, 4);
const phoneChars = (v) => v.replace(/[^0-9+ ]/g, '').slice(0, 16);
const INPUT_TRANSFORM = {
  pin: digits4, npOld: digits4, npNew: digits4, npNew2: digits4, usPin: digits4, uePin: digits4, clStaffPin: digits4,
  phone: phoneChars, usPhone: phoneChars, uePhone: phoneChars, clStaffPhone: phoneChars,
};

// ---------- التهيئة ----------
const root = document.getElementById('app');

function rerender() {
  patchDOM(root, renderApp(getState()));
}

initState(createInitialState());
subscribe(rerender);
rerender();

// استرجاع الجلسة من الخادم (يبقي المستخدم داخلًا بعد تحديث الصفحة)
A.restoreSession();

// إعادة الرسم عند تغيّر حجم الشاشة بين الجوال والمكتب
mobileQuery.addEventListener('change', rerender);
let lastMobile = mobileQuery.matches;
window.addEventListener('resize', () => {
  if (mobileQuery.matches !== lastMobile) {
    lastMobile = mobileQuery.matches;
    rerender();
  }
});

// نقرة مفوَّضة: أقرب عنصر يحمل data-action يفوز، ونوقف الفقاعة
root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const handler = ACTIONS[el.dataset.action];
  if (!handler) { console.warn('إجراء غير معرّف:', el.dataset.action); return; }
  e.stopPropagation();
  handler(el, e);
});

// إدخال مفوَّض: data-input يحدد حقل الحالة
root.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  const field = el.dataset.input;
  const transform = INPUT_TRANSFORM[field];
  setState({ [field]: transform ? transform(el.value) : el.value });
});

// تثبيت بالقيمة المكتوبة: Enter (data-enter) أو مغادرة الحقل (data-blur)
root.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const el = e.target.closest('[data-enter]');
  if (!el) return;
  const handler = ACTIONS[el.dataset.enter];
  if (!handler) return;
  e.preventDefault();
  if (el.dataset.blur) el.blur(); else handler(el, e);
});
root.addEventListener('focusout', (e) => {
  const el = e.target.closest('[data-blur]');
  if (!el) return;
  const handler = ACTIONS[el.dataset.blur];
  if (handler) handler(el, e);
});
