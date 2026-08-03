// ============================================================
// طبقات الجوال السفلية (Bottom Sheets): السلة، الأسباب، الإشعارات،
// لستة جديدة، اقتراح منتج، إضافة فرع بموقع
// ============================================================
import { esc, ICONS } from '../core/dom.js';
import { fmt } from '../core/format.js';
import { prodThumb, chip, input, pinIcon } from '../ui.js';
import { findOrder } from '../actions.js';
import { NOTIF_CHIP } from '../data/constants.js';
import { PRODUCTS, PRODUCT_MAP } from '../data/products.js';
import { showPricesFor } from '../pages/catalog.js';
import { BASE_NOTIFS } from '../data/seed.js';

function sheet(inner, { scroll = false } = {}) {
  return `
    <div class="m-sheet-wrap">
      <div class="overlay" data-action="closeAll"></div>
      <div class="m-sheet">${inner}</div>
    </div>`;
}

function cartSheet(st) {
  const ids = Object.keys(st.cart);
  const showPrices = showPricesFor(st.role);
  const sub = ids.reduce((s, id) => s + PRODUCT_MAP[id].price * st.cart[id], 0);
  return sheet(`
    <div class="flex-center gap-10" style="flex:none;padding:14px 20px 8px">
      <div class="grow" style="font-size:16px;font-weight:800">السلة</div>
      <div style="height:32px;display:flex;align-items:center;padding:0 11px;background:var(--c-chip-bg);border-radius:999px;font-size:10.5px;font-weight:800;color:var(--c-info)">التسليم: فرع العليا</div>
      <div style="width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer" data-action="closeAll">${ICONS.close('#7d7990', 14)}</div>
    </div>
    <div class="m-sheet-body" style="padding:0 20px">
      ${ids.map((id) => {
        const p = PRODUCT_MAP[id];
        const qty = st.cart[id];
        return `
        <div class="flex-center gap-11" style="padding:11px 0;border-bottom:1px solid var(--c-divider)">
          ${prodThumb(p, 44)}
          <div class="grow" style="min-width:0">
            <div style="font-size:12px;font-weight:700">${esc(p.name)}</div>
            <div style="font-size:10px;color:var(--c-faint);margin-top:2px">${esc(p.unit)}${showPrices ? `<span class="num" style="font-weight:700;color:var(--c-muted)"> · ${fmt(p.price * qty)} ر.س</span>` : ''}</div>
          </div>
          <div class="stepper">
            <button class="stepper-btn" style="width:44px;height:44px" data-action="cartInc" data-arg="${id}">${ICONS.plus('#0d7f93', 13, 2.4)}</button>
            <div class="num" style="width:24px;text-align:center;font-size:13.5px;font-weight:700">${qty}</div>
            <button class="stepper-btn" style="width:44px;height:44px" data-action="cartDec" data-arg="${id}">${ICONS.minus('#0d7f93', 13)}</button>
          </div>
        </div>`;
      }).join('')}
      ${ids.length === 0 ? '<div style="text-align:center;padding:32px;color:var(--c-faint);font-size:12px">السلة فارغة — أضف من الكتالوج.</div>' : ''}
    </div>
    <div style="flex:none;padding:12px 20px calc(26px + env(safe-area-inset-bottom));border-top:1px solid var(--c-divider)">
      ${showPrices
        ? `<div class="flex" style="font-size:11px;color:var(--c-muted)"><div>المجموع + الضريبة 15%</div><div class="grow"></div><div class="num" style="font-weight:700;font-size:14px;color:var(--c-ink)">${fmt(sub * 1.15)} ر.س</div></div>`
        : '<div style="font-size:10.5px;color:var(--c-faint)">تُعرض الأسعار والإجماليات للمعتمدين في سلسلة التعميد.</div>'}
      <button class="btn btn-primary btn-block m-btn mt-10" data-action="submitOrder">إرسال الطلب للتعميد</button>
      <div style="font-size:10px;color:var(--c-faint);text-align:center;margin-top:8px">يمر الطلب على تعميد العمليات ثم المشتريات قبل وصوله إلى B2B.</div>
    </div>`);
}

