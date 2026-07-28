// ============================================================
// أدوات DOM: تهريب النصوص، الحفاظ على تركيز الحقول بين عمليات
// إعادة الرسم، وأيقونات SVG المشتركة
// ============================================================

/** تهريب نص ديناميكي قبل حقنه في HTML (أسماء/أسباب يكتبها المستخدم) */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * إعادة رسم كاملة مع الحفاظ على تركيز حقل الإدخال النشط وموضع المؤشر.
 * كل حقل إدخال يحمل data-key ثابتًا؛ بعد الاستبدال نعيد التركيز لنفس المفتاح.
 */
export function patchDOM(rootEl, html) {
  const active = document.activeElement;
  const key = active && active.dataset ? active.dataset.key : null;
  const selStart = key && active.selectionStart != null ? active.selectionStart : null;
  const selEnd = key && active.selectionEnd != null ? active.selectionEnd : null;

  rootEl.innerHTML = html;

  if (key) {
    const el = rootEl.querySelector(`[data-key="${key}"]`);
    if (el) {
      el.focus();
      if (selStart != null && el.setSelectionRange) {
        try { el.setSelectionRange(selStart, selEnd); } catch { /* أنواع لا تدعم التحديد */ }
      }
    }
  }
}

/** أيقونة SVG بخط 24×24 (نمط أيقونات التصميم: stroke مستدير 1.8) */
export function icon(paths, { size = 19, color = 'currentColor', width = 1.8 } = {}) {
  const d = Array.isArray(paths) ? paths : [paths];
  const body = d.filter(Boolean)
    .map((p) => `<path d="${p}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>`)
    .join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24">${body}</svg>`;
}

/** أيقونات جاهزة متكررة */
export const ICONS = {
  plus: (c = '#fff', s = 13, w = 2.6) => icon('M12 5v14M5 12h14', { size: s, color: c, width: w }),
  minus: (c = '#0d7f93', s = 12, w = 2.4) => icon('M5 12h14', { size: s, color: c, width: w }),
  close: (c = '#7d7990', s = 13, w = 2.2) => icon('M6 6l12 12M18 6 6 18', { size: s, color: c, width: w }),
  search: (c = '#a8a4b8', s = 17) => icon('M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.4 15.4 20 20', { size: s, color: c }),
  bell: (c = '#262433', s = 19) => icon('M12 4a5.5 5.5 0 0 1 5.5 5.5c0 3 .9 4.5 1.8 5.6H4.7c.9-1.1 1.8-2.6 1.8-5.6A5.5 5.5 0 0 1 12 4zM10 18.6a2 2 0 0 0 4 0', { size: s, color: c, width: 1.7 }),
  branch: (c = '#654e92', s = 15) => icon('M4 10 12 4l8 6M6 9.4V20h12V9.4', { size: s, color: c }),
  chevronL: (c = '#C9C5D6') => `<svg width="7" height="12" viewBox="0 0 8 14"><path d="M7 1 1 7l6 6" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
  chevronR: (c = '#262433') => `<svg width="9" height="15" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
};
