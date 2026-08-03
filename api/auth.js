// المصادقة: جوال → OTP → جلسة → اختيار الدور
// (الـ OTP تجريبي كما في التصميم — أي 4 أرقام؛ الربط بمزود SMS نقطة التوسعة الوحيدة)
import { sql } from './_lib/db.js';
import { handler, send, readBody, createSession, getSession, setSessionCookie, clearSessionCookie, httpError } from './_lib/http.js';
import { ROLES } from '../js/data/constants.js';

export default handler(async (req, res) => {
  if (req.method === 'GET') {
    const s = await getSession(req);
    return send(res, 200, s ? { phone: s.phone, role: s.role } : { phone: null, role: null });
  }
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed');

  const body = await readBody(req);

  if (body.action === 'verify') {
    const phone = String(body.phone || '').trim();
    const otp = String(body.otp || '').trim();
    if (phone.length < 9) throw httpError(400, 'أدخل رقم جوال صحيح');
    if (!/^\d{4}$/.test(otp)) throw httpError(400, 'رمز التحقق 4 أرقام');
    const token = await createSession(phone);
    setSessionCookie(res, token);
    return send(res, 200, { ok: true });
  }

  if (body.action === 'role') {
    const s = await getSession(req);
    if (!s) throw httpError(401, 'سجّل الدخول أولًا');
    if (!ROLES[body.role]) throw httpError(400, 'دور غير معروف');
    // دور السوبر أدمن محمي برمز إدارة سري (ADMIN_KEY في إعدادات Vercel)
    if (body.role === 'b2b') {
      const expected = String(process.env.ADMIN_KEY || '').trim();
      const provided = String(body.adminKey || '').trim();
      if (!expected || provided !== expected) throw httpError(403, 'رمز الإدارة غير صحيح — دخول السوبر أدمن من بوابة الإدارة فقط');
    }
    await sql`UPDATE sessions SET role = ${body.role} WHERE token = ${s.token}`;
    return send(res, 200, { ok: true, role: body.role });
  }

  if (body.action === 'logout') {
    const s = await getSession(req);
    if (s) await sql`DELETE FROM sessions WHERE token = ${s.token}`;
    clearSessionCookie(res);
    return send(res, 200, { ok: true });
  }

  throw httpError(400, 'إجراء غير معروف');
});
