// ============================================================
// تنسيق الأرقام والعملة — أرقام إنجليزية بخط Quicksand حسب دليل التصميم
// ============================================================

/** 1234.5 → "1,234.50" */
export function fmt(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 1234.5 → "1,235" */
export function fmt0(n) {
  return Math.round(Number(n)).toLocaleString('en-US');
}

/** خلفية مخططة حتمية للمنتج بلا صورة (نفس معادلة التصميم) */
export function stripe(h) {
  return `repeating-linear-gradient(45deg,hsl(${h},30%,95.5%) 0 7px,hsl(${h},30%,91%) 7px 14px)`;
}

/** الوقت الحالي HH:MM */
export function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** نسبة الضريبة المضافة */
export const VAT = 0.15;
