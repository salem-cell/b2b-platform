// ============================================================
// عميل الـ API: نداءات الخادم + تطبيق لقطة الحالة على المخزن
// ============================================================
import { setState } from './store.js';
import { hydrateProducts } from '../data/products.js';

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function request(path, options = {}) {
  const res = await fetch(`/api/${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data = {};
  try { data = await res.json(); } catch { /* جسم فارغ */ }
  if (!res.ok) throw new ApiError(data.error || `خطأ في الخادم (${res.status})`, res.status);
  return data;
}

export const apiGet = (path) => request(path);
export const apiPost = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body || {}) });

/** تطبيق لقطة الخادم على حالة الواجهة (مع أي حقول واجهة إضافية) */
export function applySnapshot(snapshot, extra = {}) {
  hydrateProducts(snapshot.products);
  const { products, ...slices } = snapshot;
  setState({ ...slices, ...extra });
}

/** تنفيذ أمر أعمال: يرجع رسالة الخادم بعد تطبيق اللقطة */
export async function command(cmd, payload = {}, extra = {}) {
  const { msg, snapshot } = await apiPost('command', { cmd, ...payload });
  applySnapshot(snapshot, extra);
  return msg;
}
