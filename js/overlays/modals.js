// ============================================================
// النوافذ المنبثقة: السلة، التعميد، الرفض/التعليق، الاستلام، التذكرة،
// شحن المحفظة، ملف الممنوح، دعوة ممنوح، لستة جديدة، اقتراح منتج،
// إضافة مستخدم، تعديل مستخدم
// ============================================================
import { esc, ICONS } from '../core/dom.js';
import { fmt, fmt0 } from '../core/format.js';
import { chip, orderChip, prodThumb, closeBtn, input, stepper, mapSvgLarge, mapPinAt, pinIcon } from '../ui.js';
import { findOrder, locFromPin, orderTotal } from '../actions.js';
import { FRANCHISEE_STATUS, ROLES, CLIENT_TYPES, CLIENT_TYPE_SUB, CATEGORIES } from '../data/constants.js';
import { PRODUCT_MAP, PRODUCTS } from '../data/products.js';
import { showPricesFor } from '../pages/catalog.js';
import { ticketChip } from '../pages/b2b.js';

// ---------- السلة ----------
function cartModal(st) {
  const ids = Object.keys(st.cart);
  const showPrices = showPricesFor(st.role);
  const sub = ids.reduce((s, id) => s + PRODUCT_MAP[id].price * st.cart[id], 0);
  return `
    <div class="modal-head">
      <div class="modal-title grow">السلة</div>
      <div class="org-chip" style="font-size:10.5px;background:var(--c-chip-bg)">التسليم: فرع العليا</div>
      ${closeBtn()}
    </div>
    <div class="modal-body" style="padding:0 22px">
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
          ${stepper(qty, 'cartInc', 'cartDec', id)}
        </div>`;
      }).join('')}
      ${ids.length === 0 ? '<div style="text-align:center;padding:32px;color:var(--c-faint);font-size:12px">السلة فارغة — أضف من الكتالوج.</div>' : ''}
    </div>
    <div class="modal-foot">
      ${showPrices ? `<div class="flex" style="font-size:11px;color:var(--c-muted)"><div>المجموع + الضريبة 15%</div><div class="grow"></div><div class="num" style="font-weight:700;font-size:14px;color:var(--c-ink)">${fmt(sub * 1.15)} ر.س</div></div>` : ''}
      <button class="btn btn-primary btn-block mt-10" style="font-size:13.5px" data-action="submitOrder">إرسال الطلب للتعميد</button>
      <div class="flex-center" style="justify-content:center;gap:14px;margin-top:8px">
        <div style="font-size:10px;color:var(--c-faint)">يمر الطلب على تعميد العمليات ثم المشتريات.</div>
        <div style="font-size:10.5px;font-weight:800;color:var(--c-info);cursor:pointer;text-decoration:underline" data-action="saveCartAsList">حفظ السلة كلستة محفوظة</div>
      </div>
    </div>`;
}

// ---------- التعميد / تعديل الكميات ----------
function approveModal(st) {
  const o = findOrder(st.modal.id);
  const isB2bEdit = o.st === 'b2b' || o.st === 'hold';
  const total = o.items.reduce((s, i) => s + PRODUCT_MAP[i.pid].price * (st.approveQty[i.pid] || 0), 0) * 1.15;
  const btnLabel = o.st === 'ops' ? 'تعميد وتمرير لمدير المشتريات'
    : o.st === 'purch' ? 'التعميد النهائي والإرسال إلى B2B'
    : 'حفظ التعديل وإشعار العميل';
  return `
    <div class="modal-head">
      <div class="grow">
        <div class="modal-title">${isB2bEdit ? 'تعديل' : 'تعميد'} <span class="num">${o.id}</span></div>
        <div class="modal-sub">${esc(o.by)} · ${esc(o.branch)} — عدّل الكميات قبل الاعتماد؛ يُشعَر مقدّم الطلب بأي تغيير.</div>
      </div>
      ${closeBtn()}
    </div>
    <div class="modal-body">
      ${o.items.map((i) => {
        const p = PRODUCT_MAP[i.pid];
        const qty = st.approveQty[i.pid];
        return `
        <div class="flex-center gap-11" style="padding:10px 0;border-bottom:1px solid var(--c-divider);${qty === 0 ? 'opacity:.5' : ''}">
          ${prodThumb(p)}
          <div class="grow" style="min-width:0">
            <div style="font-size:11.5px;font-weight:700;${qty === 0 ? 'text-decoration:line-through' : ''}">${esc(p.name)}</div>
            <div style="font-size:9.5px;color:var(--c-faint);margin-top:2px">${esc(p.unit)}${qty !== i.qty ? '<span style="color:#c98a12;font-weight:800"> · عُدّلت</span>' : ''}${qty === 0 ? '<span style="color:var(--c-danger);font-weight:800"> · محذوف — يمكن إرجاعه</span>' : ''}</div>
          </div>
          ${stepper(qty, 'approveInc', 'approveDec', i.pid)}
        </div>`;
      }).join('')}
    </div>
    <div class="modal-foot">
      ${isB2bEdit && st.role === 'b2b' ? `
        <div style="background:var(--c-purple-soft);border:1px solid var(--c-purple-border);border-radius:11px;padding:9px 12px;margin-bottom:10px;font-size:10.5px;line-height:1.8;color:#55417E"><b>إصدار جزئي:</b> إنقاص أي كمية هنا يشحن المتوفر فورًا ويُنشئ تلقائيًا طلب نواقص تابعًا بالكميات الناقصة، يُرسل فور توفره بفاتورة مستقلة.</div>` : ''}
      <div class="flex" style="font-size:13px;font-weight:800"><div>الإجمالي بعد التعديل</div><div class="grow"></div><div class="num">${fmt(total)} <span style="font-size:9.5px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div></div>
      <button class="btn btn-primary btn-block mt-12" data-action="doApprove">${btnLabel}</button>
      <button class="btn btn-danger-outline btn-block mt-9" style="height:46px;font-size:12.5px" data-action="openReject" data-arg="${o.id}">رفض الطلب — بسبب إلزامي</button>
    </div>`;
}

// ---------- الرفض / التعليق (نافذة سبب إلزامي) ----------
function reasonModal(st) {
  const M = st.modal;
  const isRej = M.k === 'reject';
  const isHold = M.k === 'hold';
  const title = isRej ? `رفض الطلب ${M.id}` : isHold ? `تعليق الطلب ${M.id}` : `تعليق التذكرة ${M.id}`;
  const sub = isRej
    ? 'السبب إلزامي — يصل نصًا لمقدّم الطلب ليعدّل ويعيد الإرسال.'
    : 'السبب إلزامي — يظهر للعميل فورًا، ويمكن الاستئناف في أي وقت.';
  const ph = isRej ? 'مثال: تجاوز ميزانية الأسبوع للفرع — قلّل كمية الدجاج إلى ٤ كراتين.'
    : isHold ? 'مثال: صنفان غير متوفرين حاليًا — بانتظار شحنة الغد صباحًا.'
    : 'مثال: بانتظار تحقق المستودع من كميات التحميل — رد خلال 24 ساعة.';
  const color = isRej ? 'var(--c-danger)' : 'var(--c-warn)';
  const field = isRej ? 'rejectText' : isHold ? 'holdText' : 'tHoldText';
  const text = st[field] || '';
  const confirmAction = isRej ? 'confirmReject' : isHold ? 'confirmHold' : 'confirmTicketHold';
  return `
    <div style="padding:20px 22px 22px">
      <div class="modal-title" style="color:${color}">${esc(title)}</div>
      <div style="font-size:11px;color:var(--c-muted);margin-top:3px;line-height:1.8">${sub}</div>
      <textarea class="textarea mt-12" data-input="${field}" data-key="${field}" placeholder="${esc(ph)}">${esc(text)}</textarea>
      <div class="flex gap-9 mt-12">
        <button class="btn grow ${text.trim().length >= 5 ? '' : 'disabled'}" style="background:${color};color:#fff" data-action="${confirmAction}">${isRej ? 'تأكيد الرفض' : 'تأكيد التعليق'}</button>
        <button class="btn btn-ghost" style="width:110px;font-size:12.5px" data-action="closeAll">إلغاء</button>
      </div>
    </div>`;
}

// ---------- الاستلام ----------
function receiveModal(st) {
  const o = findOrder(st.modal.id);
  const shorts = o.items.filter((i) => st.recv[i.pid].short);
  return `
    <div class="modal-head">
      <div class="grow">
        <div class="modal-title">استلام <span class="num">${o.id}</span></div>
        <div class="modal-sub">افحص كل صنف مقابل الفاتورة المعتمدة — التبليغ عن النواقص قبل التأكيد فقط.</div>
      </div>
      ${closeBtn()}
    </div>
    <div class="modal-body">
      ${o.items.map((i) => {
        const p = PRODUCT_MAP[i.pid];
        const r = st.recv[i.pid];
        return `
        <div style="padding:11px 0;border-bottom:1px solid var(--c-divider)">
          <div class="flex-center gap-11">
            ${prodThumb(p)}
            <div class="grow" style="min-width:0">
              <div style="font-size:11.5px;font-weight:700">${esc(p.name)}</div>
              <div style="font-size:9.5px;color:var(--c-faint);margin-top:2px">المطلوب: <span class="num" style="font-weight:700">${i.qty}</span> × ${esc(p.unit)}</div>
            </div>
            <div style="flex:none;height:40px;display:flex;align-items:center;padding:0 16px;border-radius:11px;font-size:11.5px;font-weight:800;cursor:pointer;${r.short
              ? 'background:var(--c-danger-bg);color:var(--c-danger);border:1.5px solid var(--c-danger-border)'
              : 'background:var(--c-success-bg);color:var(--c-success);border:1.5px solid var(--c-success-border)'}"
              data-action="toggleShort" data-arg="${i.pid}" data-arg2="${i.qty}">${r.short ? 'ناقص' : 'كامل'}</div>
          </div>
          ${r.short ? `
            <div class="flex-center gap-8 mt-9" style="background:var(--c-danger-bg);border-radius:11px;padding:5px 8px">
              <div class="grow" style="font-size:10.5px;font-weight:700;color:var(--c-danger)">الكمية المستلمة فعليًا</div>
              <button class="stepper-btn" style="width:38px;height:36px" data-action="recvInc" data-arg="${i.pid}" data-arg2="${i.qty}">${ICONS.plus('#b23b3b', 11, 2.4)}</button>
              <div class="num" style="width:22px;text-align:center;font-size:12.5px;font-weight:700;color:var(--c-danger)">${r.recv}</div>
              <button class="stepper-btn" style="width:38px;height:36px" data-action="recvDec" data-arg="${i.pid}" data-arg2="${i.qty}">${ICONS.minus('#b23b3b', 11)}</button>
            </div>` : ''}
        </div>`;
      }).join('')}
    </div>
    <div class="modal-foot">
      ${shorts.length ? `<div class="banner banner-danger" style="border-radius:12px;padding:10px 14px;font-size:11px;line-height:1.8;color:var(--c-danger-deep);margin-bottom:10px"><b>${shorts.length}</b> صنف ناقص — ستُفتح تذكرة وتُرسل إلى B2B مع تأكيد الاستلام.</div>` : ''}
      <button class="btn btn-block" style="background:${shorts.length ? 'var(--c-warn)' : 'var(--c-success)'};color:#fff" data-action="confirmReceive">
        ${shorts.length ? 'فتح تذكرة النواقص وتأكيد الاستلام' : 'تأكيد الاستلام الكامل'}
      </button>
    </div>`;
}

// ---------- تفاصيل التذكرة ----------
function ticketModal(st) {
  const t = st.tickets.find((x) => x.id === st.modal.id);
  return `
    <div style="padding:20px 22px 22px;overflow-y:auto">
      <div class="flex-center gap-10">
        <div class="grow" style="min-width:0">
          <div class="modal-title" style="white-space:nowrap">تذكرة <span class="num">${t.id}</span></div>
          <div class="modal-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.date)} · ${esc(t.customer)}</div>
        </div>
        ${ticketChip(t)}
        ${closeBtn()}
      </div>
      ${t.st === 'held' ? `
        <div class="banner banner-danger mt-14">
          <div class="banner-title">سبب التعليق</div>
          <div class="banner-text">${esc(t.holdReason || '')}</div>
        </div>` : ''}
      ${t.st === 'resolved' ? `
        <div class="banner banner-success mt-14">
          <div class="banner-title">أُغلقت التذكرة</div>
          <div class="banner-text" style="font-size:11px">صدر إشعار دائن <span class="num">${esc(t.cn || '')}</span> وانعكس في محفظة العميل وفواتيره.</div>
        </div>` : ''}
      <div style="background:var(--c-subtle);border:1px solid var(--c-divider);border-radius:16px;padding:16px;margin-top:14px">
        <div style="font-size:12.5px;font-weight:800">النواقص المبلّغ عنها</div>
        <div style="font-size:12px;font-weight:700;margin-top:9px">${esc(t.desc)}</div>
        <div style="font-size:11px;color:var(--c-muted);margin-top:4px">${esc(t.qty)}</div>
        <div class="flex" style="font-size:11px;color:var(--c-muted);margin-top:12px;padding-top:12px;border-top:1px solid var(--c-divider)">
          <div>قيمة النواقص (شامل الضريبة)</div><div class="grow"></div>
          <div class="num" style="font-weight:700;color:var(--c-ink);font-size:13px">${fmt(t.val)} ر.س</div>
        </div>
      </div>
      ${st.role !== 'b2b' && t.st === 'open' ? '<div class="banner-info-dashed mt-12" style="border-style:solid;font-size:11px">التذكرة قيد المعالجة لدى فريق B2B — يصلك إشعار فور حلّها أو تعليقها.</div>' : ''}
      ${st.role === 'b2b' && t.st === 'open' ? `
        <button class="btn btn-primary btn-block mt-14" style="font-size:12.5px" data-action="resolveTicket" data-arg="${t.id}">حل المشكلة — إغلاق وإصدار إشعار دائن ${fmt(t.val)} ر.س</button>
        <button class="btn btn-warn-outline btn-block mt-9" style="height:44px;font-size:12px" data-action="openTicketHold" data-arg="${t.id}">تعليق التذكرة — بسبب</button>` : ''}
      ${st.role === 'b2b' && t.st === 'held' ? `
        <button class="btn btn-warn btn-block mt-14" style="font-size:12.5px" data-action="resumeTicket" data-arg="${t.id}">استئناف التذكرة</button>
        <button class="btn btn-info-outline btn-block mt-9" style="height:44px;font-size:12px" data-action="resolveTicket" data-arg="${t.id}">إغلاق وإصدار إشعار دائن</button>` : ''}
    </div>`;
}

// ---------- شحن المحفظة ----------
function topupModal(st) {
  const amounts = [1000, 2500, 5000, 10000];
  const methods = [
    { name: 'مدى', sub: 'خصم فوري من البطاقة' },
    { name: 'تحويل بنكي', sub: 'يُقيّد خلال ساعات العمل' },
  ];
  return `
    <div style="padding:20px 22px 22px;overflow-y:auto">
      <div class="flex-center">
        <div class="modal-title grow">شحن المحفظة</div>
        ${closeBtn()}
      </div>
      <div class="field-label">المبلغ</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
        ${amounts.map((a) => `
          <div class="num" style="height:50px;display:flex;align-items:center;justify-content:center;gap:4px;border-radius:13px;font-size:15px;font-weight:700;cursor:pointer;${st.topupAmt === a ? 'background:var(--c-primary);color:#fff' : 'background:#fff;border:1px solid var(--c-card-border)'}"
            data-action="setTopupAmt" data-arg="${a}">${fmt0(a)} <span style="font-size:10px;opacity:.7;font-family:var(--font-ar)">ر.س</span></div>`).join('')}
      </div>
      <div class="flex-center gap-8 mt-10" style="background:var(--c-subtle);border:1px solid var(--c-card-border);border-radius:13px;padding:6px 8px">
        <div class="grow" style="font-size:11px;font-weight:700;color:var(--c-muted);padding-inline-start:8px">مبلغ مخصص</div>
        <button class="stepper-btn" style="background:#fff;border:1px solid var(--c-card-border);border-radius:10px" data-action="topupInc">${ICONS.plus('#0d7f93', 12, 2.4)}</button>
        <div class="num" style="width:80px;text-align:center;font-size:16px;font-weight:700">${fmt0(st.topupAmt)}</div>
        <button class="stepper-btn" style="background:#fff;border:1px solid var(--c-card-border);border-radius:10px" data-action="topupDec">${ICONS.minus()}</button>
      </div>
      <div class="field-label" style="margin-top:16px">وسيلة الشحن</div>
      <div style="border:1px solid var(--c-divider);border-radius:14px;overflow:hidden">
        ${methods.map((m) => `
          <div class="flex-center gap-11 clickable" style="padding:0 16px;min-height:52px;border-bottom:1px solid var(--c-divider);cursor:pointer" data-action="setTopupMethod" data-arg="${esc(m.name)}">
            <div class="radio ${st.topupMethod === m.name ? 'on' : ''}"></div>
            <div class="grow">
              <div style="font-size:12.5px;font-weight:800">${esc(m.name)}</div>
              <div style="font-size:10px;color:var(--c-faint);margin-top:1px">${esc(m.sub)}</div>
            </div>
          </div>`).join('')}
      </div>
      ${st.topupMethod === 'تحويل بنكي' ? `
        <div class="field-label" style="margin-top:16px">صورة الحوالة <span style="color:var(--c-warn)">(إلزامية)</span></div>
        <div class="flex-center gap-11" style="border:1.5px dashed ${st.tuProof ? 'var(--c-success-border)' : '#D8D4E2'};border-radius:13px;background:var(--c-subtle);padding:14px 16px;cursor:pointer" data-action="toggleTuProof">
          <div style="width:40px;height:40px;border-radius:11px;background:${st.tuProof ? 'var(--c-success-bg)' : 'var(--c-chip-bg)'};display:flex;align-items:center;justify-content:center;flex:none">
            ${st.tuProof
              ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M5.5 12.5l4 4 9-9.5" stroke="#1d7a3e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
              : '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2.4" stroke="#7d7990" stroke-width="1.7"></rect><circle cx="9" cy="10" r="1.7" stroke="#7d7990" stroke-width="1.6"></circle><path d="M5 17l4.5-4 3.5 3 2.8-2.4L20 17.5" stroke="#7d7990" stroke-width="1.7" stroke-linejoin="round"></path></svg>'}
          </div>
          <div class="grow">
            <div style="font-size:12px;font-weight:800;color:${st.tuProof ? 'var(--c-success)' : 'var(--c-muted)'}">${st.tuProof ? 'أُرفقت صورة الحوالة' : 'أرفق صورة الحوالة البنكية'}</div>
            <div style="font-size:9.5px;color:var(--c-faint);margin-top:1px">JPG / PNG / PDF — تظهر لفريق B2B في التعميدات المالية</div>
          </div>
          <div style="font-size:10.5px;font-weight:800;color:var(--c-info)">${st.tuProof ? 'تغيير' : 'إرفاق'}</div>
        </div>` : ''}
      <div class="flex mt-14" style="font-size:11.5px;color:var(--c-muted);background:var(--c-subtle);border:1px solid var(--c-divider);border-radius:13px;padding:12px 16px">
        <div>الرصيد بعد الشحن</div><div class="grow"></div>
        <div class="num" style="font-weight:700;color:var(--c-success)">${fmt(st.wallet.bal + st.topupAmt)} ر.س</div>
      </div>
      <button class="btn btn-primary btn-block mt-12" data-action="confirmTopup">
        ${st.topupMethod === 'تحويل بنكي' ? 'إرسال طلب الشحن — يُضاف بعد تعميد B2B' : 'تأكيد الشحن — إيصال PDF فوري'}
      </button>
    </div>`;
}

// ---------- تسعير اقتراح منتج (B2B) ----------
function reqPriceModal(st) {
  const r = st.prodReqs.find((x) => x.id === st.modal.id) || { name: '' };
  return `
    <div style="padding:20px 22px 22px">
      <div class="flex-center">
        <div class="modal-title grow">تسعير «${esc(r.name)}»</div>
        ${closeBtn()}
      </div>
      <div style="font-size:11px;color:var(--c-muted);line-height:1.9;margin-top:6px">حدد سعر الوحدة — يعود الاقتراح للعميل لاعتماده قبل الإضافة للكتالوج.</div>
      <div class="flex-center gap-10" style="justify-content:center;background:var(--c-subtle);border:1px solid var(--c-card-border);border-radius:13px;padding:12px;margin-top:14px">
        <button class="stepper-btn" style="width:44px;height:44px;background:#fff;border:1px solid var(--c-card-border);border-radius:11px" data-action="reqPriceInc">${ICONS.plus('#0d7f93', 13, 2.4)}</button>
        <div class="num" style="width:110px;text-align:center;font-size:22px;font-weight:700">${fmt(st.reqPrice)} <span style="font-size:10px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div>
        <button class="stepper-btn" style="width:44px;height:44px;background:#fff;border:1px solid var(--c-card-border);border-radius:11px" data-action="reqPriceDec">${ICONS.minus()}</button>
      </div>
      <div class="flex gap-9 mt-14">
        <button class="btn btn-primary grow" data-action="confirmReqPrice">تسعير وإرسال للعميل</button>
        <button class="btn btn-ghost" style="padding:0 18px;font-size:12px" data-action="closeAll">إلغاء</button>
      </div>
    </div>`;
}

// ---------- تفاصيل الفاتورة ----------
function invoiceDetailModal(st) {
  const v = st.invoices.find((x) => x.id === st.modal.id);
  if (!v) return '';
  const m = INVOICE_STATUS_LOCAL[v.st];
  // الطلب المرتبط (المرجع يحتوي رقم ORD)
  const ordId = (String(v.ref).match(/ORD-[\w-]+/) || [])[0];
  const order = ordId ? st.orders.find((o) => o.id === ordId) : null;
  const amt = Math.abs(Number(v.amt));
  const sub = amt / 1.15;
  const paid = amt - Number(v.rem);
  return `
    <div style="padding:20px 22px 22px;overflow-y:auto;min-height:0">
      <div class="flex-center gap-10">
        <div style="width:40px;height:40px;border-radius:12px;background:var(--c-blue-bg);display:flex;align-items:center;justify-content:center">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M6.5 3.5h11v17h-11z" stroke="#3C79F5" stroke-width="1.7"></path><path d="M9.3 8h5.4M9.3 11.5h5.4M9.3 15h3.5" stroke="#3C79F5" stroke-width="1.7" stroke-linecap="round"></path></svg>
        </div>
        <div class="grow">
          <div class="flex-center gap-8 wrap">
            <div class="num" style="font-size:16px;font-weight:800">${v.id}</div>
            ${chip(m.label, m.chip)}
          </div>
          <div style="font-size:10.5px;color:var(--c-muted);margin-top:1px">${esc(v.ref)} · ${esc(v.due)}</div>
        </div>
        ${closeBtn()}
      </div>
      <div class="flex-center gap-8" style="background:var(--c-subtle);border:1px solid var(--c-divider);border-radius:12px;padding:10px 13px;margin-top:14px">
        <div style="font-size:10.5px;color:var(--c-muted)">صادرة لـ</div>
        <div style="font-size:11.5px;font-weight:800">مطاعم البلدة</div>
        <div class="grow"></div>
        <div class="num" style="font-size:10px;color:var(--c-faint)">C.R. 4030-118842</div>
      </div>
      ${order ? `
        <div class="field-label">أصناف الفاتورة</div>
        <div style="border:1px solid var(--c-divider);border-radius:13px;overflow:hidden;max-height:190px;overflow-y:auto">
          ${order.items.filter((i) => i.qty > 0).map((i) => {
            const p = PRODUCT_MAP[i.pid];
            return `
            <div class="flex-center gap-10" style="padding:9px 13px;border-bottom:1px solid #F7F5FA">
              <div style="width:26px;height:26px;border-radius:8px;background:${p ? `hsl(${p.h},30%,93%)` : 'var(--c-chip-bg)'};flex:none"></div>
              <div class="grow">
                <div style="font-size:11.5px;font-weight:800">${esc(p ? p.name : i.pid)}</div>
                <div style="font-size:9.5px;color:var(--c-faint)">${esc(p ? p.unit : '')} × <span class="num">${i.qty}</span></div>
              </div>
              ${p ? `<div class="num" style="font-size:11px;font-weight:700">${fmt(p.price * i.qty)} <span style="font-size:8.5px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div>` : ''}
            </div>`;
          }).join('')}
        </div>
        <div style="font-size:10.5px;font-weight:800;color:var(--c-info);cursor:pointer;margin:8px 2px 0;text-decoration:underline;display:inline-block" data-action="openOrderFromInvoice" data-arg="${esc(order.id)}">عرض الطلب ${esc(order.id)} كاملًا ←</div>` : ''}
      <div style="background:var(--c-chip-bg);border-radius:13px;padding:13px 16px;margin-top:14px">
        <div class="flex" style="font-size:11px;color:var(--c-muted)"><div>الإجمالي قبل الضريبة</div><div class="grow"></div><div class="num" style="font-weight:700">${fmt(sub)}</div></div>
        <div class="flex" style="font-size:11px;color:var(--c-muted);margin-top:5px"><div>ضريبة القيمة المضافة 15%</div><div class="grow"></div><div class="num" style="font-weight:700">${fmt(amt - sub)}</div></div>
        <div style="height:1px;background:var(--c-card-border);margin:9px 0"></div>
        <div class="flex" style="font-size:13px;font-weight:800"><div>الإجمالي</div><div class="grow"></div><div class="num">${fmt(amt)} <span style="font-size:9.5px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div></div>
        ${v.st === 'part' ? `
          <div class="flex" style="font-size:11px;color:var(--c-success);margin-top:7px"><div>المسدد</div><div class="grow"></div><div class="num" style="font-weight:700">${fmt(paid)}</div></div>
          <div class="flex" style="font-size:11px;color:var(--c-danger);margin-top:4px"><div>المتبقي</div><div class="grow"></div><div class="num" style="font-weight:700">${fmt(Number(v.rem))}</div></div>` : ''}
      </div>
      <div class="flex gap-9 mt-14">
        ${(v.st === 'unpaid' || v.st === 'part') && CAN_PAY_LOCAL.includes(st.role)
          ? `<button class="btn btn-primary grow" style="font-size:12.5px" data-action="payInvoice" data-arg="${v.id}">سداد ${fmt(Number(v.rem))} ر.س من المحفظة</button>` : ''}
        <button class="btn num" style="padding:0 20px;border:1px solid var(--c-card-border);color:var(--c-info);font-size:12px;font-weight:700" data-action="invoicePdf" data-arg="${v.id}">PDF</button>
        <button class="btn btn-ghost" style="padding:0 18px;font-size:12px" data-action="closeAll">إغلاق</button>
      </div>
    </div>`;
}
const INVOICE_STATUS_LOCAL = {
  unpaid: { label: 'غير مدفوعة', chip: 'chip-danger' },
  part:   { label: 'مدفوعة جزئيًا', chip: 'chip-warn' },
  paid:   { label: 'مدفوعة', chip: 'chip-success' },
  credit: { label: 'إشعار دائن', chip: 'chip-purple' },
};
const CAN_PAY_LOCAL = ['owner', 'fin', 'frz', 'frzs', 'fr'];

// ---------- ملف ممنوح (نافذة مختصرة لممنوح بلا ملف عميل) ----------
function franchiseeModal(st) {
  const f = st.frs.find((x) => x.id === st.frSel);
  if (!f) return '';
  const m = FRANCHISEE_STATUS[f.active ? f.st : 'off'];
  return `
    <div style="padding:20px 22px 22px">
      <div class="flex-center gap-8">
        <div class="modal-title grow">${esc(f.name)}</div>
        ${chip(m.label, m.chip)}
        ${closeBtn()}
      </div>
      <div style="font-size:11px;color:var(--c-muted);margin-top:3px">${esc(f.city)} · <span class="num">C.R. ${esc(f.cr)}</span> · محفظة مستقلة على فروعه فقط</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-top:14px">
        <div style="background:var(--c-subtle);border:1px solid var(--c-divider);border-radius:13px;padding:12px 14px"><div class="num" style="font-size:16px;font-weight:700">${f.orders}</div><div style="font-size:9.5px;font-weight:800;color:var(--c-muted);margin-top:2px">طلبات يوليو</div></div>
        <div style="background:var(--c-subtle);border:1px solid var(--c-divider);border-radius:13px;padding:12px 14px"><div class="num" style="font-size:16px;font-weight:700">${fmt0(f.bal)}</div><div style="font-size:9.5px;font-weight:800;color:var(--c-muted);margin-top:2px">رصيد محفظته (ر.س)</div></div>
        <div style="background:var(--c-subtle);border:1px solid var(--c-divider);border-radius:13px;padding:12px 14px"><div class="num" style="font-size:16px;font-weight:700">${f.pay}%</div><div style="font-size:9.5px;font-weight:800;color:var(--c-muted);margin-top:2px">التزام السداد</div></div>
      </div>
      <button class="btn btn-block mt-14" style="height:46px;font-size:12.5px;${f.active ? 'background:var(--c-danger-bg);color:var(--c-danger)' : 'background:var(--c-success-bg);color:var(--c-success)'}"
        data-action="toggleFranchisee" data-arg="${f.id}">${f.active ? 'إيقاف حساب الممنوح' : 'تفعيل حساب الممنوح'}</button>
    </div>`;
}

// ---------- إنشاء ممنوح (المانح يختار النوع: بيسك / سوبر بمنطقة امتياز) ----------
function franchiseeInviteModal(st) {
  const showKinds = st.role === 'fr';
  const isSuper = showKinds && st.frKind === 'super';
  const ready = st.frName.trim() && st.frCr.trim() && (!isSuper || (st.frRegion || '').trim());
  const kinds = [
    { key: 'normal', name: 'ممنوح بيسك', sub: 'يفتح فروعًا لمنشأته فقط — بلا ممنوحين تابعين.' },
    { key: 'super',  name: 'ممنوح سوبر', sub: 'يمنح ممنوحين ضمن منطقة امتياز محددة، وممنوحوه يفتحون فروعهم فقط.' },
  ];
  return `
    <div style="padding:20px 22px 22px">
      <div class="modal-title">إنشاء ممنوح فرنشايز</div>
      <div style="font-size:11px;color:var(--c-muted);margin-top:3px;line-height:1.8">يُنشأ حسابه ومحفظته المستقلة فور توثيق السجل التجاري وتعميد B2B.</div>
      <div class="mt-14">${input('frName', st.frName, 'اسم المنشأة')}</div>
      <div class="mt-9">${input('frCr', st.frCr, 'رقم السجل التجاري', { dir: 'ltr' })}</div>
      ${showKinds ? `
        <div class="field-label" style="margin-top:13px">نوع الممنوح</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${kinds.map((k) => {
            const on = st.frKind === k.key;
            return `
            <div class="flex-center gap-11" style="border:1.5px solid ${on ? 'var(--c-purple-border)' : 'var(--c-card-border)'};background:${on ? '#F7F5FB' : '#fff'};border-radius:13px;padding:11px 14px;cursor:pointer"
              data-action="setFrKind" data-arg="${k.key}">
              <div class="radio ${on ? 'on' : ''}" style="${on ? 'border-color:var(--c-purple)' : ''}"></div>
              <div class="grow">
                <div style="font-size:12.5px;font-weight:800">${k.name}</div>
                <div style="font-size:10px;color:var(--c-muted);margin-top:2px;line-height:1.7">${k.sub}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
        ${isSuper ? `<div class="mt-9">${input('frRegion', st.frRegion, 'منطقة الامتياز — مثال: المنطقة الغربية', { extra: 'style="border-color:var(--c-purple-border);background:#F7F5FB"' })}</div>` : ''}
      ` : ''}
      <div class="flex gap-9" style="margin-top:13px">
        <button class="btn btn-primary grow ${ready ? '' : 'disabled'}" data-action="sendInvite">إنشاء الممنوح</button>
        <button class="btn btn-ghost" style="width:110px;font-size:12.5px" data-action="closeAll">إلغاء</button>
      </div>
    </div>`;
}

