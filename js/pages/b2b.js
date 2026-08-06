// ============================================================
// صفحات B2B وسواها: التذاكر، اقتراح المنتجات، العملاء، إدارة الكتالوج
// ============================================================
import { esc, ICONS } from '../core/dom.js';
import { fmt, fmt0, stripe } from '../core/format.js';
import { chip, filterChips, emptyState, prodThumb } from '../ui.js';
import { REQUEST_STATUS, CATEGORIES, CAN_REQUEST } from '../data/constants.js';
import { PRODUCTS } from '../data/products.js';
import { filterProducts } from './catalog.js';

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
  const hint = st.role === 'b2b'
    ? 'اقتراحات العملاء — راجع وسعّر أو ارفض؛ عند الموافقة يُضاف المنتج للكتالوج فورًا.'
    : 'اقتراحاتك تصل لفريق B2B — يراجعها ويسعّرها خلال يوم عمل.';

  const cards = st.prodReqs.map((r) => {
    const m = REQUEST_STATUS[r.st];
    // اعتماد السعر لمقدّم الاقتراح (الأدوار العميلة المالكة) عندما يكون مُسعّرًا
    const clientCanDecide = r.st === 'priced' && ['owner', 'fr', 'frz', 'frzs'].includes(st.role);
    return `
      <div class="card card-pad">
        <div class="flex-center gap-8">
          <div class="grow" style="font-size:13px;font-weight:800">${esc(r.name)}</div>
          ${chip(m.label, m.chip)}
        </div>
        <div style="font-size:10.5px;color:var(--c-muted);margin-top:6px"><span class="num">${r.id}</span> · ${esc(r.date)} · ${esc(r.by)} — ${esc(r.user || '')}</div>
        <div style="font-size:11px;color:var(--c-faint);margin-top:4px;line-height:1.8">«${esc(r.note)}»</div>
        ${r.price != null && r.st !== 'pend' ? `
          <div class="flex-center gap-7" style="background:var(--c-info-bg);border:1px solid #B5E7F0;border-radius:11px;padding:9px 13px;margin-top:10px">
            <div style="font-size:11px;font-weight:800;color:var(--c-info)">سعر B2B المقترح</div>
            <div class="grow"></div>
            <div class="num" style="font-size:14px;font-weight:700;color:var(--c-info)">${fmt(r.price)} <span style="font-size:9px;font-family:var(--font-ar)">ر.س</span></div>
          </div>` : ''}
        ${st.role === 'b2b' && r.st === 'pend' ? `
          <div class="flex gap-8 mt-12">
            <button class="btn btn-primary" style="flex:1.5;height:42px;border-radius:11px;font-size:11.5px" data-action="approveRequest" data-arg="${r.id}">تسعير وإرسال للعميل</button>
            <button class="btn btn-danger-outline" style="width:90px;height:42px;border-radius:11px;font-size:11.5px" data-action="rejectRequest" data-arg="${r.id}">رفض</button>
          </div>` : ''}
        ${clientCanDecide ? `
          <div class="flex gap-8 mt-12">
            <button class="btn btn-success-solid" style="flex:1.5;height:42px;border-radius:11px;font-size:11.5px" data-action="clientAcceptReq" data-arg="${r.id}">اعتماد السعر — إضافة في منتجاتي</button>
            <button class="btn btn-danger-outline" style="width:110px;height:42px;border-radius:11px;font-size:11.5px" data-action="clientDeclineReq" data-arg="${r.id}">رفض السعر</button>
          </div>` : ''}
      </div>`;
  }).join('');

  // متصفح الكتالوج المدمج للتحقق قبل الاقتراح
  const reqCat = st.reqCat || 'الكل';
  const catRows = filterProducts(st.reqSearch, reqCat);

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
          <div class="card-title">تصفح الكتالوج</div>
          <div style="font-size:10.5px;color:var(--c-muted);margin-top:2px">تأكد أن المنتج غير متوفر قبل اقتراحه.</div>
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
          <div class="flex-center gap-9" style="border:1px solid var(--c-divider);border-radius:14px;padding:9px">
            ${prodThumb(p, 44)}
            <div class="grow" style="min-width:0">
              <div style="font-size:11px;font-weight:800;line-height:1.5">${esc(p.name)}</div>
              <div style="font-size:9.5px;color:var(--c-faint);margin-top:1px">${esc(p.unit)}</div>
            </div>
          </div>`).join('')}
      </div>
      ${catRows.length === 0 ? `
        <div style="text-align:center;padding:26px;color:var(--c-muted);font-size:12px;border:1px dashed #DDD9E6;border-radius:14px;margin-top:14px">
          غير موجود في الكتالوج${canReq ? ' — <span style="color:var(--c-info);font-weight:800;cursor:pointer;text-decoration:underline" data-action="openReqNew">اقترحه الآن</span>' : ''}.
        </div>` : ''}
    </div>`;
}

export function renderClients(st) {
  const rows = st.clients.map((c) => {
    const ok = c.st === 'ok';
    return `
      <div class="table-row clickable" data-action="openClientProfile" data-arg="${c.id}">
        <div style="flex:1.6;font-size:12.5px;font-weight:800">${esc(c.name)}</div>
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
    <div class="card" style="overflow:hidden">
      <div class="table-head">
        <div style="flex:1.6">المنشأة</div><div style="flex:1">المدينة · السجل</div><div style="flex:.7">طلبات</div>
        <div style="flex:1">مشتريات يوليو</div><div style="flex:.9">المحفظة</div><div style="width:120px">الحالة</div><div style="width:150px"></div>
      </div>
      ${rows}
    </div>
    <div class="banner-info-dashed mt-12">إيقاف العميل يمنع منشأته كاملة من إرسال طلبات جديدة فورًا — ويظهر له بانر التوقيف في تطبيقه.</div>`;
}

export function renderCatalogAdmin() {
  return `
    <div class="card" style="overflow:hidden">
      <div class="table-head">
        <div style="width:52px"></div><div style="flex:1.7">المنتج</div><div style="flex:1">الوحدة</div>
        <div style="flex:.9">القسم</div><div style="flex:.8">السعر</div><div style="width:150px"></div>
      </div>
      ${PRODUCTS.map((p) => `
        <div class="table-row" style="padding:10px 18px">
          <div style="width:52px"><div class="prod-thumb" style="width:40px;height:40px;background:${stripe(p.h)}">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}</div></div>
          <div style="flex:1.7;font-size:12px;font-weight:800">${esc(p.name)}</div>
          <div style="flex:1;font-size:10.5px;color:var(--c-muted)">${esc(p.unit)}</div>
          <div style="flex:.9;font-size:10.5px;color:var(--c-muted)">${esc(p.cat)}</div>
          <div class="num" style="flex:.8;font-size:12px;font-weight:700">${fmt(p.price)}</div>
          <div style="width:150px;display:flex;justify-content:flex-end">
            <button class="btn btn-xs ${p.out ? 'btn-success-solid' : 'btn-warn-outline'}" style="border-width:1px" data-action="toggleProductAvailability" data-arg="${p.id}">${p.out ? 'إعادة توفير' : 'إيقاف مؤقت'}</button>
          </div>
        </div>`).join('')}
    </div>`;
}