function reasonSheet(st) {
  const M = st.modal;
  const isRej = M.k === 'reject';
  const isHold = M.k === 'hold';
  const title = isRej ? `رفض الطلب ${M.id}` : isHold ? `تعليق الطلب ${M.id}` : `تعليق التذكرة ${M.id}`;
  const field = isRej ? 'rejectText' : isHold ? 'holdText' : 'tHoldText';
  const text = st[field] || '';
  const confirmAction = isRej ? 'confirmReject' : isHold ? 'confirmHold' : 'confirmTicketHold';
  const color = isRej ? 'var(--c-danger)' : 'var(--c-warn)';
  return sheet(`
    <div class="m-sheet-pad">
      <div style="font-size:16px;font-weight:800">${esc(title)}</div>
      <div style="font-size:11px;color:var(--c-muted);margin-top:3px">${isRej ? 'السبب إلزامي — يصل نصًا لمقدّم الطلب ليعدّل ويعيد الإرسال.' : 'السبب إلزامي — يظهر للعميل فورًا، ويمكن الاستئناف في أي وقت.'}</div>
      <textarea class="textarea mt-12" data-input="${field}" data-key="m-${field}" placeholder="${isRej ? 'مثال: تجاوز ميزانية الأسبوع للفرع — قلّل كمية الدجاج إلى ٤ كراتين.' : 'مثال: صنفان غير متوفرين حاليًا — بانتظار شحنة الغد صباحًا.'}">${esc(text)}</textarea>
      <div class="flex gap-9 mt-12">
        <button class="btn grow ${text.trim().length >= 5 ? '' : 'disabled'}" style="background:${color};color:#fff;height:50px;border-radius:14px;font-size:13.5px" data-action="${confirmAction}">${isRej ? 'تأكيد الرفض' : 'تأكيد التعليق'}</button>
        <button class="btn btn-ghost" style="width:110px;height:50px;border-radius:14px;font-size:13px" data-action="closeAll">إلغاء</button>
      </div>
    </div>`);
}

function notifSheet(st) {
  const notifs = [...((st.extraNotifs || {})[st.role] || []), ...(BASE_NOTIFS[st.role] || [])];
  return sheet(`
    <div class="flex-center" style="flex:none;padding:16px 20px 8px">
      <div class="grow" style="font-size:16px;font-weight:800">الإشعارات</div>
      <div style="font-size:11px;font-weight:800;color:var(--c-info);cursor:pointer;padding:10px" data-action="markAllRead">تعليم الكل كمقروء</div>
    </div>
    <div class="m-sheet-body" style="padding:0 20px calc(28px + env(safe-area-inset-bottom))">
      ${notifs.map((n) => `
        <div class="flex gap-10" style="padding:13px 0;border-bottom:1px solid var(--c-divider)">
          <div style="align-self:flex-start">${chip(n.c, NOTIF_CHIP[n.c] || 'chip-purple')}</div>
          <div class="grow">
            <div style="font-size:12px;font-weight:700;line-height:1.7">${esc(n.text)}</div>
            <div style="font-size:10px;color:var(--c-faint);margin-top:3px">${esc(n.t)}</div>
          </div>
        </div>`).join('')}
    </div>`);
}

