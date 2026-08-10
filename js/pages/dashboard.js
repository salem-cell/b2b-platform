// ============================================================
// لوحة التحكم — KPIs + بانر المهمة + آخر الطلبات + العمود الجانبي
// تختلف البطاقات والمهام حسب الدور
// ============================================================
import { esc } from '../core/dom.js';
import { fmt, fmt0 } from '../core/format.js';
import { orderChip, chip } from '../ui.js';
import { franchiseScope, frTag } from '../actions.js';
import { ORG_CR, DEFAULT_CR, CLIENT_TYPE_STYLE, STAFF_ROLE_LABEL } from '../data/constants.js';
import { PRODUCTS } from '../data/products.js';

function kpiCard(k) {
  return `
    <div class="kpi" data-action="go" data-arg="${k.go}">
      <div class="kpi-value" style="color:${k.color}">${k.v}<span class="kpi-unit"> ${k.u || ''}</span></div>
      <div class="kpi-label">${esc(k.l)}</div>
    </div>`;
}

function buildKpis(st) {
  const opsPend = st.orders.filter((o) => o.st === 'ops');
  const purchPend = st.orders.filter((o) => o.st === 'purch');
  const shipPend = st.orders.filter((o) => o.st === 'ship');
  const b2bPrep = st.orders.filter((o) => o.st === 'b2b' || o.st === 'hold');
  const openTk = st.tickets.filter((t) => t.st === 'open' || t.st === 'held');
  const pendReqs = st.prodReqs.filter((r) => r.st === 'pend');
  const doneM = st.orders.filter((o) => o.st === 'done' || o.st === 'short');
  const dueInv = st.invoices.filter((x) => x.st === 'unpaid' || x.st === 'part');
  const W = st.wallet;

  switch (st.role) {
    case 'worker': return [
      { v: shipPend.length, l: 'بانتظار استلامك', color: 'var(--c-info)', go: 'orders' },
      { v: opsPend.length + purchPend.length, l: 'بانتظار التعميد', color: 'var(--c-purple)', go: 'orders' },
      { v: doneM.length, l: 'مستلمة هذا الشهر', color: 'var(--c-success)', go: 'orders' },
      { v: PRODUCTS.length, u: 'صنف', l: 'الكتالوج المتاح', color: 'var(--c-ink)', go: 'catalog' },
    ];
    case 'ops': return [
      { v: opsPend.length, l: 'بانتظار تعميدك', color: 'var(--c-info)', go: 'approvals' },
      { v: '6', l: 'طلبات اليوم', color: 'var(--c-ink)', go: 'orders' },
      { v: st.orders.filter((o) => o.st === 'rej').length, l: 'مرفوضة', color: 'var(--c-danger)', go: 'orders' },
      { v: '14', u: 'دقيقة', l: 'متوسط زمن التعميد', color: 'var(--c-purple)', go: 'approvals' },
    ];
    case 'owner': case 'frz': return [
      { v: purchPend.length, l: 'بانتظار تعميدك النهائي', color: 'var(--c-info)', go: 'approvals' },
      { v: fmt0(W.bal), u: 'ر.س', l: 'رصيد المحفظة', color: 'var(--c-purple)', go: 'wallet' },
      { v: dueInv.length, l: 'فواتير مستحقة', color: 'var(--c-danger)', go: 'wallet' },
      { v: fmt0(W.limit - W.used), u: 'ر.س', l: 'المتاح من الحد الائتماني', color: 'var(--c-success)', go: 'wallet' },
    ];
    case 'fin': return [
      { v: fmt0(W.bal), u: 'ر.س', l: 'رصيد المحفظة', color: 'var(--c-purple)', go: 'wallet' },
      { v: fmt(dueInv.reduce((s, x) => s + x.rem, 0)), u: 'ر.س', l: 'إجمالي المستحق', color: 'var(--c-danger)', go: 'wallet' },
      { v: dueInv.length, l: 'فواتير مستحقة', color: 'var(--c-warn)', go: 'wallet' },
      { v: fmt0(W.limit - W.used), u: 'ر.س', l: 'المتاح من الحد', color: 'var(--c-success)', go: 'wallet' },
    ];
    case 'frzs': {
      const { myFrs } = franchiseScope(st);
      return [
        { v: purchPend.length, l: 'بانتظار تعميدك النهائي', color: 'var(--c-info)', go: 'approvals' },
        { v: fmt0(W.bal), u: 'ر.س', l: 'رصيد محفظتك', color: 'var(--c-purple)', go: 'wallet' },
        { v: fmt0(myFrs.reduce((s, f) => s + f.spend, 0)), u: 'ر.س', l: 'مشتريات ممنوحيك — يوليو', color: 'var(--c-blue)', go: 'analytics' },
        { v: myFrs.length, l: 'ممنوحون في منطقتك', color: 'var(--c-ink)', go: 'frs' },
      ];
    }
    case 'fr': {
      const { netFrs } = franchiseScope(st);
      return [
        { v: fmt0(netFrs.reduce((s, f) => s + f.spend, 0)), u: 'ر.س', l: 'مشتريات الشبكة كاملة — يوليو', color: 'var(--c-purple)', go: 'analytics' },
        { v: netFrs.reduce((s, f) => s + f.orders, 0), u: 'طلب', l: 'طلبات الشبكة', color: 'var(--c-info)', go: 'analytics' },
        { v: `${Math.round(netFrs.reduce((s, f) => s + f.pay, 0) / Math.max(netFrs.length, 1))}%`, l: 'الالتزام بالسداد', color: 'var(--c-success)', go: 'analytics' },
        { v: netFrs.length, l: 'ممنوحون — سوبر وبيسك وتابعون', color: 'var(--c-ink)', go: 'frs' },
      ];
    }
    default: return [ // b2b
      { v: b2bPrep.filter((o) => o.st === 'b2b').length, l: 'قيد التجهيز', color: 'var(--c-blue)', go: 'orders' },
      { v: b2bPrep.filter((o) => o.st === 'hold').length, l: 'طلبات معلقة', color: 'var(--c-warn)', go: 'orders' },
      { v: openTk.length, l: 'تذاكر نواقص مفتوحة', color: 'var(--c-danger)', go: 'tickets' },
      { v: pendReqs.length, l: 'اقتراحات منتجات', color: 'var(--c-info)', go: 'reqs' },
    ];
  }
}

