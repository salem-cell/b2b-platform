// المصادقة: جوال + رمز سري (PIN) لحساب مسجّل → جلسة بدور ومنشأة ثابتين من سجل الحساب.
// لا اختيار للدور من المتصفح. حسابات B2B تتطلب أيضًا رمز الإدارة (ADMIN_KEY). التفاصيل: docs/SECURITY.md
import { sql } from './_lib/db.js';
import { handler, send, readBody, getSession, setSessionCookie, clearSessionCookie, httpError } from './_lib/http.js';
import { verifyLogin, createSession, changePin } from './_lib/auth.js';

const me = (s) => ({ phone: s.phone, role: s.role, name: s.name, org: s.org, clientId: s.clientId, branch: s.branch, mustChangePin: s.mustChangePin });

export default handler(async (req, res) => {
  if (req.method === 'GET') {
    const s = await getSession(req);
    return send(res, 200, s ? me(s) : { phone: null, role: null });
  }
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed');

  const body = await readBody(req);

  if (body.action === 'login') {
    const user = await verifyLogin(req, { phone: body.phone, pin: body.pin, adminKey: body.adminKey });
    const token = await createSession(user);
    setSessionCookie(res, token);
    return send(res, 200, { ok: true, role: user.role, mustChangePin: !!user.must_change_pin });
  }

  if (body.action === 'changePin') {
    const s = await getSession(req);
    if (!s) throw httpError(401, 'سجّل الدخول أولًا');
    await changePin(req, s, { oldPin: body.oldPin, newPin: body.newPin });
    return send(res, 200, { ok: true, msg: 'تم تغيير الرمز السري — يسري من الآن' });
  }

  if (body.action === 'logout') {
    const s = await getSession(req);
    if (s) await sql`DELETE FROM sessions WHERE token = ${s.token}`;
    clearSessionCookie(res);
    return send(res, 200, { ok: true });
  }

  throw httpError(400, 'إجراء غير معروف');
});
