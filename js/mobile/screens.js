// ============================================================
// شاشات الجوال: الرئيسية لكل دور + التبويبات + شاشات الـ push
// نفس بيانات ومنطق الويب — عرض جوال فقط (تصميم B2B App)
// ============================================================
import { esc, ICONS } from '../core/dom.js';
import { fmt, fmt0, stripe } from '../core/format.js';
import { chip, orderChip, prodThumb, ledgerAmount, pinIcon } from '../ui.js';
import { orderTotal, franchiseScope, frTag, findOrder } from '../actions.js';
import {
  ROLES, CATEGORIES, ORDER_FILTERS, INVOICE_FILTERS, INVOICE_STATUS,
  FRANCHISEE_STATUS, REQUEST_STATUS, STAFF_ROLE_LABEL, STAFF_ROLE_CHIP,
  ORDER_STEPS, ORDER_STEPS_EN, STEP_INDEX, POLICY,
  CAN_ORDER, CAN_REQUEST, CAN_PAY, ORG_CR, DEFAULT_CR,
} from '../data/constants.js';
import { PRODUCTS, PRODUCT_MAP } from '../data/products.js';
import { showPricesFor, filterProducts } from '../pages/catalog.js';
import { rowAction } from '../pages/orders.js';
import { ticketChip } from '../pages/b2b.js';
import { homeHeader, pushHeader } from './shell.js';

const orgCrOf = (st) => ORG_CR[st.role] || DEFAULT_CR;

function mChips(names, active, action) {
  return `<div class="m-chips">${names.map((n) => `
    <div class="filter-chip ${n === active ? 'active' : ''}" data-action="${action}" data-arg="${esc(n)}">${esc(n)}</div>`).join('')}</div>`;
}

/** بطاقة طلب مختصرة بقائمة الجوال */
function orderCard(st, o, showPrices) {
  return `
    <div class="flex-center gap-10 clickable" style="padding:14px 16px;border-bottom:1px solid var(--c-divider);min-height:64px;cursor:pointer" data-action="openOrderDrawer" data-arg="${o.id}">
      <div class="grow">
        <div class="flex-center gap-6" style="flex-wrap:wrap"><span class="num" style="font-size:13px;font-weight:700">${o.id}</span>${o.backorder ? '<span class="chip chip-purple" style="font-size:8.5px;padding:3px 8px">نواقص · تابع</span>' : ''}</div>
        <div style="font-size:10.5px;color:var(--c-faint);margin-top:3px">${esc(o.date)} · ${esc(o.by)} · ${esc(o.branch)}</div>
      </div>
      <div style="text-align:left">
        ${orderChip(o.st)}
        ${showPrices ? `<div class="num" style="font-size:11.5px;font-weight:700;color:var(--c-muted);margin-top:4px;text-align:left">${fmt(orderTotal(o))} <span style="font-family:var(--font-ar);font-size:9px">ر.س</span></div>` : ''}
      </div>
    </div>`;
}

/** بطاقة تعميد (رئيسية العمليات/المالك) */
function approvalCard(st, o, btnLabel) {
  return `
    <div class="m-card" style="margin:0 18px 10px;padding:14px 16px">
      <div class="flex-center gap-8">
        <div class="num" style="font-size:13.5px;font-weight:700">${o.id}</div>
        ${orderChip(o.st)}
        <div class="grow"></div>
        <div style="font-size:10.5px;color:var(--c-faint)">${esc(o.date)}</div>
      </div>
      <div style="font-size:11.5px;color:var(--c-muted);margin-top:6px">${esc(o.by)} · ${esc(o.branch)} · ${o.items.length} أصناف · <span class="num" style="font-weight:700;color:var(--c-ink)">${fmt(orderTotal(o))}</span> ر.س</div>
      <div class="flex gap-8" style="margin-top:12px">
        <button class="btn btn-primary" style="flex:1.4;height:44px;border-radius:12px;font-size:12.5px" data-action="openApprove" data-arg="${o.id}">${btnLabel}</button>
        <button class="btn btn-soft grow" style="height:44px;border-radius:12px;font-size:12.5px;color:var(--c-info)" data-action="openOrderDrawer" data-arg="${o.id}">التفاصيل</button>
      </div>
    </div>`;
}

/** بطاقة المحفظة المتدرجة */
function walletHero(st, big = false) {
  const W = st.wallet;
  return `
    <div class="m-hero clickable" style="cursor:pointer" data-action="mGo" data-arg="wallet">
      <div class="flex" style="align-items:baseline;gap:8px">
        <div style="font-size:11px;font-weight:800;opacity:.85">رصيد المحفظة</div>
        <div class="grow"></div>
        <div class="num" style="font-size:10px;opacity:.75">C.R. ${orgCrOf(st)}</div>
      </div>
      <div class="num" style="font-size:${big ? 30 : 27}px;font-weight:700;margin-top:6px">${fmt(W.bal)} <span style="font-size:12px;font-family:var(--font-ar);font-weight:700;opacity:.8">ر.س</span></div>
      <div style="margin-top:12px;height:6px;border-radius:999px;background:rgba(255,255,255,.25);overflow:hidden"><div style="height:100%;border-radius:999px;background:#7DF0FF;width:${Math.round(W.used / W.limit * 100)}%"></div></div>
      <div style="font-size:10.5px;opacity:.85;margin-top:6px">الحد الائتماني: مستخدم <span class="num">${fmt0(W.used)}</span> من <span class="num">${fmt0(W.limit)}</span> ر.س</div>
    </div>`;
}

