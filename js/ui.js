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

// ---------- خريطة تجريبية (محاكاة خرائط Google بنمط التصميم) ----------

/** خلفية خريطة مصغرة لبطاقات الفروع (560×170) */
export function mapSvgSmall() {
  return `<svg width="100%" height="100%" viewBox="0 0 560 170" preserveAspectRatio="none" style="position:absolute;inset:0">
    <rect width="560" height="170" fill="#E8EAED"></rect>
    <rect x="0" y="0" width="560" height="46" fill="#DDE6DA"></rect>
    <path d="M0 75 H560" stroke="#fff" stroke-width="11"></path>
    <path d="M0 75 H560" stroke="#F9CE6C" stroke-width="6"></path>
    <path d="M170 0 V170" stroke="#fff" stroke-width="9"></path>
    <path d="M390 0 V170" stroke="#fff" stroke-width="9"></path>
    <path d="M0 130 H560" stroke="#fff" stroke-width="7"></path>
    <rect x="200" y="88" width="60" height="34" rx="3" fill="#F1F3F4" stroke="#DADCE0"></rect>
    <rect x="290" y="88" width="64" height="34" rx="3" fill="#F1F3F4" stroke="#DADCE0"></rect>
    <rect x="420" y="88" width="56" height="34" rx="3" fill="#F1F3F4" stroke="#DADCE0"></rect>
  </svg>`;
}

/** خلفية خريطة كبيرة للنوافذ (560×300) مع أسماء شوارع */
export function mapSvgLarge() {
  return `<svg width="100%" height="100%" viewBox="0 0 560 300" preserveAspectRatio="none" style="position:absolute;inset:0">
    <rect width="560" height="300" fill="#E8EAED"></rect>
    <rect x="0" y="0" width="560" height="90" fill="#DDE6DA"></rect>
    <circle cx="80" cy="48" r="34" fill="#CDE3C8"></circle>
    <circle cx="470" cy="230" r="44" fill="#CDE3C8"></circle>
    <rect x="330" y="20" width="120" height="52" rx="8" fill="#D4E7F7"></rect>
    <path d="M0 130 H560" stroke="#fff" stroke-width="14"></path>
    <path d="M0 130 H560" stroke="#F9CE6C" stroke-width="8"></path>
    <path d="M170 0 V300" stroke="#fff" stroke-width="12"></path>
    <path d="M390 0 V300" stroke="#fff" stroke-width="12"></path>
    <path d="M0 220 H560" stroke="#fff" stroke-width="9"></path>
    <path d="M280 130 V300" stroke="#fff" stroke-width="7"></path>
    <path d="M60 0 V130" stroke="#fff" stroke-width="7"></path>
    <path d="M470 0 V130" stroke="#fff" stroke-width="7"></path>
    <rect x="188" y="146" width="74" height="58" rx="4" fill="#F1F3F4" stroke="#DADCE0"></rect>
    <rect x="296" y="146" width="78" height="58" rx="4" fill="#F1F3F4" stroke="#DADCE0"></rect>
    <rect x="188" y="236" width="74" height="50" rx="4" fill="#F1F3F4" stroke="#DADCE0"></rect>
    <rect x="406" y="146" width="70" height="58" rx="4" fill="#F1F3F4" stroke="#DADCE0"></rect>
    <rect x="80" y="146" width="74" height="58" rx="4" fill="#F1F3F4" stroke="#DADCE0"></rect>
    <text x="120" y="115" font-size="11" fill="#7d8288" font-family="Almarai">طريق الملك فهد</text>
    <text x="415" y="212" font-size="10" fill="#7d8288" font-family="Almarai">شارع التحلية</text>
    <text x="30" y="40" font-size="10" fill="#6b8f63" font-family="Almarai">حديقة</text>
  </svg>`;
}

/** دبوس خريطة أحمر بموضع نسبي (x,y بالمئة من اليمين/الأعلى) */
export function mapPinAt(x, y, size = 30) {
  return `<div style="position:absolute;right:${x}%;top:${y}%;transform:translate(50%,-100%);pointer-events:none">
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="filter:drop-shadow(0 3px 5px rgba(0,0,0,.3))">
      <path d="M12 22s-7-5.7-7-11.3A7 7 0 0 1 19 10.7C19 16.3 12 22 12 22z" fill="#EA4335" stroke="#B31412" stroke-width="1"></path>
      <circle cx="12" cy="10.6" r="2.6" fill="#7F1D14"></circle>
    </svg>
  </div>`;
}

/** أيقونة دبوس صغيرة (stroke) للاستخدام بجانب النصوص */
export function pinIcon(color = '#654e92', size = 15) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
    <path d="M12 21s-7-5.4-7-11a7 7 0 0 1 14 0c0 5.6-7 11-7 11z" stroke="${color}" stroke-width="1.8"></path>
    <circle cx="12" cy="10" r="2.6" stroke="${color}" stroke-width="1.8"></circle>
  </svg>`;
}