// ---------- لستة محفوظة جديدة ----------
function listNewModal(st) {
  const lq = st.lnQty || {};
  const q = (st.lnSearch || '').trim();
  const rows = PRODUCTS.filter((p) => !q || p.name.includes(q) || p.id.toLowerCase().includes(q.toLowerCase()));
  const count = Object.keys(lq).length;
  const ready = (st.lnName || '').trim() && count;
  return `
    <div class="modal-head" style="display:block">
      <div class="flex-center gap-10">
        <div class="modal-title grow">لستة محفوظة جديدة</div>
        ${closeBtn()}
      </div>
      <div class="mt-10">${input('lnName', st.lnName, 'اسم اللستة — مثال: طلبية نهاية الأسبوع', { cls: 'input', extra: 'style="height:46px;border-radius:12px"' })}</div>
      <div class="search-box mt-9" style="height:42px;background:var(--c-subtle);border-radius:12px">
        ${ICONS.search('#a8a4b8', 15)}
        <input data-input="lnSearch" data-key="lnSearch" value="${esc(st.lnSearch)}" placeholder="ابحث لإضافة أصناف…" style="flex:1;border:none;outline:none;background:transparent;font-size:12px">
      </div>
    </div>
    <div class="modal-body" style="padding:2px 22px">
      ${rows.map((p) => {
        const qty = lq[p.id] || 0;
        return `
        <div class="flex-center gap-11" style="padding:9px 0;border-bottom:1px solid var(--c-divider)">
          ${prodThumb(p, 40)}
          <div class="grow" style="min-width:0">
            <div style="font-size:11.5px;font-weight:700">${esc(p.name)}</div>
            <div style="font-size:9.5px;color:var(--c-faint);margin-top:2px">${esc(p.unit)}</div>
          </div>
          ${qty > 0
            ? stepper(qty, 'listInc', 'listDec', p.id)
            : `<button style="width:38px;height:38px;border-radius:999px;background:var(--c-primary-soft);display:flex;align-items:center;justify-content:center;cursor:pointer;border:none" data-action="listInc" data-arg="${p.id}">${ICONS.plus('#0d7f93', 14, 2.4)}</button>`}
        </div>`;
      }).join('')}
    </div>
    <div class="modal-foot">
      <div style="font-size:11px;color:var(--c-muted)"><span class="num" style="font-weight:700;color:var(--c-ink)">${count}</span> صنف في اللستة</div>
      <button class="btn btn-purple btn-block mt-9 ${ready ? '' : 'disabled'}" data-action="saveList">حفظ اللستة</button>
    </div>`;
}

