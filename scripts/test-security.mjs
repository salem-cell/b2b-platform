// ============================================================
// اختبار الأمان على خادم محلي: الدخول بالرمز السري + قفل المحاولات + فصل بيانات المنشآت.
// يعيد بناء قاعدة التجارب المحلية ثم يتحقق عبر HTTP كما يفعل المتصفح — docs/SECURITY.md
//
//   (الخادم المحلي يعمل بـ LOCAL_PG_URL و SEED_PIN و ADMIN_KEY و MIGRATE_KEY و BOT_API_KEY)
//   SEED_PIN=… ADMIN_KEY=… MIGRATE_KEY=… BOT_API_KEY=… node scripts/test-security.mjs [http://127.0.0.1:3100]
//
// يرفض العمل على غير الجهاز المحلي: يعيد بناء القاعدة من الصفر.
// ============================================================
const BASE = (process.argv[2] || process.env.BASE || 'http://127.0.0.1:3100').replace(/\/$/, '');
const { SEED_PIN, ADMIN_KEY, MIGRATE_KEY, BOT_API_KEY } = process.env;

if (!['127.0.0.1', 'localhost'].includes(new URL(BASE).hostname)) {
  console.error('هذا الاختبار يعيد بناء القاعدة — يعمل على خادم محلي فقط.');
  process.exit(2);
}
for (const [k, v] of Object.entries({ SEED_PIN, ADMIN_KEY, MIGRATE_KEY })) {
  if (!v) { console.error(`${k} مطلوب في البيئة (نفس قيمة الخادم المحلي)`); process.exit(2); }
}

let pass = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