/** بانر المهمة الحية أعلى اللوحة */
function taskBanner(st) {
  const opsPend = st.orders.filter((o) => o.st === 'ops');
  const purchPend = st.orders.filter((o) => o.st === 'purch');
  const shipPend = st.orders.filter((o) => o.st === 'ship');
  const b2bPrep = st.orders.filter((o) => o.st === 'b2b' || o.st === 'hold');

  let t = null;
  if (st.role === 'worker' && shipPend[0]) {
    t = { title: `وصل الطلب ${shipPend[0].id} إلى الفرع`, sub: 'افحص البضاعة مقابل الفاتورة المعتمدة ثم أكّد الاستلام.', btn: 'بدء الاستلام', action: 'openReceive', arg: shipPend[0].id };
  } else if (st.role === 'ops' && opsPend[0]) {
    t = { title: `${opsPend.length} طلب بانتظار تعميدك`, sub: `راجع الكميات وعمّد أو ارفض بسبب — أقدمها ${opsPend[opsPend.length - 1].id}.`, btn: 'فتح التعميدات', action: 'go', arg: 'approvals' };
  } else if ((st.role === 'owner' || st.role === 'frz' || st.role === 'frzs') && purchPend[0]) {
    t = { title: `${purchPend[0].id} بانتظار تعميدك النهائي`, sub: 'بعد تعميدك يُرسل الطلب إلى B2B للتجهيز والتوصيل.', btn: 'فتح التعميد', action: 'openApprove', arg: purchPend[0].id };
  } else if (st.role === 'b2b' && b2bPrep[0]) {
    t = { title: `${b2bPrep.length} طلب في قائمة التجهيز`, sub: 'جهّز وأرسل للتوصيل — أو عدّل/علّق/ارفض من تفاصيل الطلب.', btn: 'فتح القائمة', action: 'go', arg: 'orders' };
  }
  if (!t) return '';
  return `
    <div class="grad-card flex-center gap-14 mt-16" style="padding:20px 22px">
      <div style="width:10px;height:10px;border-radius:999px;background:#7DF0FF;animation:wPulse 1.6s infinite;flex:none"></div>
      <div class="grow">
        <div style="font-size:15px;font-weight:800">${esc(t.title)}</div>
        <div style="font-size:11.5px;opacity:.85;margin-top:2px">${esc(t.sub)}</div>
      </div>
      <button class="btn" style="height:44px;padding:0 22px;border-radius:12px;background:#fff;color:var(--c-purple)" data-action="${t.action}" data-arg="${esc(t.arg)}">${esc(t.btn)}</button>
    </div>`;
}

