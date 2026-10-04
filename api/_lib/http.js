// أدوات HTTP للدوال السيرفرلس: قراءة الجسم، الردود، الكوكيز، غلاف الأخطاء

export function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

export async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

const COOKIE = 'b2b_session';

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 30}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`);
}

/**
 * سياق الجلسة (الحساب الحي: الدور، المنشأة، الاسم…) أو null. الدور والمنشأة من سجل الحساب لا من الطلب.
 * الجلسات القديمة (قبل الحسابات) بلا حساب مرتبط فتُعتبر منتهية.
 */
export async function getSession(req) {
  const { loadContext } = await import('./auth.js');
  return loadContext(parseCookies(req)[COOKIE]);
}

/** غلاف موحد: أخطاء JSON + قياس المنهج */
export function handler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error(err);
      send(res, err.status || 500, { error: err.message || 'خطأ غير متوقع في الخادم' });
    }
  };
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
