// لقطة الحالة لنطاق الحساب الحالي (منشأته ودوره من سجل الحساب)
import { handler, send, getSession, httpError } from './_lib/http.js';
import { snapshot } from './_lib/state.js';

export default handler(async (req, res) => {
  if (req.method !== 'GET') throw httpError(405, 'Method not allowed');
  const ctx = await getSession(req);
  if (!ctx) throw httpError(401, 'سجّل الدخول أولًا');
  if (ctx.mustChangePin) throw httpError(403, 'غيّر رمزك السري المؤقت أولًا');
  send(res, 200, { role: ctx.role, snapshot: await snapshot(ctx) });
});
