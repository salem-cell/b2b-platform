// بوابة بوت واتس اب (خادم ↔ خادم): بحث المنتجات بالأسعار الحقيقية + إنشاء طلب مؤكد
// الحماية: ترويسة x-bot-key تساوي BOT_API_KEY في إعدادات Vercel (بدون كوكيز/جلسة)
//
//   GET  /api/bot?action=products&q=حليب[&client_id=1]   → { data: [ {id,name,unit,cat,price,stock,img} ] }
//   GET  /api/bot?action=product&id=P-1042[&client_id=1] → { data: {...} }
//   POST /api/bot { action:'order', items:[{pid,qty}], phone, name?, note?, quote? } → { data: { id, total } }
import { sql, nextSeq, nowLabel, notify } from './_lib/db.js';
import { handler, send, readBody, httpError } from './_lib/http.js';

function auth(req) {
  const expected = String(process.env.BOT_API_KEY || '').trim();
  const provided = String(req.headers['x-bot-key'] || '').trim();
  if (!expected) throw httpError(500, 'BOT_API_KEY غير مضبوط في إعدادات الخادم');
  if (provided !== expected) throw httpError(401, 'مفتاح البوت غير صحيح');
}

/** تطبيع عربي بسيط للبحث (همزات/تاء مربوطة/ألف لام) */
function norm(s = '') {
  return String(s).toLowerCase()
    .replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه').replace(/^ال/, '').replace(/\s+ال/g, ' ').replace(/\s+/g, ' ').trim();
}

function score(p, q) {
  const nq = norm(q); if (!nq) return 0;
  const f = norm(p.name), c = norm(p.cat);
  if (f === nq) return 100;
  if (f.startsWith(nq) || nq.startsWith(f)) return 80;
  if (f.includes(nq) || nq.includes(f)) return 60;
  const words = nq.split(' ');
  const hits = words.filter((w) => w.length > 1 && (f.includes(w) || c.includes(w))).length;
  return hits ? Math.round((hits / words.length) * 50) : 0;
}

const shape = (p, clientPrice) => ({
  id: p.id, name: p.name, unit: p.unit, cat: p.cat,
  price: clientPrice != null ? Number(clientPrice) : Number(p.price),
  list_price: Number(p.price),
  stock: p.is_out ? 0 : 9999,
  img: p.img || '',
});

async function clientPrices(clientId) {
  if (!clientId) return {};
  const rows = await sql`SELECT pid, price::float FROM client_products WHERE client_id = ${Number(clientId)}`;
  return Object.fromEntries(rows.map((r) => [r.pid, r.price]));
}

export default handler(async (req, res) => {
  auth(req);
  const url = new URL(req.url, 'http://x');
  const action = url.searchParams.get('action') || '';

  if (req.method === 'GET' && action === 'products') {
    const q = url.searchParams.get('q') || '';
    const limit = Math.min(20, Number(url.searchParams.get('limit') || 8));
    const cp = await clientPrices(url.searchParams.get('client_id'));
    const rows = await sql`SELECT id, name, unit, cat, price::float, img, is_out FROM products ORDER BY id`;
    const data = rows
      .map((p) => ({ ...shape(p, cp[p.id]), score: score(p, q) }))
      .filter((p) => !q || p.score >= 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return send(res, 200, { data });
  }

  if (req.method === 'GET' && action === 'product') {
    const id = url.searchParams.get('id') || '';
    const cp = await clientPrices(url.searchParams.get('client_id'));
    const [p] = await sql`SELECT id, name, unit, cat, price::float, img, is_out FROM products WHERE id = ${id}`;
    if (!p) throw httpError(404, 'المنتج غير موجود');
    return send(res, 200, { data: shape(p, cp[p.id]) });
  }

  // حالة طلب — يُعاد فقط إذا كان الطلب لنفس رقم الجوال (لا يكشف طلبات عملاء آخرين)
  if (req.method === 'GET' && action === 'order_status') {
    const id = (url.searchParams.get('id') || '').trim().toUpperCase();
    const phone = (url.searchParams.get('phone') || '').replace(/\D/g, '');
    const [o] = await sql`SELECT id, by_user, st, items, stamps, log FROM orders WHERE id = ${id}`;
    if (!o || !phone || !String(o.by_user).includes(phone)) throw httpError(404, 'لا يوجد طلب بهذا الرقم لهذا العميل');
    const pm = await (async () => {
      const rows = await sql`SELECT id, name FROM products`;
      return Object.fromEntries(rows.map((p) => [p.id, p.name]));
    })();
    const last = Array.isArray(o.log) && o.log.length ? o.log[o.log.length - 1] : null;
    return send(res, 200, {
      data: {
        id: o.id, st: o.st,
        items: (o.items || []).map((i) => ({ name: pm[i.pid] || i.pid, qty: i.qty })),
        last: last ? `${last.txt} (${last.t})` : null,
      },
    });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    if ((body.action || action) !== 'order') throw httpError(400, 'إجراء غير معروف');
    const phone = String(body.phone || '').replace(/\D/g, '');
    if (!phone) throw httpError(400, 'رقم الجوال مطلوب');
    if (!Array.isArray(body.items) || !body.items.length) throw httpError(400, 'لا أصناف في الطلب');

    const rows = await sql`SELECT id, name, price::float, is_out FROM products`;
    const pm = Object.fromEntries(rows.map((p) => [p.id, p]));
    const clean = body.items
      .filter((i) => pm[i.pid] && !pm[i.pid].is_out && Number(i.qty) > 0)
      .map((i) => ({ pid: i.pid, qty: Math.min(999, Math.floor(Number(i.qty))) }));
    if (!clean.length) throw httpError(400, 'لا أصناف صالحة (غير موجودة أو نافدة)');

    const seq = await nextSeq('order');
    const id = `ORD-${seq}`;
    const n = nowLabel();
    const who = body.name ? `${body.name} (واتس اب ${phone})` : `واتس اب ${phone}`;
    const log = [{
      who, role: 'عميل واتس اب',
      txt: `طلب عبر بوت واتس اب${body.quote ? ` — عرض ${body.quote}` : ''} (${clean.length} أصناف)${body.note ? ` — ${body.note}` : ''}`,
      t: n,
    }];
    // طلبات واتس اب تدخل مباشرة مرحلة تجهيز B2B (مثل طلبات المالك)
    await sql`INSERT INTO orders (id, by_user, branch, date_label, st, items, stamps, log)
              VALUES (${id}, ${who}, ${'واتس اب'}, 'الآن', 'b2b',
                      ${JSON.stringify(clean)}, ${JSON.stringify([n, n, n, n, '', ''])}, ${JSON.stringify(log)})`;
    await notify(['b2b', 'ops'], 'اعتمادات', `طلب جديد من واتس اب ${id} — ${who}`);

    const total = clean.reduce((s, i) => s + pm[i.pid].price * i.qty, 0);
    return send(res, 200, { data: { id, total: Math.round(total * 100) / 100, items: clean.length } });
  }

  throw httpError(400, 'إجراء غير معروف — استخدم action=products|product أو POST action=order');
});
