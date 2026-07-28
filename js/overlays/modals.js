// ============================================================
// النوافذ المنبثقة: السلة، التعميد، الرفض/التعليق، الاستلام، التذكرة،
// شحن المحفظة، ملف الممنوح، دعوة ممنوح، لستة جديدة، اقتراح منتج،
// إضافة مستخدم، تعديل مستخدم
// ============================================================
import { esc, ICONS } from '../core/dom.js';
import { fmt, fmt0 } from '../core/format.js';
import { chip, prodThumb, closeBtn, input, stepper } from '../ui.js';
import { findOrder } from '../actions.js';
import { FRANCHISEE_STATUS } from '../data/constants.js';
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
        <div class="flex-center gap-11" style="padding:10px 0;border-bottom:1px solid var(--c-divider)">
          ${prodThumb(p)}
          <div class="grow" style="min-width:0">
            <div style="font-size:11.5px;font-weight:700">${esc(p.name)}</div>
            <div style="font-size:9.5px;color:var(--c-faint);margin-top:2px">${esc(p.unit)}${qty !== i.qty ? '<span style="color:#c98a12;font-weight:800"> · عُدّلت</span>' : ''}</div>
          </div>
          ${stepper(qty, 'approveInc', 'approveDec', i.pid)}
        </div>`;
      }).join('')}
    </div>
    <div class="modal-foot">
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
      <div class="flex mt-14" style="font-size:11.5px;color:var(--c-muted);background:var(--c-subtle);border:1px solid var(--c-divider);border-radius:13px;padding:12px 16px">
        <div>الرصيد بعد الشحن</div><div class="grow"></div>
        <div class="num" style="font-weight:700;color:var(--c-success)">${fmt(st.wallet.bal + st.topupAmt)} ر.س</div>
      </div>
      <button class="btn btn-primary btn-block mt-12" data-action="confirmTopup">تأكيد الشحن — إيصال PDF فوري</button>
    </div>`;
}

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

// ---------- دعوة ممنوح ----------
function franchiseeInviteModal(st) {
  const ready = st.frName.trim() && st.frCr.trim();
  return `
    <div style="padding:20px 22px 22px">
      <div class="modal-title">دعوة ممنوح فرنشايز</div>
      <div style="font-size:11px;color:var(--c-muted);margin-top:3px;line-height:1.8">يُنشأ حسابه ومحفظته المستقلة عند قبول الدعوة وتوثيق السجل التجاري.</div>
      <div class="mt-14">${input('frName', st.frName, 'اسم المنشأة')}</div>
      <div class="mt-9">${input('frCr', st.frCr, 'رقم السجل التجاري', { dir: 'ltr' })}</div>
      <div class="flex gap-9" style="margin-top:13px">
        <button class="btn btn-primary grow ${ready ? '' : 'disabled'}" data-action="sendInvite">إرسال الدعوة</button>
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

const MODALS = {
  cart: cartModal,
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
