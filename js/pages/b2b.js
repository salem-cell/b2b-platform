// ============================================================
// صفحات B2B وسواها: التذاكر، اقتراح المنتجات، العملاء، إدارة الكتالوج
// ============================================================
import { esc, ICONS } from '../core/dom.js';
import { fmt, fmt0, stripe } from '../core/format.js';
import { chip, filterChips, emptyState, prodThumb } from '../ui.js';
import { REQUEST_STATUS, CATEGORIES, CAN_REQUEST, NC_STATUS, RM_MARKS, RM_COLS, RM_ROWS } from '../data/constants.js';
import { PRODUCTS, PRODUCT_MAP } from '../data/products.js';
import { filterProducts } from './catalog.js';
import { typeChip } from './dashboard.js';
import { sessionClientId } from '../actions.js';

/** الأدوار التي تطلب إضافة منتجات من الكتالوج لكتالوجها الخاص (سلة v6) */
export const CAN_BKT = ['owner', 'frz', 'frzs'];

/** شريحة حالة تذكرة */
export function ticketChip(t) {
  if (t.st === 'open') return chip('مفتوحة', 'chip-warn');
  if (t.st === 'held') return chip('معلقة', 'chip-danger');
  return chip(`مقفلة — ${t.cn || ''}`, 'chip-success');
}

export function renderTickets(st) {
  const rows = st.tickets.map((t) => `
    <div class="table-row clickable" data-action="openTicket" data-arg="${t.id}">
      <div class="num" style="flex:.9;font-size:12.5px;font-weight:700">${t.id}</div>
      <div class="num" style="flex:1;font-size:11px;color:var(--c-muted)">${t.ord}</div>
      <div style="flex:1.6;font-size:11px;color:var(--c-muted)">${esc(t.customer)}</div>
      <div style="flex:1.6;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-inline-end:8px">${esc(t.desc)}</div>
      <div class="num" style="flex:.9;font-size:12px;font-weight:700">${fmt(t.val)}</div>
      <div style="width:130px">${ticketChip(t)}</div>
      <div style="width:110px;display:flex;justify-content:flex-end"><div style="font-size:10.5px;font-weight:800;color:var(--c-info)">التفاصيل ←</div></div>
    </div>`).join('');

  return `
    <div class="card" style="overflow:hidden">
      <div class="table-head">
        <div style="flex:.9">التذكرة</div><div style="flex:1">الطلب</div><div style="flex:1.6">العميل</div>
        <div style="flex:1.6">النواقص</div><div style="flex:.9">القيمة</div><div style="width:130px">الحالة</div><div style="width:110px"></div>
      </div>
      ${rows}
    </div>
    ${st.tickets.length === 0 ? `<div class="mt-14">${emptyState('لا تذاكر نواقص.')}</div>` : ''}`;
}

