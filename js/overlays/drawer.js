// ============================================================
// درج تفاصيل الطلب (يفتح من يسار الشاشة في RTL)
// رحلة 6 خطوات + الأصناف + الإجراءات حسب الدور
// ============================================================
import { esc } from '../core/dom.js';
import { fmt } from '../core/format.js';
import { orderChip, prodThumb, closeBtn, chip } from '../ui.js';
import { findOrder } from '../actions.js';
import { ORDER_STEPS, ORDER_STEPS_EN, STEP_INDEX, POLICY } from '../data/constants.js';
import { PRODUCT_MAP } from '../data/products.js';
import { showPricesFor } from '../pages/catalog.js';

function timeline(o) {
  const idx = STEP_INDEX[o.st];
  return ORDER_STEPS.map((label, i) => {
    let mode = 'wait';
    if (o.st === 'rej') mode = i < o.rejAt ? 'done' : (i === o.rejAt ? 'rej' : 'wait');
    else if (i < idx) mode = 'done';
    else if (i === idx && o.st !== 'done' && o.st !== 'short') mode = 'now';
    const labelColor = mode === 'wait' ? 'var(--c-faint)' : mode === 'rej' ? 'var(--c-danger)' : 'var(--c-ink)';
    return `
      <div class="timeline-step">
        <div class="timeline-rail">
          <div class="timeline-dot ${mode}"></div>
          ${i < ORDER_STEPS.length - 1 ? `<div class="timeline-line ${mode === 'done' ? 'done' : ''}"></div>` : ''}
        </div>
        <div class="flex grow" style="padding-bottom:14px;align-items:flex-start">
          <div>
            <div class="timeline-label" style="color:${labelColor}">${label}</div>
            ${POLICY.statusEnglish ? `<div class="timeline-en">${ORDER_STEPS_EN[i]}</div>` : ''}
          </div>
          <div class="grow"></div>
          <div class="timeline-stamp">${mode === 'rej' ? 'رُفض هنا' : (o.stamps[i] || '')}</div>
        </div>
      </div>`;
  }).join('');
}

/** بانرات أعلى الدرج: تعليق / رفض / تذكرة مرتبطة */
function drawerBanners(st, o) {
  const parts = [];
  if (o.st === 'hold') {
    parts.push(`
      <div class="banner banner-warn" style="margin-bottom:14px">
        <div class="banner-title">الطلب معلق لدى B2B</div>
        <div class="banner-text">${esc(o.holdReason || '')}</div>
      </div>`);
  }
  if (o.st === 'rej') {
    parts.push(`
      <div class="banner banner-danger" style="margin-bottom:14px">
        <div class="banner-title">سبب الرفض</div>
        <div class="banner-text">${esc(o.reason || '')}</div>
      </div>`);
  }
  if (o.ticket) {
    const tk = st.tickets.find((x) => x.id === o.ticket);
    const chipHtml = tk
      ? (tk.st === 'open' ? chip('قيد المعالجة', 'chip-plain') : tk.st === 'held' ? chip('معلقة', 'chip-danger') : chip(`حُلّت — ${tk.cn || ''}`, 'chip-success'))
      : chip('قيد المعالجة', 'chip-plain');
    const sub = tk
      ? (tk.st === 'held' ? `علّقها B2B: ${tk.holdReason || ''}` : tk.st === 'resolved' ? `صدر إشعار دائن ${tk.cn || ''} في محفظتكم` : 'لدى B2B الآن — اضغط لعرض التفاصيل')
      : 'أُرسلت إلى B2B.';
    parts.push(`
      <div class="banner banner-warn flex-center gap-10" style="margin-bottom:14px;cursor:pointer" data-action="openTicket" data-arg="${esc(o.ticket)}">
        <div class="grow">
          <div class="flex-center wrap" style="gap:6px 8px">
            <div class="banner-title" style="white-space:nowrap">تذكرة نواقص <span class="num">${esc(o.ticket)}</span></div>
            ${chipHtml}
          </div>
          <div style="font-size:11px;line-height:1.8;color:var(--c-warn-deep);margin-top:3px">${esc(sub)}</div>
        </div>
      </div>`);
  }
  return parts.join('');
}

