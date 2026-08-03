// ============================================================
// غلاف الجوال: شريط التبويبات السفلي + شريط السلة + التوست
// (تصميم B2B App — تبويبات مختلفة لكل دور)
// ============================================================
import { esc, icon, ICONS } from '../core/dom.js';
import { fmt } from '../core/format.js';
import { CAN_ORDER } from '../data/constants.js';
import { PRODUCT_MAP } from '../data/products.js';
import { showPricesFor } from '../pages/catalog.js';

/** أيقونات وتسميات تبويبات الجوال */
export const M_TABS = {
  home:      { l: 'الرئيسية',  p: 'M4 11.2 12 4.4l8 6.8', p2: 'M6.6 10.4V19.4h10.8v-9' },
  catalog:   { l: 'الكتالوج',  p: 'M4.5 4.5h6.2v6.2H4.5zM13.3 4.5h6.2v6.2h-6.2zM4.5 13.3h6.2v6.2H4.5zM13.3 13.3h6.2v6.2h-6.2z', p2: '' },
  orders:    { l: 'طلباتي',    p: 'M6.2 3.6h11.6V20l-1.9-1.4-2 1.4-1.9-1.4-2 1.4-1.9-1.4L6.2 20z', p2: 'M9.3 8.2h5.4M9.3 11.7h5.4' },
  approvals: { l: 'التعميدات', p: 'M12 3.4a8.6 8.6 0 1 1 0 17.2 8.6 8.6 0 0 1 0-17.2z', p2: 'M8.4 12.1l2.5 2.5 4.7-5' },
  wallet:    { l: 'المحفظة',   p: 'M4 8A2.6 2.6 0 0 1 6.6 5.4h10.8A2.6 2.6 0 0 1 20 8v8a2.6 2.6 0 0 1-2.6 2.6H6.6A2.6 2.6 0 0 1 4 16z', p2: 'M14.6 12H20' },
  analytics: { l: 'البيانات',  p: 'M5.2 20v-7.4M12 20V4.8M18.8 20V9.6', p2: '' },
  frs:       { l: 'الممنوحون', p: 'M9.2 11.2a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2zM3.6 19.6c0-3.1 2.5-5 5.6-5s5.6 1.9 5.6 5', p2: 'M15.8 4.5a3.6 3.6 0 0 1 0 6.9M17.4 15c2 .7 3.4 2.1 3.4 4.6' },
  tickets:   { l: 'التذاكر',   p: 'M4.2 9.6V6.2A2 2 0 0 1 6.2 4.2h11.6a2 2 0 0 1 2 2v3.4a2.4 2.4 0 0 0 0 4.8v3.4a2 2 0 0 1-2 2H6.2a2 2 0 0 1-2-2v-3.4a2.4 2.4 0 0 0 0-4.8z', p2: 'M12 4.6v2.2M12 10.9v2.2M12 17.2v2.2' },
  clients:   { l: 'العملاء',   p: 'M9.2 11.2a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2zM3.6 19.6c0-3.1 2.5-5 5.6-5s5.6 1.9 5.6 5', p2: 'M15.8 4.5a3.6 3.6 0 0 1 0 6.9M17.4 15c2 .7 3.4 2.1 3.4 4.6' },
  more:      { l: 'المزيد',    p: 'M6.2 12h.01M12 12h.01M17.8 12h.01', p2: '', w: 3.4 },
};

/** تبويبات كل دور (frzs امتداد متسق مع تصميم الويب المحدث) */
export const ROLE_TABS = {
  worker: ['home', 'catalog', 'orders', 'more'],
  ops:    ['home', 'catalog', 'orders', 'approvals', 'more'],
  owner:  ['home', 'catalog', 'orders', 'wallet', 'more'],
  fin:    ['home', 'wallet', 'orders', 'more'],
  frz:    ['home', 'catalog', 'orders', 'wallet', 'more'],
  frzs:   ['home', 'catalog', 'orders', 'wallet', 'more'],
  fr:     ['home', 'analytics', 'frs', 'wallet', 'more'],
  b2b:    ['home', 'orders', 'clients', 'tickets', 'more'],
};

