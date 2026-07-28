// ============================================================
// مكونات واجهة مشتركة — دوال ترجع HTML
// ============================================================
import { esc, ICONS } from './core/dom.js';
import { fmt, stripe } from './core/format.js';
import { ORDER_STATUS } from './data/constants.js';

/** شريحة حالة (pill) */
export function chip(label, cls) {
  return `<div class="chip ${cls}">${esc(label)}</div>`;
}

/** شريحة حالة طلب */
export function orderChip(st) {
  const m = ORDER_STATUS[st];
  return chip(m.label, m.chip);
}

/** صف شرائح فلترة — action يستقبل اسم الفلتر في data-arg */
export function filterChips(names, active, action) {
  return `<div class="filter-row">${names.map((n) => `
    <div class="filter-chip ${n === active ? 'active' : ''}" data-action="${action}" data-arg="${esc(n)}">${esc(n)}</div>`).join('')}
  </div>`;
}

/** مصغّرة منتج (صورة أو خلفية مخططة) */
export function prodThumb(p, size = 42) {
  return `<div class="prod-thumb" style="width:${size}px;height:${size}px;background:${stripe(p.h)}">
    ${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
  </div>`;
}

/** مبلغ بخط الأرقام مع "ر.س" صغيرة */
export function money(n, { size = 12.5, unitSize = 9 } = {}) {
  return `<span class="num" style="font-size:${size}px;font-weight:700">${fmt(n)}</span> <span style="font-size:${unitSize}px;color:var(--c-faint)">ر.س</span>`;
}

/** مبلغ حركة محفظة (+ أخضر / − عادي) */
export function ledgerAmount(amt, size = 13) {
  const sign = amt > 0 ? '+' : '−';
  const color = amt > 0 ? 'var(--c-success)' : 'var(--c-ink)';
  return `<div class="num" style="font-size:${size}px;font-weight:700;color:${color};direction:ltr;flex:none">${sign}${fmt(Math.abs(amt))}</div>`;
}

/** عدّاد كمية */
export function stepper(qty, incAction, decAction, arg, { cyan = false, color = '#0d7f93' } = {}) {
  return `<div class="stepper ${cyan ? 'cyan' : ''}">
    <button class="stepper-btn" data-action="${incAction}" data-arg="${esc(arg)}">${ICONS.plus(color, 12, 2.4)}</button>
    <div class="stepper-qty">${qty}</div>
    <button class="stepper-btn" data-action="${decAction}" data-arg="${esc(arg)}">${ICONS.minus(color, 12, 2.4)}</button>
  </div>`;
}

/** حقل إدخال مربوط بالحالة عبر data-input (مع مفتاح تركيز ثابت) */
export function input(field, value, placeholder, { cls = 'input', dir = '', extra = '', type = 'text' } = {}) {
  return `<input class="${cls}" type="${type}" data-input="${field}" data-key="${field}" value="${esc(value)}"
    placeholder="${esc(placeholder)}" ${dir ? `dir="${dir}"` : ''} ${extra}>`;
}

/** زر إغلاق النوافذ */
export function closeBtn() {
  return `<button class="modal-close" data-action="closeAll">${ICONS.close()}</button>`;
}

/** حالة فارغة */
export function emptyState(html) {
  return `<div class="empty-state">${html}</div>`;
}