/** أزرار الإجراء أسفل الدرج حسب الدور والحالة */
function drawerActions(st, o) {
  const parts = [];
  const canApprove = (o.st === 'ops' && st.role === 'ops')
    || (o.st === 'purch' && (st.role === 'owner' || st.role === 'frz'))
    || ((o.st === 'ops' || o.st === 'purch') && st.role === 'b2b');

  if (canApprove) parts.push(`<button class="btn btn-primary btn-block mt-14" data-action="openApprove" data-arg="${o.id}">فتح شاشة التعميد</button>`);
  if (o.st === 'ship' && st.role === 'worker') parts.push(`<button class="btn btn-primary btn-block mt-14" data-action="openReceive" data-arg="${o.id}">بدء الاستلام</button>`);
  if (o.st === 'b2b' && st.role === 'b2b') {
    parts.push(`<button class="btn btn-primary btn-block mt-14" data-action="b2bAdvance" data-arg="${o.id}">جاهز — إرسال للتوصيل</button>`);
    parts.push(`
      <div class="flex gap-8 mt-10">
        <button class="btn btn-soft grow" style="height:44px;border-radius:12px;font-size:11.5px" data-action="openApprove" data-arg="${o.id}">تعديل الكميات</button>
        <button class="btn btn-warn-outline grow" style="height:44px;border-radius:12px;font-size:11.5px" data-action="openHold" data-arg="${o.id}">تعليق بسبب</button>
        <button class="btn btn-danger-outline grow" style="height:44px;border-radius:12px;font-size:11.5px" data-action="openReject" data-arg="${o.id}">رفض</button>
      </div>`);
  }
  if (o.st === 'hold' && st.role === 'b2b') {
    parts.push(`<button class="btn btn-warn btn-block mt-14" data-action="resumeOrder" data-arg="${o.id}">استئناف التجهيز</button>`);
    parts.push(`<button class="btn btn-danger-outline btn-block mt-10" style="height:46px;font-size:12.5px" data-action="openReject" data-arg="${o.id}">رفض الطلب — بسبب إلزامي</button>`);
  }
  return parts.join('');
}

export function renderDrawer(st) {
  if (!st.drawer || st.drawer.k !== 'order' || st.modal) return '';
  const o = findOrder(st.drawer.id);
  if (!o) return '';

  const showPrices = showPricesFor(st.role);
  const sub = o.items.reduce((s, i) => s + PRODUCT_MAP[i.pid].price * i.qty, 0);

  return `
    <div class="drawer-wrap">
      <div class="overlay" data-action="closeAll"></div>
      <div class="drawer">
        <div class="drawer-head">
          <div class="grow" style="min-width:0">
            <div class="num" style="font-size:17px;font-weight:700">${o.id}</div>
            <div style="font-size:10.5px;color:var(--c-muted);margin-top:2px">${esc(o.date)} · ${esc(o.by)} · ${esc(o.branch)}</div>
          </div>
          ${orderChip(o.st)}
          ${closeBtn()}
        </div>
        <div class="drawer-body">
          ${drawerBanners(st, o)}
          <div style="background:var(--c-subtle);border:1px solid var(--c-divider);border-radius:16px;padding:16px 18px">
            <div style="font-size:12.5px;font-weight:800;margin-bottom:13px">رحلة الطلب</div>
            ${timeline(o)}
          </div>
          <div style="border:1px solid var(--c-divider);border-radius:16px;overflow:hidden;margin-top:14px">
            ${o.items.map((i) => {
              const p = PRODUCT_MAP[i.pid];
              return `
              <div class="flex-center gap-11" style="padding:11px 16px;border-bottom:1px solid var(--c-divider)">
                ${prodThumb(p)}
                <div class="grow">
                  <div style="font-size:12px;font-weight:700">${esc(p.name)}</div>
                  <div style="font-size:10px;color:var(--c-faint);margin-top:2px">${esc(p.unit)} × <span class="num" style="font-weight:700">${i.qty}</span></div>
                </div>
                ${showPrices ? `<div class="num" style="font-size:12px;font-weight:700">${fmt(p.price * i.qty)}</div>` : ''}
              </div>`;
            }).join('')}
            ${showPrices ? `
              <div style="padding:13px 16px;background:var(--c-subtle)">
                <div class="flex" style="font-size:11px;color:var(--c-muted)"><div>المجموع</div><div class="grow"></div><div class="num">${fmt(sub)}</div></div>
                <div class="flex" style="font-size:11px;color:var(--c-muted);margin-top:5px"><div>الضريبة 15%</div><div class="grow"></div><div class="num">${fmt(sub * 0.15)}</div></div>
                <div class="flex" style="font-size:13.5px;font-weight:800;margin-top:7px"><div>الإجمالي</div><div class="grow"></div><div class="num">${fmt(sub * 1.15)} <span style="font-size:9.5px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div></div>
              </div>` : ''}
          </div>
          ${drawerActions(st, o)}
        </div>
      </div>
    </div>`;
}
