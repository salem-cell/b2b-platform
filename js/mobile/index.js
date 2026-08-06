// ============================================================
// مُجمّع واجهة الجوال: تسجيل الدخول → التبويبات → شاشات push → الطبقات
// نفس الحالة والإجراءات — طبقة عرض بديلة تحت 820px
// ============================================================
import { esc } from '../core/dom.js';
import { renderLogin } from '../pages/login.js';
import { renderModal } from '../overlays/modals.js';
import { renderTabBar, renderCartBar, topPush } from './shell.js';
import {
  renderMHome, renderMCatalog, renderMOrders, renderMApprovals, renderMWallet,
  renderMAnalytics, renderMFrs, renderMClients, renderMTickets, renderMMore,
  renderMOrderDetail, renderMApprove, renderMReceive, renderMTopup,
  renderMLists, renderMMyReqs, renderMCadmin, renderMBranches, renderMUsers, renderMFintu,
} from './screens.js';
import { renderMSheet, SHEET_KINDS } from './sheets.js';

const TAB_SCREENS = {
  home: renderMHome,
  catalog: renderMCatalog,
  orders: renderMOrders,
  approvals: renderMApprovals,
  wallet: renderMWallet,
  analytics: renderMAnalytics,
  frs: renderMFrs,
  clients: renderMClients,
  tickets: renderMTickets,
  more: renderMMore,
};

const PUSH_SCREENS = {
  order: renderMOrderDetail,
  approve: renderMApprove,
  receive: renderMReceive,
  topup: renderMTopup,
  lists: renderMLists,
  myReqs: renderMMyReqs,
  cadmin: renderMCadmin,
  branches: renderMBranches,
  users: renderMUsers,
  fintu: renderMFintu,
};

function renderMToast(st) {
  if (!st.toast) return '';
  return `<div class="m-toast-wrap"><div class="toast" style="font-size:12px;padding:11px 18px;max-width:350px">${esc(st.toast)}</div></div>`;
}

export function renderMobileApp(st) {
  if (!st.role) return renderLogin(st) + renderMToast(st);

  const tabFn = TAB_SCREENS[st.mTab] || renderMHome;
  const push = topPush(st);
  const pushFn = push ? PUSH_SCREENS[push.s] : null;

  // نوافذ لا تملك نسخة جوال مخصصة (خرائط، تذاكر، ملفات، مستخدمون…) → نافذة مركزية قياسية
  const sheetHtml = renderMSheet(st);
  const fallbackModal = (!sheetHtml && st.modal && !PUSH_SCREENS[st.modal.k] && !SHEET_KINDS.includes(st.modal.k))
    ? renderModal(st) : '';

  return `
    <div class="m-app">
      <div class="m-screens">
        ${tabFn(st)}
        ${pushFn ? pushFn(st) : ''}
        ${renderCartBar(st)}
        ${sheetHtml || ''}
      </div>
      ${renderTabBar(st)}
      ${fallbackModal}
      ${renderMToast(st)}
    </div>`;
}
