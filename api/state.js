// لقطة الحالة الكاملة للجلسة الحالية
import { handler, send, getSession, httpError } from './_lib/http.js';
import { snapshot } from './_lib/state.js';

export default handler(async (req, res) => {
  if (req.method !== 'GET') throw httpError(405, 'Method not allowed');
  const s = await getSession(req);
  if (!s || !s.role) throw httpError(401, 'سجّل الدخول واختر حسابك أولًا');
  send(res, 200, { role: s.role, snapshot: await snapshot() });
});