// ============ الرئيسية لكل دور ============
export function renderMHome(st) {
  const R = ROLES[st.role];
  const showPrices = showPricesFor(st.role);
  const opsPend = st.orders.filter((o) => o.st === 'ops');
  const purchPend = st.orders.filter((o) => o.st === 'purch');
  const shipPend = st.orders.filter((o) => o.st === 'ship');
  const branchName = st.role === 'fr' ? 'شبكة الفرنشايز'
    : st.role === 'frz' ? 'مطاعم الريف الشمالي'
    : st.role === 'frzs' ? 'الشرقية للفرنشايز'
    : st.role === 'b2b' ? 'مركز التوزيع — الرياض' : 'فرع العليا';
  const greeting = st.role === 'b2b' ? 'مركز عمليات B2B' : `مساء الخير، ${R.user.split(' ')[0] === 'م.' ? R.user.split(' ').slice(0, 2).join(' ') : R.user.split(' ')[0]}`;

  const parts = [];

  // بانر الإيقاف
  const clientRoles = ['worker', 'ops', 'owner', 'fin'];
  const superClient = st.clients.find((c) => c.id === 6);
  const suspended = (clientRoles.includes(st.role) && st.clients[0].st === 'susp')
    || (st.role === 'frz' && st.clients[1].st === 'susp')
    || (st.role === 'frzs' && superClient && superClient.st === 'susp');
  if (suspended) {
    parts.push(`
      <div class="banner banner-danger" style="margin:16px 18px 0;border-width:1.5px;border-radius:16px;padding:14px 16px">
        <div class="banner-title" style="font-size:12.5px">حساب منشأتك موقوف من B2B</div>
        <div class="banner-text" style="font-size:11px">لا يمكن إرسال طلبات جديدة حتى إعادة التفعيل — تواصل مع الدعم أو راجع فواتيرك المستحقة.</div>
      </div>`);
  }

  if (st.role === 'worker') {
    const task = shipPend[0];
    if (task) {
      parts.push(`
        <div class="m-hero" style="margin:16px 18px 0">
          <div class="flex-center gap-8">
            <div style="width:9px;height:9px;border-radius:999px;background:#7DF0FF;animation:wPulse 1.6s infinite"></div>
            <div style="font-size:11px;font-weight:800;opacity:.9">مهمة بانتظارك</div>
          </div>
          <div style="font-size:16px;font-weight:800;margin-top:8px">وصل الطلب <span class="num">${task.id}</span> إلى الفرع</div>
          <div style="font-size:11.5px;line-height:1.8;opacity:.85;margin-top:3px">افحص البضاعة مقابل الفاتورة المعتمدة ثم أكّد الاستلام.</div>
          <button class="btn m-btn-sm btn-block mt-14" style="background:#fff;color:var(--c-info);font-size:13.5px" data-action="openReceive" data-arg="${task.id}">بدء الاستلام</button>
        </div>`);
    }
    parts.push(`
      <div class="flex gap-10" style="margin:16px 18px 0">
        ${[['طلب جديد', 'mGo', 'catalog', 'M12 5v14M5 12h14'], ['اللستات', 'mPushLists', '', 'M6.5 4.5h11V20l-5.5-3.4L6.5 20z'], ['طلباتي', 'mGo', 'orders', 'M6.2 3.6h11.6V20l-1.9-1.4-2 1.4-1.9-1.4-2 1.4-1.9-1.4L6.2 20zM9.3 8.2h5.4M9.3 11.7h5.4']].map(([l, a, arg, p]) => `
          <div class="m-card clickable" style="flex:1;padding:14px 10px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer" data-action="${a}" ${arg ? `data-arg="${arg}"` : ''}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="${p}" stroke="#0d7f93" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            <div style="font-size:11px;font-weight:800">${l}</div>
          </div>`).join('')}
      </div>`);
    if (!showPrices) {
      parts.push('<div class="banner banner-warn" style="margin:14px 18px 0;border-radius:13px;padding:10px 14px;font-size:10.5px;line-height:1.8">الأسعار مخفية لدور العامل حسب سياسة المنشأة — تظهر للمعتمدين.</div>');
    }
  }

  if (st.role === 'ops') {
    parts.push(`
      <div class="flex gap-10" style="margin:16px 18px 0">
        <div class="m-card clickable" style="flex:1;padding:14px 16px;border-color:var(--c-info-border);cursor:pointer" data-action="mGo" data-arg="approvals">
          <div class="num" style="font-size:26px;font-weight:700;color:var(--c-info)">${opsPend.length}</div>
          <div style="font-size:11px;font-weight:800;color:#0D5866;margin-top:2px">بانتظار تعميدك</div>
        </div>
        <div class="m-card" style="flex:1;padding:14px 16px">
          <div class="num" style="font-size:26px;font-weight:700">6</div>
          <div style="font-size:11px;font-weight:800;color:var(--c-muted);margin-top:2px">طلبات اليوم</div>
        </div>
      </div>
      <div class="m-section-title">قائمة التعميد</div>
      ${opsPend.map((o) => approvalCard(st, o, 'فتح التعميد')).join('')}`);
  }

  if (st.role === 'fin') {
    const due = st.invoices.filter((x) => x.st === 'unpaid' || x.st === 'part');
    parts.push(`
      <div style="margin:16px 18px 0">${walletHero(st)}</div>
      <div class="flex gap-10" style="margin:14px 18px 0">
        <div class="m-card clickable" style="flex:1;padding:14px 16px;cursor:pointer" data-action="goInvoicesM">
          <div class="num" style="font-size:26px;font-weight:700;color:var(--c-danger)">${due.length}</div>
          <div style="font-size:11px;font-weight:800;color:var(--c-muted);margin-top:2px">فواتير مستحقة</div>
        </div>
        <div class="m-card clickable" style="flex:1;padding:14px 16px;cursor:pointer" data-action="goInvoicesM">
          <div class="num" style="font-size:26px;font-weight:700">${fmt(due.reduce((s, x) => s + x.rem, 0))}</div>
          <div style="font-size:11px;font-weight:800;color:var(--c-muted);margin-top:2px">إجمالي المستحق (ر.س)</div>
        </div>
      </div>
      <button class="btn btn-primary m-btn-sm" style="margin:12px 18px 0;width:calc(100% - 36px);font-size:13px" data-action="openTopup">شحن المحفظة</button>`);
  }

  if (['frz', 'frzs'].includes(st.role)) {
    parts.push(`
      <div class="flex-center gap-11" style="margin:16px 18px 0;background:var(--c-info-bg);border:1px solid var(--c-info-border);border-radius:16px;padding:13px 16px">
        <img src="assets/logo-0.png" alt="" style="width:34px;height:34px;border-radius:10px;object-fit:contain;background:#fff;padding:4px;border:1px solid var(--c-info-border)">
        <div class="grow">
          <div style="font-size:12px;font-weight:800;color:#0D5866">مرتبط بالمانح: دوار السعادة</div>
          <div style="font-size:10px;line-height:1.7;color:var(--c-info);margin-top:2px">قائمة أسعار الفرنشايز مطبقة · محفظتك مستقلة — يطّلع المانح دون الصرف منها</div>
          ${st.role === 'frzs' ? '<div style="font-size:10px;font-weight:800;line-height:1.7;color:var(--c-purple);margin-top:3px">منطقة امتيازك: المنطقة الشرقية — تمنح ممنوحين ضمنها فقط</div>' : ''}
        </div>
      </div>`);
  }

  if (['owner', 'frz', 'frzs'].includes(st.role)) {
    parts.push(`<div style="margin:16px 18px 0">${walletHero(st)}</div>`);
    parts.push(purchPend.map((o) => `<div style="margin-top:14px">${approvalCard(st, o, 'التعميد النهائي — تعديل الكميات')}</div>`).join(''));
    parts.push(`
      <div class="banner banner-warn flex-center gap-10 clickable" style="margin:12px 18px 0;border-radius:14px;padding:12px 14px;cursor:pointer" data-action="goInvoicesM">
        <div style="width:8px;height:8px;border-radius:999px;background:#c98a12"></div>
        <div class="grow" style="font-size:11.5px;font-weight:700">فاتورة <span class="num">INV-9312</span> تستحق 28 يوليو — <span class="num">8,420.50</span> ر.س</div>
        ${ICONS.chevronL('#c98a12')}
      </div>`);
  }

  if (st.role === 'fr' || st.role === 'frzs') {
    const { netFrs } = franchiseScope(st);
    const maxSpend = Math.max(...netFrs.map((f) => f.spend), 1);
    if (st.role === 'fr') {
      parts.push(`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 18px 0">
          ${[
            [fmt0(netFrs.reduce((s, f) => s + f.spend, 0)), 'ر.س', 'مشتريات الشبكة — يوليو'],
            [String(netFrs.reduce((s, f) => s + f.orders, 0)), 'طلب', 'طلبات الممنوحين'],
            [`${Math.round(netFrs.reduce((s, f) => s + f.pay, 0) / Math.max(netFrs.length, 1))}%`, '', 'الالتزام بالسداد'],
            [String(netFrs.length), '', 'ممنوحون في الشبكة'],
          ].map(([v, u, l]) => `
            <div class="m-card" style="padding:13px 14px">
              <div class="num" style="font-size:19px;font-weight:700;color:var(--c-info)">${v}<span style="font-size:10.5px;font-family:var(--font-ar);font-weight:700;color:var(--c-faint)"> ${u}</span></div>
              <div style="font-size:10.5px;font-weight:800;color:var(--c-muted);margin-top:3px">${l}</div>
            </div>`).join('')}
        </div>
        <div class="banner banner-danger flex-center gap-10 clickable" style="margin:14px 18px 0;border-radius:14px;padding:12px 14px;cursor:pointer" data-action="mGo" data-arg="analytics">
          <div style="width:8px;height:8px;border-radius:999px;background:var(--c-danger)"></div>
          <div class="grow" style="font-size:11.5px;font-weight:700;color:var(--c-danger)">تأخر سداد — بروست الخليج: فاتورة متأخرة <span class="num">12</span> يومًا</div>
          ${ICONS.chevronL('#b23b3b')}
        </div>`);
    }
    parts.push(`
      <div class="m-section-title">مشتريات الممنوحين — يوليو<div class="grow"></div><div style="font-size:11px;color:#083b44;cursor:pointer;font-weight:800" data-action="mGo" data-arg="analytics">لوحة البيانات</div></div>
      <div class="m-card" style="margin:0 18px;padding:16px;display:flex;flex-direction:column;gap:12px">
        ${netFrs.filter((f) => f.spend > 0).map((f) => `
          <div>
            <div class="flex" style="font-size:11px;font-weight:700"><div>${esc(frTag(st, f))}</div><div class="grow"></div><div class="num" style="color:var(--c-muted)">${fmt0(f.spend)}</div></div>
            <div class="progress" style="margin-top:5px;height:8px"><div style="width:${Math.round(f.spend / maxSpend * 100)}%"></div></div>
          </div>`).join('')}
      </div>`);
  }

  if (st.role === 'b2b') {
    const prep = st.orders.filter((o) => o.st === 'b2b' || o.st === 'hold');
    const openTk = st.tickets.filter((t) => t.st === 'open');
    parts.push(`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 18px 0">
        ${[
          [String(prep.length), 'بانتظار التجهيز'],
          [String(shipPend.length), 'قيد التوصيل'],
          [String(openTk.length), 'تذاكر مفتوحة'],
          [String(st.prodReqs.filter((r) => r.st === 'pend').length), 'طلبات منتجات'],
        ].map(([v, l]) => `
          <div class="m-card" style="padding:13px 14px">
            <div class="num" style="font-size:22px;font-weight:700;color:var(--c-info)">${v}</div>
            <div style="font-size:10.5px;font-weight:800;color:var(--c-muted);margin-top:3px">${l}</div>
          </div>`).join('')}
      </div>
      ${openTk.length ? `
        <div class="banner banner-warn flex-center gap-10 clickable" style="margin:14px 18px 0;border-radius:14px;padding:12px 14px;cursor:pointer" data-action="mGo" data-arg="tickets">
          <div style="width:8px;height:8px;border-radius:999px;background:#c98a12"></div>
          <div class="grow" style="font-size:11.5px;font-weight:700">${openTk.length === 1 ? `تذكرة نواقص ${openTk[0].id} بانتظار التسوية` : `${openTk.length} تذاكر نواقص بانتظار التسوية`}</div>
          ${ICONS.chevronL('#c98a12')}
        </div>` : ''}
      <div class="m-section-title">بانتظار التجهيز</div>
      ${prep.map((o) => `
        <div class="m-card" style="margin:0 18px 10px;padding:14px 16px">
          <div class="flex-center gap-8">
            <div class="num" style="font-size:13.5px;font-weight:700">${o.id}</div>
            ${orderChip(o.st)}
            <div class="grow"></div>
            <div style="font-size:10.5px;color:var(--c-faint)">${esc(o.date)}</div>
          </div>
          <div style="font-size:11.5px;color:var(--c-muted);margin-top:6px">مطاعم البلدة — ${esc(o.branch)} · ${o.items.length} أصناف · <span class="num" style="font-weight:700;color:var(--c-ink)">${fmt(orderTotal(o))}</span> ر.س</div>
          <div class="flex gap-8" style="margin-top:12px">
            ${o.st !== 'hold'
              ? `<button class="btn btn-primary grow" style="height:44px;border-radius:12px;font-size:12.5px" data-action="b2bAdvance" data-arg="${o.id}">جاهز — إرسال للتوصيل</button>`
              : `<button class="btn btn-warn grow" style="height:44px;border-radius:12px;font-size:12.5px" data-action="resumeOrder" data-arg="${o.id}">استئناف التجهيز</button>`}
            <button class="btn btn-soft grow" style="height:44px;border-radius:12px;font-size:12px;color:var(--c-info)" data-action="openOrderDrawer" data-arg="${o.id}">التفاصيل</button>
          </div>
        </div>`).join('')}
      ${prep.length === 0 ? '<div class="empty-state" style="margin:0 18px;border-radius:18px">لا طلبات بانتظار التجهيز.</div>' : ''}`);
  }

  // آخر الطلبات (مشترك للأدوار العميلة)
  if (!['fr', 'b2b'].includes(st.role)) {
    parts.push(`
      <div class="m-section-title">آخر الطلبات<div class="grow"></div><div style="font-size:11px;color:#083b44;cursor:pointer;font-weight:800" data-action="mGo" data-arg="orders">الكل</div></div>
      <div class="m-card" style="margin:0 18px;overflow:hidden">
        ${st.orders.slice(0, 3).map((o) => `
          <div class="flex-center gap-10 clickable" style="padding:13px 16px;border-bottom:1px solid var(--c-divider);min-height:56px;cursor:pointer" data-action="openOrderDrawer" data-arg="${o.id}">
            <div class="grow">
              <div class="num" style="font-size:12.5px;font-weight:700">${o.id}</div>
              <div style="font-size:10.5px;color:var(--c-faint);margin-top:2px">${esc(o.date)} · ${esc(o.branch)}</div>
            </div>
            ${orderChip(o.st)}
          </div>`).join('')}
      </div>`);
  }

  return `
    <div class="m-screen">
      ${homeHeader(st, branchName)}
      <div class="m-body">
        <div style="padding:8px 18px 0">
          <div style="font-size:22px;font-weight:800">${esc(greeting)}</div>
          <div class="m-sub">${esc(R.name)} · ${esc(branchName)}</div>
        </div>
        ${parts.join('')}
      </div>
    </div>`;
}

