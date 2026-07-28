// ============================================================
// نقطة الدخول: التهيئة، حلقة الرسم، وموجّه الأحداث المفوَّض
// كل عنصر تفاعلي يحمل data-action (+ data-arg / data-arg2)
// وكل حقل إدخال يحمل data-input باسم حقل الحالة
// ============================================================
import { initState, getState, setState, subscribe } from './core/store.js';
import { patchDOM, esc } from './core/dom.js';
import { createInitialState } from './data/seed.js';
import * as A from './actions.js';
import { renderLogin } from './pages/login.js';
import { renderShell } from './pages/shell.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderCatalog } from './pages/catalog.js';
import { renderOrders, renderApprovals } from './pages/orders.js';
import { renderFinance } from './pages/finance.js';
import { renderAnalytics, renderFranchisees } from './pages/network.js';
import { renderTickets, renderRequests, renderClients, renderCatalogAdmin } from './pages/b2b.js';
import { renderUsers, renderBranches, renderSettings, renderClientProfile } from './pages/org.js';
import { renderDrawer } from './overlays/drawer.js';
import { renderModal } from './overlays/modals.js';

// ---------- خريطة الصفحات ----------
const PAGES_RENDER = {
  dash: renderDashboard,
  catalog: renderCatalog,
  orders: renderOrders,
  approvals: renderApprovals,
  wallet: renderFinance,
  analytics: renderAnalytics,
  frs: renderFranchisees,
  tickets: renderTickets,
  reqs: renderRequests,
  clients: renderClients,
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

function renderApp(st) {
  if (!st.role) return renderLogin(st) + renderToast(st);
  const pageFn = PAGES_RENDER[st.page] || renderDashboard;
  return renderShell(st, pageFn(st)) + renderDrawer(st) + renderModal(st) + renderToast(st);
}

// ---------- سجل الإجراءات (data-action → دالة) ----------
const ACTIONS = {
  // تنقل وجلسة
  go: (el) => A.go(el.dataset.arg),
  sendOtp: () => A.sendOtp(),
  verifyOtp: () => A.verifyOtp(),
  backPhone: () => setState({ auth: 'phone', otp: '' }),
  pickRole: (el) => A.pickRole(el.dataset.arg),
  switchUser: () => A.switchUser(),
  logout: () => A.logout(),
  closeAll: () => A.closeAll(),
  goWallet: () => { A.go('wallet'); setState({ finSeg: 'w' }); },
  goInvoices: () => { A.go('wallet'); setState({ finSeg: 'i' }); },
  backClients: () => A.go(getState().role === 'fr' ? 'frs' : 'clients'),

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

  // فرنشايز
  openFrNew: () => setState({ modal: { k: 'frNew' } }),
  sendInvite: () => A.sendInvite(),
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
    const c = st.clients.find((x) => x.id === st.clientSel);
    A.updateClient(c.id, (x) => ({ ...x, branches: [...x.branches, { name, city: c.city }] }));
    setState({ clBrName: '' });
    A.say(`أُضيف ${name} لفروع ${c.name}`);
  },
  clientDelBranch: (el) => {
    const st = getState();
    const c = st.clients.find((x) => x.id === st.clientSel);
    const bi = Number(el.dataset.arg);
    const bn = c.branches[bi].name;
    A.updateClient(c.id, (x) => ({ ...x, branches: x.branches.filter((_, i) => i !== bi) }));
    A.say(`أُزيل ${bn}`);
  },
  clientAddStaff: () => {
    const st = getState();
    const name = (st.clStaffName || '').trim();
    if (!name) { A.say('اكتب اسم العامل أولًا'); return; }
    const c = st.clients.find((x) => x.id === st.clientSel);
    A.updateClient(c.id, (x) => ({
      ...x,
      staff: [...x.staff, { name, role: st.clStaffRole || 'worker', branch: c.branches[0] ? c.branches[0].name : 'الإدارة', st: 'ok' }],
    }));
    setState({ clStaffName: '' });
    A.say(`أُنشئ حساب ${name} لدى ${c.name} — فعّال فورًا`);
  },
  clientToggleStaff: (el) => {
    const st = getState();
    const c = st.clients.find((x) => x.id === st.clientSel);
    const ui = Number(el.dataset.arg);
    const u = c.staff[ui];
    const off = u.st === 'off';
    A.updateClient(c.id, (x) => ({ ...x, staff: x.staff.map((s, i) => (i === ui ? { ...s, st: off ? 'ok' : 'off' } : s)) }));
    A.say(off ? `فُعّل ${u.name}` : `أُوقف ${u.name} — لا يستطيع الدخول`);
  },
  clientMoveStaff: (el) => {
    const st = getState();
    const c = st.clients.find((x) => x.id === st.clientSel);
    const ui = Number(el.dataset.arg);
    const u = c.staff[ui];
    const options = c.branches.map((b) => b.name).concat(['الإدارة']);
    const next = options[(options.indexOf(u.branch) + 1) % options.length];
    A.updateClient(c.id, (x) => ({ ...x, staff: x.staff.map((s, i) => (i === ui ? { ...s, branch: next } : s)) }));
    A.say(`نُقل ${u.name} إلى ${next}`);
  },

  // إدارة الكتالوج (B2B)
  toggleProductAvailability: (el) => A.toggleProductAvailability(el.dataset.arg),

  // مستخدمون وفروع
  openUserNew: () => setState({ modal: { k: 'userNew' } }),
  addUser: () => A.addUser(),
  openUserEdit: (el) => {
    if (el.dataset.can !== '1') { A.say('صلاحيتك تتيح إدارة حسابات العمال فقط'); return; }
    const u = getState().users.find((x) => x.id === Number(el.dataset.arg));
    setState({ modal: { k: 'userEdit', id: u.id }, ueRole: u.role, ueBranches: (u.branch || '').split(' · ').filter(Boolean) });
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
  confirmUser: (el) => {
    const u = getState().users.find((x) => x.id === Number(el.dataset.arg));
    A.setUserStatus(u.id, 'ok', `فُعّل حساب ${u.name} — يستطيع الدخول الآن بالإيميل وكلمة السر`);
  },
  holdUser: (el) => {
    const u = getState().users.find((x) => x.id === Number(el.dataset.arg));
    A.setUserStatus(u.id, 'off', `عُطّل حساب ${u.name} قبل التفعيل`);
  },
  toggleUser: (el) => {
    const u = getState().users.find((x) => x.id === Number(el.dataset.arg));
    const off = u.st === 'off';
    A.setUserStatus(u.id, off ? 'ok' : 'off', off ? `أُعيد تفعيل ${u.name}` : `أُوقف ${u.name} — لا يستطيع الدخول`);
  },
  addBranch: () => A.addBranch(),

  // متفرقات
  rowSoon: () => A.say('هذه الشاشة ضمن الدفعة التالية من النموذج'),
};

// ---------- تحويلات حقول الإدخال الخاصة ----------
const INPUT_TRANSFORM = {
  otp: (v) => v.replace(/[^0-9]/g, '').slice(0, 4),
};

// ---------- التهيئة ----------
const root = document.getElementById('app');

function rerender() {
  patchDOM(root, renderApp(getState()));
}

initState(createInitialState());
subscribe(rerender);
rerender();

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
