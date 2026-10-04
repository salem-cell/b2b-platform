// بوابة الأوامر: POST { cmd, ...payload } → تنفيذ + لقطة حالة محدّثة
import { handler, send, readBody, getSession, httpError } from './_lib/http.js';
import { snapshot } from './_lib/state.js';
import { COMMANDS } from './_lib/logic.js';
import { enabled as integrationOn, flush, syncMasterData, MASTER_DATA_COMMANDS } from './_lib/integration.js';

export default handler(async (req, res) => {
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed');
  const s = await getSession(req);
  if (!s || !s.role) throw httpError(401, 'سجّل الدخول واختر حسابك أولًا');

  const body = await readBody(req);
  const fn = COMMANDS[body.cmd];
  if (!fn) throw httpError(400, `أمر غير معروف: ${body.cmd}`);

  const msg = await fn(s.role, body);
  if (integrationOn()) {
    // نظام العمليات يعرف فورًا: عميل/صنف تغيّر، ثم يُرسل ما تراكم (تعثّر الإرسال لا يُفشل أمر المستخدم — يُعاد لاحقًا)
    try {
      if (MASTER_DATA_COMMANDS.test(body.cmd)) await syncMasterData();
      await flush({ budgetMs: 4000 });
    } catch (e) {
      console.error('integration after command', body.cmd, e);
    }
  }
  send(res, 200, { msg, snapshot: await snapshot() });
});