// ---------- اقتراح منتج ----------
function requestNewModal(st) {
  const ready = (st.reqName || '').trim();
  return `
    <div style="padding:20px 22px 22px">
      <div class="modal-title">اقتراح منتج جديد</div>
      <div style="font-size:11px;color:var(--c-muted);margin-top:3px;line-height:1.8">يصل الاقتراح لفريق B2B — وعند الموافقة يُضاف للكتالوج ويُشعرك.</div>
      <div class="mt-14">${input('reqName', st.reqName, 'اسم المنتج — مثال: صوص باربكيو')}</div>
      <div class="mt-9">${input('reqUnit', st.reqUnit, 'الوحدة المطلوبة — مثال: جالون 3.78 لتر (اختياري)')}</div>
      <textarea class="textarea mt-9" style="min-height:80px;border-radius:13px" data-input="reqNote" data-key="reqNote" placeholder="ملاحظة تساعد الفريق — الاستخدام، الكمية المتوقعة أسبوعيًا… (اختياري)">${esc(st.reqNote)}</textarea>
      <div class="flex gap-9" style="margin-top:13px">
        <button class="btn btn-primary grow ${ready ? '' : 'disabled'}" data-action="submitRequest">إرسال الاقتراح</button>
        <button class="btn btn-ghost" style="width:110px;font-size:12.5px" data-action="closeAll">إلغاء</button>
      </div>
    </div>`;
}

