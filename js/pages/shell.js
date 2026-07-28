// ============================================================
// هيكل التطبيق: الشريط الجانبي + الشريط العلوي + بانر التوقيف
// ============================================================
import { esc, icon, ICONS } from '../core/dom.js';
import { chip } from '../ui.js';
import { ROLES, PAGES, FR_PAGE_LABELS, NOTIF_CHIP, CAN_ORDER } from '../data/constants.js';
import { BASE_NOTIFS } from '../data/seed.js';

/** عنوان الصفحة الحالي حسب الدور */
export function pageTitle(st) {
  if (st.page === 'clientdet') return st.role === 'fr' ? 'ملف الممنوح' : 'ملف العميل';
  if (st.role === 'b2b' && st.page === 'wallet') return 'محافظ العملاء';
  if (st.role === 'fr' && FR_PAGE_LABELS[st.page]) return FR_PAGE_LABELS[st.page];
  return (PAGES[st.page] || {}).label || '';
}

/** شارات التنقل حسب قوائم الانتظار */
function navBadge(st, key) {
  const opsPend = st.orders.filter((o) => o.st === 'ops').length;
  const purchPend = st.orders.filter((o) => o.st === 'purch').length;
  const shipPend = st.orders.filter((o) => o.st === 'ship').length;
  const b2bPrep = st.orders.filter((o) => o.st === 'b2b' || o.st === 'hold').length;
  const openTk = st.tickets.filter((t) => t.st === 'open' || t.st === 'held').length;
  const pendReqs = st.prodReqs.filter((r) => r.st === 'pend').length;

  if (key === 'approvals') return st.role === 'ops' ? opsPend : purchPend;
  if (key === 'orders' && st.role === 'worker') return shipPend;
  if (key === 'orders' && st.role === 'b2b') return b2bPrep;
  if (key === 'tickets') return openTk;
  if (key === 'reqs' && st.role === 'b2b') return pendReqs;
  return 0;
}

function renderSidebar(st) {
  const R = ROLES[st.role];
  const items = R.nav.map((key) => {
    const page = { ...PAGES[key] };
    if (st.role === 'fr' && FR_PAGE_LABELS[key]) page.label = FR_PAGE_LABELS[key];
    if (st.role === 'b2b' && key === 'wallet') page.label = 'محافظ العملاء';
    const active = st.page === key;
    const badge = navBadge(st, key);
    return `
      <div class="nav-item ${active ? 'active' : ''}" data-action="go" data-arg="${key}">
        ${icon([page.p, page.p2], { color: active ? '#654e92' : '#A19DB0' })}
        <div class="grow">${esc(page.label)}</div>
        ${badge > 0 ? `<div class="nav-badge">${badge}</div>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="sidebar">
      <div class="sidebar-logo"><img src="assets/logo-1.png" alt="B2B"></div>
      <div class="sidebar-nav">${items}</div>
      <div class="sidebar-user">
        <div class="sidebar-user-row">
          <div class="sidebar-avatar">${esc(R.ini)}</div>
          <div class="grow" style="min-width:0">
            <div class="sidebar-username">${esc(R.user)}</div>
            <div class="sidebar-role">${esc(R.name)}</div>
          </div>
        </div>
        <div class="sidebar-actions">
          <button class="btn btn-soft btn-sm grow" style="font-size:10.5px;color:var(--c-purple);background:var(--c-chip-bg);border:none" data-action="switchUser">تبديل الحساب</button>
          <button class="btn btn-danger-outline btn-sm" style="width:66px;font-size:10.5px;border-width:1px" data-action="logout">خروج</button>
        </div>
      </div>
    </div>`;
}

function renderNotifications(st) {
  if (!st.notifOpen) return '';
  const notifs = [...((st.extraNotifs || {})[st.role] || []), ...BASE_NOTIFS[st.role]];
  return `
    <div class="overlay" style="background:transparent;z-index:59" data-action="toggleNotif"></div>
    <div class="notif-pop">
      <div class="flex-center" style="padding:13px 16px 9px">
        <div class="grow" style="font-size:13px;font-weight:800">الإشعارات</div>
        <div style="font-size:10.5px;font-weight:800;color:var(--c-info);cursor:pointer" data-action="markAllRead">تعليم الكل كمقروء</div>
      </div>
      <div style="max-height:380px;overflow-y:auto">
        ${notifs.map((n) => `
          <div class="notif-row">
            <div style="align-self:flex-start">${chip(n.c, NOTIF_CHIP[n.c] || 'chip-purple')}</div>
            <div class="grow">
              <div class="notif-text">${esc(n.text)}</div>
              <div class="notif-time">${esc(n.t)}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderTopbar(st) {
  const R = ROLES[st.role];
  const cartCount = Object.values(st.cart).reduce((s, q) => s + q, 0);
  const showCart = CAN_ORDER.includes(st.role) && st.page === 'catalog';
  return `
    <div class="topbar">
      <div class="topbar-title">${esc(pageTitle(st))}</div>
      <div class="org-chip">${esc(R.org)}</div>
      <div style="position:relative">
        <button class="icon-btn" data-action="toggleNotif">
          ${ICONS.bell()}
          ${st.notifUnread > 0 ? `<div class="bell-badge">${st.notifUnread}</div>` : ''}
        </button>
        ${renderNotifications(st)}
      </div>
      ${showCart ? `
        <button class="btn btn-primary btn-pill" style="height:40px;padding:0 16px;font-size:12px;gap:8px" data-action="openCart">
          السلة
          ${cartCount > 0 ? `<span class="num" style="min-width:20px;height:20px;border-radius:999px;background:#fff;color:var(--c-info);font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 5px">${cartCount}</span>` : ''}
        </button>` : ''}
    </div>`;
}

/** بانر إيقاف المنشأة */
function suspensionBanner(st) {
  const clientRoles = ['worker', 'ops', 'owner', 'fin'];
  const suspended = (clientRoles.includes(st.role) && st.clients[0].st === 'susp')
    || (st.role === 'frz' && st.clients[1].st === 'susp');
  if (!suspended) return '';
  return `
    <div class="banner banner-danger" style="border-width:1.5px;border-radius:16px;padding:14px 18px;margin-bottom:18px">
      <div class="banner-title" style="font-size:13px">حساب منشأتك موقوف من B2B</div>
      <div class="banner-text">لا يمكن إرسال طلبات جديدة حتى إعادة التفعيل — راجع فواتيرك المستحقة أو تواصل مع الدعم.</div>
    </div>`;
}

/** يغلّف محتوى الصفحة بالهيكل العام */
export function renderShell(st, pageHtml) {
  return `
    <div class="app-shell">
      ${renderSidebar(st)}
      <div class="main-col">
        ${renderTopbar(st)}
        <div class="page-content">
          ${suspensionBanner(st)}
          ${pageHtml}
        </div>
      </div>
    </div>`;
}
