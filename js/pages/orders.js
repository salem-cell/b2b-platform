// ============================================================
// الطلبات + التعميدات
// ============================================================
import { esc } from '../core/dom.js';
import { fmt } from '../core/format.js';
import { filterChips, orderChip, emptyState } from '../ui.js';
import { orderTotal } from '../actions.js';
import { ORDER_FILTERS } from '../data/constants.js';
import { showPricesFor } from './catalog.js';

/** زر الإجراء المضمّن حسب الدور وحالة الطلب */
export function rowAction(st, o) {
  if (st.role === 'ops' && o.st === 'ops')                          return { label: 'فتح التعميد',      action: 'openApprove', arg: o.id };
  if ((st.role === 'owner' || st.role === 'frz') && o.st === 'purch') return { label: 'التعميد النهائي', action: 'openApprove', arg: o.id };
  if (st.role === 'worker' && o.st === 'ship')                      return { label: 'بدء الاستلام',     action: 'openReceive', arg: o.id };
  if (st.role === 'b2b' && o.st === 'b2b')                          return { label: 'إرسال للتوصيل',    action: 'b2bAdvance',  arg: o.id };
  if (st.role === 'b2b' && o.st === 'hold')                         return { label: 'استئناف التجهيز',  action: 'resumeOrder', arg: o.id };
  return null;
}

export function renderOrders(st) {
  const showPrices = showPricesFor(st.role);
  const fset = ORDER_FILTERS[st.ordFilter];
  const orders = st.orders.filter((o) => !fset || fset.includes(o.st));

  const rows = orders.map((o) => {
    const act = rowAction(st, o);
    return `
      <div class="table-row clickable" data-action="openOrderDrawer" data-arg="${o.id}">
        <div class="num" style="flex:1.1;font-size:12.5px;font-weight:700">${o.id}</div>
        <div style="flex:1.6;font-size:11px;color:var(--c-muted)">${esc(o.by)} · ${esc(o.branch)}</div>
        <div style="flex:1;font-size:10.5px;color:var(--c-faint)">${esc(o.date)}</div>
        <div class="num" style="flex:.7;font-size:11.5px;color:var(--c-muted)">${o.items.length}</div>
        ${showPrices ? `<div class="num" style="flex:1;font-size:12px;font-weight:700">${fmt(orderTotal(o))} <span style="font-size:9px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div>` : ''}
        <div style="width:170px">${orderChip(o.st)}</div>
        <div style="width:130px;display:flex;justify-content:flex-end">
          ${act ? `<button class="btn btn-primary btn-sm" data-action="${act.action}" data-arg="${act.arg}">${act.label}</button>` : ''}
        </div>
      </div>`;
  }).join('');

  return `
    ${filterChips(Object.keys(ORDER_FILTERS), st.ordFilter, 'setOrdFilter')}
    <div class="card mt-14" style="overflow:hidden">
      <div class="table-head">
        <div style="flex:1.1">الطلب</div><div style="flex:1.6">مقدّم الطلب · الفرع</div><div style="flex:1">التاريخ</div>
        <div style="flex:.7">الأصناف</div>${showPrices ? '<div style="flex:1">الإجمالي</div>' : ''}
        <div style="width:170px">الحالة</div><div style="width:130px"></div>
      </div>
      ${rows}
    </div>
    ${orders.length === 0 ? `<div class="mt-14">${emptyState('لا طلبات ضمن هذا الفلتر.')}</div>` : ''}`;
}

export function renderApprovals(st) {
  const opsPend = st.orders.filter((o) => o.st === 'ops');
  const purchPend = st.orders.filter((o) => o.st === 'purch');
  const queue = st.role === 'ops' ? opsPend : st.role === 'b2b' ? [...opsPend, ...purchPend] : purchPend;

  const hint = st.role === 'ops'
    ? 'الطلبات التي تنتظر تعميدك قبل تمريرها لمدير المشتريات — يمكنك تعديل الكميات أو الرفض بسبب إلزامي.'
    : st.role === 'b2b'
      ? 'صلاحية سوبر أدمن — تطّلع على كل التعميدات المعلقة لدى العملاء ويمكنك التعميد أو الرفض نيابة عنهم في أي مرحلة.'
      : 'التعميد النهائي — بعد اعتمادك يُرسل الطلب إلى B2B للتجهيز.';

  const cards = queue.map((o) => `
    <div class="card card-pad">
      <div class="flex-center gap-8">
        <div class="num" style="font-size:14px;font-weight:700">${o.id}</div>
        ${orderChip(o.st)}
        <div class="grow"></div>
        <div style="font-size:10.5px;color:var(--c-faint)">${esc(o.date)}</div>
      </div>
      <div style="font-size:11.5px;color:var(--c-muted);margin-top:7px">
        ${esc(o.by)} · ${esc(o.branch)} · ${o.items.length} أصناف ·
        <span class="num" style="font-weight:700;color:var(--c-ink)">${fmt(orderTotal(o))}</span> ر.س
      </div>
      <div class="flex gap-8" style="margin-top:13px">
        <button class="btn btn-primary" style="flex:1.5;height:42px;border-radius:11px;font-size:12px" data-action="openApprove" data-arg="${o.id}">
          ${o.st === 'ops' ? 'فتح التعميد' : 'التعميد النهائي'}
        </button>
        <button class="btn btn-soft grow" style="height:42px;border-radius:11px;font-size:12px" data-action="openOrderDrawer" data-arg="${o.id}">التفاصيل</button>
      </div>
    </div>`).join('');

  return `
    <div class="section-hint">${hint}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px">${cards}</div>
    ${queue.length === 0 ? emptyState('لا طلبات بانتظار التعميد — أحسنت.') : ''}`;
}