// ---------- إضافة مستخدم ----------
function userNewModal(st) {
  const roles = st.role === 'ops' ? { worker: 'عامل مطعم' } : { worker: 'عامل مطعم', ops: 'مدير عمليات', fin: 'مدير مالية' };
  const activeRole = st.role === 'ops' ? 'worker' : st.usRole;
  const branches = st.usBranches || [];
  const hint = st.role === 'ops'
    ? 'صلاحيتك تتيح إضافة عمال المطعم فقط — يُنشأ الحساب مباشرة ويعمل بعد تفعيلك له.'
    : 'يُنشأ الحساب مباشرة بالإيميل وكلمة السر — يستطيع الدخول بعد تفعيلك للحساب.';
  return `
    <div style="padding:20px 22px 22px">
      <div class="modal-title">إضافة مستخدم</div>
      <div style="font-size:11px;color:var(--c-muted);margin-top:3px;line-height:1.8">${hint}</div>
      <div class="mt-14">${input('usName', st.usName, 'اسم المستخدم')}</div>
      <div class="mt-9">${input('usEmail', st.usEmail, 'الإيميل — user@company.sa', { dir: 'ltr', extra: 'style="font-family:var(--font-num);text-align:left"' })}</div>
      <div class="mt-9">${input('usPass', st.usPass, 'كلمة السر — 6 أحرف على الأقل', { dir: 'ltr', type: 'password', extra: 'style="font-family:var(--font-num);text-align:left"' })}</div>
      <div class="field-label" style="margin-top:12px">أي دور يلعب هذا اليوزر؟</div>
      <div class="flex gap-7">
        ${Object.entries(roles).map(([k, label]) => `
          <div style="flex:1;height:42px;display:flex;align-items:center;justify-content:center;border-radius:11px;font-size:11.5px;font-weight:800;cursor:pointer;${activeRole === k ? 'background:var(--c-purple);color:#fff' : 'background:var(--c-subtle);color:var(--c-muted);border:1px solid var(--c-card-border)'}"
            data-action="setUsRole" data-arg="${k}">${label}</div>`).join('')}
      </div>
      <div class="field-label" style="margin-top:12px">أي فروع تتبع له؟ (اختر أكثر من فرع)</div>
      <div class="flex gap-7 wrap">
        ${st.branches.map((b) => {
          const on = branches.includes(b.name);
          return `
          <div style="height:40px;display:flex;align-items:center;gap:6px;padding:0 14px;border-radius:11px;font-size:11.5px;font-weight:800;cursor:pointer;${on ? 'background:var(--c-primary);color:#fff' : 'background:var(--c-subtle);color:var(--c-muted);border:1px solid var(--c-card-border)'}"
            data-action="toggleUsBranch" data-arg="${esc(b.name)}">${esc(b.name)}</div>`;
        }).join('')}
      </div>
      <div class="flex gap-9 mt-14">
        <button class="btn btn-primary grow" data-action="addUser">إنشاء الحساب</button>
        <button class="btn btn-ghost" style="width:110px;font-size:12.5px" data-action="closeAll">إلغاء</button>
      </div>
    </div>`;
}

// ---------- تعديل مستخدم ----------
function userEditModal(st) {
  const u = st.users.find((x) => x.id === st.modal.id) || {};
  const roles = st.role === 'ops' ? { worker: 'عامل مطعم' } : { worker: 'عامل مطعم', ops: 'مدير عمليات', fin: 'مدير مالية' };
  const branches = st.ueBranches || [];
  return `
    <div style="padding:20px 22px 22px">
      <div class="flex-center gap-10">
        <div class="grow">
          <div class="modal-title">إدارة: ${esc(u.name || '')}</div>
          <div class="num" style="font-size:10.5px;color:var(--c-faint);margin-top:2px" dir="ltr">${esc(u.email || '—')}</div>
        </div>
        ${closeBtn()}
      </div>
      <div class="field-label">دوره</div>
      <div class="flex gap-7">
        ${Object.entries(roles).map(([k, label]) => `
          <div style="flex:1;height:42px;display:flex;align-items:center;justify-content:center;border-radius:11px;font-size:11.5px;font-weight:800;cursor:pointer;${(st.ueRole || 'worker') === k ? 'background:var(--c-purple);color:#fff' : 'background:var(--c-subtle);color:var(--c-muted);border:1px solid var(--c-card-border)'}"
            data-action="setUeRole" data-arg="${k}">${label}</div>`).join('')}
      </div>
      <div class="field-label" style="margin-top:12px">الفروع التابعة له</div>
      <div class="flex gap-7 wrap">
        ${st.branches.map((b) => {
          const on = branches.includes(b.name);
          return `
          <div style="height:40px;display:flex;align-items:center;padding:0 14px;border-radius:11px;font-size:11.5px;font-weight:800;cursor:pointer;${on ? 'background:var(--c-primary);color:#fff' : 'background:var(--c-subtle);color:var(--c-muted);border:1px solid var(--c-card-border)'}"
            data-action="toggleUeBranch" data-arg="${esc(b.name)}">${esc(b.name)}</div>`;
        }).join('')}
      </div>
      <div class="flex gap-9 mt-16">
        <button class="btn btn-primary grow" data-action="saveUserEdit">حفظ التغييرات</button>
        <button class="btn btn-ghost" style="width:110px;font-size:12.5px" data-action="closeAll">إلغاء</button>
      </div>
    </div>`;
}