/** هل توجد شاشة مدفوعة (push) فوق التبويب الحالي؟ */
export function topPush(st) {
  if (st.drawer && st.drawer.k === 'order') return { s: 'order', arg: st.drawer.id };
  const pushModals = ['approve', 'receive', 'topup'];
  if (st.modal && pushModals.includes(st.modal.k)) return { s: st.modal.k, arg: st.modal.id };
  if (st.mStack && st.mStack.length) return st.mStack[st.mStack.length - 1];
  return null;
}

export function renderTabBar(st) {
  const tabs = ROLE_TABS[st.role] || ROLE_TABS.worker;
  const hasPush = !!topPush(st);
  const opsPend = st.orders.filter((o) => o.st === 'ops').length;
  const shipPend = st.orders.filter((o) => o.st === 'ship').length;
  const prepPend = st.orders.filter((o) => o.st === 'b2b' || o.st === 'hold').length;
  const tkPend = st.tickets.filter((t) => t.st === 'open').length + st.prodReqs.filter((r) => r.st === 'pend').length;

  return `
    <div class="m-tabbar">
      ${tabs.map((key) => {
        const T = M_TABS[key];
        const active = st.mTab === key && !hasPush;
        const color = active ? '#654e92' : '#A19DB0';
        let badge = 0;
        if (key === 'approvals') badge = opsPend;
        if (key === 'orders' && st.role === 'worker') badge = shipPend;
        if (key === 'orders' && st.role === 'b2b') badge = prepPend;
        if (key === 'tickets') badge = tkPend;
        return `
        <div class="m-tab" data-action="mGo" data-arg="${key}">
          ${icon([T.p, T.p2], { size: 23, color, width: T.w || 1.7 })}
          <div class="m-tab-label" style="color:${color}">${T.l}</div>
          ${badge > 0 ? `<div class="m-tab-badge">${badge}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
}

/** شريط السلة العائم (كتالوج فقط) */
export function renderCartBar(st) {
  const count = Object.values(st.cart).reduce((s, q) => s + q, 0);
  const showOn = st.mTab === 'catalog' && !topPush(st) && !st.modal && !st.notifOpen;
  if (!count || !showOn || !CAN_ORDER.includes(st.role)) return '';
  const sub = Object.keys(st.cart).reduce((s, id) => s + PRODUCT_MAP[id].price * st.cart[id], 0);
  const totalTxt = showPricesFor(st.role) && sub > 0 ? ` — ${fmt(sub * 1.15)} ر.س` : '';
  return `
    <div class="m-cartbar" data-action="openCart">
      <div class="num" style="min-width:24px;height:24px;border-radius:999px;background:#fff;color:#083b44;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center">${count}</div>
      <div style="font-size:12.5px;font-weight:800;flex:1">عرض السلة${esc(totalTxt)}</div>
      ${ICONS.chevronL('#fff')}
    </div>`;
}

/** رأس شاشة رئيسية (شعار + فرع + جرس) */
export function homeHeader(st, branchChip) {
  return `
    <div class="m-head m-head-safe">
      <img src="assets/logo-1.png" alt="B2B" style="height:38px;width:auto">
      <div class="grow"></div>
      <div style="height:34px;display:flex;align-items:center;padding:0 12px;background:#fff;border:1px solid var(--c-card-border);border-radius:999px;font-size:11px;font-weight:800;color:var(--c-purple)">${esc(branchChip)}</div>
      <div class="m-icon-btn" data-action="toggleNotif">
        ${ICONS.bell()}
        ${st.notifUnread > 0 ? `<div class="bell-badge" style="top:8px;left:9px;width:15px;height:15px;font-size:9px">${st.notifUnread}</div>` : ''}
      </div>
    </div>`;
}

/** رأس شاشة push (زر رجوع + عنوان) */
export function pushHeader(title, sub = '', extraHtml = '') {
  return `
    <div class="m-head m-head-safe">
      <div class="m-back" data-action="mBack">${ICONS.chevronR()}</div>
      <div class="grow" style="min-width:0">
        <div class="m-title-sm">${title}</div>
        ${sub ? `<div style="font-size:10.5px;color:#0D5866">${sub}</div>` : ''}
      </div>
      ${extraHtml}
    </div>`;
}