/** صف طلب مختصر بجدول اللوحة */
function dashOrderRow(st, o) {
  return `
    <div class="table-row clickable" style="padding:12px 18px" data-action="openOrderDrawer" data-arg="${o.id}">
      <div class="num" style="flex:1.2;font-size:12.5px;font-weight:700">${o.id}</div>
      <div style="flex:1.6;font-size:11px;color:var(--c-muted)">${esc(o.by)} · ${esc(o.branch)}</div>
      <div style="flex:1;font-size:10.5px;color:var(--c-faint)">${esc(o.date)}</div>
      <div style="width:150px">${orderChip(o.st)}</div>
    </div>`;
}

/** العمود الجانبي: بطاقة المحفظة + التنبيهات + بطاقات الفرنشايز */
function sideColumn(st) {
  const W = st.wallet;
  const parts = [];
  const orgCr = ORG_CR[st.role] || DEFAULT_CR;

  if (['owner', 'fin', 'frz', 'frzs', 'fr'].includes(st.role)) {
    parts.push(`
      <div class="grad-card" style="padding:18px 20px;cursor:pointer;border-radius:18px" data-action="goWallet">
        <div class="flex-center"><div style="font-size:11px;font-weight:800;opacity:.85">رصيد المحفظة</div><div class="grow"></div><div class="num" style="font-size:10px;opacity:.75">C.R. ${orgCr}</div></div>
        <div class="num" style="font-size:26px;font-weight:700;margin-top:6px">${fmt(W.bal)} <span style="font-size:12px;font-family:var(--font-ar);font-weight:700;opacity:.8">ر.س</span></div>
        <div style="margin-top:11px;height:6px;border-radius:999px;background:rgba(255,255,255,.25);overflow:hidden"><div style="height:100%;background:#7DF0FF;width:${Math.round(W.used / W.limit * 100)}%"></div></div>
        <div style="font-size:10.5px;opacity:.85;margin-top:6px">الحد الائتماني: <span class="num">${fmt0(W.used)}</span> / <span class="num">${fmt0(W.limit)}</span></div>
      </div>`);
  }

  // بطاقات تنبيه حسب الدور
  const alert = (text, tone, action, arg) => `
    <div class="flex-center gap-10" style="padding:13px 16px;border-radius:14px;cursor:pointer;${tone === 'red'
      ? 'background:var(--c-danger-bg);border:1px solid var(--c-danger-border);color:var(--c-danger)'
      : 'background:var(--c-warn-bg);border:1px solid var(--c-warn-border);color:var(--c-warn-deep)'}"
      ${action ? `data-action="${action}" data-arg="${arg || ''}"` : ''}>
      <div style="width:8px;height:8px;border-radius:999px;background:currentColor;flex:none"></div>
      <div class="grow" style="font-size:11.5px;font-weight:700;line-height:1.8">${text}</div>
    </div>`;

  const openTk = st.tickets.filter((t) => t.st === 'open' || t.st === 'held');
  if (['owner', 'fin', 'frz'].includes(st.role)) parts.push(alert('فاتورة INV-9312 تستحق 28 يوليو — 8,420.50 ر.س', 'amber', 'goInvoices'));
  if (st.role === 'fr') parts.push(alert('تأخر سداد — بروست الخليج: فاتورة متأخرة 12 يومًا', 'red', 'go', 'analytics'));
  if (st.role === 'b2b' && openTk.length) parts.push(alert(`${openTk.length} تذكرة نواقص بانتظار الحل`, 'red', 'go', 'tickets'));
  if (st.role === 'worker') parts.push(alert('الأسعار مخفية لدور العامل حسب سياسة المنشأة', 'amber'));

  // مانح/سوبر: أشرطة مشتريات شبكته
  if (st.role === 'fr' || st.role === 'frzs') {
    const { netFrs } = franchiseScope(st);
    const maxSpend = Math.max(...netFrs.map((f) => f.spend), 1);
    parts.push(`
      <div class="card card-pad">
        <div style="font-size:13px;font-weight:800;margin-bottom:12px">مشتريات الممنوحين — يوليو</div>
        <div style="display:flex;flex-direction:column;gap:11px">
          ${netFrs.filter((f) => f.spend > 0).map((f) => `
            <div>
              <div class="flex" style="font-size:11px;font-weight:700"><div>${esc(frTag(st, f))}</div><div class="grow"></div><div class="num" style="color:var(--c-muted)">${fmt0(f.spend)}</div></div>
              <div class="progress" style="margin-top:5px"><div style="width:${Math.round(f.spend / maxSpend * 100)}%"></div></div>
            </div>`).join('')}
        </div>
      </div>`);
  }

  // الممنوح (بيسك أو سوبر): بطاقة الربط بالمانح
  if (st.role === 'frz' || st.role === 'frzs') {
    parts.push(`
      <div class="card flex-center gap-11" style="border-color:var(--c-info-border);padding:14px 16px">
        <img src="assets/logo-0.png" alt="" style="width:36px;height:36px;border-radius:10px;object-fit:contain;background:var(--c-chip-bg);padding:4px" onerror="this.style.display='none'">
        <div class="grow">
          <div style="font-size:12px;font-weight:800;color:var(--c-purple)">مرتبط بالمانح: دوار السعادة</div>
          <div style="font-size:10px;line-height:1.7;color:var(--c-info);margin-top:2px">قائمة أسعار الفرنشايز مطبقة · محفظتك مستقلة — يطّلع المانح دون الصرف منها</div>
          ${st.role === 'frzs' ? '<div style="font-size:10px;font-weight:800;line-height:1.7;color:var(--c-purple);margin-top:4px">منطقة امتيازك: المنطقة الشرقية — تمنح ممنوحين ضمنها فقط، وممنوحوك يفتحون فروعهم فقط</div>' : ''}
        </div>
      </div>`);
  }

  return parts.join('');
}

