// أحداث نظام العمليات → المبيعات (موقّعة HMAC). POST حدث واحد أو مصفوفة أو {events:[…]}.
// كل حدث يُستلم مرة واحدة (معرّفه)، ويُطبّق بترتيبه لكل طلب، والرد لكل حدث بالترتيب.
import { send, httpError } from '../_lib/http.js';
import { verify, applyOpsEvent, enabled } from '../_lib/integration.js';

async function rawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw httpError(405, 'Method not allowed');
    if (!enabled()) throw httpError(503, 'integration disabled');
    const raw = await rawBody(req);
    if (raw.length > 1048576) throw httpError(413, 'body too large');
    const v = verify(req.headers, req.method, req.url, raw);
    if (!v.ok) { send(res, 401, { code: v.code, error: 'توقيع النظام غير صالح' }); return; }
    let body;
    try { body = JSON.parse(raw); } catch { throw httpError(400, 'invalid JSON'); }
    const events = Array.isArray(body) ? body : Array.isArray(body?.events) ? body.events : [body];
    if (events.length > 100) throw httpError(400, 'batch too large');
    const results = [];
    for (const e of events) {
      try {
        results.push({ eventId: e?.id ?? null, ...(await applyOpsEvent(e)) });
      } catch (err) {
        console.error('integration event failed', e?.id, err);
        results.push({ eventId: e?.id ?? null, status: 'failed', code: 'HANDLER_ERROR', message: String(err?.message || err).slice(0, 200) });
      }
    }
    // فشل داخلي في أي حدث → 500 حتى يعيد المرسل المحاولة لاحقًا (المكرر منها يُتجاهل بمعرّفه)
    send(res, results.some((r) => r.status === 'failed') ? 500 : 202, { results });
  } catch (err) {
    console.error(err);
    send(res, err.status || 500, { error: err.message || 'error' });
  }
}
