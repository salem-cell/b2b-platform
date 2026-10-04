// المطابقة: كيف ترى المبيعات طلباتها المرسلة للعمليات. GET ?ids=ORD-1,ORD-2 (موقّع من العمليات فقط، قراءة فقط)
import { send, httpError } from '../_lib/http.js';
import { sql } from '../_lib/db.js';
import { verify, enabled } from '../_lib/integration.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') throw httpError(405, 'Method not allowed');
    if (!enabled()) throw httpError(503, 'integration disabled');
    const v = verify(req.headers, req.method, req.url, '');
    if (!v.ok) { send(res, 401, { code: v.code }); return; }
    const ids = String(new URL(req.url, 'http://x').searchParams.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100);
    const rows = ids.length ? await sql`SELECT id, st, ops_ref, ops_status, ops_sent_at, updated_at FROM orders WHERE id = ANY(${ids})` : [];
    send(res, 200, { orders: rows.map((o) => ({ id: o.id, st: o.st, opsRef: o.ops_ref, opsStatus: o.ops_status, sentAt: o.ops_sent_at, updatedAt: o.updated_at })) });
  } catch (err) {
    console.error(err);
    send(res, err.status || 500, { error: err.message || 'error' });
  }
}