function listNewSheet(st) {
  const lq = st.lnQty || {};
  const count = Object.keys(lq).length;
  const ready = (st.lnName || '').trim() && count;
  return sheet(`
    <div style="flex:none;padding:18px 20px 0">
      <div style="font-size:16px;font-weight:800">لستة جديدة</div>
      <div style="font-size:11px;color:var(--c-muted);margin-top:3px">${count ? `${count} أصناف مختارة` : 'اختر الأصناف والكميات'} — تُحفظ وتظهر لكل مستخدمي فرعك.</div>
      ${input('lnName', st.lnName, 'اسم اللستة — مثال: طلبية نهاية الأسبوع', { extra: 'style="height:50px;margin-top:12px;border-radius:14px"' })}
    </div>
    <div class="m-sheet-body" style="padding:10px 20px 0">
      ${PRODUCTS.map((p) => {
        const qty = lq[p.id] || 0;
        return `
        <div class="flex-center gap-10" style="padding:9px 0;border-bottom:1px solid var(--c-divider)">
          <div class="grow" style="min-width:0">
            <div style="font-size:12px;font-weight:700">${esc(p.name)}</div>
            <div style="font-size:9.5px;color:var(--c-faint);margin-top:1px">${esc(p.unit)}</div>
          </div>
          <div class="stepper">
            <button class="stepper-btn" style="width:44px;height:44px" data-action="listInc" data-arg="${p.id}">${ICONS.plus('#0d7f93', 13, 2.4)}</button>
            <div class="num" style="width:24px;text-align:center;font-size:13.5px;font-weight:700;color:${qty > 0 ? '#0d7f93' : '#C9C5D6'}">${qty}</div>
            <button class="stepper-btn" style="width:44px;height:44px" data-action="listDec" data-arg="${p.id}">${ICONS.minus('#0d7f93', 13)}</button>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="flex gap-9" style="flex:none;padding:12px 20px calc(26px + env(safe-area-inset-bottom));border-top:1px solid var(--c-divider)">
      <button class="btn btn-primary grow ${ready ? '' : 'disabled'}" style="height:50px;border-radius:14px;font-size:13.5px" data-action="saveList">حفظ اللستة</button>
      <button class="btn btn-ghost" style="width:110px;height:50px;border-radius:14px;font-size:13px" data-action="closeAll">إلغاء</button>
    </div>`);
}

function reqNewSheet(st) {
  const ready = (st.reqName || '').trim();
  return sheet(`
    <div class="m-sheet-pad">
      <div style="font-size:16px;font-weight:800">اقتراح منتج جديد</div>
      <div style="font-size:11px;color:var(--c-muted);margin-top:3px">يصل الاقتراح لفريق B2B — وعند الموافقة يُضاف للكتالوج ويُشعرك.</div>
      ${input('reqName', st.reqName, 'اسم المنتج — مثال: صوص باربكيو', { extra: 'style="height:50px;margin-top:14px;border-radius:14px"' })}
      ${input('reqUnit', st.reqUnit, 'الوحدة المطلوبة — مثال: جالون 3.78 لتر (اختياري)', { extra: 'style="height:50px;margin-top:9px;border-radius:14px"' })}
      <textarea class="textarea mt-9" style="min-height:84px;border-radius:14px" data-input="reqNote" data-key="m-reqNote" placeholder="ملاحظة تساعد الفريق — الاستخدام، الكمية المتوقعة أسبوعيًا… (اختياري)">${esc(st.reqNote)}</textarea>
      <div class="flex gap-9" style="margin-top:13px">
        <button class="btn btn-primary grow ${ready ? '' : 'disabled'}" style="height:50px;border-radius:14px;font-size:13.5px" data-action="submitRequest">إرسال الاقتراح</button>
        <button class="btn btn-ghost" style="width:110px;height:50px;border-radius:14px;font-size:13px" data-action="closeAll">إلغاء</button>
      </div>
    </div>`);
}

/** إضافة فرع (جوال) — اسم + موقع خريطة إلزامي */
function branchNewSheet(st) {
  const ready = (st.brName || '').trim() && st.brLoc;
  return sheet(`
    <div class="m-sheet-pad">
      <div style="font-size:16px;font-weight:800">إضافة فرع</div>
      <div style="font-size:11px;color:var(--c-muted);margin-top:3px">اسم الفرع + موقعه على الخريطة (<b style="color:var(--c-warn)">إلزامي</b>).</div>
      ${input('brName', st.brName, 'اسم الفرع — مثال: فرع الياسمين', { extra: 'style="height:50px;margin-top:14px;border-radius:14px"' })}
      <div class="flex-center gap-8 mt-9" style="height:50px;border-radius:14px;border:1.5px dashed ${st.brLoc ? 'var(--c-success-border)' : '#D8D4E2'};background:var(--c-subtle);padding:0 14px;cursor:pointer" data-action="openMapPickBr">
        ${pinIcon(st.brLoc ? '#1d7a3e' : '#7d7990', 16)}
        <div class="grow" style="font-size:12px;font-weight:800;color:${st.brLoc ? 'var(--c-success)' : 'var(--c-muted)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${st.brLoc ? `${esc(st.brLoc.addr)} · ${esc(st.brLoc.coords)}` : 'موقع الفرع على الخريطة'}</div>
        <div style="font-size:10.5px;font-weight:800;color:var(--c-info)">${st.brLoc ? 'تغيير' : 'فتح الخريطة'}</div>
      </div>
      <div class="flex gap-9" style="margin-top:13px">
        <button class="btn btn-primary grow ${ready ? '' : 'disabled'}" style="height:50px;border-radius:14px;font-size:13.5px" data-action="addBranch">إضافة الفرع</button>
        <button class="btn btn-ghost" style="width:110px;height:50px;border-radius:14px;font-size:13px" data-action="closeAll">إلغاء</button>
      </div>
    </div>`);
}

const SHEETS = {
  cart: cartSheet,
  reject: reasonSheet,
  hold: reasonSheet,
  tHold: reasonSheet,
  listNew: listNewSheet,
  reqNew: reqNewSheet,
  brNewM: branchNewSheet,
};

/** يعيد HTML الطبقة السفلية إن كانت الحالة تستدعيها (وإلا null) */
export function renderMSheet(st) {
  if (st.notifOpen) return notifSheet(st);
  if (st.modal && SHEETS[st.modal.k]) return SHEETS[st.modal.k](st);
  return null;
}

export const SHEET_KINDS = Object.keys(SHEETS);