/** شريحة نوع العميل الموحّدة */
export function typeChip(type, size = 9.5) {
  return `<span style="display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;font-size:${size}px;font-weight:800;white-space:nowrap;${CLIENT_TYPE_STYLE[type] || CLIENT_TYPE_STYLE['مستقل']}">${esc(type || 'مستقل')}</span>`;
}

/** لوحة B2B الشاملة: نبض المنصة كاملة — عمليات، مال، منشآت، يوزرات */
function renderB2bDash(st) {
  const cnt = (s) => st.orders.filter((o) => o.st === s).length;
  const openTk = st.tickets.filter((t) => t.st === 'open' || t.st === 'held').length;
  const pendReqs = st.prodReqs.filter((r) => r.st === 'pend').length;
  const pendNc = (st.newClients || []).filter((n) => n.st === 'pend').length;
  const pendTu = (st.topupReqs || []).length;
  const pendUsers = st.users.filter((u) => u.st === 'pend').length;

  const kpis = [
    { v: cnt('b2b'), l: 'قيد التجهيز', color: 'var(--c-blue)', go: 'orders' },
    { v: cnt('hold'), l: 'طلبات معلقة', color: 'var(--c-warn)', go: 'orders' },
    { v: cnt('ship'), l: 'قيد التوصيل', color: 'var(--c-purple)', go: 'orders' },
    { v: openTk, l: 'تذاكر نواقص', color: 'var(--c-danger)', go: 'tickets' },
    { v: pendTu, l: 'تعميدات مالية', color: 'var(--c-info)', go: 'fintu' },
    { v: pendNc, l: 'عملاء جدد', color: 'var(--c-success)', go: 'newclients' },
  ];

  // خط سير الطلبات عبر المنصة كاملة
  const pipe = [
    { l: 'بانتظار تعميد المنشآت', c: '#8A94A3', n: cnt('ops') + cnt('purch') },
    { l: 'قيد التجهيز لدى B2B', c: 'var(--c-blue)', n: cnt('b2b') },
    { l: 'معلقة', c: 'var(--c-warn)', n: cnt('hold') },
    { l: 'قيد التوصيل', c: 'var(--c-purple)', n: cnt('ship') },
    { l: 'مكتملة', c: 'var(--c-success)', n: cnt('done') + cnt('short') },
  ];
  const pipeMax = Math.max(...pipe.map((p) => p.n), 1);

  // قائمة العمل — كل ما يتطلب إجراء فريق B2B الآن
  const queue = [
    { n: cnt('b2b'), l: 'طلبات جاهزة للتجهيز والإرسال', go: 'orders' },
    { n: pendTu, l: 'تحويلات بنكية بانتظار التعميد المالي', go: 'fintu' },
    { n: openTk, l: 'تذاكر نواقص بانتظار الحل', go: 'tickets' },
    { n: pendReqs, l: 'اقتراحات منتجات بانتظار التسعير', go: 'reqs' },
    { n: pendNc, l: 'منشآت جديدة بانتظار المراجعة والاعتماد', go: 'newclients' },
    { n: st.frs.filter((f) => f.st === 'new').length, l: 'ممنوحون بانتظار تعميد التفعيل', go: 'frs' },
  ].filter((q) => q.n > 0);

  // توزيع اليوزرات عبر منشآت المنصة
  const roleCounts = {};
  for (const c of st.clients) for (const s of (c.staff || [])) roleCounts[s.role] = (roleCounts[s.role] || 0) + 1;
  const roleMax = Math.max(...Object.values(roleCounts), 1);
  const roleColors = { owner: 'var(--c-purple)', ops: 'var(--c-info)', fin: 'var(--c-blue)', worker: '#8A94A3' };

  const clientRows = st.clients.map((c) => {
    const usersN = (c.staff || []).length;
    return `
      <div class="table-row clickable" style="padding:11px 18px" data-action="openClientProfile" data-arg="${c.id}">
        <div style="flex:1.7;min-width:0">
          <div style="font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</div>
          <div class="num" style="font-size:9.5px;color:var(--c-faint);margin-top:1px">${esc(c.cr)}</div>
        </div>
        <div style="flex:1">${typeChip(c.type)}</div>
        <div class="num" style="flex:.9;font-size:12px;font-weight:700;color:var(--c-info)">${fmt0(c.bal)}</div>
        <div class="num" style="flex:.9;font-size:12px;font-weight:700">${fmt0(c.spend)}</div>
        <div style="flex:.6;font-size:11.5px;font-weight:800;color:var(--c-purple)"><span class="num">${usersN}</span> يوزر</div>
        <div style="width:86px">${chip(c.st === 'ok' ? 'نشط' : 'موقوف', c.st === 'ok' ? 'chip-success' : 'chip-danger')}</div>
      </div>`;
  }).join('');

  const b2bPrep = st.orders.filter((o) => o.st === 'b2b' || o.st === 'hold');

  return `
    <div class="kpi-grid" style="grid-template-columns:repeat(6,1fr)">${kpis.map(kpiCard).join('')}</div>
    ${taskBanner(st)}
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:14px;margin-top:16px;align-items:start">
      <div style="display:flex;flex-direction:column;gap:14px;min-width:0">
        <div class="card card-pad">
          <div class="card-title" style="margin-bottom:13px">خط سير الطلبات — المنصة كاملة</div>
          <div style="display:flex;flex-direction:column;gap:11px">
            ${pipe.map((p) => `
              <div style="cursor:pointer" data-action="go" data-arg="orders">
                <div class="flex" style="font-size:11px;font-weight:700"><div>${p.l}</div><div class="grow"></div><div class="num" style="color:var(--c-muted)">${p.n}</div></div>
                <div class="progress" style="margin-top:5px"><div style="width:${Math.round(p.n / pipeMax * 100)}%;background:${p.c}"></div></div>
              </div>`).join('')}
          </div>
        </div>
        <div class="card" style="overflow:hidden">
          <div class="flex-center" style="padding:15px 18px 10px">
            <div class="grow">
              <div class="card-title">كل منشآت المنصة</div>
              <div style="font-size:10px;color:var(--c-muted);margin-top:2px">المحفظة والمشتريات واليوزرات — اضغط منشأة لملفها الكامل</div>
            </div>
            <div style="font-size:11px;font-weight:800;color:var(--c-info);cursor:pointer" data-action="go" data-arg="clients">الكل</div>
          </div>
          <div class="table-head" style="padding:8px 18px;border-top:1px solid var(--c-divider)">
            <div style="flex:1.7">المنشأة</div><div style="flex:1">النوع</div><div style="flex:.9">المحفظة</div>
            <div style="flex:.9">مشتريات يوليو</div><div style="flex:.6">اليوزرات</div><div style="width:86px">الحالة</div>
          </div>
          ${clientRows}
        </div>
        <div class="card" style="overflow:hidden">
          <div class="flex-center" style="padding:15px 18px 10px">
            <div class="card-title grow">قائمة التجهيز</div>
            <div style="font-size:11px;font-weight:800;color:var(--c-info);cursor:pointer" data-action="go" data-arg="orders">الكل</div>
          </div>
          <div class="table-head" style="padding:8px 18px;border-top:1px solid var(--c-divider)">
            <div style="flex:1.2">الطلب</div><div style="flex:1.6">مقدّم الطلب · الفرع</div><div style="flex:1">التاريخ</div><div style="width:150px">الحالة</div>
          </div>
          ${b2bPrep.map((o) => dashOrderRow(st, o)).join('')}
          ${b2bPrep.length === 0 ? '<div style="padding:22px;text-align:center;font-size:11.5px;color:var(--c-muted)">قائمة التجهيز فارغة الآن.</div>' : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card card-pad">
          <div class="card-title" style="margin-bottom:12px">قائمة العمل — يتطلب إجراءك</div>
          ${queue.length ? queue.map((q) => `
            <div class="flex-center gap-10 clickable" style="padding:10px 4px;border-bottom:1px solid var(--c-divider);cursor:pointer" data-action="go" data-arg="${q.go}">
              <div class="num" style="width:30px;height:30px;border-radius:10px;background:var(--c-info-bg);color:var(--c-info);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex:none">${q.n}</div>
              <div class="grow" style="font-size:11.5px;font-weight:700;line-height:1.6">${q.l}</div>
              <div style="font-size:10px;font-weight:800;color:var(--c-info)">فتح ←</div>
            </div>`).join('') : '<div style="font-size:11.5px;color:var(--c-muted);padding:6px 0">لا إجراءات معلقة — كل شيء تحت السيطرة ✨</div>'}
        </div>
        ${pendUsers ? `
          <div class="flex-center gap-10" style="padding:13px 16px;border-radius:14px;cursor:pointer;background:var(--c-warn-bg);border:1px solid var(--c-warn-border);color:var(--c-warn-deep)" data-action="go" data-arg="users">
            <div style="width:8px;height:8px;border-radius:999px;background:currentColor;flex:none"></div>
            <div class="grow" style="font-size:11.5px;font-weight:700;line-height:1.8">${pendUsers} يوزر بانتظار تفعيل حسابه — فعّله ليستطيع الدخول</div>
          </div>` : ''}
        <div class="card card-pad">
          <div class="card-title" style="margin-bottom:4px">توزيع اليوزرات على المنصة</div>
          <div style="font-size:10px;color:var(--c-muted);margin-bottom:12px">كل مستخدمي المنشآت حسب الدور — إدارتها من «الأنواع واليوزرات»</div>
          <div style="display:flex;flex-direction:column;gap:11px">
            ${['owner', 'ops', 'fin', 'worker'].map((r) => `
              <div style="cursor:pointer" data-action="go" data-arg="roles">
                <div class="flex" style="font-size:11px;font-weight:700"><div>${STAFF_ROLE_LABEL[r]}</div><div class="grow"></div><div class="num" style="color:var(--c-muted)">${roleCounts[r] || 0}</div></div>
                <div class="progress" style="margin-top:5px"><div style="width:${Math.round((roleCounts[r] || 0) / roleMax * 100)}%;background:${roleColors[r]}"></div></div>
              </div>`).join('')}
          </div>
        </div>
        ${sideColumn(st)}
      </div>
    </div>`;
}

