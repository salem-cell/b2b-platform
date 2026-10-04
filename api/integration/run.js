// دورة التكامل الدورية (Cron): إرسال الأحداث المتأخرة/المعادة + إصلاح الطلبات التي لم تُرسل + تحديث المتاح للبيع.
// يستدعيها مجدول موقّع بنفس مفتاح العمليات (X-B2B-System: ops) — لا تُستدعى من المتصفح.
import { send, httpError } from '../_lib/http.js';
import { verify, runCycle, enabled } from '../_lib/integration.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw httpError(405, 'Method not allowed');
    if (!enabled()) { send(res, 200, { ran: false, reason: 'integration disabled' }); return; }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const v = verify(req.headers, req.method, req.url, Buffer.concat(chunks).toString('utf8'));
    if (!v.ok) { send(res, 401, { code: v.code }); return; }
    send(res, 200, await runCycle());
  } catch (err) {
    console.error(err);
    send(res, err.status || 500, { error: err.message || 'error' });
  }
}