export function renderRequests(st) {
  const canReq = CAN_REQUEST.includes(st.role);
  const canBkt = CAN_BKT.includes(st.role);
  const hint = st.role === 'b2b'
    ? 'اقتراحات العملاء وطلبات الإضافة — سعّر أو ارفض؛ بعد اعتماد العميل تنزل الأسعار في كتالوجه.'
    : 'اقتراحاتك وطلبات إضافتك تصل لفريق B2B — يسعّرها وتعتمد الأسعار قبل نزولها في منتجاتك.';

  const cards = st.prodReqs.map((r) => {
    const m = REQUEST_STATUS[r.st];
    const isCat = r.kind === 'cat';
    // اعتماد السعر لمقدّم الاقتراح (الأدوار العميلة المالكة) عندما يكون مُسعّرًا
    const clientCanDecide = r.st === 'priced' && ['owner', 'fr', 'frz', 'frzs'].includes(st.role)
      && (!isCat || r.clientId === sessionClientId(st.role) || st.role === 'fr');
    return `
      <div class="card card-pad">
        <div class="flex-center gap-8">
          <div class="grow" style="font-size:13px;font-weight:800">${esc(r.name)}</div>
          ${chip(m.label, m.chip)}
        </div>
        <div style="font-size:10.5px;color:var(--c-muted);margin-top:6px"><span class="num">${r.id}</span> · ${esc(r.date)} · ${esc(r.by)} — ${esc(r.user || '')}</div>
        <div style="font-size:11px;color:var(--c-faint);margin-top:4px;line-height:1.8">«${esc(r.note)}»</div>
        ${!isCat && r.price != null && r.st !== 'pend' ? `
          <div class="flex-center gap-7" style="background:var(--c-info-bg);border:1px solid #B5E7F0;border-radius:11px;padding:9px 13px;margin-top:10px">
            <div style="font-size:11px;font-weight:800;color:var(--c-info)">سعر B2B المقترح</div>
            <div class="grow"></div>
            <div class="num" style="font-size:14px;font-weight:700;color:var(--c-info)">${fmt(r.price)} <span style="font-size:9px;font-family:var(--font-ar)">ر.س</span></div>
          </div>` : ''}
        ${isCat && r.st === 'priced' ? `
          <div style="background:var(--c-info-bg);border:1px solid #B5E7F0;border-radius:11px;padding:10px 13px;margin-top:10px">
            <div style="font-size:10.5px;font-weight:800;color:var(--c-info);margin-bottom:7px">الأسعار الخاصة المقترحة من B2B</div>
            <div style="display:flex;flex-direction:column;gap:5px">
              ${(r.items || []).map((it) => {
                const p = PRODUCT_MAP[it.pid] || { name: it.pid, price: 0 };
                return `
                <div class="flex-center gap-8" style="font-size:10.5px">
                  <div class="grow" style="font-weight:700;color:#0d5866">${esc(p.name)}</div>
                  <div class="num" style="color:var(--c-faint);text-decoration:line-through;font-size:9.5px">${fmt(p.price)}</div>
                  <div class="num" style="font-weight:700;color:var(--c-info);font-size:12px">${fmt(it.price ?? p.price)} <span style="font-size:8.5px;font-family:var(--font-ar)">ر.س</span></div>
                </div>`;
              }).join('')}
            </div>
          </div>` : ''}
        ${st.role === 'b2b' && r.st === 'pend' ? `
          <div class="flex gap-8 mt-12">
            <button class="btn btn-primary" style="flex:1.5;height:42px;border-radius:11px;font-size:11.5px" data-action="${isCat ? 'openRcp' : 'approveRequest'}" data-arg="${r.id}">${isCat ? 'تسعير المنتجات' : 'تسعير وإرسال للعميل'}</button>
            <button class="btn btn-danger-outline" style="width:90px;height:42px;border-radius:11px;font-size:11.5px" data-action="rejectRequest" data-arg="${r.id}">رفض</button>
          </div>` : ''}
        ${clientCanDecide ? `
          <div class="flex gap-8 mt-12">
            <button class="btn btn-success-solid" style="flex:1.5;height:42px;border-radius:11px;font-size:11.5px" data-action="clientAcceptReq" data-arg="${r.id}">${isCat ? 'اعتماد الأسعار — تنزل في منتجاتي' : 'اعتماد السعر — إضافة في منتجاتي'}</button>
            <button class="btn btn-danger-outline" style="width:110px;height:42px;border-radius:11px;font-size:11.5px" data-action="clientDeclineReq" data-arg="${r.id}">رفض السعر</button>
          </div>` : ''}
      </div>`;
  }).join('');

  // متصفح الكتالوج المدمج: للتحقق قبل الاقتراح، ولسلة الإضافة (v6)
  const reqCat = st.reqCat || 'الكل';
  const catRows = filterProducts(st.reqSearch, reqCat);
  const bkt = st.bkt || {};
  const bktN = Object.keys(bkt).length;

  // حالة كل منتج تجاه العميل الحالي: ضمن منتجاته / بطلب سابق / في السلة / قابل للإضافة
  const cid = sessionClientId(st.role);
  const mine = new Set((st.clientProds || []).filter((x) => x.clientId === cid).map((x) => x.pid));
  const pend = new Set();
  if (canBkt) {
    for (const r of st.prodReqs) {
      if (r.kind === 'cat' && r.clientId === cid && ['pend', 'priced'].includes(r.st)) {
        for (const it of r.items || []) pend.add(it.pid);
      }
    }
  }
  const prodChip = (p) => {
    if (!canBkt) return '';
    if (mine.has(p.id)) return `<div class="flex-center gap-5" style="display:inline-flex;height:26px;padding:0 10px;border-radius:999px;background:var(--c-success-bg);color:var(--c-success);font-size:9.5px;font-weight:800;margin-top:6px">✓ ضمن منتجاتك</div>`;
    if (pend.has(p.id)) return `<div style="display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;background:var(--c-warn-bg);color:var(--c-warn-deep);font-size:9.5px;font-weight:800;margin-top:6px">بطلب سابق — بانتظار B2B</div>`;
    if (bkt[p.id]) return `<div class="flex-center gap-5" style="display:inline-flex;height:26px;padding:0 10px;border-radius:999px;background:var(--c-purple);color:#fff;font-size:9.5px;font-weight:800;cursor:pointer;margin-top:6px" data-action="bktRm" data-arg="${p.id}">✓ في السلة — إزالة</div>`;
    return `<div class="flex-center gap-5" style="display:inline-flex;height:26px;padding:0 10px;border-radius:999px;background:var(--c-info-bg);color:var(--c-info);font-size:9.5px;font-weight:800;cursor:pointer;margin-top:6px" data-action="bktAdd" data-arg="${p.id}">${ICONS.plus('#0d7f93', 9, 3)} أضف للسلة</div>`;
  };

  return `
    <div class="flex-center" style="margin-bottom:14px">
      <div style="font-size:12px;color:var(--c-muted)">${hint}</div>
      <div class="grow"></div>
      ${canReq ? `<button class="btn btn-primary btn-pill" style="height:42px;font-size:12px" data-action="openReqNew">${ICONS.plus('#fff', 13, 2.6)} اقتراح منتج</button>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px">${cards}</div>
    ${st.prodReqs.length === 0 ? emptyState('لا اقتراحات بعد — لم تجد منتجًا في الكتالوج؟ اقترحه.') : ''}
    <div class="card mt-16" style="padding:18px">
      <div class="flex-center gap-10 wrap">
        <div>
          <div class="card-title">تصفح كتالوج B2B</div>
          <div style="font-size:10.5px;color:var(--c-muted);margin-top:2px">${canBkt ? 'أضف ما تحتاجه لسلة الإضافة — يُسعَّر خصيصًا لك وتعتمده قبل نزوله في منتجاتك.' : 'تأكد أن المنتج غير متوفر قبل اقتراحه.'}</div>
        </div>
        <div class="grow"></div>
        <div class="search-box" style="height:42px;min-width:260px;background:var(--c-subtle);border-radius:12px">
          ${ICONS.search('#a8a4b8', 15)}
          <input data-input="reqSearch" data-key="reqSearch" value="${esc(st.reqSearch)}" placeholder="ابحث بالمنتج أو الرمز…" style="flex:1;border:none;outline:none;background:transparent;font-size:12px">
        </div>
      </div>
      <div class="mt-12">${filterChips(CATEGORIES, reqCat, 'setReqCat')}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-top:14px">
        ${catRows.map((p) => `
          <div class="flex gap-9" style="border:1px solid var(--c-divider);border-radius:14px;padding:9px;align-items:flex-start">
            ${prodThumb(p, 44)}
            <div class="grow" style="min-width:0">
              <div style="font-size:11px;font-weight:800;line-height:1.5">${esc(p.name)}</div>
              <div style="font-size:9.5px;color:var(--c-faint);margin-top:1px">${esc(p.unit)}</div>
              ${prodChip(p)}
            </div>
          </div>`).join('')}
      </div>
      ${catRows.length === 0 ? `
        <div style="text-align:center;padding:26px;color:var(--c-muted);font-size:12px;border:1px dashed #DDD9E6;border-radius:14px;margin-top:14px">
          غير موجود في الكتالوج${canReq ? ' — <span style="color:var(--c-info);font-weight:800;cursor:pointer;text-decoration:underline" data-action="openReqNew">اقترحه الآن</span>' : ''}.
        </div>` : ''}
      ${canBkt && bktN ? `
        <div class="flex-center gap-13" style="position:sticky;bottom:14px;margin-top:16px;border-radius:16px;background:linear-gradient(140deg,#654E92,#3C79F5);box-shadow:0 12px 28px rgba(58,46,94,.28);padding:13px 18px;color:#fff">
          <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;flex:none">${ICONS.cart ? ICONS.cart('#fff', 18) : '🛒'}</div>
          <div class="grow">
            <div style="font-size:13px;font-weight:800">سلة الإضافة — <span class="num">${bktN}</span> منتجات</div>
            <div style="font-size:10px;opacity:.85;margin-top:1px">تُرسل طلبًا واحدًا لB2B — بعد الاتفاق على الأسعار والاعتماد تنزل في منتجاتك</div>
          </div>
          <button class="btn" style="height:40px;padding:0 20px;border-radius:11px;background:#fff;color:var(--c-purple);font-size:12px;font-weight:800" data-action="openBkt">مراجعة وإرسال</button>
        </div>` : ''}
    </div>`;
}

export function renderClients(st) {
  const rows = st.clients.map((c) => {
    const ok = c.st === 'ok';
    return `
      <div class="table-row clickable" data-action="openClientProfile" data-arg="${c.id}">
        <div style="flex:1.6;min-width:0">
          <div style="font-size:12.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</div>
          <div style="margin-top:4px">${typeChip(c.type, 9)}</div>
        </div>
        <div style="flex:1;font-size:10.5px;color:var(--c-muted)">${esc(c.city)} · <span class="num">${esc(c.cr)}</span></div>
        <div class="num" style="flex:.7;font-size:12px;font-weight:700">${c.orders}</div>
        <div class="num" style="flex:1;font-size:12px;font-weight:700">${fmt0(c.spend)} <span style="font-size:9px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div>
        <div class="num" style="flex:.9;font-size:12px;font-weight:700;color:var(--c-info);cursor:pointer" data-action="openClientWallet" data-arg="${c.id}">${fmt0(c.bal)} ←</div>
        <div style="width:120px">${chip(ok ? 'نشط' : 'موقوف', ok ? 'chip-success' : 'chip-danger')}</div>
        <div style="width:150px;display:flex;justify-content:flex-end">
          <button class="btn btn-xs ${ok ? 'btn-danger-outline' : 'btn-success-solid'}" style="border-width:1px" data-action="toggleClientAccount" data-arg="${c.id}">${ok ? 'إيقاف' : 'إعادة تفعيل'}</button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="flex-center" style="margin-bottom:14px">
      <div style="font-size:12px;color:var(--c-muted)">كل منشآت المنصة بأنواعها الأربعة — مستقل، مانح، ممنوح بيسك، ممنوح سوبر.</div>
      <div class="grow"></div>
      <button class="btn btn-primary btn-pill" style="height:42px;font-size:12px" data-action="openClientNew">${ICONS.plus('#fff', 13, 2.6)} إنشاء عميل</button>
    </div>
    <div class="card" style="overflow:hidden">
      <div class="table-head">
        <div style="flex:1.6">المنشأة · النوع</div><div style="flex:1">المدينة · السجل</div><div style="flex:.7">طلبات</div>
        <div style="flex:1">مشتريات يوليو</div><div style="flex:.9">المحفظة</div><div style="width:120px">الحالة</div><div style="width:150px"></div>
      </div>
      ${rows}
    </div>
    <div class="banner-info-dashed mt-12">إيقاف العميل يمنع منشأته كاملة من إرسال طلبات جديدة فورًا — ويظهر له بانر التوقيف في تطبيقه.</div>`;
}

// ============ إدارة الكتالوج الأساسي (v5): بحث + إضافة + تسعير مباشر + حذف ============

export function renderCatalogAdmin(st) {
  const q = (st.cadSearch || '').trim();
  const cat = st.cadCat || 'الكل';
  const list = PRODUCTS.filter((p) =>
    (cat === 'الكل' || p.cat === cat) &&
    (!q || p.name.includes(q) || p.id.includes(q)));
  const total = list.reduce((s, p) => s + p.price, 0);

  return `
    <div class="flex-center gap-10 wrap" style="margin-bottom:14px">
      <div>
        <div style="font-size:12px;color:var(--c-muted)">الكتالوج الأساسي للمنصة — <span class="num" style="font-weight:800;color:var(--c-ink)">${list.length}</span> منتج${q || cat !== 'الكل' ? ' (مُصفّى)' : ''}</div>
      </div>
      <div class="grow"></div>
      <div class="search-box" style="height:42px;min-width:250px;background:#fff;border:1px solid var(--c-divider);border-radius:12px">
        ${ICONS.search('#a8a4b8', 15)}
        <input data-input="cadSearch" data-key="cadSearch" value="${esc(st.cadSearch || '')}" placeholder="ابحث بالاسم أو الرمز…" style="flex:1;border:none;outline:none;background:transparent;font-size:12px">
      </div>
      <button class="btn btn-primary btn-pill" style="height:42px;font-size:12px" data-action="openCadNew">${ICONS.plus('#fff', 13, 2.6)} إضافة منتج</button>
    </div>
    <div style="margin-bottom:12px">${filterChips(CATEGORIES, cat, 'setCadCat')}</div>
    <div class="card" style="overflow:hidden">
      <div class="table-head">
        <div style="width:52px"></div><div style="flex:1.7">المنتج</div><div style="flex:.9">الوحدة</div>
        <div style="flex:.9">القسم</div><div style="flex:1.1">السعر الأساسي</div><div style="width:210px"></div>
      </div>
      ${list.map((p) => {
        const editKey = `cadP_${p.id}`;
        const editVal = st[editKey] != null ? st[editKey] : String(p.price);
        return `
        <div class="table-row" style="padding:10px 18px">
          <div style="width:52px;position:relative">
            <div class="prod-thumb" title="إضافة / تغيير صورة المنتج" style="width:40px;height:40px;background:${stripe(p.h)};cursor:pointer" data-action="openImgEdit" data-arg="${p.id}">
              ${p.img
                ? `<img src="${esc(p.img)}" alt="" loading="lazy" onerror="this.style.display='none'">`
                : '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" stroke="#a8a4b8" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.2" stroke="#a8a4b8" stroke-width="1.7"/></svg></div>'}
            </div>
            ${p.img ? `<div title="إزالة الصورة" style="position:absolute;top:-6px;right:-6px;width:17px;height:17px;border-radius:999px;background:var(--c-danger);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.25)" data-action="imgDelete" data-arg="${p.id}">${ICONS.close('#fff', 8, 3)}</div>` : ''}
          </div>
          <div style="flex:1.7;min-width:0">
            <div style="font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div>
            <div class="num" style="font-size:9.5px;color:var(--c-faint);margin-top:1px">${p.id}</div>
          </div>
          <div style="flex:.9;font-size:10.5px;color:var(--c-muted)">${esc(p.unit)}</div>
          <div style="flex:.9;font-size:10.5px;color:var(--c-muted)">${esc(p.cat)}</div>
          <div style="flex:1.1">
            <div class="flex-center gap-6">
              <button class="btn" style="width:26px;height:26px;border-radius:8px;padding:0;background:var(--c-subtle);color:var(--c-purple);font-size:14px;font-weight:800" data-action="cadStepPrice" data-arg="${p.id}|-1">−</button>
              <input class="num" value="${esc(editVal)}" data-input="${editKey}" data-key="${editKey}" data-enter="cadCommitPrice" data-blur="cadCommitPrice" data-arg="${p.id}"
                dir="ltr" inputmode="decimal" title="اكتب السعر ثم Enter"
                style="width:64px;height:28px;text-align:center;font-size:12.5px;font-weight:700;color:var(--c-purple);border:1px solid var(--c-divider);border-radius:8px;outline:none;background:var(--c-subtle)">
              <button class="btn" style="width:26px;height:26px;border-radius:8px;padding:0;background:var(--c-purple);color:#fff;font-size:14px;font-weight:800" data-action="cadStepPrice" data-arg="${p.id}|1">+</button>
            </div>
          </div>
          <div style="width:210px;display:flex;justify-content:flex-end;gap:7px">
            <button class="btn btn-xs ${p.out ? 'btn-success-solid' : 'btn-warn-outline'}" style="border-width:1px" data-action="toggleProductAvailability" data-arg="${p.id}">${p.out ? 'إعادة توفير' : 'إيقاف مؤقت'}</button>
            <button class="btn btn-xs btn-danger-outline" style="border-width:1px" data-action="cadDelete" data-arg="${p.id}">حذف</button>
          </div>
        </div>`;
      }).join('')}
      ${list.length === 0 ? '<div style="padding:26px;text-align:center;font-size:12px;color:var(--c-muted)">لا نتائج مطابقة — عدّل البحث أو القسم.</div>' : ''}
    </div>
    <div class="banner-info-dashed mt-12">تعديل السعر هنا يغيّر <b>مرجع التسعير الأساسي</b> لكل المنصة — الأسعار الخاصة داخل ملفات العملاء تتقدّم عليه ولا تتأثر به.</div>`;
}

// ============ العملاء الجدد (v5): طلبات «سجّل منشأتك» ============

export function renderNewClients(st) {
  const list = st.newClients || [];
  const rows = list.map((r) => {
    const m = NC_STATUS[r.st] || NC_STATUS.pend;
    return `
      <div class="table-row clickable" data-action="openNcDet" data-arg="${r.id}">
        <div style="flex:1.7;min-width:0">
          <div style="font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.name)}</div>
          <div class="flex-center gap-6" style="margin-top:4px"><span style="font-size:9.5px;color:var(--c-muted)">${esc(r.activity)}</span>${typeChip(r.model, 8.5)}</div>
        </div>
        <div style="flex:1"><div class="num" style="font-size:11.5px;font-weight:700">${r.id}</div><div style="font-size:9.5px;color:var(--c-faint);margin-top:1px">${esc(r.date)}</div></div>
        <div style="flex:1;font-size:10.5px;color:var(--c-muted)">${esc(r.city)} · <span class="num">${r.branchesN}</span> فروع</div>
        <div style="flex:1.4;min-width:0">
          <div style="font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.mgrName)}</div>
          <div style="font-size:9.5px;color:var(--c-faint);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" class="num">${esc(r.mgrContact)}</div>
        </div>
        <div class="num" style="flex:1;font-size:10.5px;font-weight:700;color:var(--c-purple)">${esc(r.monthly)}</div>
        <div style="width:150px">${chip(m.label, m.chip)}</div>
      </div>`;
  }).join('');

  return `
    <div class="flex-center" style="margin-bottom:14px">
      <div style="font-size:12px;color:var(--c-muted)">الطلبات الواردة من فورم <a href="register.html" target="_blank" style="color:var(--c-info);font-weight:800">«سجّل منشأتك»</a> العام — راجع واعتمد لإنشاء حساب العميل.</div>
      <div class="grow"></div>
      <button class="btn btn-primary btn-pill" style="height:42px;font-size:12px" data-action="openClientNew">${ICONS.plus('#fff', 13, 2.6)} إنشاء عميل</button>
    </div>
    <div class="card" style="overflow:hidden">
      <div class="table-head">
        <div style="flex:1.7">المنشأة · النشاط</div><div style="flex:1">الطلب</div><div style="flex:1">المدينة · الفروع</div>
        <div style="flex:1.4">مسؤول الحساب</div><div style="flex:1">مشتريات متوقعة</div><div style="width:150px">الحالة</div>
      </div>
      ${rows}
    </div>
    ${list.length === 0 ? `<div class="mt-14">${emptyState('لا طلبات تسجيل جديدة.')}</div>` : ''}
    <div class="banner-info-dashed mt-12">الاعتماد ينشئ حساب العميل فورًا بنوعه المطلوب وحد ائتماني افتتاحي 20,000 ر.س — والرفض يُشعر مسؤول الحساب.</div>`;
}

/** صفحة مراجعة طلب التسجيل الكاملة */
export function renderNcDet(st) {
  const r = (st.newClients || []).find((x) => x.id === st.ncSel);
  if (!r) return renderNewClients(st);
  const m = NC_STATUS[r.st] || NC_STATUS.pend;
  const sec = (n, title, body) => `
    <div class="card card-pad">
      <div class="flex-center gap-8" style="margin-bottom:13px">
        <div style="width:26px;height:26px;border-radius:9px;background:var(--c-info-bg);color:var(--c-info);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800">${n}</div>
        <div style="font-size:13px;font-weight:800">${title}</div>
      </div>${body}
    </div>`;
  const field = (l, v) => `
    <div>
      <div style="font-size:9.5px;color:var(--c-faint);font-weight:700">${l}</div>
      <div style="font-size:12px;font-weight:800;margin-top:3px;line-height:1.7">${v || '—'}</div>
    </div>`;

  return `
    <div class="flex-center gap-10" style="margin-bottom:14px">
      <button class="btn" style="height:38px;padding:0 16px;border-radius:999px;background:#fff;border:1px solid var(--c-divider);font-size:11.5px;font-weight:800" data-action="closeNcDet">→ كل الطلبات</button>
      <div class="grow"></div>
      ${r.st === 'pend' ? `
        <button class="btn btn-danger-outline" style="height:42px;padding:0 20px;border-radius:11px;font-size:12px" data-action="ncReject" data-arg="${r.id}">رفض الطلب</button>
        <button class="btn btn-success-solid" style="height:42px;padding:0 24px;border-radius:11px;font-size:12px" data-action="ncApprove" data-arg="${r.id}">اعتماد — إنشاء حساب العميل</button>` : ''}
      ${r.st === 'ok' && r.clientId ? `<button class="btn btn-primary" style="height:42px;padding:0 22px;border-radius:11px;font-size:12px" data-action="openClientProfile" data-arg="${r.clientId}">فتح ملف العميل ←</button>` : ''}
    </div>
    <div class="card card-pad" style="margin-bottom:14px">
      <div class="flex-center gap-10 wrap">
        <div>
          <div class="flex-center gap-8"><div style="font-size:17px;font-weight:800">${esc(r.name)}</div>${typeChip(r.model)}</div>
          <div style="font-size:10.5px;color:var(--c-muted);margin-top:5px"><span class="num">${r.id}</span> · وصل ${esc(r.date)} · ${esc(r.activity)}</div>
        </div>
        <div class="grow"></div>
        ${chip(m.label, m.chip)}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">
      ${sec('١', 'بيانات المنشأة', `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          ${field('نوع النشاط', esc(r.activity))}
          ${field('نموذج التشغيل', typeChip(r.model))}
          ${field('المدينة · مدن التغطية', `${esc(r.city)}${r.cities ? ` — ${esc(r.cities)}` : ''}`)}
          ${field('عدد الفروع', `<span class="num">${r.branchesN}</span> فروع`)}
        </div>`)}
      ${sec('٢', 'البيانات النظامية', `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          ${field('السجل التجاري', `<span class="num">${esc(r.cr) || '—'}</span>`)}
          ${field('الرقم الضريبي (VAT)', `<span class="num">${esc(r.vat) || '—'}</span>`)}
        </div>
        <div style="margin-top:13px">
          <div style="font-size:9.5px;color:var(--c-faint);font-weight:700;margin-bottom:7px">المستندات المرفقة</div>
          ${(r.docs || []).length
            ? `<div class="flex gap-7 wrap">${r.docs.map((d) => `<span class="flex-center gap-6" style="height:30px;padding:0 12px;border-radius:999px;background:var(--c-info-bg);border:1px solid #B5E7F0;color:var(--c-info);font-size:10.5px;font-weight:800;cursor:pointer">📄 ${esc(d)}</span>`).join('')}</div>`
            : '<div style="font-size:11px;color:var(--c-warn-deep);background:var(--c-warn-bg);border:1px dashed var(--c-warn-border);border-radius:10px;padding:9px 13px">لا مستندات مرفقة — اطلبها من مسؤول الحساب قبل الاعتماد.</div>'}
        </div>`)}
      ${sec('٣', 'مسؤول الحساب', `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          ${field('الاسم · الصفة', `${esc(r.mgrName)}${r.mgrRole ? ` · <span style="color:var(--c-muted);font-weight:700">${esc(r.mgrRole)}</span>` : ''}`)}
          ${field('التواصل', `<span class="num">${esc(r.mgrContact)}</span>`)}
        </div>`)}
      ${sec('٤', 'احتياجات التوريد', `
        <div class="flex gap-7 wrap" style="margin-bottom:13px">
          ${(r.cats || []).map((c) => `<span style="height:28px;display:inline-flex;align-items:center;padding:0 12px;border-radius:999px;background:var(--c-subtle);font-size:10.5px;font-weight:800;color:var(--c-purple)">${esc(c)}</span>`).join('') || '—'}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          ${field('متوسط المشتريات الشهرية', `<span class="num" style="color:var(--c-purple)">${esc(r.monthly)}</span>`)}
          ${field('الدفع · نوافذ الاستلام', esc(r.payment))}
        </div>`)}
    </div>`;
}

// ============ الأنواع واليوزرات (v5): مصفوفة صلاحيات مُصدَّرة ============

export function renderRolesMatrix(st) {
  const all = st.rolesMatrix || [];
  const draft = all.find((m) => m.draft);
  const cur = all.find((m) => m.cur);
  const active = draft || cur;
  if (!active) return emptyState('لا توجد مصفوفة صلاحيات بعد.');
  const cells = active.cells;

  const grid = `
    <div style="overflow-x:auto">
      <div style="min-width:860px">
        <div style="display:grid;grid-template-columns:200px repeat(8,1fr);gap:6px;margin-bottom:6px">
          <div></div>
          ${RM_COLS.map((c) => `<div style="font-size:9.5px;font-weight:800;color:var(--c-muted);text-align:center;line-height:1.5;align-self:end">${c}</div>`).join('')}
        </div>
        ${RM_ROWS.map((row, ri) => `
          <div style="display:grid;grid-template-columns:200px repeat(8,1fr);gap:6px;margin-bottom:6px">
            <div style="padding:8px 10px;border-radius:11px;background:var(--c-subtle)">
              <div style="font-size:11.5px;font-weight:800">${row.name}</div>
              <div style="font-size:9px;color:var(--c-faint);margin-top:1px;line-height:1.5">${row.desc}</div>
            </div>
            ${RM_COLS.map((_, ci) => {
              const mk = RM_MARKS[cells[ri]?.[ci]] || RM_MARKS.off;
              return `<button class="btn" title="${mk.tip}" style="height:100%;min-height:44px;border-radius:11px;font-size:14px;font-weight:800;${mk.style}" data-action="rmToggleCell" data-arg="${ri}|${ci}">${mk.sym}</button>`;
            }).join('')}
          </div>`).join('')}
      </div>
    </div>`;

  const legend = `
    <div class="flex gap-14 wrap" style="margin-top:13px">
      ${Object.values(RM_MARKS).map((m) => `
        <div class="flex-center gap-7">
          <span style="width:26px;height:26px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;${m.style}">${m.sym}</span>
          <span style="font-size:10.5px;font-weight:700;color:var(--c-muted)">${m.tip}</span>
        </div>`).join('')}
    </div>`;

  const hist = all.filter((m) => !m.draft).map((m) => `
    <div class="flex-center gap-10" style="padding:11px 4px;border-bottom:1px solid var(--c-divider)">
      <div class="num" style="font-size:12px;font-weight:700;color:var(--c-purple)">v${m.ver}</div>
      <div class="grow" style="min-width:0">
        <div style="font-size:11.5px;font-weight:700">${esc(m.note)}</div>
        <div style="font-size:9.5px;color:var(--c-faint);margin-top:1px">${esc(m.meta)}</div>
      </div>
      ${m.cur ? chip('المنشور حاليًا', 'chip-success') : ''}
    </div>`).join('');

  return `
    <div class="flex-center gap-10 wrap" style="margin-bottom:14px">
      <div>
        <div class="flex-center gap-8">
          ${chip(draft ? 'مسودة غير منشورة' : 'منشور وساري', draft ? 'chip-warn' : 'chip-success')}
          <div class="num" style="font-size:12px;font-weight:700;color:var(--c-muted)">v${active.ver}</div>
        </div>
        <div style="font-size:10.5px;color:var(--c-muted);margin-top:5px">${esc(active.meta)}</div>
      </div>
      <div class="grow"></div>
      ${draft ? `<button class="btn" style="height:42px;padding:0 18px;border-radius:11px;background:#fff;border:1px solid var(--c-divider);font-size:11.5px;font-weight:800;color:var(--c-danger)" data-action="rmDiscard">إهمال المسودة</button>` : ''}
      <button class="btn ${draft ? 'btn-primary' : ''}" style="height:42px;padding:0 24px;border-radius:11px;font-size:12px;${draft ? '' : 'background:var(--c-subtle);color:var(--c-faint);cursor:default'}" ${draft ? 'data-action="rmPublish"' : ''}>نشر الإصدار</button>
    </div>
    ${draft ? '<div style="background:var(--c-warn-bg);border:1px solid var(--c-warn-border);color:var(--c-warn-deep);border-radius:12px;padding:11px 15px;font-size:11.5px;font-weight:700;margin-bottom:14px">لديك تعديلات غير منشورة — لا تسري على الحسابات حتى تنشر الإصدار.</div>' : ''}
    <div class="card card-pad">
      <div class="card-title" style="margin-bottom:4px">مصفوفة الأنواع × اليوزرات</div>
      <div style="font-size:10.5px;color:var(--c-muted);margin-bottom:14px">اضغط أي خلية لتدوير صلاحيتها: ممكّن → جزئي → مدير الحساب → غير متاح.</div>
      ${grid}
      ${legend}
    </div>
    <div class="banner-info-dashed mt-12">وثيقة تشغيلية للمطورين أيضًا: كل إصدار منشور يقابل نسخة سياسة وصول (RBAC) في الخادم.</div>
    <div class="card card-pad mt-14">
      <div class="card-title" style="margin-bottom:8px">سجل الإصدارات</div>
      ${hist || '<div style="font-size:11px;color:var(--c-muted)">لا إصدارات سابقة.</div>'}
    </div>`;
}