/** عميل HTTP بكوكي جلسة مستقل (متصفح واحد) */
function browser() {
  let cookie = '';
  const call = async (method, path, body) => {
    const r = await fetch(BASE + path, {
      method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = r.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    let json = {};
    try { json = await r.json(); } catch { /* ليس JSON */ }
    return { status: r.status, json, setCookie: set || '' };
  };
  return {
    login: (phone, pin, extra = {}) => call('POST', '/api/auth', { action: 'login', phone, pin, ...extra }),
    auth: (body) => call('POST', '/api/auth', body),
    me: () => call('GET', '/api/auth'),
    state: () => call('GET', '/api/state'),
    cmd: (cmd, payload = {}) => call('POST', '/api/command', { cmd, ...payload }),
  };
}

const PHONE = { worker: '0500000001', ops: '0500000002', owner: '0500000003', fin: '0500000004', frz: '0500000005', frzs: '0500000006', fr: '0500000007', b2b: '0500000000' };
const WRONG = SEED_PIN === '9173' ? '9174' : '9173';

async function session(role) {
  const b = browser();
  const r = await b.login(PHONE[role], SEED_PIN, role === 'b2b' ? { adminKey: ADMIN_KEY } : {});
  if (r.status !== 200) throw new Error(`login ${role}: ${r.status} ${r.json.error || ''}`);
  return b;
}

// ───────────── إعادة البناء ─────────────
console.log(`\n[security] ${BASE}`);
{
  const r = await fetch(`${BASE}/api/admin/migrate`, { method: 'POST', headers: { 'x-migrate-key': MIGRATE_KEY }, body: JSON.stringify({ reset: 1 }) });
  const j = await r.json();
  check('الترحيل: قاعدة جديدة + حسابات الدخول', r.status === 200 && j.seeded === true && j.accounts === 8, JSON.stringify(j));
  const bad = await fetch(`${BASE}/api/admin/migrate`, { method: 'POST', headers: { 'x-migrate-key': 'x' }, body: '{}' });
  check('الترحيل: مفتاح خاطئ مرفوض', bad.status === 403);
  const again = await (await fetch(`${BASE}/api/admin/migrate`, { method: 'POST', headers: { 'x-migrate-key': MIGRATE_KEY }, body: '{}' })).json();
  check('الترحيل: التكرار لا يضيف حسابات ولا يعيد الزرع', again.seeded === false && again.accounts === 0, JSON.stringify(again));
}

// ───────────── الدخول ─────────────
console.log('\n— الدخول بالرمز السري');
{
  const anon = browser();
  check('بلا جلسة: الحالة 401', (await anon.state()).status === 401);
  check('بلا جلسة: الأوامر 401', (await anon.cmd('orders.submit', { items: [] })).status === 401);

  const wrong = await anon.login(PHONE.owner, WRONG);
  check('رمز خاطئ: 401 مع عدد المحاولات المتبقية', wrong.status === 401 && /بقي 4/.test(wrong.json.error), wrong.json.error);
  const unknown = await anon.login('0599999999', WRONG);
  check('جوال غير مسجّل: نفس الرد (لا يكشف وجود الحساب)', unknown.status === 401 && /رقم الجوال أو الرمز السري غير صحيح/.test(unknown.json.error), unknown.json.error);
  check('جوال غير صالح: 400', (await anon.login('12345', SEED_PIN)).status === 400);
  check('رمز ليس 4 أرقام: 400', (await anon.login(PHONE.owner, '12345')).status === 400);
  check('إجراءات الدخول القديمة (OTP/اختيار الدور) أُزيلت', (await anon.auth({ action: 'verify', phone: PHONE.owner, otp: '1234' })).status === 400
    && (await anon.auth({ action: 'role', role: 'b2b' })).status === 400);

  const ok = await anon.login(PHONE.owner, SEED_PIN, { role: 'b2b' });
  check('دخول صحيح: الدور من الحساب لا من الطلب', ok.status === 200 && ok.json.role === 'owner', JSON.stringify(ok.json));
  check('كوكي الجلسة HttpOnly + SameSite', /HttpOnly/.test(ok.setCookie) && /SameSite=Lax/.test(ok.setCookie));
  const me = await anon.me();
  check('هوية الجلسة: الاسم والمنشأة من الحساب', me.json.role === 'owner' && me.json.clientId === 1 && me.json.name === 'م. ناصر القحطاني', JSON.stringify(me.json));
  check('الدخول الصحيح يصفّر عدّاد المحاولات', /بقي 4/.test((await browser().login(PHONE.owner, WRONG)).json.error));

  await anon.auth({ action: 'logout' });
  check('الخروج ينهي الجلسة', (await anon.state()).status === 401);

  const noKey = await browser().login(PHONE.b2b, SEED_PIN);
  check('حساب الإدارة بلا رمز الإدارة: مرفوض', noKey.status === 401);
  const badKey = await browser().login(PHONE.b2b, SEED_PIN, { adminKey: 'nope' });
  check('حساب الإدارة برمز إدارة خاطئ: مرفوض', badKey.status === 401);
  const admin = await browser().login(PHONE.b2b, SEED_PIN, { adminKey: ADMIN_KEY });
  check('حساب الإدارة بالرمزين: يدخل', admin.status === 200 && admin.json.role === 'b2b');
}

// ───────────── القفل وإعادة التعيين ─────────────
console.log('\n— قفل المحاولات وإعادة تعيين الرمز');
{
  const b = browser();
  let last;
  for (let i = 0; i < 5; i++) last = await b.login(PHONE.fin, WRONG);
  check('5 محاولات خاطئة تقفل الجوال', last.status === 401 && /قُفل/.test(last.json.error), last.json.error);
  const locked = await b.login(PHONE.fin, SEED_PIN);
  check('أثناء القفل: حتى الرمز الصحيح مرفوض (429)', locked.status === 429, `${locked.status} ${locked.json.error}`);

  const owner = await session('owner');
  const snap = (await owner.state()).json.snapshot;
  const fin = snap.users.find((u) => u.role === 'fin');
  check('المدير يرى حسابات منشأته بجوالاتها', !!fin && fin.phone === PHONE.fin && fin.hasPin === true);
  check('اللقطة لا تحمل تجزئة الرمز', !JSON.stringify(snap).includes('pin_hash') && !JSON.stringify(snap).includes('pinHash'));

  check('رمز مؤقت بديهي مرفوض', (await owner.cmd('users.resetPin', { id: fin.id, pin: '1234' })).status === 400);
  const reset = await owner.cmd('users.resetPin', { id: fin.id, pin: '7391' });
  check('المدير يعيّن رمزًا مؤقتًا ويفك القفل', reset.status === 200, reset.json.error);

  const f = browser();
  const tmp = await f.login(PHONE.fin, '7391');
  check('الدخول بالرمز المؤقت: يُلزم بتغييره', tmp.status === 200 && tmp.json.mustChangePin === true, JSON.stringify(tmp.json));
  check('قبل تغيير الرمز: الحالة محجوبة', (await f.state()).status === 403);
  check('قبل تغيير الرمز: الأوامر محجوبة', (await f.cmd('wallet.topup', { amt: 500, method: 'مدى' })).status === 403);
  check('تغيير الرمز: الحالي الخاطئ مرفوض', (await f.auth({ action: 'changePin', oldPin: WRONG, newPin: '6402' })).status === 401);
  check('تغيير الرمز: الجديد البديهي مرفوض', (await f.auth({ action: 'changePin', oldPin: '7391', newPin: '1111' })).status === 400);
  check('تغيير الرمز: نفس الرمز مرفوض', (await f.auth({ action: 'changePin', oldPin: '7391', newPin: '7391' })).status === 400);
  const changed = await f.auth({ action: 'changePin', oldPin: '7391', newPin: '6402' });
  check('تغيير الرمز ينجح', changed.status === 200, changed.json.error);
  check('بعد التغيير: الحالة تعمل', (await f.state()).status === 200);
  check('الرمز المؤقت القديم لم يعد يعمل', (await browser().login(PHONE.fin, '7391')).status === 401);
  check('الرمز الجديد يعمل', (await browser().login(PHONE.fin, '6402')).status === 200);
}

// ───────────── إدارة الحسابات ─────────────
console.log('\n— إدارة الحسابات');
{
  const owner = await session('owner');
  check('إضافة حساب بلا جوال: مرفوض', (await owner.cmd('users.add', { name: 'تجربة', pin: '7391', userRole: 'worker', branches: ['فرع العليا'] })).status === 400);
  check('إضافة حساب بجوال مكرر: مرفوض', (await owner.cmd('users.add', { name: 'تجربة', phone: PHONE.worker, pin: '7391', userRole: 'worker', branches: ['فرع العليا'] })).status === 409);
  check('لا يستطيع المدير إنشاء حساب B2B أو مدير', (await owner.cmd('users.add', { name: 'متسلل', phone: '0551110001', pin: '7391', userRole: 'b2b', branches: ['فرع العليا'] })).status === 200
    && (await owner.state()).json.snapshot.users.find((u) => u.phone === '0551110001').role === 'worker');
  check('حساب مدير المنشأة ينشئه B2B فقط', (await owner.cmd('users.add', { name: 'مدير ثانٍ', phone: '0551110002', pin: '7391', userRole: 'mgr' })).status === 403);

  const add = await owner.cmd('users.add', { name: 'عامل جديد', phone: '+966 55 111 0003', pin: '7391', userRole: 'worker', branches: ['فرع الروضة'] });
  check('إضافة حساب: الجوال يُطبَّع (+966 → 05)', add.status === 200 && add.json.snapshot.users.some((u) => u.phone === '0551110003'), add.json.error);
  const nu = add.json.snapshot.users.find((u) => u.phone === '0551110003');
  const pend = await browser().login('0551110003', '7391');
  check('حساب بانتظار التفعيل: لا يدخل', pend.status === 403, `${pend.status} ${pend.json.error}`);
  check('تفعيل الحساب', (await owner.cmd('users.setStatus', { id: nu.id, st: 'ok' })).status === 200);
  const w = browser();
  const first = await w.login('0551110003', '7391');
  check('الحساب الجديد يدخل ويُلزم بتغيير الرمز', first.status === 200 && first.json.mustChangePin === true);
  await w.auth({ action: 'changePin', oldPin: '7391', newPin: '8265' });
  check('الحساب الجديد يعمل بدوره ومنشأته', (await w.state()).json.snapshot?.me?.role === 'worker' && (await w.state()).json.snapshot.me.clientId === 1);

  check('إيقاف الحساب', (await owner.cmd('users.setStatus', { id: nu.id, st: 'off' })).status === 200);
  check('الإيقاف يُنهي جلسته فورًا', (await w.state()).status === 401);
  check('الحساب الموقوف لا يدخل', (await browser().login('0551110003', '8265')).status === 403);
  check('لا يوقف المدير حسابه', (await owner.cmd('users.setStatus', { id: (await owner.state()).json.snapshot.me.id, st: 'off' })).status === 400);

  const ops = await session('ops');
  const opsSnap = (await ops.state()).json.snapshot;
  const finId = opsSnap.users.find((u) => u.role === 'fin').id;
  check('مدير العمليات لا يدير غير العمال', (await ops.cmd('users.resetPin', { id: finId, pin: '7391' })).status === 403);
  const worker = await session('worker');
  check('العامل لا يدير الحسابات', (await worker.cmd('users.add', { name: 'x', phone: '0551110009', pin: '7391', userRole: 'worker', branches: ['فرع العليا'] })).status === 403);
}

// ───────────── فصل بيانات المنشآت ─────────────
console.log('\n— فصل بيانات المنشآت');
{
  const owner = await session('owner');   // منشأة 1
  const frz = await session('frz');       // منشأة 2
  const frzs = await session('frzs');     // منشأة 6 (سوبر: تابعوه 4 و5)
  const fr = await session('fr');         // المانح
  const b2b = await session('b2b');
  const worker = await session('worker');

  const so = (await owner.state()).json.snapshot;
  const sz = (await frz.state()).json.snapshot;
  const ss = (await frzs.state()).json.snapshot;
  const sf = (await fr.state()).json.snapshot;
  const sb = (await b2b.state()).json.snapshot;

  check('المالك: يرى منشأته فقط', so.clients.length === 1 && so.clients[0].id === 1, so.clients.map((c) => c.id).join());
  check('المالك: كل طلباته لمنشأته', so.orders.length > 0 && so.orders.every((o) => o.clientId === 1));
  check('المالك: لا طلبات تسجيل ولا محافظ العملاء', so.newClients.length === 0 && so.walletsByClient === undefined);
  check('المالك: فواتيره وتذاكره لمنشأته', so.invoices.length === 4 && so.invoices.every((v) => v.clientId === 1) && so.tickets.every((t) => t.clientId === 1));
  check('الممنوح: يرى منشأته فقط ولا طلبات غيره', sz.clients.length === 1 && sz.clients[0].id === 2 && sz.orders.every((o) => o.clientId === 2) && sz.invoices.length === 0);
  check('الممنوح: محفظته هو (لا محفظة العينة)', sz.wallet.bal === 22400 && sz.wallet.hist.length === 0, JSON.stringify(sz.wallet).slice(0, 80));
  check('المالك: محفظته بكشفها', so.wallet.bal === 48250 && so.wallet.hist.length > 0);
  check('السوبر: منشأته + تابعوه فقط', ss.clients.map((c) => c.id).sort().join() === '4,5,6', ss.clients.map((c) => c.id).join());
  check('السوبر: لا يرى طلبات تابعيه ولا فواتيرهم', ss.orders.every((o) => o.clientId === 6) && ss.invoices.every((v) => v.clientId === 6));
  check('المانح: منشأته + شبكته (5 ممنوحين)', sf.clients.length === 6 && sf.frs.length === 5, `${sf.clients.length}/${sf.frs.length}`);
  check('المانح: لا يرى «مطاعم البلدة» (خارج شبكته)', !sf.clients.some((c) => c.id === 1));
  check('B2B: كل العملاء + كشوف محافظهم', sb.clients.length === 7 && !!sb.walletsByClient && sb.orders.length >= so.orders.length);
  check('B2B: يرى طلبات التسجيل', sb.newClients.length > 0);

  const purch = so.orders.find((o) => o.st === 'purch');
  const inv = so.invoices.find((v) => v.st === 'unpaid');
  const user1 = so.users.find((u) => u.role === 'worker');

  // وصول على مستوى السجل: منشأة أخرى تحصل على «غير موجود»
  check('ممنوح يعمّد طلب منشأة أخرى: 404', (await frz.cmd('orders.approve', { id: purch.id })).status === 404);
  check('ممنوح يرفض طلب منشأة أخرى: 404', (await frz.cmd('orders.reject', { id: purch.id, reason: 'محاولة اختراق' })).status === 404);
  check('ممنوح يسدد فاتورة منشأة أخرى: 404', (await frz.cmd('invoices.pay', { id: inv.id })).status === 404);
  check('ممنوح يوقف مستخدم منشأة أخرى: 404', (await frz.cmd('users.setStatus', { id: user1.id, st: 'off' })).status === 404);
  check('ممنوح يعيّن رمز مستخدم منشأة أخرى: 404', (await frz.cmd('users.resetPin', { id: user1.id, pin: '7391' })).status === 404);
  check('ممنوح يضيف حسابًا في منشأة أخرى: 404', (await frz.cmd('users.add', { name: 'x', phone: '0551110010', pin: '7391', userRole: 'worker', clientId: 1 })).status === 404);
  check('سوبر يعدّل عميلًا خارج شبكته: 404', (await frzs.cmd('clients.patch', { id: 3, branches: [] })).status === 404);
  check('مالك يعدّل ملف عميل: 403', (await owner.cmd('clients.patch', { id: 2, branches: [] })).status === 403);
  check('مالك يغيّر حدًّا ائتمانيًا: 403', (await owner.cmd('clients.setLimit', { id: 1, limit: 999999 })).status === 403);
  check('مالك يغيّر سعر الكتالوج: 403', (await owner.cmd('products.setPrice', { pid: so.products[0].id, delta: 1 })).status === 403);
  check('مالك يشحن محفظة عميل (أمر B2B): 403', (await owner.cmd('clients.topup', { id: 1, amt: 5000 })).status === 403);
  check('عامل يعمّد نهائيًا: 403', (await worker.cmd('orders.approve', { id: purch.id })).status === 403);
  check('الطلب لم يتغير بعد المحاولات', (await owner.state()).json.snapshot.orders.find((o) => o.id === purch.id).st === 'purch');

  // طلب الممنوح يُسجَّل لمنشأته
  const sub = await frz.cmd('orders.submit', { items: [{ pid: so.products.find((p) => !p.out).id, qty: 3 }] });
  check('الممنوح يرسل طلبًا', sub.status === 200, sub.json.error);
  const newId = (sub.json.msg.match(/ORD-\d+/) || [])[0];
  check('الطلب الجديد لمنشأة الممنوح', sub.json.snapshot.orders.find((o) => o.id === newId)?.clientId === 2);
  check('المالك لا يرى طلب الممنوح', !(await owner.state()).json.snapshot.orders.some((o) => o.id === newId));
  check('B2B يرى طلب الممنوح', (await b2b.state()).json.snapshot.orders.some((o) => o.id === newId));
  check('مالك يرفض طلب الممنوح: 404', (await owner.cmd('orders.reject', { id: newId, reason: 'ليس طلبي' })).status === 404);

  // المحافظ منفصلة
  const top = await b2b.cmd('clients.topup', { id: 2, amt: 1000 });
  check('B2B يشحن محفظة الممنوح', top.status === 200, top.json.error);
  check('رصيد الممنوح زاد', (await frz.state()).json.snapshot.wallet.bal === 23400);
  check('رصيد المالك لم يتأثر', (await owner.state()).json.snapshot.wallet.bal === 48250);
  const own = await owner.cmd('wallet.topup', { amt: 500, method: 'مدى' });
  check('المالك يشحن محفظته هو فقط', own.status === 200 && own.json.snapshot.wallet.bal === 48750 && (await frz.state()).json.snapshot.wallet.bal === 23400);
  check('الإشعارات لا تتسرب بين المنشآت', !(await owner.state()).json.snapshot.extraNotifs.owner.some((n) => /الريف الشمالي/.test(n.text)));

  // الفروع لكل منشأة
  check('فروع المالك لمنشأته فقط', so.branches.length === 3 && sz.branches.length === 2 && !sz.branches.some((x) => so.branches.some((y) => y.name === x.name)));
  check('ممنوح يحذف فرع منشأة أخرى: 404', (await frz.cmd('branches.delete', { name: so.branches[0].name })).status === 404);

  // B2B من ملف العميل: حساب مدير لعميل + رمز مؤقت
  const mgr = await b2b.cmd('users.add', { name: 'وليد بخاري ٢', phone: '0551110020', pin: '7391', userRole: 'mgr', clientId: 3 });
  check('B2B ينشئ حساب مدير لعميل', mgr.status === 200, mgr.json.error);
  const m = browser();
  const ml = await m.login('0551110020', '7391');
  check('مدير العميل الجديد يدخل (فعّال فورًا، رمز مؤقت)', ml.status === 200 && ml.json.role === 'frz' && ml.json.mustChangePin === true, JSON.stringify(ml.json));
}

// ───────────── بوت واتس اب ─────────────
if (BOT_API_KEY) {
  console.log('\n— بوت واتس اب');
  const bot = (body, key = BOT_API_KEY) => fetch(`${BASE}/api/bot`, { method: 'POST', headers: { 'x-bot-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const b2b = await session('b2b');
  const pid = (await b2b.state()).json.snapshot.products.find((p) => !p.out).id;
  check('مفتاح بوت خاطئ: 401', (await bot({ action: 'order', phone: '0500000003', items: [{ pid, qty: 1 }] }, 'bad')).status === 401);
  const known = await (await bot({ action: 'order', phone: '966500000003', items: [{ pid, qty: 2 }] })).json();
  const stranger = await (await bot({ action: 'order', phone: '0588888888', name: 'زبون', items: [{ pid, qty: 2 }] })).json();
  const orders = (await b2b.state()).json.snapshot.orders;
  check('طلب واتساب من جوال مسجّل: يُربط بمنشأة صاحبه', orders.find((o) => o.id === known.data?.id)?.clientId === 1, JSON.stringify(known));
  check('طلب واتساب من جوال غير مسجّل: بلا منشأة (معالجة يدوية)', orders.find((o) => o.id === stranger.data?.id)?.clientId === undefined, JSON.stringify(stranger));
  const owner = await session('owner');
  const mine = (await owner.state()).json.snapshot.orders;
  check('المالك يرى طلب واتساب منشأته لا طلب الغريب', mine.some((o) => o.id === known.data.id) && !mine.some((o) => o.id === stranger.data.id));
} else {
  console.log('\n(تخطّي اختبار البوت — BOT_API_KEY غير مضبوط)');
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) { for (const f of failures) console.log(`  ✗ ${f}`); process.exit(1); }