// ---------- تفاصيل الفرع (خريطة + إحصائيات + طلبات + فريق + إيقاف/حذف) ----------
function branchDetailModal(st) {
  const b = st.branches.find((x) => x.name === st.brDetName) || { name: '', city: '' };
  const branchOrders = st.orders.filter((o) => o.branch === b.name);
  const team = st.users.filter((u) => u.branch === b.name || (u.branch || '').split(' · ').includes(b.name));
  const supervisors = team.filter((u) => u.role !== 'worker');
  const workers = team.filter((u) => u.role === 'worker');
  const roleChip = { owner: ['المالك', 'chip-purple'], ops: ['مشرف — مدير عمليات', 'chip-info'], fin: ['مشرف — مالية', 'chip-blue'], worker: ['عامل', 'chip-gray'] };
  const off = b.st === 'off';

  return `
    <div style="padding:20px 22px 22px;overflow-y:auto;min-height:0">
      <div class="flex-center gap-10">
        <div style="width:40px;height:40px;border-radius:12px;background:var(--c-purple-soft);display:flex;align-items:center;justify-content:center">${ICONS.branch('#654e92', 18)}</div>
        <div class="grow">
          <div class="modal-title">${esc(b.name)}</div>
          <div style="font-size:10.5px;color:var(--c-muted);margin-top:1px">${esc(ROLES[st.role].org)} · ${esc(b.city)}</div>
        </div>
        ${closeBtn()}
      </div>
      ${b.loc ? `
        <div class="clickable" title="اضغط لعرض الموقع على الخريطة" style="position:relative;height:150px;border-radius:13px;overflow:hidden;margin-top:14px;border:1px solid var(--c-card-border);cursor:pointer" data-action="openMapView" data-arg="${esc(b.name)}">
          ${mapSvgLarge()}
          ${mapPinAt(b.loc.x, b.loc.y, 30)}
        </div>
        <div class="flex-center gap-7 mt-9" style="cursor:pointer" data-action="openMapView" data-arg="${esc(b.name)}">
          ${pinIcon('#654e92', 13)}
          <div style="font-size:11.5px;font-weight:800">${esc(b.loc.addr)}</div>
          <div class="num" style="font-size:10px;color:var(--c-faint)">${esc(b.loc.coords)}</div>
          <div class="grow"></div>
          <div style="font-size:10px;font-weight:800;color:var(--c-info)">عرض على الخريطة ←</div>
        </div>`
      : '<div class="banner banner-warn mt-14" style="border-radius:12px;padding:11px 13px;font-size:11px;font-weight:800">لم يُحدد موقع هذا الفرع بعد.</div>'}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-top:14px">
        <div style="background:var(--c-chip-bg);border-radius:12px;padding:11px 13px"><div class="num" style="font-size:17px;font-weight:700;color:var(--c-purple)">${branchOrders.length}</div><div style="font-size:9.5px;font-weight:800;color:var(--c-muted);margin-top:1px">طلبات الفرع</div></div>
        <div style="background:var(--c-chip-bg);border-radius:12px;padding:11px 13px"><div class="num" style="font-size:17px;font-weight:700;color:var(--c-info)">${supervisors.length}</div><div style="font-size:9.5px;font-weight:800;color:var(--c-muted);margin-top:1px">مشرفون</div></div>
        <div style="background:var(--c-chip-bg);border-radius:12px;padding:11px 13px"><div class="num" style="font-size:17px;font-weight:700;color:var(--c-blue)">${workers.length}</div><div style="font-size:9.5px;font-weight:800;color:var(--c-muted);margin-top:1px">عمال</div></div>
      </div>
      <div class="field-label">طلبات الفرع</div>
      <div style="border:1px solid var(--c-divider);border-radius:13px;overflow:hidden;max-height:170px;overflow-y:auto">
        ${branchOrders.map((o) => `
          <div class="flex-center gap-9 clickable" style="padding:10px 13px;border-bottom:1px solid #F7F5FA;cursor:pointer" data-action="openOrderFromBranch" data-arg="${o.id}">
            <div class="num" style="font-size:11.5px;font-weight:700">${o.id}</div>
            <div style="font-size:10px;color:var(--c-faint)">${esc(o.date)}</div>
            <div class="grow"></div>
            <div class="num" style="font-size:11px;font-weight:700">${fmt(orderTotal(o))} <span style="font-size:8.5px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div>
            ${orderChip(o.st)}
          </div>`).join('')}
        ${branchOrders.length === 0 ? '<div style="padding:14px;font-size:11px;color:var(--c-faint);text-align:center">لا طلبات من هذا الفرع بعد.</div>' : ''}
      </div>
      <div class="field-label">الفريق</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${[...supervisors, ...workers].map((u) => {
          const rc = roleChip[u.role] || roleChip.worker;
          return `
          <div class="flex-center gap-9" style="background:var(--c-subtle);border:1px solid var(--c-divider);border-radius:11px;padding:8px 12px">
            <div style="width:28px;height:28px;border-radius:999px;background:var(--c-purple-soft);color:var(--c-purple);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center">${esc((u.name || ' ').trim()[0])}</div>
            <div class="grow" style="font-size:11.5px;font-weight:800">${esc(u.name)}</div>
            ${chip(rc[0], rc[1])}
          </div>`;
        }).join('')}
        ${team.length === 0 ? '<div style="padding:10px;font-size:11px;color:var(--c-faint);text-align:center">لا مستخدمون مرتبطون بهذا الفرع — اربطهم من اليوزرات والصلاحيات.</div>' : ''}
      </div>
      <div class="flex gap-9" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--c-divider)">
        <button class="btn btn-warn-outline grow" style="height:44px;border-radius:12px;font-size:12px" data-action="toggleBranch" data-arg="${esc(b.name)}">${off ? 'إعادة تفعيل الفرع' : 'إيقاف الفرع مؤقتًا'}</button>
        <button class="btn btn-danger-outline grow" style="height:44px;border-radius:12px;font-size:12px" data-action="deleteBranch" data-arg="${esc(b.name)}">حذف الفرع</button>
      </div>
      <div style="font-size:9.5px;color:var(--c-faint);margin-top:7px;line-height:1.8">الإيقاف يمنع الطلب من الفرع مؤقتًا مع بقاء سجلّه · الحذف نهائي ولا يمس الطلبات السابقة.</div>
    </div>`;
}

// ---------- عرض موقع الفرع ----------
function mapViewModal(st) {
  const mv = st.mapView || {};
  return `
    <div style="padding:20px 22px 22px;overflow-y:auto;min-height:0">
      <div class="flex-center gap-8">
        <div class="modal-title">موقع ${esc(mv.name || '')}</div>
        <div class="chip chip-success" style="gap:5px;font-size:9.5px">خرائط Google</div>
        <div class="grow"></div>
        ${closeBtn()}
      </div>
      <div style="position:relative;height:300px;border-radius:14px;overflow:hidden;margin-top:12px;border:1px solid var(--c-card-border)">
        ${mapSvgLarge()}
        ${mapPinAt(mv.x || 0, mv.y || 0, 36)}
      </div>
      <div class="flex-center gap-9" style="background:var(--c-chip-bg);border-radius:12px;padding:11px 13px;margin-top:10px">
        ${pinIcon('#654e92', 16)}
        <div class="grow">
          <div style="font-size:12px;font-weight:800">${esc(mv.addr || '')}</div>
          <div class="num" style="font-size:10px;color:var(--c-muted);margin-top:1px">${esc(mv.coords || '')}</div>
        </div>
        <button class="btn btn-primary btn-sm" data-action="backToBranchDet" data-arg="${esc(mv.name || '')}">رجوع للتفاصيل</button>
      </div>
    </div>`;
}

// ---------- اختيار موقع الفرع من الخريطة (الموقع إلزامي) ----------
function mapPickModal(st) {
  const pin = st.mapPin;
  const loc = pin ? locFromPin(pin) : null;
  return `
    <div style="padding:20px 22px 22px;overflow-y:auto;min-height:0">
      <div class="flex-center gap-8">
        <div class="modal-title">حدد موقع الفرع</div>
        <div class="chip chip-success" style="gap:5px;font-size:9.5px">${pinIcon('#1d7a3e', 10)} خرائط Google</div>
      </div>
      <div style="font-size:11px;color:var(--c-muted);margin-top:3px;line-height:1.8">انقر على الخريطة لإسقاط الدبوس على موقع الفرع بدقة.</div>
      <div class="flex-center gap-8" style="height:44px;border:1.5px solid var(--c-card-border);border-radius:12px;background:#fff;padding:0 12px;margin-top:12px;box-shadow:0 2px 8px rgba(38,36,51,.06)">
        ${ICONS.search('#a8a4b8', 15)}
        <input data-input="mapSearch" data-key="mapSearch" value="${esc(st.mapSearch)}" placeholder="ابحث عن حي أو شارع… (مثال: العليا)" style="flex:1;border:none;outline:none;font-size:12px;background:transparent">
      </div>
      <div id="map-pick-canvas" style="position:relative;height:300px;border-radius:14px;overflow:hidden;margin-top:10px;cursor:crosshair;border:1px solid var(--c-card-border);background:#E8EAED" data-action="mapClick">
        ${mapSvgLarge()}
        ${pin ? mapPinAt(pin.x, pin.y, 34) : ''}
        <div style="position:absolute;left:10px;bottom:10px;display:flex;flex-direction:column;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.18);overflow:hidden">
          <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#5f6368;border-bottom:1px solid #eee">+</div>
          <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#5f6368">−</div>
        </div>
      </div>
      ${loc ? `
        <div class="flex-center gap-9" style="background:var(--c-chip-bg);border-radius:12px;padding:11px 13px;margin-top:10px">
          ${pinIcon('#654e92', 16)}
          <div class="grow">
            <div style="font-size:12px;font-weight:800">${esc(loc.addr)}</div>
            <div class="num" style="font-size:10px;color:var(--c-muted);margin-top:1px">${esc(loc.coords)}</div>
          </div>
        </div>` : ''}
      <div class="flex gap-9" style="margin-top:13px">
        <button class="btn btn-primary grow ${pin ? '' : 'disabled'}" data-action="confirmMapPick">تأكيد الموقع</button>
        <button class="btn btn-ghost" style="padding:0 18px;font-size:12px" data-action="closeAll">إلغاء</button>
      </div>
    </div>`;
}