// ============ الكتالوج ============
export function renderMCatalog(st) {
  const showPrices = showPricesFor(st.role);
  const canOrder = CAN_ORDER.includes(st.role);
  const products = filterProducts(st.search, st.cat);
  const canSuggest = CAN_REQUEST.includes(st.role);

  return `
    <div class="m-screen">
      <div class="m-head m-head-safe" style="display:block">
        <div class="m-title">الكتالوج</div>
        <div class="search-box mt-12" style="border-radius:14px">
          ${ICONS.search('#a8a4b8', 18)}
          <input data-input="search" data-key="m-search" value="${esc(st.search)}" placeholder="ابحث بالمنتج أو الرمز…" style="flex:1;border:none;outline:none;background:transparent;font-size:13px">
        </div>
        <div class="mt-10">${mChips(CATEGORIES, st.cat, 'setCat')}</div>
      </div>
      <div class="m-body m-pad" style="padding-top:4px;padding-bottom:190px">
        <div class="m-prod-grid">
          ${products.map((p) => {
            const qty = st.cart[p.id] || 0;
            return `
            <div class="m-card" style="border-radius:16px;padding:10px;display:flex;flex-direction:column">
              <div class="m-prod-img" style="background:${stripe(p.h)}">
                <div class="prod-code">${p.id}</div>
                ${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
              </div>
              <div style="font-size:12px;font-weight:800;line-height:1.5;margin-top:8px;min-height:36px">${esc(p.name)}</div>
              <div style="font-size:10px;color:var(--c-faint);margin-top:1px">${esc(p.unit)}</div>
              ${p.out ? '<div class="mt-9" style="min-height:44px;display:flex;align-items:center"><span class="chip chip-danger" style="font-size:10.5px;padding:5px 12px">نافد حاليًا</span></div>'
                : qty > 0 && canOrder ? `
                <div class="flex-center gap-7 mt-9" style="background:var(--c-info-bg);border-radius:12px;padding:2px">
                  <button class="stepper-btn" style="width:44px" data-action="cartInc" data-arg="${p.id}">${ICONS.plus('#0d7f93', 14, 2.4)}</button>
                  <div class="num grow" style="text-align:center;font-size:15px;font-weight:700;color:var(--c-info)">${qty}</div>
                  <button class="stepper-btn" style="width:44px" data-action="cartDec" data-arg="${p.id}">${ICONS.minus('#0d7f93', 14)}</button>
                </div>`
                : `
                <div class="flex-center mt-9">
                  ${showPrices ? `<div class="num" style="font-size:14px;font-weight:700">${fmt(p.price)}<span style="font-size:9.5px;font-family:var(--font-ar);color:var(--c-faint)"> ر.س</span></div>` : '<div style="font-size:10px;color:var(--c-faint)">حسب قائمة الأسعار</div>'}
                  <div class="grow"></div>
                  ${canOrder ? `<button class="add-fab" style="width:44px;height:44px" data-action="cartInc" data-arg="${p.id}">${ICONS.plus('#fff', 16, 2.4)}</button>` : ''}
                </div>`}
            </div>`;
          }).join('')}
        </div>
        ${products.length === 0 ? `<div style="text-align:center;padding:36px 20px;color:#0D5866;font-size:12px;line-height:2">لا نتائج لبحثك.${canSuggest ? '<br><span style="color:#083b44;font-weight:800;cursor:pointer;text-decoration:underline" data-action="openReqNew">اطلب إضافة منتج جديد</span> وسيراجعه فريق B2B.' : ''}</div>` : ''}
        ${canSuggest && products.length > 0 ? `
          <div class="flex-center gap-9 clickable" style="margin-top:14px;background:var(--c-info-bg);border:1px dashed var(--c-primary-border);border-radius:14px;padding:0 16px;min-height:48px;cursor:pointer" data-action="mPushMyReqs">
            ${ICONS.plus('#0d7f93', 15, 2.2)}
            <div class="grow" style="font-size:11.5px;font-weight:800;color:var(--c-info)">ما لقيت منتجك؟ اقترح منتجًا جديدًا</div>
            ${ICONS.chevronL('#0d7f93')}
          </div>` : ''}
      </div>
    </div>`;
}

// ============ طلباتي / التعميدات ============
export function renderMOrders(st) {
  const showPrices = showPricesFor(st.role);
  const fset = ORDER_FILTERS[st.ordFilter];
  const orders = st.orders.filter((o) => !fset || fset.includes(o.st));
  return `
    <div class="m-screen">
      <div class="m-head m-head-safe" style="display:block">
        <div class="m-title">طلباتي</div>
        <div class="mt-12">${mChips(Object.keys(ORDER_FILTERS), st.ordFilter, 'setOrdFilter')}</div>
      </div>
      <div class="m-body m-pad" style="padding-top:4px">
        <div class="m-card" style="overflow:hidden">
          ${orders.map((o) => orderCard(st, o, showPrices)).join('')}
          ${orders.length === 0 ? '<div style="padding:32px;text-align:center;font-size:12px;color:var(--c-faint)">لا طلبات ضمن هذا الفلتر.</div>' : ''}
        </div>
      </div>
    </div>`;
}

export function renderMApprovals(st) {
  const opsPend = st.orders.filter((o) => o.st === 'ops');
  return `
    <div class="m-screen">
      <div class="m-head m-head-safe" style="display:block">
        <div class="m-title">التعميدات</div>
        <div class="m-sub">الطلبات التي تنتظر تعميدك قبل تمريرها للمشتريات.</div>
      </div>
      <div class="m-body" style="padding-top:6px">
        ${opsPend.map((o) => approvalCard(st, o, 'فتح التعميد')).join('')}
        ${opsPend.length === 0 ? '<div style="text-align:center;padding:48px 20px;color:#0D5866;font-size:12.5px">لا طلبات بانتظار التعميد — أحسنت.</div>' : ''}
      </div>
    </div>`;
}

// ============ المحفظة ============
export function renderMWallet(st) {
  const W = st.wallet;
  const canPay = CAN_PAY.includes(st.role);
  const isW = st.finSeg === 'w';
  const iset = INVOICE_FILTERS[st.invFilter];
  const invoices = st.invoices.filter((x) => !iset || iset.includes(x.st));
  const rows = (list) => list.map((h) => `
    <div class="flex-center gap-10" style="padding:13px 16px;border-bottom:1px solid var(--c-divider)">
      <div class="grow">
        <div style="font-size:12px;font-weight:700">${esc(h.t)}</div>
        <div style="font-size:10px;color:var(--c-faint);margin-top:2px">${esc(h.d)}</div>
      </div>
      ${ledgerAmount(h.amt)}
    </div>`).join('');

  return `
    <div class="m-screen">
      <div class="m-head m-head-safe" style="display:block">
        <div class="m-title">العمليات المالية</div>
        <div class="seg mt-12" style="max-width:none">
          <div class="seg-item ${isW ? 'active' : ''}" data-action="setFinSeg" data-arg="w">المحفظة</div>
          <div class="seg-item ${!isW ? 'active' : ''}" data-action="setFinSeg" data-arg="i">الفواتير</div>
        </div>
      </div>
      <div class="m-body m-pad" style="padding-top:6px">
        ${isW ? `
          <div class="m-hero">
            <div class="flex-center"><div style="font-size:11px;font-weight:800;opacity:.85">رصيد المحفظة</div><div class="grow"></div><div class="num" style="font-size:10px;opacity:.75">C.R. ${orgCrOf(st)}</div></div>
            <div class="num" style="font-size:30px;font-weight:700;margin-top:8px">${fmt(W.bal)} <span style="font-size:12.5px;font-family:var(--font-ar);font-weight:700;opacity:.8">ر.س</span></div>
            <div style="font-size:10.5px;opacity:.8;margin-top:2px">المحفظة تتبع السجل التجاري وتعمل على فروع منشأتك فقط.</div>
            <div class="flex gap-8 mt-16">
              <button class="btn grow" style="height:44px;border-radius:12px;background:#fff;color:var(--c-info);font-size:12.5px" data-action="openTopup">شحن المحفظة</button>
              <button class="btn grow" style="height:44px;border-radius:12px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.45);color:#fff;font-size:12.5px" data-action="goInvoicesM">الفواتير</button>
            </div>
          </div>
          <div class="m-card mt-12" style="padding:16px">
            <div class="flex" style="font-size:12px;font-weight:800"><div>الحد الائتماني</div><div class="grow"></div><div class="num" style="color:var(--c-muted);font-weight:700">${fmt0(W.used)} / ${fmt0(W.limit)}</div></div>
            <div class="progress mt-10" style="height:8px"><div style="width:${Math.round(W.used / W.limit * 100)}%"></div></div>
            <div style="font-size:10.5px;color:var(--c-muted);margin-top:8px">المتاح للطلب الآجل: <span class="num" style="font-weight:700;color:var(--c-success)">${fmt0(W.limit - W.used)}</span> ر.س — يتوقف الاعتماد تلقائيًا عند تجاوز الحد.</div>
          </div>
          <div class="m-section-title" style="margin:20px 0 10px">كشف الحركات</div>
          <div class="m-card" style="overflow:hidden">${rows(W.hist)}</div>
          <div class="m-section-title" style="margin:20px 0 10px">سجل التسويات</div>
          <div class="m-card" style="overflow:hidden">${rows(W.settle)}</div>`
        : `
          <div style="margin-bottom:12px">${mChips(Object.keys(INVOICE_FILTERS), st.invFilter, 'setInvFilter')}</div>
          ${invoices.map((x) => {
            const m = INVOICE_STATUS[x.st];
            return `
            <div class="m-card" style="padding:14px 16px;margin-bottom:10px">
              <div class="flex-center gap-8">
                <div class="num" style="font-size:13px;font-weight:700">${x.id}</div>
                ${chip(m.label, m.chip)}
                <div class="grow"></div>
                <button class="btn num" style="height:34px;padding:0 11px;border:1px solid var(--c-card-border);border-radius:999px;font-size:10px;font-weight:700;color:var(--c-info)" data-action="invoicePdf" data-arg="${x.id}">PDF</button>
              </div>
              <div style="font-size:11px;color:var(--c-muted);margin-top:6px">${esc(x.ref)} · ${esc(x.due)}</div>
              <div class="flex-center" style="margin-top:8px">
                <div class="num" style="font-size:16px;font-weight:700">${fmt(Math.abs(x.amt))} <span style="font-size:10px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div>
                <div class="grow"></div>
                ${(x.st === 'unpaid' || x.st === 'part') && canPay ? `<button class="btn btn-primary" style="height:40px;padding:0 18px;border-radius:11px;font-size:11.5px" data-action="payInvoice" data-arg="${x.id}">سداد من المحفظة</button>` : ''}
              </div>
            </div>`;
          }).join('')}`}
      </div>
    </div>`;
}

// ============ التحليلات / الممنوحون / العملاء / التذاكر ============
export function renderMAnalytics(st) {
  const { netFrs } = franchiseScope(st);
  const maxSpend = Math.max(...netFrs.map((f) => f.spend), 1);
  return `
    <div class="m-screen">
      <div class="m-head m-head-safe">
        <div>
          <div class="m-title">لوحة البيانات</div>
          <div class="m-sub">${st.role === 'frzs' ? 'شبكة ممنوحيك — المنطقة الشرقية' : 'شبكة الفرنشايز'} · يوليو 2026</div>
        </div>
        <div class="grow"></div>
        <button class="btn btn-sm btn-pill num" style="border:1px solid var(--c-card-border);background:#fff;color:var(--c-info)" data-action="reportPdf">PDF</button>
        <button class="btn btn-sm btn-pill num" style="border:1px solid var(--c-card-border);background:#fff;color:var(--c-success)" data-action="reportXls">Excel</button>
      </div>
      <div class="m-body m-pad" style="padding-top:6px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${[
            [fmt0(netFrs.reduce((s, f) => s + f.spend, 0)), 'ر.س', 'مشتريات الشبكة'],
            [String(netFrs.reduce((s, f) => s + f.orders, 0)), 'طلب', 'طلبات الممنوحين'],
            [`${Math.round(netFrs.reduce((s, f) => s + f.pay, 0) / Math.max(netFrs.length, 1))}%`, '', 'الالتزام بالسداد'],
            [String(netFrs.length), '', 'ممنوحون'],
          ].map(([v, u, l]) => `
            <div class="m-card" style="border-radius:16px;padding:13px 14px">
              <div class="num" style="font-size:19px;font-weight:700;color:var(--c-info)">${v}<span style="font-size:10.5px;font-family:var(--font-ar);font-weight:700;color:var(--c-faint)"> ${u}</span></div>
              <div style="font-size:10.5px;font-weight:800;color:var(--c-muted);margin-top:3px">${l}</div>
            </div>`).join('')}
        </div>
        <div class="m-section-title" style="margin:20px 0 10px">مقارنة المشتريات</div>
        <div class="m-card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
          ${netFrs.filter((f) => f.spend > 0).map((f) => `
            <div>
              <div class="flex" style="font-size:11px;font-weight:700"><div>${esc(frTag(st, f))}</div><div class="grow"></div><div class="num" style="color:var(--c-muted)">${fmt0(f.spend)}</div></div>
              <div class="progress" style="margin-top:5px;height:8px"><div style="width:${Math.round(f.spend / maxSpend * 100)}%"></div></div>
            </div>`).join('')}
        </div>
        <div class="m-section-title" style="margin:20px 0 10px">الالتزام بالسداد</div>
        <div class="m-card" style="overflow:hidden">
          ${netFrs.map((f) => `
            <div class="flex-center gap-10" style="padding:12px 16px;border-bottom:1px solid var(--c-divider)">
              <div class="grow" style="font-size:12px;font-weight:700">${esc(frTag(st, f))}</div>
              <div class="chip num ${f.pay >= 90 ? 'chip-success' : f.pay >= 80 ? 'chip-warn' : 'chip-danger'}">${f.pay}%</div>
            </div>`).join('')}
        </div>
        <div class="m-section-title" style="margin:20px 0 10px">تنبيهات الانحراف</div>
        <div class="banner banner-danger" style="border-radius:14px;padding:12px 14px;margin-bottom:9px">
          <div style="font-size:12px;font-weight:800;color:var(--c-danger-deep)">تأخر سداد — بروست الخليج</div>
          <div style="font-size:10.5px;margin-top:3px;line-height:1.7;color:var(--c-danger-deep)">فاتورة متأخرة 12 يومًا بقيمة 9,200 ر.س — أُرسل تذكير تلقائي.</div>
        </div>
        <div class="banner banner-warn" style="border-radius:14px;padding:12px 14px">
          <div style="font-size:12px;font-weight:800">انخفاض طلبات — كرسبر برجر</div>
          <div style="font-size:10.5px;margin-top:3px;line-height:1.7">انخفاض 38% عن متوسط 4 أسابيع — قد يشير لمشكلة تشغيلية.</div>
        </div>
      </div>
    </div>`;
}

export function renderMFrs(st) {
  const { myFrs } = franchiseScope(st);
  return `
    <div class="m-screen">
      <div class="m-head m-head-safe">
        <div class="m-title">الممنوحون</div>
        <div class="grow"></div>
        <button class="m-pill-btn" data-action="openFrNew">${ICONS.plus('#fff', 13, 2.6)} إنشاء ممنوح</button>
      </div>
      <div class="m-body m-pad" style="padding-top:6px">
        ${myFrs.map((f) => {
          const m = FRANCHISEE_STATUS[f.active ? f.st : 'off'];
          return `
          <div class="m-card clickable" style="padding:14px 16px;margin-bottom:10px;cursor:pointer" data-action="openFranchisee" data-arg="${f.id}">
            <div class="flex-center gap-8">
              <div class="grow" style="font-size:13px;font-weight:800">${esc(f.name)}${f.super ? ` <span class="chip chip-purple" style="margin-inline-start:5px">سوبر · ${esc(f.region || '')}</span>` : ''}</div>
              ${chip(m.label, m.chip)}
            </div>
            <div style="font-size:10.5px;color:var(--c-faint);margin-top:5px">${esc(f.city)} · <span class="num">C.R. ${esc(f.cr)}</span></div>
            <div class="flex" style="gap:14px;margin-top:10px;font-size:10.5px;color:var(--c-muted)">
              <div>طلبات: <span class="num" style="font-weight:700;color:var(--c-ink)">${f.orders}</span></div>
              <div>محفظته: <span class="num" style="font-weight:700;color:var(--c-ink)">${fmt0(f.bal)}</span> ر.س</div>
              <div>السداد: <span class="num" style="font-weight:700;color:var(--c-ink)">${f.pay}%</span></div>
            </div>
            ${st.role === 'b2b' && f.st === 'new' && f.active ? `<button class="btn btn-primary btn-block mt-12" style="height:44px;border-radius:12px;font-size:12.5px" data-action="approveFranchisee" data-arg="${f.id}">تعميد وتفعيل</button>` : ''}
          </div>`;
        }).join('')}
        <div class="banner-info-dashed" style="border-style:solid">لكل ممنوح محفظة مستقلة تُنشأ تلقائيًا عند تفعيل سجله التجاري، وتعمل على فروعه فقط — يطّلع المانح عليها دون الصرف منها.</div>
      </div>
    </div>`;
}

export function renderMClients(st) {
  return `
    <div class="m-screen">
      <div class="m-head m-head-safe" style="display:block">
        <div class="m-title">العملاء</div>
        <div class="m-sub" style="color:var(--c-muted)">كل المنشآت: المحافظ، الحدود الائتمانية، والإيقاف الفوري.</div>
      </div>
      <div class="m-body m-pad" style="padding-top:6px">
        ${st.clients.map((c) => {
          const susp = c.st === 'susp';
          return `
          <div class="m-card clickable" style="padding:14px 16px;margin-bottom:10px;cursor:pointer;${susp ? 'opacity:.6' : ''}" data-action="openClientProfile" data-arg="${c.id}">
            <div class="flex-center gap-8">
              <div class="grow" style="font-size:13px;font-weight:800">${esc(c.name)}</div>
              ${chip(susp ? 'موقوف' : 'نشط', susp ? 'chip-danger' : 'chip-success')}
            </div>
            <div style="font-size:10.5px;color:var(--c-faint);margin-top:4px">${esc(c.city)} · <span class="num">C.R. ${esc(c.cr)}</span></div>
            <div class="flex" style="gap:14px;margin-top:10px;font-size:10.5px;color:var(--c-muted)">
              <div>طلبات: <span class="num" style="font-weight:700;color:var(--c-ink)">${c.orders}</span></div>
              <div>محفظته: <span class="num" style="font-weight:700;color:var(--c-ink)">${fmt0(c.bal)}</span> ر.س</div>
              <div>الحد: <span class="num" style="font-weight:700;color:var(--c-ink)">${fmt0(c.limit)}</span></div>
            </div>
            <div class="flex gap-8" style="margin-top:11px">
              <button class="btn ${susp ? 'btn-success-solid' : 'btn-danger-outline'} grow" style="height:40px;border-radius:11px;font-size:11px;border-width:1px" data-action="toggleClientAccount" data-arg="${c.id}">${susp ? 'إعادة تفعيل' : 'إيقاف المنشأة'}</button>
              <button class="btn ${c.wst === 'frozen' ? 'btn-success-solid' : 'btn-warn-outline'} grow" style="height:40px;border-radius:11px;font-size:11px;border-width:1px" data-action="toggleClientWallet" data-arg="${c.id}">${c.wst === 'frozen' ? 'فك تجميد المحفظة' : 'تجميد المحفظة'}</button>
            </div>
          </div>`;
        }).join('')}
        <div class="banner-info-dashed" style="border-style:solid">أي تغيير هنا ينعكس فورًا على تطبيق العميل — جرّب إيقاف «مطاعم البلدة» ثم بدّل لدور العامل.</div>
      </div>
    </div>`;
}

export function renderMTickets(st) {
  return `
    <div class="m-screen">
      <div class="m-head m-head-safe" style="display:block">
        <div class="m-title">التذاكر</div>
        <div class="m-sub" style="color:var(--c-muted)">نواقص الاستلام وطلبات إضافة المنتجات من العملاء.</div>
      </div>
      <div class="m-body m-pad" style="padding-top:6px">
        <div style="font-size:13px;font-weight:800;margin:4px 0 10px">تذاكر النواقص</div>
        ${st.tickets.map((t) => `
          <div class="m-card" style="padding:14px 16px;margin-bottom:10px">
            <div class="flex-center gap-8">
              <div class="num" style="font-size:13px;font-weight:700">${t.id}</div>
              ${ticketChip(t)}
              <div class="grow"></div>
              <div style="font-size:10.5px;color:var(--c-faint)">${esc(t.date)}</div>
            </div>
            <div style="font-size:11.5px;font-weight:700;margin-top:8px">${esc(t.desc)}</div>
            <div style="font-size:10.5px;color:var(--c-muted);margin-top:3px">${esc(t.customer)} · مرجع <span class="num">${t.ord}</span> · ${esc(t.qty)}</div>
            <div class="flex gap-8" style="margin-top:12px">
              ${t.st === 'open' ? `<button class="btn btn-primary" style="flex:1.5;height:46px;border-radius:12px;font-size:12px" data-action="resolveTicket" data-arg="${t.id}">إصدار إشعار دائن — ${fmt(t.val)} ر.س</button>` : ''}
              ${t.st === 'held' ? `<button class="btn btn-warn" style="flex:1.5;height:46px;border-radius:12px;font-size:12px" data-action="resumeTicket" data-arg="${t.id}">استئناف التذكرة</button>` : ''}
              <button class="btn btn-soft grow" style="height:46px;border-radius:12px;font-size:12px;color:var(--c-info)" data-action="openTicket" data-arg="${t.id}">التفاصيل</button>
            </div>
          </div>`).join('')}
        <div style="font-size:13px;font-weight:800;margin:18px 0 10px">طلبات إضافة منتجات</div>
        ${st.prodReqs.map((r) => {
          const m = REQUEST_STATUS[r.st];
          return `
          <div class="m-card" style="padding:14px 16px;margin-bottom:10px">
            <div class="flex-center gap-8">
              <div class="grow" style="font-size:12.5px;font-weight:800">${esc(r.name)}</div>
              ${r.st !== 'pend' ? chip(m.label, m.chip) : ''}
              <div class="num" style="font-size:10.5px;color:var(--c-faint)">${r.id}</div>
            </div>
            <div style="font-size:10.5px;color:var(--c-muted);margin-top:4px">${esc(r.by)} · ${esc(r.date)} — «${esc(r.note)}»</div>
            ${r.price != null && r.st !== 'pend' ? `<div class="num" style="font-size:11px;font-weight:800;color:var(--c-info);margin-top:6px">السعر المقترح: ${fmt(r.price)} ر.س</div>` : ''}
            ${r.st === 'pend' ? `
              <div class="flex gap-8" style="margin-top:12px">
                <button class="btn btn-primary grow" style="height:44px;border-radius:12px;font-size:12.5px" data-action="approveRequest" data-arg="${r.id}">تسعير وإرسال للعميل</button>
                <button class="btn btn-danger-outline" style="width:96px;height:44px;border-radius:12px;font-size:12px" data-action="rejectRequest" data-arg="${r.id}">رفض</button>
              </div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ============ المزيد ============
export function renderMMore(st) {
  const R = ROLES[st.role];
  const pendReqs = st.prodReqs.filter((r) => r.st === 'pend').length;
  const items = [{ l: 'اللستات المحفوظة', d: `${st.lists.length} لستات`, a: 'mPushLists' }];
  if (CAN_REQUEST.includes(st.role)) items.push({ l: 'اقتراح منتجات جديدة', d: pendReqs ? `${pendReqs} قيد المراجعة` : '', a: 'mPushMyReqs' });
  if (['fin', 'owner', 'fr', 'frz', 'frzs'].includes(st.role)) items.push({ l: 'الفواتير وكشف الحساب', d: String(st.invoices.length), a: 'goInvoicesM' });
  if (['owner', 'fr', 'frz', 'frzs'].includes(st.role)) {
    items.push({ l: 'الفروع', d: `${st.branches.length} فروع`, a: 'mPushBranches' });
    items.push({ l: 'اليوزرات والصلاحيات', d: `${st.users.length} مستخدمين`, a: 'mPushUsers' });
  }
  if (st.role === 'frzs') {
    items.push({ l: 'لوحة عرض البيانات', d: '', a: 'mGo', arg: 'analytics' });
    items.push({ l: 'إدارة الممنوحين', d: '', a: 'mGo', arg: 'frs' });
  }
  if (st.role === 'fr') items.push({ l: 'إنشاء ممنوحين', d: String(st.frs.length), a: 'mGo', arg: 'frs' });
  if (st.role === 'b2b') {
    items.push({ l: 'التعميدات المالية', d: (st.topupReqs || []).length ? `${st.topupReqs.length} بانتظار` : '', a: 'mPushFintu' });
    items.push({ l: 'إدارة الكتالوج والتوفر', d: `${PRODUCTS.length} منتج`, a: 'mPushCadmin' });
  }

  return `
    <div class="m-screen">
      <div class="m-head m-head-safe" style="display:block"><div class="m-title">المزيد</div></div>
      <div class="m-body m-pad" style="padding-top:6px">
        <div class="m-card flex-center gap-13" style="padding:16px;gap:13px">
          <div style="width:48px;height:48px;border-radius:999px;background:var(--c-purple-soft);color:var(--c-purple);font-size:19px;font-weight:800;display:flex;align-items:center;justify-content:center">${esc(R.ini)}</div>
          <div>
            <div style="font-size:14px;font-weight:800">${esc(R.user)}</div>
            <div class="m-sub">${esc(R.name)} · ${esc(R.org)}</div>
          </div>
        </div>
        <div style="font-size:12px;font-weight:800;color:#0D5866;margin:18px 4px 8px">التشغيل</div>
        <div class="m-card" style="overflow:hidden">
          ${items.map((m) => `
            <div class="flex-center gap-10 clickable" style="padding:0 16px;min-height:52px;border-bottom:1px solid var(--c-divider);cursor:pointer" data-action="${m.a}" ${m.arg ? `data-arg="${m.arg}"` : ''}>
              <div class="grow" style="font-size:13px;font-weight:700">${m.l}</div>
              <div class="num" style="font-size:11px;color:var(--c-faint)">${m.d}</div>
              ${ICONS.chevronL()}
            </div>`).join('')}
        </div>
        <div style="font-size:12px;font-weight:800;color:#0D5866;margin:18px 4px 8px">الإعدادات</div>
        <div class="m-card" style="overflow:hidden">
          <div class="flex-center gap-10" style="padding:0 16px;min-height:52px;border-bottom:1px solid var(--c-divider)">
            <div class="grow" style="font-size:13px;font-weight:700">اللغة</div>
            <div style="font-size:11px;font-weight:800;color:var(--c-purple);background:var(--c-purple-soft);border-radius:8px;padding:4px 10px">عربي · E</div>
          </div>
          <div class="flex-center gap-10 clickable" style="padding:0 16px;min-height:52px;border-bottom:1px solid var(--c-divider);cursor:pointer" data-action="rowSoon">
            <div class="grow" style="font-size:13px;font-weight:700">تفضيلات الإشعارات</div>
            ${ICONS.chevronL()}
          </div>
          <div style="padding:13px 16px">
            <div class="flex-center gap-10">
              <div class="grow" style="font-size:13px;font-weight:700">السجل التجاري</div>
              <div class="num" style="font-size:11px;color:var(--c-muted)">${orgCrOf(st)}</div>
            </div>
            <div class="banner banner-warn mt-9" style="border-radius:11px;padding:9px 12px;font-size:10.5px;line-height:1.8">ينتهي في 12 سبتمبر 2026 — يُعلَّق الحساب تلقائيًا فور الانتهاء حتى تحديث السجل.</div>
          </div>
        </div>
        <button class="btn btn-block mt-14" style="background:#fff;border:1px solid var(--c-card-border);color:var(--c-danger);font-size:13px;min-height:52px;border-radius:18px" data-action="logout">تسجيل الخروج</button>
      </div>
    </div>`;
}

// ============ شاشات Push ============

/** تفاصيل الطلب */
export function renderMOrderDetail(st) {
  const o = findOrder(st.drawer.id);
  if (!o) return '';
  const showPrices = showPricesFor(st.role);
  const sub = o.items.reduce((s, i) => s + PRODUCT_MAP[i.pid].price * i.qty, 0);
  const idx = STEP_INDEX[o.st];
  const act = rowAction(st, o);

  const timeline = ORDER_STEPS.map((label, i) => {
    let mode = 'wait';
    if (o.st === 'rej') mode = i < o.rejAt ? 'done' : (i === o.rejAt ? 'rej' : 'wait');
    else if (i < idx) mode = 'done';
    else if (i === idx && o.st !== 'done' && o.st !== 'short') mode = 'now';
    return `
      <div class="timeline-step">
        <div class="timeline-rail">
          <div class="timeline-dot ${mode}"></div>
          ${i < ORDER_STEPS.length - 1 ? `<div class="timeline-line ${mode === 'done' ? 'done' : ''}"></div>` : ''}
        </div>
        <div class="flex grow" style="padding-bottom:16px;align-items:flex-start">
          <div>
            <div class="timeline-label" style="color:${mode === 'wait' ? 'var(--c-faint)' : mode === 'rej' ? 'var(--c-danger)' : 'var(--c-ink)'}">${label}</div>
            ${POLICY.statusEnglish ? `<div class="timeline-en">${ORDER_STEPS_EN[i]}</div>` : ''}
          </div>
          <div class="grow"></div>
          <div class="timeline-stamp">${mode === 'rej' ? 'رُفض هنا' : (o.stamps[i] || '')}</div>
        </div>
      </div>`;
  }).join('');

  const tk = o.ticket ? st.tickets.find((x) => x.id === o.ticket) : null;

  return `
    <div class="m-screen push">
      ${pushHeader(`<span class="num">${o.id}</span>`, `${esc(o.date)} · ${esc(o.by)} · ${esc(o.branch)}`, orderChip(o.st))}
      <div class="m-body m-pad" style="padding-top:6px">
        ${o.st === 'hold' ? `<div class="banner banner-warn" style="margin-bottom:12px"><div class="banner-title">الطلب معلق لدى B2B</div><div class="banner-text">${esc(o.holdReason || '')}</div></div>` : ''}
        ${o.st === 'rej' ? `<div class="banner banner-danger" style="margin-bottom:12px"><div class="banner-title">سبب الرفض</div><div class="banner-text">${esc(o.reason || '')}</div></div>` : ''}
        ${o.ticket ? `
          <div class="banner banner-warn flex-center gap-10 clickable" style="margin-bottom:12px;cursor:pointer" data-action="openTicket" data-arg="${esc(o.ticket)}">
            <div class="grow">
              <div class="banner-title">تذكرة نواقص <span class="num">${esc(o.ticket)}</span></div>
              <div style="font-size:11px;line-height:1.8;color:var(--c-warn-deep);margin-top:3px">${tk ? (tk.st === 'resolved' ? `صدر إشعار دائن ${tk.cn || ''} في محفظتكم` : 'لدى B2B الآن — اضغط للتفاصيل') : 'أُرسلت إلى B2B.'}</div>
            </div>
            ${ICONS.chevronL('#c98a12')}
          </div>` : ''}
        <div class="m-card" style="padding:16px">
          <div style="font-size:13px;font-weight:800;margin-bottom:14px">رحلة الطلب</div>
          ${timeline}
        </div>
        <div class="m-card" style="overflow:hidden;margin-top:12px">
          ${o.items.map((i) => {
            const p = PRODUCT_MAP[i.pid];
            return `
            <div class="flex-center gap-11" style="padding:12px 16px;border-bottom:1px solid var(--c-divider)">
              ${prodThumb(p)}
              <div class="grow">
                <div style="font-size:12px;font-weight:700">${esc(p.name)}</div>
                <div style="font-size:10px;color:var(--c-faint);margin-top:2px">${esc(p.unit)} × <span class="num" style="font-weight:700">${i.qty}</span></div>
              </div>
              ${showPrices ? `<div class="num" style="font-size:12px;font-weight:700">${fmt(p.price * i.qty)}</div>` : ''}
            </div>`;
          }).join('')}
          ${showPrices ? `
            <div style="padding:13px 16px;background:var(--c-subtle)">
              <div class="flex" style="font-size:11px;color:var(--c-muted)"><div>المجموع</div><div class="grow"></div><div class="num">${fmt(sub)}</div></div>
              <div class="flex" style="font-size:11px;color:var(--c-muted);margin-top:5px"><div>الضريبة 15%</div><div class="grow"></div><div class="num">${fmt(sub * 0.15)}</div></div>
              <div class="flex" style="font-size:13.5px;font-weight:800;margin-top:7px"><div>الإجمالي</div><div class="grow"></div><div class="num">${fmt(sub * 1.15)} <span style="font-size:9.5px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div></div>
            </div>` : ''}
        </div>
        ${act && act.action === 'openApprove' ? `<button class="btn btn-primary btn-block m-btn mt-14" data-action="openApprove" data-arg="${o.id}">فتح شاشة التعميد</button>` : ''}
        ${act && act.action === 'openReceive' ? `<button class="btn btn-primary btn-block m-btn mt-14" data-action="openReceive" data-arg="${o.id}">بدء الاستلام</button>` : ''}
        ${o.st === 'b2b' && st.role === 'b2b' ? `
          <button class="btn btn-primary btn-block m-btn mt-14" data-action="b2bAdvance" data-arg="${o.id}">جاهز — إرسال للتوصيل</button>
          <div class="flex gap-8 mt-10">
            <button class="btn btn-soft grow m-btn-sm" style="font-size:12px;color:var(--c-info)" data-action="openApprove" data-arg="${o.id}">تعديل الكميات</button>
            <button class="btn btn-warn-outline grow m-btn-sm" style="font-size:12px" data-action="openHold" data-arg="${o.id}">تعليق بسبب</button>
            <button class="btn btn-danger-outline grow m-btn-sm" style="font-size:12px" data-action="openReject" data-arg="${o.id}">رفض</button>
          </div>` : ''}
        ${o.st === 'hold' && st.role === 'b2b' ? `
          <button class="btn btn-primary btn-block m-btn mt-14" data-action="resumeOrder" data-arg="${o.id}">استئناف التجهيز</button>
          <button class="btn btn-danger-outline btn-block m-btn-sm mt-10" style="font-size:13px" data-action="openReject" data-arg="${o.id}">رفض الطلب — بسبب إلزامي</button>` : ''}
      </div>
    </div>`;
}

/** التعميد */
export function renderMApprove(st) {
  const o = findOrder(st.modal.id);
  const total = o.items.reduce((s, i) => s + PRODUCT_MAP[i.pid].price * (st.approveQty[i.pid] || 0), 0) * 1.15;
  const btnLabel = o.st === 'ops' ? 'تعميد وتمرير لمدير المشتريات' : o.st === 'purch' ? 'التعميد النهائي والإرسال إلى B2B' : 'حفظ التعديل وإشعار العميل';
  return `
    <div class="m-screen push">
      ${pushHeader(`تعميد <span class="num">${o.id}</span>`, `${esc(o.by)} · ${esc(o.branch)}`)}
      <div class="m-body m-pad" style="padding-top:6px">
        <div class="banner-info-dashed" style="border-style:solid;margin-bottom:12px">يمكنك تعديل الكميات قبل الاعتماد — يُشعَر مقدّم الطلب بأي تغيير تلقائيًا.</div>
        <div class="m-card" style="overflow:hidden">
          ${o.items.map((i) => {
            const p = PRODUCT_MAP[i.pid];
            const qty = st.approveQty[i.pid];
            return `
            <div class="flex-center gap-11" style="padding:11px 14px;border-bottom:1px solid var(--c-divider)">
              ${prodThumb(p)}
              <div class="grow" style="min-width:0">
                <div style="font-size:11.5px;font-weight:700">${esc(p.name)}</div>
                <div style="font-size:9.5px;color:var(--c-faint);margin-top:2px">${esc(p.unit)}${qty !== i.qty ? '<span style="color:#c98a12;font-weight:800"> · عُدّلت</span>' : ''}</div>
              </div>
              <div class="stepper">
                <button class="stepper-btn" style="width:44px;height:44px" data-action="approveInc" data-arg="${i.pid}">${ICONS.plus('#0d7f93', 13, 2.4)}</button>
                <div class="num" style="width:26px;text-align:center;font-size:14px;font-weight:700">${qty}</div>
                <button class="stepper-btn" style="width:44px;height:44px" data-action="approveDec" data-arg="${i.pid}">${ICONS.minus('#0d7f93', 13)}</button>
              </div>
            </div>`;
          }).join('')}
          <div class="flex" style="padding:13px 16px;background:var(--c-subtle);font-size:13px;font-weight:800"><div>الإجمالي بعد التعديل</div><div class="grow"></div><div class="num">${fmt(total)} <span style="font-size:9.5px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div></div>
        </div>
        <button class="btn btn-primary btn-block m-btn mt-14" data-action="doApprove">${btnLabel}</button>
        <button class="btn btn-danger-outline btn-block mt-10" style="height:50px;border-radius:14px;font-size:13.5px" data-action="openReject" data-arg="${o.id}">رفض الطلب — بسبب إلزامي</button>
      </div>
    </div>`;
}

/** الاستلام */
export function renderMReceive(st) {
  const o = findOrder(st.modal.id);
  const shorts = o.items.filter((i) => st.recv[i.pid].short);
  return `
    <div class="m-screen push">
      ${pushHeader(`استلام <span class="num">${o.id}</span>`, 'افحص كل صنف مقابل الفاتورة المعتمدة')}
      <div class="m-body m-pad" style="padding-top:6px">
        <div class="banner banner-warn" style="border-radius:14px;padding:11px 14px;font-size:10.5px;line-height:1.8;margin-bottom:12px">الفحص والتبليغ عن النواقص قبل تأكيد الاستلام فقط — لا يمكن فتح تذكرة بعد التأكيد.</div>
        <div class="m-card" style="overflow:hidden">
          ${o.items.map((i) => {
            const p = PRODUCT_MAP[i.pid];
            const r = st.recv[i.pid];
            return `
            <div style="padding:12px 14px;border-bottom:1px solid var(--c-divider)">
              <div class="flex-center gap-11">
                ${prodThumb(p)}
                <div class="grow" style="min-width:0">
                  <div style="font-size:11.5px;font-weight:700">${esc(p.name)}</div>
                  <div style="font-size:9.5px;color:var(--c-faint);margin-top:2px">المطلوب: <span class="num" style="font-weight:700">${i.qty}</span> × ${esc(p.unit)}</div>
                </div>
                <div style="flex:none;height:44px;display:flex;align-items:center;padding:0 16px;border-radius:12px;font-size:11.5px;font-weight:800;cursor:pointer;${r.short ? 'background:var(--c-danger-bg);color:var(--c-danger);border:1.5px solid var(--c-danger-border)' : 'background:var(--c-success-bg);color:var(--c-success);border:1.5px solid var(--c-success-border)'}"
                  data-action="toggleShort" data-arg="${i.pid}" data-arg2="${i.qty}">${r.short ? 'ناقص' : 'كامل'}</div>
              </div>
              ${r.short ? `
                <div class="flex-center gap-8 mt-9" style="background:var(--c-danger-bg);border-radius:11px;padding:5px 8px">
                  <div class="grow" style="font-size:10.5px;font-weight:700;color:var(--c-danger)">الكمية المستلمة فعليًا</div>
                  <button class="stepper-btn" style="width:44px;height:38px" data-action="recvInc" data-arg="${i.pid}" data-arg2="${i.qty}">${ICONS.plus('#b23b3b', 12, 2.4)}</button>
                  <div class="num" style="width:22px;text-align:center;font-size:13px;font-weight:700;color:var(--c-danger)">${r.recv}</div>
                  <button class="stepper-btn" style="width:44px;height:38px" data-action="recvDec" data-arg="${i.pid}" data-arg2="${i.qty}">${ICONS.minus('#b23b3b', 12)}</button>
                </div>` : ''}
            </div>`;
          }).join('')}
        </div>
        ${shorts.length ? `<div class="banner banner-danger mt-12" style="border-radius:14px;padding:11px 14px;font-size:11px;line-height:1.8;color:var(--c-danger-deep)"><b>${shorts.length}</b> صنف ناقص — ستُفتح تذكرة «استلمت أقل من المطلوب» وتُرسل إلى B2B مع تأكيد الاستلام.</div>` : ''}
        <button class="btn btn-block m-btn mt-14" style="background:${shorts.length ? 'var(--c-warn)' : 'var(--c-success)'};color:#fff" data-action="confirmReceive">${shorts.length ? 'فتح تذكرة النواقص وتأكيد الاستلام' : 'تأكيد الاستلام الكامل'}</button>
      </div>
    </div>`;
}

/** شحن المحفظة */
export function renderMTopup(st) {
  const amounts = [1000, 2500, 5000, 10000];
  return `
    <div class="m-screen push">
      ${pushHeader('شحن المحفظة')}
      <div class="m-body m-pad" style="padding-top:6px">
        <div style="font-size:12px;font-weight:800;color:#0D5866;margin:6px 4px 8px">المبلغ</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
          ${amounts.map((a) => `
            <div class="num" style="height:52px;display:flex;align-items:center;justify-content:center;gap:4px;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;${st.topupAmt === a ? 'background:var(--c-primary);color:#fff' : 'background:#fff;border:1px solid var(--c-card-border)'}"
              data-action="setTopupAmt" data-arg="${a}">${fmt0(a)} <span style="font-size:10px;opacity:.7;font-family:var(--font-ar)">ر.س</span></div>`).join('')}
        </div>
        <div class="flex-center gap-8 mt-10 m-card" style="border-radius:14px;padding:6px 8px">
          <div class="grow" style="font-size:11px;font-weight:700;color:var(--c-muted);padding-inline-start:8px">مبلغ مخصص</div>
          <button class="stepper-btn" style="width:44px;height:44px;background:var(--c-chip-bg);border-radius:10px" data-action="topupInc">${ICONS.plus('#0d7f93', 13, 2.4)}</button>
          <div class="num" style="width:76px;text-align:center;font-size:16px;font-weight:700">${fmt0(st.topupAmt)}</div>
          <button class="stepper-btn" style="width:44px;height:44px;background:var(--c-chip-bg);border-radius:10px" data-action="topupDec">${ICONS.minus('#0d7f93', 13)}</button>
        </div>
        <div style="font-size:12px;font-weight:800;color:#0D5866;margin:18px 4px 8px">وسيلة الشحن</div>
        <div class="m-card" style="overflow:hidden">
          ${[['مدى', 'خصم فوري من البطاقة'], ['تحويل بنكي', 'يُقيّد خلال ساعات العمل']].map(([name, sub]) => `
            <div class="flex-center gap-11 clickable" style="padding:0 16px;min-height:56px;border-bottom:1px solid var(--c-divider);cursor:pointer" data-action="setTopupMethod" data-arg="${name}">
              <div class="radio ${st.topupMethod === name ? 'on' : ''}"></div>
              <div class="grow">
                <div style="font-size:13px;font-weight:800">${name}</div>
                <div style="font-size:10px;color:var(--c-faint);margin-top:1px">${sub}</div>
              </div>
            </div>`).join('')}
        </div>
        ${st.topupMethod === 'تحويل بنكي' ? `
          <div style="font-size:12px;font-weight:800;color:#0D5866;margin:16px 4px 8px">صورة الحوالة <span style="color:var(--c-warn)">(إلزامية)</span></div>
          <div class="flex-center gap-11" style="border:1.5px dashed ${st.tuProof ? 'var(--c-success-border)' : '#D8D4E2'};border-radius:13px;background:#fff;padding:14px 16px;cursor:pointer" data-action="toggleTuProof">
            <div class="grow" style="font-size:12px;font-weight:800;color:${st.tuProof ? 'var(--c-success)' : 'var(--c-muted)'}">${st.tuProof ? 'أُرفقت صورة الحوالة ✓' : 'أرفق صورة الحوالة البنكية'}</div>
            <div style="font-size:10.5px;font-weight:800;color:var(--c-info)">${st.tuProof ? 'تغيير' : 'إرفاق'}</div>
          </div>` : ''}
        <div class="m-card mt-14" style="padding:14px 16px">
          <div class="flex" style="font-size:11.5px;color:var(--c-muted)"><div>الرصيد بعد الشحن</div><div class="grow"></div><div class="num" style="font-weight:700;color:var(--c-success)">${fmt(st.wallet.bal + st.topupAmt)} ر.س</div></div>
        </div>
        <button class="btn btn-primary btn-block m-btn mt-14" data-action="confirmTopup">${st.topupMethod === 'تحويل بنكي' ? 'إرسال طلب الشحن — يُضاف بعد تعميد B2B' : 'تأكيد الشحن — إيصال PDF فوري'}</button>
      </div>
    </div>`;
}

/** اللستات المحفوظة */
export function renderMLists(st) {
  const cartCount = Object.keys(st.cart).length;
  return `
    <div class="m-screen push">
      ${pushHeader('اللستات المحفوظة', '', `<button class="m-pill-btn" data-action="openListNew">${ICONS.plus('#fff', 13, 2.6)} لستة جديدة</button>`)}
      <div class="m-body m-pad" style="padding-top:6px;padding-bottom:190px">
        ${cartCount ? `
          <div class="flex-center gap-9 clickable" style="background:var(--c-info-bg);border:1px dashed var(--c-primary-border);border-radius:14px;padding:0 16px;min-height:48px;margin-bottom:10px;cursor:pointer" data-action="saveCartAsList">
            <div style="font-size:11.5px;font-weight:800;color:var(--c-info)">حفظ السلة الحالية كلستة (${cartCount} أصناف)</div>
          </div>` : ''}
        ${st.lists.map((l, i) => `
          <div class="m-card" style="padding:14px 16px;margin-bottom:10px">
            <div class="flex-center gap-6">
              <div class="grow" style="font-size:13.5px;font-weight:800">${esc(l.name)}</div>
              <div style="font-size:10.5px;color:var(--c-faint)"><span class="num" style="font-weight:700">${l.items.length}</span> صنف</div>
            </div>
            <div style="font-size:10.5px;color:var(--c-muted);line-height:1.8;margin-top:5px">${l.items.slice(0, 3).map(([pid]) => esc((PRODUCT_MAP[pid] || {}).name || '')).join(' · ')}${l.items.length > 3 ? ' …' : ''}</div>
            <button class="btn btn-block mt-11" style="height:44px;border-radius:12px;background:var(--c-info-bg);color:var(--c-info);font-size:12.5px" data-action="addListToCart" data-arg="${i}">إضافة كل الأصناف للسلة</button>
          </div>`).join('')}
      </div>
    </div>`;
}

/** اقتراح المنتجات */
export function renderMMyReqs(st) {
  const reqCat = st.reqCat || 'الكل';
  const catRows = filterProducts(st.reqSearch, reqCat);
  return `
    <div class="m-screen push">
      ${pushHeader('اقتراح منتجات جديدة', 'يراجع فريق B2B الاقتراح ويسعّره خلال يوم عمل',
        `<button class="m-pill-btn" data-action="openReqNew">${ICONS.plus('#fff', 13, 2.6)} اقتراح</button>`)}
      <div class="m-body m-pad" style="padding-top:6px">
        <div style="font-size:12px;font-weight:800;color:#0D5866;margin:4px 4px 8px">مقترحاتي وحالتها</div>
        ${st.prodReqs.map((r) => {
          const m = REQUEST_STATUS[r.st];
          const clientCanDecide = r.st === 'priced' && ['owner', 'fr', 'frz', 'frzs'].includes(st.role);
          return `
          <div class="m-card" style="padding:14px 16px;margin-bottom:10px">
            <div class="flex-center gap-8">
              <div class="grow" style="font-size:12.5px;font-weight:800">${esc(r.name)}</div>
              ${chip(m.label, m.chip)}
            </div>
            <div style="font-size:10.5px;color:var(--c-muted);margin-top:5px"><span class="num">${r.id}</span> · ${esc(r.date)} · اقترحه ${esc(r.user || '')}</div>
            <div style="font-size:10.5px;color:var(--c-faint);margin-top:3px">«${esc(r.note)}»</div>
            ${r.price != null && r.st !== 'pend' ? `
              <div class="flex-center gap-7" style="background:var(--c-info-bg);border-radius:11px;padding:9px 13px;margin-top:9px">
                <div style="font-size:10.5px;font-weight:800;color:var(--c-info)">سعر B2B المقترح</div>
                <div class="grow"></div>
                <div class="num" style="font-size:13.5px;font-weight:700;color:var(--c-info)">${fmt(r.price)} ر.س</div>
              </div>` : ''}
            ${clientCanDecide ? `
              <div class="flex gap-8" style="margin-top:11px">
                <button class="btn btn-success-solid grow" style="height:44px;border-radius:12px;font-size:12px" data-action="clientAcceptReq" data-arg="${r.id}">اعتماد السعر — إضافة في منتجاتي</button>
                <button class="btn btn-danger-outline" style="width:96px;height:44px;border-radius:12px;font-size:11.5px" data-action="clientDeclineReq" data-arg="${r.id}">رفض</button>
              </div>` : ''}
          </div>`;
        }).join('')}
        <div class="flex" style="align-items:baseline;gap:8px;margin:18px 4px 8px">
          <div class="grow" style="font-size:12px;font-weight:800;color:#0D5866">منتجات الكتالوج الحالية</div>
          <div style="font-size:9.5px;color:var(--c-muted)">تأكد أنه غير موجود قبل اقتراحه</div>
        </div>
        <div class="search-box" style="height:44px;border-radius:13px;margin-bottom:10px">
          ${ICONS.search('#a8a4b8', 16)}
          <input data-input="reqSearch" data-key="m-reqSearch" value="${esc(st.reqSearch)}" placeholder="ابحث في الكتالوج…" style="flex:1;border:none;outline:none;background:transparent;font-size:12.5px">
        </div>
        <div style="margin-bottom:8px">${mChips(CATEGORIES, reqCat, 'setReqCat')}</div>
        <div class="m-prod-grid" style="gap:9px">
          ${catRows.map((p) => `
            <div class="m-card" style="border-radius:14px;padding:8px">
              <div class="m-prod-img" style="height:64px;border-radius:9px;background:${stripe(p.h)}">
                ${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
              </div>
              <div style="font-size:10.5px;font-weight:800;line-height:1.5;margin-top:6px;min-height:30px">${esc(p.name)}</div>
              <div style="font-size:9px;color:var(--c-faint);margin-top:1px">${esc(p.unit)}</div>
            </div>`).join('')}
        </div>
        ${catRows.length === 0 ? '<div style="text-align:center;padding:22px;color:#0D5866;font-size:11.5px;line-height:1.9">غير موجود في الكتالوج — <span style="font-weight:800;text-decoration:underline;cursor:pointer" data-action="openReqNew">اقترحه الآن</span></div>' : ''}
      </div>
    </div>`;
}

/** إدارة الكتالوج (B2B) */
export function renderMCadmin() {
  return `
    <div class="m-screen push">
      ${pushHeader('إدارة الكتالوج والتوفر', '«نافد» يخفي زر الإضافة عند كل العملاء فورًا')}
      <div class="m-body m-pad" style="padding-top:6px">
        <div class="m-card" style="overflow:hidden">
          ${PRODUCTS.map((p) => `
            <div class="flex-center gap-11" style="padding:11px 14px;border-bottom:1px solid var(--c-divider)">
              ${prodThumb(p)}
              <div class="grow" style="min-width:0">
                <div style="font-size:11.5px;font-weight:700">${esc(p.name)}</div>
                <div style="font-size:9.5px;color:var(--c-faint);margin-top:2px">${esc(p.unit)} · <span class="num" style="font-weight:700;color:var(--c-muted)">${fmt(p.price)}</span> ر.س</div>
              </div>
              <div style="flex:none;height:40px;display:flex;align-items:center;padding:0 14px;border-radius:11px;font-size:11px;font-weight:800;cursor:pointer;${p.out
                ? 'background:var(--c-danger-bg);color:var(--c-danger);border:1.5px solid var(--c-danger-border)'
                : 'background:var(--c-success-bg);color:var(--c-success);border:1.5px solid var(--c-success-border)'}"
                data-action="toggleProductAvailability" data-arg="${p.id}">${p.out ? 'نافد' : 'متوفر'}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

/** الفروع (نسخة الجوال — بيانات المواقع من النظام الموحد) */
export function renderMBranches(st) {
  return `
    <div class="m-screen push">
      ${pushHeader('الفروع', '', `<button class="m-pill-btn" data-action="mOpenBrNew">${ICONS.plus('#fff', 13, 2.6)} إضافة فرع</button>`)}
      <div class="m-body m-pad" style="padding-top:6px">
        ${st.branches.map((b) => {
          const off = b.st === 'off';
          const ordCount = st.orders.filter((o) => o.branch === b.name).length;
          const teamCount = st.users.filter((u) => u.branch === b.name || (u.branch || '').split(' · ').includes(b.name)).length;
          return `
          <div class="m-card clickable" style="padding:14px 16px;margin-bottom:10px;cursor:pointer" data-action="openBranchDet" data-arg="${esc(b.name)}">
            <div class="flex-center gap-8">
              <div class="grow" style="font-size:13.5px;font-weight:800">${esc(b.name)}</div>
              ${chip(off ? 'موقوف الطلب' : 'نشط', off ? 'chip-danger' : 'chip-success')}
            </div>
            <div class="flex-center gap-7" style="font-size:10.5px;color:var(--c-faint);margin-top:5px">
              ${pinIcon('#a8a4b8', 11)} ${b.loc ? `${esc(b.loc.addr)} · <span class="num">${esc(b.loc.coords)}</span>` : `${esc(b.city)} — بلا موقع محدد`}
            </div>
            <div class="flex" style="gap:14px;margin-top:10px;font-size:10.5px;color:var(--c-muted)">
              <div>طلبات: <span class="num" style="font-weight:700;color:var(--c-ink)">${ordCount}</span></div>
              <div>الفريق: <span class="num" style="font-weight:700;color:var(--c-ink)">${teamCount}</span></div>
            </div>
          </div>`;
        }).join('')}
        <div class="banner-info-dashed" style="border-style:solid">تحديد موقع الفرع على الخريطة إلزامي عند الإضافة — اضغط أي فرع لعرض موقعه وطلباته وفريقه.</div>
      </div>
    </div>`;
}

/** التعميدات المالية (الجوال — B2B) */
export function renderMFintu(st) {
  const reqs = st.topupReqs || [];
  return `
    <div class="m-screen push">
      ${pushHeader('التعميدات المالية', 'تحويلات بنكية تُضاف للمحفظة فور تعميدك')}
      <div class="m-body m-pad" style="padding-top:6px">
        ${reqs.map((r) => `
          <div class="m-card" style="padding:14px 16px;margin-bottom:10px">
            <div class="flex-center gap-8">
              <div class="num" style="font-size:13px;font-weight:700">${r.id}</div>
              ${chip('تحويل بنكي', 'chip-warn')}
              <div class="grow"></div>
              <div class="num" style="font-size:14px;font-weight:700">${fmt(r.amt)} <span style="font-size:9px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div>
            </div>
            <div style="font-size:10.5px;color:var(--c-muted);margin-top:5px">${esc(r.org)} · ${esc(r.by)}</div>
            <div class="num" style="font-size:10px;font-weight:800;color:var(--c-info);margin-top:4px;cursor:pointer" data-action="viewProof" data-arg="${esc(r.proof)}">📎 ${esc(r.proof)}</div>
            <div class="flex gap-8" style="margin-top:11px">
              <button class="btn btn-success-solid grow" style="height:44px;border-radius:12px;font-size:12px" data-action="approveTopup" data-arg="${r.id}">تعميد الإضافة</button>
              <button class="btn btn-danger-outline" style="width:96px;height:44px;border-radius:12px;font-size:12px" data-action="rejectTopup" data-arg="${r.id}">رفض</button>
            </div>
          </div>`).join('')}
        ${reqs.length === 0 ? '<div class="empty-state" style="border-radius:18px">لا تحويلات بنكية بانتظار التعميد.</div>' : ''}
      </div>
    </div>`;
}

/** اليوزرات (الجوال) */
export function renderMUsers(st) {
  return `
    <div class="m-screen push">
      ${pushHeader('اليوزرات والصلاحيات', 'الصلاحيات تتبع الدور — الدور يحدد ما يراه ويعمّده',
        `<button class="m-pill-btn" data-action="openUserNew">${ICONS.plus('#fff', 13, 2.6)} إضافة</button>`)}
      <div class="m-body m-pad" style="padding-top:6px">
        <div class="m-card" style="overflow:hidden">
          ${st.users.map((u) => {
            const off = u.st === 'off';
            const pend = u.st === 'pend';
            return `
            <div class="flex-center gap-11 clickable" style="padding:12px 16px;border-bottom:1px solid var(--c-divider);cursor:pointer;${off ? 'opacity:.55' : ''}"
              data-action="openUserEdit" data-arg="${u.id}" data-can="${st.role !== 'ops' || u.role === 'worker' ? 1 : 0}">
              <div style="width:40px;height:40px;border-radius:999px;background:var(--c-purple-soft);color:var(--c-purple);font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none">${esc((u.name || ' ')[0])}</div>
              <div class="grow" style="min-width:0">
                <div style="font-size:12.5px;font-weight:800">${esc(u.name)}</div>
                <div style="font-size:10px;color:var(--c-faint);margin-top:3px">${esc(u.branch)}${u.email ? ` · <span class="num" dir="ltr">${esc(u.email)}</span>` : ''}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                ${chip(STAFF_ROLE_LABEL[u.role] || u.role, STAFF_ROLE_CHIP[u.role] || 'chip-gray')}
                ${pend ? chip('بانتظار التفعيل', 'chip-info') : off ? chip('موقوف', 'chip-danger') : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}
