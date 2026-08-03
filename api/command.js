// بوابة الأوامر: POST { cmd, ...payload } → تنفيذ + لقطة حالة محدّثة
import { handler, send, readBody, getSession, httpError } from './_lib/http.js';
import { snapshot } from './_lib/state.js';
import { COMMANDS } from './_lib/logic.js';

export default handler(async (req, res) => {
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed');
  const s = await getSession(req);
  if (!s || !s.role) throw httpError(401, 'سجّل الدخول واختر حسابك أولًا');

  const body = await readBody(req);
  const fn = COMMANDS[body.cmd];
  if (!fn) throw httpError(400, `أمر غير معروف: ${body.cmd}`);

  const msg = await fn(s.role, body);
  send(res, 200, { msg, snapshot: await snapshot() });
});