// ---------- v5: إنشاء عميل (بأنواعه الأربعة) ----------
function clientNewModal(st) {
  const granters = st.clients.filter((c) => c.type === 'مانح');
  const needsGranter = ['ممنوح بيسك', 'ممنوح سوبر'].includes(st.cnType);
  const ready = (st.cnName || '').trim() && (st.cnCr || '').trim()
    && (!needsGranter || st.cnGranter || granters.length === 0)
    && (st.cnType !== 'ممنوح سوبر' || (st.cnRegion || '').trim());
  return `
    <div style="padding:20px 22px 22px;overflow-y:auto;min-height:0">
      <div class="flex-center gap-8">
        <div class="modal-title grow">إنشاء عميل جديد</div>
        ${closeBtn()}
      </div>
      <div class="field-label">اسم المنشأة</div>
      ${input('cnName', st.cnName, 'مثال: مطاعم الساحل الغربي', {})}
      <div class="flex gap-9">
        <div class="grow">
          <div class="field-label">السجل التجاري</div>
          ${input('cnCr', st.cnCr, '4030-000000', { dir: 'ltr' })}
        </div>
        <div class="grow">
          <div class="field-label">المدينة</div>
          ${input('cnCity', st.cnCity, 'الرياض', {})}
        </div>
      </div>
      <div class="field-label">نوع العميل</div>
      <div style="display:flex;flex-direction:column;gap:7px">
        ${CLIENT_TYPES.map((t) => `
          <div class="flex-center gap-10 clickable" style="border:1.5px solid ${st.cnType === t ? 'var(--c-purple)' : 'var(--c-divider)'};background:${st.cnType === t ? 'var(--c-purple-soft)' : '#fff'};border-radius:12px;padding:10px 13px;cursor:pointer" data-action="setCnType" data-arg="${t}">
            <div style="width:16px;height:16px;border-radius:999px;border:5px solid ${st.cnType === t ? 'var(--c-purple)' : '#D8D4E2'};flex:none"></div>
            <div class="grow">
              <div style="font-size:12px;font-weight:800">${t}</div>
              <div style="font-size:9.5px;color:var(--c-muted);margin-top:1px;line-height:1.6">${CLIENT_TYPE_SUB[t]}</div>
            </div>
          </div>`).join('')}
      </div>
      ${needsGranter ? `
        <div class="field-label">المانح المرتبط (إلزامي)</div>
        ${granters.length ? `
          <div class="flex gap-7 wrap">
            ${granters.map((g) => `
              <div style="height:34px;display:inline-flex;align-items:center;padding:0 14px;border-radius:999px;font-size:11px;font-weight:800;cursor:pointer;${st.cnGranter === g.id ? 'background:var(--c-purple);color:#fff' : 'background:#fff;color:var(--c-muted);border:1px solid var(--c-card-border)'}" data-action="setCnGranter" data-arg="${g.id}">${esc(g.name)}</div>`).join('')}
          </div>`
          : '<div style="font-size:10.5px;color:var(--c-warn-deep);background:var(--c-warn-bg);border:1px dashed var(--c-warn-border);border-radius:10px;padding:9px 13px">لا يوجد مانح مسجّل بعد — أنشئ عميلًا من نوع «مانح» أولًا وسيُربط لاحقًا.</div>'}` : ''}
      ${st.cnType === 'ممنوح سوبر' ? `
        <div class="field-label">منطقة الامتياز (إلزامي)</div>
        ${input('cnRegion', st.cnRegion, 'مثال: المنطقة الغربية', {})}` : ''}
      <div class="flex gap-9" style="margin-top:16px">
        <button class="btn btn-primary grow ${ready ? '' : 'disabled'}" data-action="createClient">إنشاء العميل</button>
        <button class="btn btn-ghost" style="padding:0 18px;font-size:12px" data-action="closeAll">إلغاء</button>
      </div>
      <div style="font-size:9.5px;color:var(--c-faint);margin-top:8px;line-height:1.8">يُنشأ الحساب بحد ائتماني افتتاحي 20,000 ر.س ومحفظة نشطة — الممنوحون يظهرون أيضًا في شبكة الفرنشايز لتعميدهم.</div>
    </div>`;
}

// ---------- v5: إضافة منتج لكتالوج العميل (سعر خاص) ----------
function clProdAddModal(st) {
  const c = st.clients.find((x) => x.id === st.clientSel) || { name: '' };
  const mine = new Set((st.clientProds || []).filter((x) => x.clientId === st.clientSel).map((x) => x.pid));
  const q = (st.cpSearch || '').trim();
  const list = PRODUCTS.filter((p) => !mine.has(p.id) && (!q || p.name.includes(q) || p.id.includes(q))).slice(0, 30);
  return `
    <div style="padding:20px 22px 22px;overflow-y:auto;min-height:0">
      <div class="flex-center gap-8">
        <div class="grow">
          <div class="modal-title">إضافة من كتالوج B2B</div>
          <div style="font-size:10px;color:var(--c-muted);margin-top:2px">لكتالوج «${esc(c.name)}» — يُسعَّر تلقائيًا بخصم الاتفاق ٥٪ وتعدّله بعدها</div>
        </div>
        ${closeBtn()}
      </div>
      <div class="flex-center gap-8" style="height:44px;border:1.5px solid var(--c-card-border);border-radius:12px;background:#fff;padding:0 12px;margin-top:12px">
        ${ICONS.search('#a8a4b8', 15)}
        <input data-input="cpSearch" data-key="cpSearch" value="${esc(st.cpSearch || '')}" placeholder="ابحث بالاسم أو الرمز…" style="flex:1;border:none;outline:none;font-size:12px;background:transparent">
      </div>
      <div style="border:1px solid var(--c-divider);border-radius:13px;overflow:hidden;max-height:320px;overflow-y:auto;margin-top:10px">
        ${list.map((p) => `
          <div class="flex-center gap-10" style="padding:9px 13px;border-bottom:1px solid #F7F5FA">
            ${prodThumb(p, 38)}
            <div class="grow" style="min-width:0">
              <div style="font-size:11.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div>
              <div style="font-size:9.5px;color:var(--c-faint);margin-top:1px">${esc(p.unit)} · <span class="num">${fmt(p.price)}</span> ر.س</div>
            </div>
            <button class="btn btn-purple btn-xs" style="height:30px;border-radius:9px" data-action="clProdAdd" data-arg="${p.id}">إضافة</button>
          </div>`).join('')}
        ${list.length === 0 ? '<div style="padding:18px;font-size:11px;color:var(--c-faint);text-align:center">لا نتائج — كل المنتجات المطابقة مضافة مسبقًا.</div>' : ''}
      </div>
    </div>`;
}

// ---------- v5: إضافة منتج للكتالوج الأساسي ----------
function cadNewModal(st) {
  const ready = (st.cadnName || '').trim() && Number(st.cadnPrice) > 0;
  return `
    <div style="padding:20px 22px 22px;overflow-y:auto;min-height:0">
      <div class="flex-center gap-8">
        <div class="modal-title grow">إضافة منتج للكتالوج الأساسي</div>
        ${closeBtn()}
      </div>
      <div class="field-label">اسم المنتج</div>
      ${input('cadnName', st.cadnName, 'مثال: زيت زيتون بكر — عبوة 4 لتر', {})}
      <div class="flex gap-9">
        <div class="grow">
          <div class="field-label">الوحدة</div>
          ${input('cadnUnit', st.cadnUnit, 'كرتون / حبة / كيس…', {})}
        </div>
        <div class="grow">
          <div class="field-label">السعر الأساسي (ر.س)</div>
          ${input('cadnPrice', st.cadnPrice, '0.00', { dir: 'ltr' })}
        </div>
      </div>
      <div class="field-label">القسم</div>
      <div class="flex gap-7 wrap">
        ${CATEGORIES.filter((x) => x !== 'الكل').map((x) => `
          <div style="height:32px;display:inline-flex;align-items:center;padding:0 13px;border-radius:999px;font-size:10.5px;font-weight:800;cursor:pointer;${(st.cadnCat || 'مواد غذائية') === x ? 'background:var(--c-purple);color:#fff' : 'background:#fff;color:var(--c-muted);border:1px solid var(--c-card-border)'}" data-action="setCadnCat" data-arg="${x}">${x}</div>`).join('')}
      </div>
      <div class="flex gap-9" style="margin-top:16px">
        <button class="btn btn-primary grow ${ready ? '' : 'disabled'}" data-action="cadCreate">إضافة المنتج</button>
        <button class="btn btn-ghost" style="padding:0 18px;font-size:12px" data-action="closeAll">إلغاء</button>
      </div>
      <div style="font-size:9.5px;color:var(--c-faint);margin-top:8px;line-height:1.8">يظهر المنتج فورًا في كتالوج كل العملاء بالسعر الأساسي — الأسعار الخاصة تُدار من ملف كل عميل.</div>
    </div>`;
}

// ---------- v6: سلة إضافة منتجات من كتالوج B2B ----------
function bktModal(st) {
  const pids = Object.keys(st.bkt || {});
  const rows = pids.map((pid) => {
    const p = PRODUCT_MAP[pid];
    if (!p) return '';
    return `
      <div class="flex-center gap-10" style="border:1px solid #F1EFF6;border-radius:13px;padding:9px 12px">
        ${prodThumb(p, 40)}
        <div class="grow" style="min-width:0">
          <div style="font-size:11.5px;font-weight:800">${esc(p.name)}</div>
          <div style="font-size:9.5px;color:var(--c-faint);margin-top:1px">${esc(p.unit)} · سعر الكتالوج <span class="num" style="font-weight:700">${fmt(p.price)}</span> ر.س</div>
        </div>
        <div style="width:28px;height:28px;border-radius:9px;border:1px solid #F3C4C4;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none" data-action="bktRm" data-arg="${pid}">${ICONS.close('#b23b3b', 10, 2.6)}</div>
      </div>`;
  }).join('');

  return `
    <div style="padding:20px 22px 22px;overflow-y:auto;min-height:0">
      <div class="flex-center gap-8">
        <div class="grow">
          <div class="modal-title">سلة الإضافة — طلب منتجات من كتالوج B2B</div>
          <div style="font-size:11px;color:var(--c-muted);margin-top:3px;line-height:1.8">يسعّر B2B كل منتج خصيصًا لمنشأتك، وبعد اعتمادك تنزل في «منتجاتي» بأسعارك الخاصة.</div>
        </div>
        ${closeBtn()}
      </div>
      <div style="max-height:44vh;overflow-y:auto;margin-top:12px;display:flex;flex-direction:column;gap:8px">${rows}</div>
      ${pids.length === 0 ? '<div style="text-align:center;padding:22px;color:var(--c-faint);font-size:11.5px">السلة فارغة — أضف منتجات من «تصفح كتالوج B2B».</div>' : ''}
      <div class="flex gap-9" style="margin-top:15px">
        <button class="btn btn-primary grow ${pids.length ? '' : 'disabled'}" style="height:48px;border-radius:13px;font-size:13px" data-action="bktSend">إرسال طلب الإضافة لفريق B2B</button>
        <button class="btn btn-ghost" style="width:110px;font-size:12.5px" data-action="closeAll">متابعة التصفح</button>
      </div>
    </div>`;
}

