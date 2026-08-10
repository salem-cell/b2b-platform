// ============================================================
// نقطة عامة (بلا جلسة): استقبال طلبات «سجّل منشأتك»
// POST /api/register → صف في new_clients بانتظار مراجعة B2B
// ============================================================
import { sql, nextSeq, notify } from './_lib/db.js';
import { handler, send, readBody, httpError } from './_lib/http.js';

const MODELS = ['مستقل', 'مانح', 'ممنوح بيسك', 'ممنوح سوبر'];

export default handler(async (req, res) => {
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed');
  const b = await readBody(req);

  const name = String(b.name || '').trim();
  if (name.length < 3) throw httpError(400, 'اكتب اسم المنشأة (٣ أحرف على الأقل)');
  const mgrName = String(b.mgrName || '').trim();
  if (!mgrName) throw httpError(400, 'اسم مسؤول الحساب إلزامي');
  const clip = (v, max = 200) => String(v || '').trim().slice(0, max);

  const seq = await nextSeq('nc');
  const id = `NC-${seq}`;
  await sql`INSERT INTO new_clients (id, name, activity, model, city, cities, branches_n, cr, vat, docs,
                                     mgr_name, mgr_role, mgr_contact, cats, monthly, payment, st)
            VALUES (${id}, ${clip(name)}, ${clip(b.activity)},
                    ${MODELS.includes(b.model) ? b.model : 'مستقل'},
                    ${clip(b.city, 60)}, ${clip(b.cities)}, ${Math.min(500, Math.max(1, Math.floor(Number(b.branchesN) || 1)))},
                    ${clip(b.cr, 40)}, ${clip(b.vat, 40)},
                    ${JSON.stringify(Array.isArray(b.docs) ? b.docs.slice(0, 10).map((d) => clip(d, 80)) : [])},
                    ${clip(mgrName, 80)}, ${clip(b.mgrRole, 80)}, ${clip(b.mgrContact)},
                    ${JSON.stringify(Array.isArray(b.cats) ? b.cats.slice(0, 10).map((c) => clip(c, 40)) : [])},
                    ${clip(b.monthly, 60)}, ${clip(b.payment)}, 'pend')`;
  await notify(['b2b'], 'اعتمادات', `طلب تسجيل منشأة جديد ${id} — «${name}» بانتظار المراجعة`);
  return send(res, 200, { ok: true, id, msg: `استلمنا طلبك ${id} — يراجعه فريق B2B ويتواصل معك مسؤول الحساب` });
});
