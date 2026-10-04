// بوابة الأوامر: POST { cmd, ...payload } → تنفيذ بسياق الحساب (دوره ومنشأته من سجله) + لقطة محدّثة لنطاقه
import { handler, send, readBody, getSession, httpError } from './_lib/http.js';
import { snapshot } from './_lib/state.js';
import { COMMANDS } from './_lib/logic.js';
import { enabled as integrationOn, flush, syncMasterData, MASTER_DATA_COMMANDS } from './_lib/integration.js';

export default handler(async (req, res) => {
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed');
  const ctx = await getSession(req);
  if (!ctx) throw httpError(401, 'سجّل الدخول أولًا');
  if (ctx.mustChangePin) throw httpError(403, 'غيّر رمزك السري المؤقت أولًا');

  const body = await readBody(req);
  const fn = Object.hasOwn(COMMANDS, body.cmd) ? COMMANDS[body.cmd] : null;
  if (!fn) throw httpError(400, `أمر غير معروف: ${String(body.cmd).slice(0, 60)}`);

  const msg = await fn(ctx, body);
  if (integrationOn()) {
    // نظام العمليات يعرف فورًا: عميل/صنف تغيّر، ثم يُرسل ما تراكم (تعثّر الإرسال لا يُفشل أمر المستخدم — يُعاد لاحقًا)
    try {
      if (MASTER_DATA_COMMANDS.test(body.cmd)) await syncMasterData();
      await flush({ budgetMs: 4000 });
    } catch (e) {
      console.error('integration after command', body.cmd, e);
    }
  }
  send(res, 200, { msg, snapshot: await snapshot(ctx) });
});
