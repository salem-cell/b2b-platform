// ============================================================
// الكتالوج: بحث + أقسام + لستات محفوظة + شبكة المنتجات
// ============================================================
import { esc, ICONS } from '../core/dom.js';
import { fmt, stripe } from '../core/format.js';
import { filterChips, input, stepper } from '../ui.js';
import { CATEGORIES, CAN_ORDER, CAN_REQUEST, POLICY } from '../data/constants.js';
import { PRODUCTS } from '../data/products.js';

/** فلترة الكتالوج بالنص والقسم (تُستخدم أيضًا في صفحة الاقتراحات) */
export function filterProducts(query, cat) {
  const q = (query || '').trim();
  return PRODUCTS.filter((p) => (cat === 'الكل' || p.cat === cat)
    && (!q || p.name.includes(q) || p.id.toLowerCase().includes(q.toLowerCase())));
}

export function showPricesFor(role) {
  return role !== 'worker' || POLICY.workerSeesPrices;
}

function productCard(st, p, canOrder, showPrices) {
  const qty = st.cart[p.id] || 0;
  const inCart = canOrder && qty > 0;
  return `
    <div class="prod-card">
      <div class="prod-img" style="background:${stripe(p.h)}">
        <div class="prod-code">${p.id}</div>
        ${p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'">` : ''}
      </div>
      <div class="prod-name">${esc(p.name)}</div>
      <div class="prod-unit">${esc(p.unit)}</div>
      ${inCart
        ? `<div class="mt-9">${stepper(qty, 'cartInc', 'cartDec', p.id, { cyan: true })}</div>`
        : `<div class="flex-center mt-9">
            ${showPrices
              ? `<div class="num" style="font-size:14px;font-weight:700">${fmt(p.price)}<span style="font-size:9.5px;font-family:var(--font-ar);color:var(--c-faint)"> ر.س</span></div>`
              : '<div style="font-size:10px;color:var(--c-faint)">حسب قائمة الأسعار</div>'}
            <div class="grow"></div>
            ${canOrder ? `<button class="add-fab" data-action="cartInc" data-arg="${p.id}">${ICONS.plus('#fff', 15, 2.4)}</button>` : ''}
          </div>`}
    </div>`;
}

export function renderCatalog(st) {
  const canOrder = CAN_ORDER.includes(st.role);
  const showPrices = showPricesFor(st.role);
  const products = filterProducts(st.search, st.cat);
  const showLists = CAN_ORDER.includes(st.role);
  const canReq = CAN_REQUEST.includes(st.role);

  return `
    <div class="search-box">
      ${ICONS.search()}
      ${input('search', st.search, 'ابحث بالمنتج أو الرمز…', { cls: '', extra: 'style="flex:1;border:none;outline:none;background:transparent;font-size:13px"' })}
    </div>
    <div class="mt-12">${filterChips(CATEGORIES, st.cat, 'setCat')}</div>
    ${showLists ? `
      <div class="flex-center gap-7 wrap mt-10">
        <div style="font-size:10.5px;font-weight:800;color:var(--c-muted)">لستات محفوظة:</div>
        ${st.lists.map((l, i) => `
          <div class="flex-center gap-7" style="height:32px;padding:0 12px;border-radius:999px;background:var(--c-purple-soft);color:var(--c-purple);font-size:10.5px;font-weight:800;cursor:pointer"
            data-action="addListToCart" data-arg="${i}">
            ${ICONS.plus('#654e92', 11, 2.6)} ${esc(l.name)}
          </div>`).join('')}
        <div class="flex-center gap-7" style="height:32px;padding:0 12px;border-radius:999px;background:#fff;border:1.5px dashed var(--c-primary-border);color:var(--c-info);font-size:10.5px;font-weight:800;cursor:pointer"
          data-action="openListNew">
          ${ICONS.plus('#0d7f93', 11, 2.6)} لستة جديدة
        </div>
      </div>` : ''}
    <div class="prod-grid">
      ${products.map((p) => productCard(st, p, canOrder, showPrices)).join('')}
    </div>
    ${products.length === 0 ? `
      <div class="empty-state mt-16">لا نتائج لبحثك.${canReq
        ? '<br><span style="color:var(--c-info);font-weight:800;cursor:pointer;text-decoration:underline" data-action="openReqNew">اقترح إضافة منتج جديد</span> وسيراجعه فريق B2B.'
        : ''}</div>` : ''}`;
}