// ---------- v6: تسعير طلب إضافة من الكتالوج (B2B) ----------
function rcpModal(st) {
  const r = st.prodReqs.find((x) => x.id === st.modal.id);
  if (!r) return '<div style="padding:22px">الطلب غير موجود.</div>';
  const rows = (r.items || []).map((it) => {
    const p = PRODUCT_MAP[it.pid] || { name: it.pid, unit: '', price: 0 };
    const key = `rcp_${it.pid}`;
    const val = st[key] != null ? st[key] : String(Math.round(p.price * 0.95 * 100) / 100);
    return `
      <div class="flex-center gap-10" style="border:1px solid #F1EFF6;border-radius:13px;padding:9px 12px">
        <div class="grow" style="min-width:0">
          <div style="font-size:11.5px;font-weight:800">${esc(p.name)}</div>
          <div style="font-size:9.5px;color:var(--c-faint);margin-top:1px">${esc(p.unit)} · كتالوج B2B <span class="num" style="font-weight:700">${fmt(p.price)}</span> ر.س</div>
        </div>
        <input class="num" value="${esc(val)}" data-input="${key}" data-key="${key}" dir="ltr" inputmode="decimal"
          style="width:84px;height:36px;text-align:center;font-size:13px;font-weight:700;color:var(--c-purple);border:1.5px solid var(--c-divider);border-radius:10px;outline:none;background:var(--c-subtle)">
        <div style="font-size:9px;color:var(--c-faint);flex:none">ر.س</div>
      </div>`;
  }).join('');

  return `
    <div style="padding:20px 22px 22px;overflow-y:auto;min-height:0">
      <div class="flex-center gap-8">
        <div class="grow">
          <div class="modal-title">تسعير طلب الإضافة <span class="num">${r.id}</span></div>
          <div style="font-size:11px;color:var(--c-muted);margin-top:3px">${esc(r.by)} — حدد السعر الخاص لكل منتج، ثم يُرسل للعميل للاعتماد قبل نزوله في منتجاته.</div>
        </div>
        ${closeBtn()}
      </div>
      <div style="max-height:46vh;overflow-y:auto;margin-top:12px;display:flex;flex-direction:column;gap:8px">${rows}</div>
      <div class="flex gap-9" style="margin-top:15px">
        <button class="btn btn-primary grow" style="height:48px;border-radius:13px;font-size:13px" data-action="rcpConfirm" data-arg="${r.id}">إرسال الأسعار للعميل للاعتماد</button>
        <button class="btn btn-ghost" style="width:110px;font-size:12.5px" data-action="closeAll">إلغاء</button>
      </div>
    </div>`;
}

// ---------- v6: صورة المنتج (إضافة / تغيير / إزالة) ----------
function imgEditModal(st) {
  const p = PRODUCT_MAP[st.imgPid] || { name: '', img: '' };
  return `
    <div style="padding:20px 22px 22px;overflow-y:auto;min-height:0">
      <div class="flex-center gap-8">
        <div class="modal-title grow">صورة «${esc(p.name)}»</div>
        ${closeBtn()}
      </div>
      ${p.img ? `<img src="${esc(p.img)}" alt="" style="width:100%;height:150px;object-fit:cover;border-radius:13px;margin-top:12px;border:1px solid var(--c-divider)" onerror="this.style.display='none'">` : ''}
      <div class="field-label">رابط الصورة (https)</div>
      ${input('imgUrl', st.imgUrl, 'https://…', { dir: 'ltr' })}
      <div class="flex gap-9" style="margin-top:15px">
        <button class="btn btn-primary grow ${(st.imgUrl || '').trim().startsWith('https://') ? '' : 'disabled'}" data-action="imgSave">حفظ الصورة</button>
        ${p.img ? `<button class="btn btn-danger-outline" style="padding:0 16px;font-size:12px" data-action="imgDelete" data-arg="${esc(st.imgPid)}">إزالة الصورة</button>` : ''}
        <button class="btn btn-ghost" style="padding:0 16px;font-size:12px" data-action="closeAll">إلغاء</button>
      </div>
      <div style="font-size:9.5px;color:var(--c-faint);margin-top:8px;line-height:1.8">تظهر الصورة فورًا في كتالوج كل الأدوار — وعند تعذّر تحميلها تظهر الخلفية اللونية الاحتياطية.</div>
    </div>`;
}

// ---------- v7: التحصيل والائتمان ----------

/** هيكل موحد لنوافذ v7: عنوان + وصف + حقول + زر تأكيد */
function finModal({ title, sub, fields, btnLabel, btnAction, btnArg, btnColor = 'var(--c-info)' }) {
  return `
    <div style="padding:20px 22px 22px;overflow-y:auto;min-height:0">
      <div class="flex-center gap-8">
        <div class="modal-title grow">${title}</div>
        ${closeBtn()}
      </div>
      <div style="font-size:11px;color:var(--c-muted);margin-top:3px;line-height:1.8">${sub}</div>
      ${fields}
      <div class="flex gap-9" style="margin-top:15px">
        <button class="btn grow" style="height:48px;border-radius:13px;background:${btnColor};color:#fff;font-size:13px;font-weight:800" data-action="${btnAction}" ${btnArg ? `data-arg="${esc(btnArg)}"` : ''}>${btnLabel}</button>
        <button class="btn btn-ghost" style="width:100px;font-size:12.5px" data-action="closeAll">إلغاء</button>
      </div>
    </div>`;
}

const numInput = (key, val, ph) => `
  <input class="num" value="${esc(val || '')}" data-input="${key}" data-key="${key}" placeholder="${ph}" dir="ltr" inputmode="decimal"
    style="width:100%;margin-top:12px;height:50px;border:1.5px solid var(--c-divider);border-radius:13px;padding:0 14px;font-size:16px;font-weight:700;outline:none;background:var(--c-subtle);text-align:center">`;
const dateInput = (key, val, label) => `
  <div style="font-size:11px;font-weight:800;color:var(--c-muted);margin:13px 2px 6px">${label} — اختر من التقويم</div>
  <input class="num" type="date" value="${esc(val || '')}" data-input="${key}" data-key="${key}" dir="ltr"
    style="width:100%;height:48px;border:1.5px solid var(--c-divider);border-radius:13px;padding:0 14px;font-size:14px;font-weight:700;outline:none;background:var(--c-subtle)">`;
const noteInput = (key, val, ph) => `
  <input value="${esc(val || '')}" data-input="${key}" data-key="${key}" placeholder="${ph}"
    style="width:100%;margin-top:9px;height:46px;border:1.5px solid var(--c-divider);border-radius:13px;padding:0 14px;font-size:12.5px;outline:none;background:var(--c-subtle)">`;

/** طلب أجل (العميل) */
function wcAjelModal(st) {
  const months = [[1, 'شهر'], [2, 'شهران'], [3, '3 أشهر']];
  return finModal({
    title: 'طلب أجل',
    sub: 'أجل سداد بمدة محددة يراجعه B2B — عند الموافقة تصبح مشترياتك آجلة حتى تاريخ الاستحقاق، والتعثر بعده يفتح ملف تحصيل تلقائيًا.',
    fields: `
      ${numInput('waAmt', st.waAmt, 'مبلغ الأجل المطلوب بالريال')}
      <div style="font-size:11px;font-weight:800;color:var(--c-muted);margin:12px 2px 7px">مدة الأجل</div>
      <div class="flex gap-7">
        ${months.map(([m, l]) => `
          <div class="grow" style="height:40px;display:flex;align-items:center;justify-content:center;border-radius:11px;font-size:11.5px;font-weight:800;cursor:pointer;${(st.waMonths || 1) === m ? 'background:var(--c-purple);color:#fff' : 'background:#fff;color:var(--c-muted);border:1px solid var(--c-card-border)'}" data-action="setWaMonths" data-arg="${m}">${l}</div>`).join('')}
      </div>
      ${noteInput('waNote', st.waNote, 'مبرر الطلب — مثال: توسعة، موسم، افتتاح فرع…')}`,
    btnLabel: 'إرسال الطلب لB2B', btnAction: 'waSend', btnColor: 'var(--c-purple)',
  });
}

/** طلب مهلة / تأجيل (العميل) */
function wcDelayModal(st) {
  return finModal({
    title: 'طلب مهلة / تأجيل سداد',
    sub: 'يصل الطلب لB2B ويقرره — الموافقة تجمّد التصعيد حتى التاريخ المقترح وتُسجل في ملفك.',
    fields: `${dateInput('wdDate', st.wdDate, 'التاريخ المقترح')}${noteInput('wdNote', st.wdNote, 'سبب المهلة — اختياري')}`,
    btnLabel: 'إرسال طلب المهلة', btnAction: 'wdSend', btnColor: '#b26a16',
  });
}

/** وعد سداد (العميل) */
function wcPromModal(st) {
  return finModal({
    title: 'تحديد وعد سداد',
    sub: 'يُسجل فورًا في ملف التحصيل ويُبلغ B2B — الالتزام به يوقف التصعيد، والإخلاف يصعّده تلقائيًا.',
    fields: `${dateInput('wpDate', st.wpDate, 'تاريخ السداد')}${numInput('wpAmt', st.wpAmt, 'المبلغ الموعود بالريال')}`,
    btnLabel: 'تسجيل الوعد وإبلاغ B2B', btnAction: 'wpSend',
  });
}

/** سداد دفعة من المحفظة (العميل) */
function wcPayModal(st) {
  const f = (st.colFiles || []).find((x) => x.id === st.modal.id) || { amt: 0 };
  return finModal({
    title: 'سداد دفعة من المحفظة',
    sub: `المستحق <span class="num" style="font-weight:700;color:var(--c-danger)">${fmt(f.amt)}</span> ر.س · رصيد محفظتك <span class="num" style="font-weight:700;color:var(--c-purple)">${fmt(st.wallet.bal)}</span> ر.س — أي مبلغ تسدده يُسجل دفعة في ملفك، وسداد الكامل يغلقه.`,
    fields: numInput('wpaAmt', st.wpaAmt, 'مبلغ الدفعة بالريال'),
    btnLabel: 'سداد الدفعة', btnAction: 'wpaConfirm', btnArg: st.modal.id, btnColor: 'var(--c-success)',
  });
}

/** وعد سداد (B2B) */
function ccPromModal(st) {
  return finModal({
    title: 'تسجيل وعد سداد',
    sub: 'وعد متفق عليه مع العميل — يُراقب تلقائيًا ويُصعّد الملف عند الإخلاف به.',
    fields: `${dateInput('ccpDate', st.ccpDate, 'تاريخ الوعد')}${numInput('ccpAmt', st.ccpAmt, 'المبلغ الموعود بالريال')}`,
    btnLabel: 'تسجيل الوعد', btnAction: 'ccpSend', btnArg: st.modal.id,
  });
}

/** تسجيل دفعة تحصيل (B2B) */
function colPayModal(st) {
  const f = (st.colFiles || []).find((x) => x.id === st.modal.id) || { amt: 0 };
  return finModal({
    title: `تسجيل دفعة — <span class="num">${esc(st.modal.id || '')}</span>`,
    sub: `المستحق المتبقي <span class="num" style="font-weight:700;color:var(--c-danger)">${fmt(f.amt)}</span> ر.س — سجّل ما حُصّل نقدًا أو بتحويل خارج المنصة؛ سداد الكامل يغلق الملف.`,
    fields: numInput('cpAmt', st.cpAmt, 'مبلغ الدفعة بالريال'),
    btnLabel: 'تسجيل الدفعة', btnAction: 'cpConfirm', btnArg: st.modal.id, btnColor: 'var(--c-success)',
  });
}