export function renderDashboard(st) {
  if (st.role === 'b2b') return renderB2bDash(st);
  const b2bPrep = st.orders.filter((o) => o.st === 'b2b' || o.st === 'hold');
  const listOrders = st.role === 'b2b' ? b2bPrep : st.orders.slice(0, 5);

  return `
    <div class="kpi-grid">${buildKpis(st).map(kpiCard).join('')}</div>
    ${taskBanner(st)}
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:14px;margin-top:16px;align-items:start">
      <div class="card" style="overflow:hidden">
        <div class="flex-center" style="padding:15px 18px 10px">
          <div class="card-title grow">${st.role === 'b2b' ? 'قائمة التجهيز' : 'آخر الطلبات'}</div>
          <div style="font-size:11px;font-weight:800;color:var(--c-info);cursor:pointer" data-action="go" data-arg="orders">الكل</div>
        </div>
        <div class="table-head" style="padding:8px 18px;border-top:1px solid var(--c-divider)">
          <div style="flex:1.2">الطلب</div><div style="flex:1.6">مقدّم الطلب · الفرع</div><div style="flex:1">التاريخ</div><div style="width:150px">الحالة</div>
        </div>
        ${listOrders.map((o) => dashOrderRow(st, o)).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        ${sideColumn(st)}
      </div>
    </div>`;
}