/** جدولة الاستحقاق (B2B) */
function ccResModal(st) {
  const f = (st.colFiles || []).find((x) => x.id === st.modal.id) || { dueHist: [] };
  return finModal({
    title: 'جدولة تاريخ الاستحقاق',
    sub: `الجدولة رقم <span class="num">${(f.dueHist || []).length + 1}</span> من 5 كحد أقصى — تُصفّر عداد التأخر وتُوثق في سجل الملف وسجل تعديل الاستحقاق.`,
    fields: `${dateInput('ccrDate', st.ccrDate, 'الاستحقاق الجديد')}${noteInput('ccrWhy', st.ccrWhy, 'سبب الجدولة')}`,
    btnLabel: 'اعتماد الجدولة', btnAction: 'ccrConfirm', btnArg: st.modal.id, btnColor: '#b26a16',
  });
}

/** تعديل الحد الائتماني (B2B) */
function clLimitModal(st) {
  const c = st.clients.find((x) => x.id === st.clientSel) || { name: '', limit: 0, used: 0 };
  return finModal({
    title: `تعديل الحد الائتماني — ${esc(c.name)}`,
    sub: `الحد الحالي <span class="num" style="font-weight:700;color:var(--c-purple)">${fmt0(c.limit)}</span> ر.س · المستخدم <span class="num" style="font-weight:700">${fmt0(c.used)}</span> ر.س — لا يقبل حدًا أقل من المستخدم.`,
    fields: numInput('nlAmt', st.nlAmt, 'الحد الجديد بالريال'),
    btnLabel: 'حفظ الحد الجديد', btnAction: 'nlSave', btnColor: 'var(--c-purple)',
  });
}

/** شحن محفظة عميل (B2B — قيد مباشر) */
function clTopupModal(st) {
  const c = st.clients.find((x) => x.id === st.clientSel) || { name: '', bal: 0 };
  return finModal({
    title: `شحن محفظة — ${esc(c.name)}`,
    sub: `الرصيد الحالي <span class="num" style="font-weight:700;color:var(--c-purple)">${fmt0(c.bal)}</span> ر.س — قيد مباشر لدفعة استلمها B2B خارج المنصة (نقد/شيك/حوالة موثقة).`,
    fields: numInput('ctAmt', st.ctAmt, 'المبلغ بالريال'),
    btnLabel: 'إضافة المبلغ للمحفظة', btnAction: 'ctConfirm',
  });
}

/** ملف القضية القانوني (B2B) */
function legalModal(st) {
  const f = (st.colFiles || []).find((x) => x.id === st.modal.id);
  if (!f) return '<div style="padding:22px">الملف غير موجود.</div>';
  const c = st.clients.find((x) => x.id === f.clientId) || { name: '', cr: '', city: '' };
  const kv = (rows) => `
    <div style="border:1px solid var(--c-divider);border-radius:13px;overflow:hidden">
      ${rows.map(([a, b]) => `
        <div class="flex" style="border-top:1px solid var(--c-divider);font-size:11px">
          <div style="width:150px;background:var(--c-subtle);padding:8px 13px;font-weight:800;color:#55506a;flex:none">${a}</div>
          <div class="grow" style="padding:8px 13px;font-weight:700">${b}</div>
        </div>`).join('')}
    </div>`;
  return `
    <div style="padding:20px 22px 22px;max-height:78vh;overflow-y:auto;min-height:0">
      <div class="flex-center gap-10">
        <div style="width:38px;height:38px;border-radius:11px;background:#262433;color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;flex:none">⚖</div>
        <div class="grow">
          <div class="modal-title">ملف القضية القانوني — <span class="num">${f.id}</span></div>
          <div style="font-size:10.5px;color:var(--c-muted);margin-top:1px">سري — يُسلَّم للمستشار القانوني بعد استنفاد مراحل التحصيل الودية</div>
        </div>
        ${closeBtn()}
      </div>
      <div style="font-size:11px;font-weight:800;color:var(--c-purple);margin:15px 2px 7px">أولًا — بيانات المدين</div>
      ${kv([
        ['اسم المنشأة', esc(c.name)],
        ['السجل التجاري', `<span class="num">${esc(c.cr)}</span>`],
        ['المدينة', esc(c.city)],
        ['نوع العميل', esc(c.type || 'مستقل')],
        ['حالة الحساب', c.st === 'susp' ? 'موقوف' : 'نشط — يُوقف عند الإحالة'],
      ])}
      <div style="font-size:11px;font-weight:800;color:var(--c-purple);margin:13px 2px 7px">ثانيًا — بيانات المديونية</div>
      ${kv([
        ['مرجع الدين', `<span class="num">${esc(f.inv)}</span> · ${esc(f.ref)}`],
        ['أصل المبلغ', `<span class="num">${fmt(f.origAmt)}</span> ر.س`],
        ['المستحق المتبقي', `<span class="num" style="color:var(--c-danger)">${fmt(f.amt)}</span> ر.س`],
        ['تاريخ إنشاء الدين', `<span class="num">${esc(f.created)}</span>`],
        ['الاستحقاق الحالي والتأخر', `<span class="num">${esc(f.due)}</span> — متأخر <span class="num">${f.lateDays}</span> يومًا`],
      ])}
      <div style="font-size:11px;font-weight:800;color:var(--c-purple);margin:13px 2px 7px">ثالثًا — سجل تعديل تاريخ الاستحقاق</div>
      ${(f.dueHist || []).length ? `
        <div style="border:1px solid #F0DEB8;border-radius:13px;overflow:hidden">
          <div style="display:grid;grid-template-columns:34px 1fr 1fr 1.1fr 150px;gap:8px;padding:8px 13px;background:#b26a16;font-size:9px;font-weight:800;color:#fff">
            <div>#</div><div>الاستحقاق السابق</div><div>الاستحقاق الجديد</div><div>السبب</div><div>تاريخ التعديل</div>
          </div>
          ${f.dueHist.map((h, i) => `
            <div style="display:grid;grid-template-columns:34px 1fr 1fr 1.1fr 150px;gap:8px;align-items:center;padding:8px 13px;border-top:1px solid #F7EBD2;background:#fff">
              <div class="num" style="width:20px;height:20px;border-radius:999px;background:var(--c-warn-bg);color:#8a5f10;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center">${i + 1}</div>
              <div class="num" style="font-size:9.5px;font-weight:700;color:var(--c-faint);text-decoration:line-through">${esc(h.old)}</div>
              <div class="num" style="font-size:9.5px;font-weight:800;color:var(--c-danger)">${esc(h.to)}</div>
              <div style="font-size:9px;font-weight:700;color:#55506a">${esc(h.why)}</div>
              <div class="num" style="font-size:9px;font-weight:700;color:var(--c-muted)">${esc(h.d)}</div>
            </div>`).join('')}
        </div>`
        : '<div style="border:1px dashed #DDD9E6;border-radius:13px;padding:11px 14px;font-size:10.5px;color:var(--c-muted);background:var(--c-subtle)">لا توجد تعديلات — الدين قائم على تاريخ الاستحقاق الأصلي دون أي مهل أو جدولات.</div>'}
      <div style="font-size:11px;font-weight:800;color:var(--c-purple);margin:13px 2px 7px">رابعًا — السجل الزمني الموثق للإجراءات</div>
      <div style="border:1px solid var(--c-divider);border-radius:13px;overflow:hidden">
        <div style="display:grid;grid-template-columns:40px 1fr 170px;gap:8px;padding:8px 13px;background:#262433;font-size:9.5px;font-weight:800;color:#fff">
          <div>#</div><div>الإجراء</div><div>التاريخ والوقت</div>
        </div>
        <div style="max-height:200px;overflow-y:auto">
          ${(f.log || []).map((g, i) => `
            <div style="display:grid;grid-template-columns:40px 1fr 170px;gap:8px;align-items:center;padding:9px 13px;border-top:1px solid var(--c-divider)">
              <div class="num" style="width:22px;height:22px;border-radius:999px;background:#EBE8F2;color:#262433;font-size:9.5px;font-weight:800;display:flex;align-items:center;justify-content:center">${i + 1}</div>
              <div style="font-size:10.5px;font-weight:700;color:#55506a;line-height:1.7">${esc(g.t)}</div>
              <div class="num" style="font-size:9.5px;font-weight:700;color:var(--c-muted)">${esc(g.d)}</div>
            </div>`).join('')}
        </div>
      </div>
      <div style="background:var(--c-warn-bg);border:1px solid #F0DEB8;border-radius:12px;padding:10px 14px;font-size:10.5px;line-height:1.9;color:#8a5f10;margin-top:12px">استنفدت المنصة الإجراءات الودية الموثقة أعلاه دون سداد — الملف جاهز للمطالبة وفق نظام المعاملات التجارية.</div>
      <div class="flex gap-9" style="margin-top:15px">
        <button class="btn grow" style="height:48px;border-radius:13px;background:#262433;color:#fff;font-size:13px;font-weight:800" data-action="legalDownload" data-arg="${f.id}">⬇ تحميل ملف القضية — لتسليم المحامي</button>
        <button class="btn btn-ghost" style="width:100px;font-size:12.5px" data-action="closeAll">إغلاق</button>
      </div>
    </div>`;
}

const MODALS = {
  cart: cartModal,
  cnNew: clientNewModal,
  clProdAdd: clProdAddModal,
  cadNew: cadNewModal,
  bkt: bktModal,
  rcp: rcpModal,
  imgEdit: imgEditModal,
  wcAjel: wcAjelModal,
  wcDelay: wcDelayModal,
  wcProm: wcPromModal,
  wcPay: wcPayModal,
  ccProm: ccPromModal,
  colPay: colPayModal,
  ccRes: ccResModal,
  clLimit: clLimitModal,
  clTopup: clTopupModal,
  legal: legalModal,
  brDet: branchDetailModal,
  mapView: mapViewModal,
  mapPick: mapPickModal,
  reqPrice: reqPriceModal,
  invDet: invoiceDetailModal,
  approve: approveModal,
  reject: reasonModal,
  hold: reasonModal,
  tHold: reasonModal,
  receive: receiveModal,
  ticket: ticketModal,
  topup: topupModal,
  fr: franchiseeModal,
  frNew: franchiseeInviteModal,
  listNew: listNewModal,
  reqNew: requestNewModal,
  userNew: userNewModal,
  userEdit: userEditModal,
};

export function renderModal(st) {
  if (!st.modal) return '';
  const renderFn = MODALS[st.modal.k];
  if (!renderFn) return '';
  return `
    <div class="modal-wrap">
      <div class="overlay" data-action="closeAll"></div>
      <div class="modal">${renderFn(st)}</div>
    </div>`;
}
