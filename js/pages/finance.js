// ============================================================
// العمليات المالية: المحفظة / الفواتير (عملاء) + محافظ العملاء (B2B)
// ============================================================
import { esc } from '../core/dom.js';
import { fmt, fmt0 } from '../core/format.js';
import { chip, filterChips, ledgerAmount, emptyState } from '../ui.js';
import { INVOICE_STATUS, INVOICE_FILTERS, CAN_PAY, ORG_CR, DEFAULT_CR, ROLES } from '../data/constants.js';
import { sessionClientId } from '../actions.js';

// ============ التحصيل والائتمان (v7) ============

/** مراحل التصعيد الخمس لملف التحصيل */
export const COL_STAGES = ['تواصل ودي', 'مطالبة رسمية', 'إنذار نهائي', 'تجميد الائتمان', 'إحالة قانونية'];
const STAGE_COLORS = ['#0d7f93', '#b26a16', '#b23b3b', '#8a2432', '#262433'];
export const FRQ_KIND = { ajel: 'أجل', delay: 'مهلة', promise: 'وعد سداد' };
const FRQ_ST = { pend: ['قيد المراجعة', 'chip-warn'], ok: ['معتمد', 'chip-success'], no: ['مرفوض', 'chip-danger'] };

export function colStageColor(f) { return f.st === 'closed' ? 'var(--c-success)' : STAGE_COLORS[f.stage - 1]; }

function clientNameById(st, id) {
  const c = st.clients.find((x) => x.id === id);
  return c ? c.name : `عميل ${id}`;
}

/** تفاصيل نصية لطلب أجل/مهلة/وعد */
function frqDetTxt(r) {
  if (r.kind === 'ajel') return `${fmt0(r.amt)} ر.س · ${r.months === 1 ? 'شهر' : r.months === 2 ? 'شهران' : `${r.months} أشهر`}`;
  if (r.kind === 'delay') return `تأجيل حتى ${r.toDate}`;
  return `${fmt0(r.amt)} ر.س بتاريخ ${r.toDate}`;
}

/** جدول سجل طلبات الأجل والمهلة (يُستخدم لدى العميل وداخل ملف العميل لدى B2B) */
export function frqHistoryTable(st, rows, openAction) {
  if (!rows.length) return '';
  return `
    <div class="card" style="overflow:hidden;margin-bottom:14px">
      <div style="font-size:12.5px;font-weight:800;padding:12px 16px 8px">سجل طلبات الأجل والمهلة — اضغط طلبًا معتمدًا لعرض ملف تحصيله</div>
      <div class="table-head" style="padding:7px 16px;border-top:1px solid var(--c-divider)">
        <div style="width:64px">الطلب</div><div style="width:70px">النوع</div><div style="flex:1.1">التفاصيل</div>
        <div style="flex:1.3">المبرر</div><div style="width:100px">ملف التحصيل</div><div style="width:106px">الحالة</div>
      </div>
      ${rows.map((r) => {
        const s = FRQ_ST[r.st] || FRQ_ST.pend;
        const clickable = r.fileId && r.st === 'ok';
        return `
        <div class="table-row ${clickable ? 'clickable" data-action="' + openAction + '" data-arg="' + r.fileId + '"' : '"'} style="padding:10px 16px">
          <div class="num" style="width:64px;font-size:10px;font-weight:700">${r.id}</div>
          <div style="width:70px;font-size:10.5px;font-weight:800;color:var(--c-purple)">${FRQ_KIND[r.kind] || r.kind}</div>
          <div style="flex:1.1;font-size:10.5px;font-weight:700;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(frqDetTxt(r))}</div>
          <div style="flex:1.3;font-size:9.5px;color:var(--c-muted);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.note || '—')}</div>
          <div class="num" style="width:100px;font-size:9.5px;font-weight:800;color:var(--c-info)">${r.fileId || '—'}</div>
          <div style="width:106px">${chip(s[0], s[1])}</div>
        </div>`;
      }).join('')}
    </div>`;
}

/** بطاقة ملف التحصيل الكاملة — viewer: 'b2b' أو 'client' يغيّر أزرار الإجراءات */
export function colFileCard(st, f, viewer) {
  const closed = f.st === 'closed';
  const color = colStageColor(f);
  const stageIdx = f.stage;
  const lineW = closed ? 80 : Math.max(0, (stageIdx - 1) / 4 * 80);

  const steps = COL_STAGES.map((l, i) => {
    const n = i + 1;
    const on = n <= stageIdx && !closed;
    const done = closed;
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;position:relative">
        <div class="num" style="width:33px;height:33px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;z-index:1;
          ${done ? 'background:var(--c-success);color:#fff' : on ? `background:${color};color:#fff` : 'background:#fff;border:2px solid #EDEAF4;color:var(--c-faint)'}">${n}</div>
        <div style="font-size:9px;font-weight:800;margin-top:7px;text-align:center;line-height:1.5;color:${on && !done ? color : 'var(--c-faint)'}">${l}</div>
      </div>`;
  }).join('');

  const dueHist = (f.dueHist || []);
  const dhBlock = dueHist.length ? `
    <div style="margin-top:12px">
      <div style="border:1px solid #F0DEB8;border-radius:11px;overflow:hidden">
        <div class="flex-center gap-8 clickable" style="padding:9px 12px;background:var(--c-warn-bg);cursor:pointer" data-action="toggleDh">
          <div style="transform:rotate(${st.dhOpen ? '90deg' : '0deg'});transition:transform .15s;font-size:10px;color:#8a5f10">◀</div>
          <div class="grow" style="font-size:10px;font-weight:800;color:#8a5f10">سجل تعديل تاريخ الاستحقاق</div>
          <div class="num" style="min-width:19px;height:19px;padding:0 6px;border-radius:999px;background:#fff;color:#8a5f10;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center">${dueHist.length}</div>
          <div style="font-size:8.5px;font-weight:800;color:#b28a3f">اضغط للعرض</div>
        </div>
        ${st.dhOpen ? `
          <div style="display:grid;grid-template-columns:34px 1fr 1fr 1.1fr 150px;gap:8px;padding:7px 12px;background:#FDF7E9;font-size:9px;font-weight:800;color:#8a5f10;border-top:1px solid #F7EBD2">
            <div>#</div><div>الاستحقاق السابق</div><div>الاستحقاق الجديد</div><div>السبب</div><div>تاريخ التعديل</div>
          </div>
          ${dueHist.map((h, i) => `
            <div style="display:grid;grid-template-columns:34px 1fr 1fr 1.1fr 150px;gap:8px;align-items:center;padding:7px 12px;border-top:1px solid #F7EBD2;background:#fff">
              <div class="num" style="width:19px;height:19px;border-radius:999px;background:var(--c-warn-bg);color:#8a5f10;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center">${i + 1}</div>
              <div class="num" style="font-size:9.5px;font-weight:700;color:var(--c-faint);text-decoration:line-through">${esc(h.old)}</div>
              <div class="num" style="font-size:9.5px;font-weight:800;color:var(--c-danger)">${esc(h.to)}</div>
              <div style="font-size:9px;font-weight:700;color:#55506a">${esc(h.why)}</div>
              <div class="num" style="font-size:9px;font-weight:700;color:var(--c-muted)">${esc(h.d)}</div>
            </div>`).join('')}` : ''}
      </div>
    </div>` : '';

  const rescheduleExhausted = dueHist.length >= 5;
  const actions = closed ? '' : viewer === 'b2b' ? `
    <div class="flex gap-7 wrap" style="margin-top:13px;align-items:center">
      <button class="btn btn-success-solid" style="height:38px;padding:0 16px;border-radius:11px;font-size:11px" data-action="openColPay" data-arg="${f.id}">تسجيل دفعة</button>
      <button class="btn" style="height:38px;padding:0 14px;border-radius:11px;background:var(--c-info-bg);color:var(--c-info);font-size:11px;font-weight:800" data-action="openCcProm" data-arg="${f.id}">تسجيل وعد سداد</button>
      <button class="btn" style="height:38px;padding:0 14px;border-radius:11px;background:#fff;border:1px solid var(--c-divider);color:#55506a;font-size:11px;font-weight:800" data-action="colRemind" data-arg="${f.id}">إرسال تذكير</button>
      ${rescheduleExhausted
        ? '<div style="height:38px;padding:0 14px;border-radius:11px;background:var(--c-subtle);color:var(--c-faint);font-size:11px;font-weight:800;display:flex;align-items:center">استُنفدت الجدولة (5/5)</div>'
        : `<button class="btn" style="height:38px;padding:0 14px;border-radius:11px;background:var(--c-warn-bg);border:1px solid var(--c-warn-border);color:#8a5f10;font-size:11px;font-weight:800" data-action="openCcRes" data-arg="${f.id}">جدولة الاستحقاق (${dueHist.length}/5)</button>`}
      ${f.stage >= 5 ? `<button class="btn" style="height:38px;padding:0 16px;border-radius:11px;background:#262433;color:#fff;font-size:11px;font-weight:800" data-action="openLegal" data-arg="${f.id}">⚖ ملف القضية القانوني</button>` : ''}
      <div class="grow"></div>
      ${f.stage < 5 ? `<button class="btn btn-danger-outline" style="height:38px;padding:0 16px;border-radius:11px;font-size:11px;border-width:1.5px" data-action="colEscalate" data-arg="${f.id}">تصعيد إلى «${COL_STAGES[f.stage]}»</button>` : ''}
    </div>` : `
    <div class="flex gap-8 wrap" style="margin-top:13px;align-items:center">
      <button class="btn btn-success-solid" style="height:42px;padding:0 20px;border-radius:12px;font-size:12px" data-action="openWcPay" data-arg="${f.id}">سداد دفعة من المحفظة</button>
      <button class="btn" style="height:42px;padding:0 15px;border-radius:12px;background:#fff;border:1px solid #F0DEB8;color:#b26a16;font-size:11px;font-weight:800" data-action="openWcDelay" data-arg="${f.id}">طلب مهلة / تأجيل</button>
      <button class="btn" style="height:42px;padding:0 15px;border-radius:12px;background:var(--c-info-bg);color:var(--c-info);font-size:11px;font-weight:800" data-action="openWcProm" data-arg="${f.id}">تحديد وعد سداد بتاريخ</button>
      <div style="font-size:9.5px;color:var(--c-faint);line-height:1.7;flex:1;min-width:150px">التأخر يصعّد الملف تلقائيًا حتى تجميد الائتمان وإيقاف الحساب — السداد في المواعيد يعيد حالتك «نشط».</div>
    </div>`;

  return `
    <div class="card" style="border:1.5px solid ${closed ? 'var(--c-success-border, #BFE8CC)' : '#F0DEB8'};padding:16px 18px">
      <div class="flex-center gap-9 wrap">
        <div style="width:9px;height:9px;border-radius:999px;background:${color};flex:none"></div>
        <div style="font-size:13.5px;font-weight:800">ملف التحصيل <span class="num">${f.id}</span>${viewer === 'b2b' ? ` — ${esc(clientNameById(st, f.clientId))}` : ''}</div>
        <div style="font-size:10px;color:var(--c-faint)"><span class="num">${esc(f.inv)}</span> · ${esc(f.ref)}</div>
        <div class="grow"></div>
        <div style="display:flex;align-items:stretch;border:1px solid var(--c-divider);border-radius:11px;overflow:hidden">
          <div style="background:var(--c-subtle);padding:5px 12px;text-align:center"><div style="font-size:8px;font-weight:800;color:var(--c-faint)">تاريخ إنشاء الدين</div><div class="num" style="font-size:11px;font-weight:800;margin-top:1px" dir="ltr">${esc(f.created)}</div></div>
          <div style="width:1px;background:var(--c-divider)"></div>
          <div style="background:var(--c-danger-bg);padding:5px 12px;text-align:center"><div style="font-size:8px;font-weight:800;color:var(--c-danger)">تاريخ الاستحقاق الحالي</div><div class="num" style="font-size:11px;font-weight:800;margin-top:1px;color:var(--c-danger)" dir="ltr">${esc(f.due)}</div></div>
          <div style="width:1px;background:var(--c-divider)"></div>
          <div style="background:var(--c-subtle);padding:5px 12px;text-align:center"><div style="font-size:8px;font-weight:800;color:var(--c-faint)">المبلغ المستحق</div><div class="num" style="font-size:11px;font-weight:700;margin-top:1px;color:var(--c-danger)">${fmt(f.amt)} <span style="font-size:8px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div></div>
        </div>
        ${closed
          ? chip('مسدد ومغلق ✓', 'chip-success')
          : f.lateDays > 0
            ? `<span style="display:inline-flex;align-items:center;height:26px;padding:0 11px;border-radius:999px;background:var(--c-danger-bg);color:var(--c-danger);font-size:10px;font-weight:800">متأخر <span class="num" style="margin:0 3px">${f.lateDays}</span> يومًا</span>`
            : chip('ضمن الاستحقاق', 'chip-info')}
      </div>
      <div style="display:flex;gap:4px;margin:38px 0 30px;align-items:flex-start;position:relative">
        <div style="position:absolute;top:16px;right:10%;left:10%;height:3.5px;border-radius:999px;background:#EDEAF4"></div>
        <div style="position:absolute;top:16px;right:10%;width:${lineW}%;height:3.5px;border-radius:999px;background:${color}"></div>
        ${steps}
      </div>
      ${f.promise && !closed ? `<div style="background:var(--c-info-bg);border:1px solid #B5E7F0;border-radius:12px;padding:9px 14px;margin-bottom:11px;font-size:10.5px;font-weight:800;color:var(--c-info)">وعد سداد قائم: <span class="num">${fmt0(f.promise.amt)}</span> ر.س بتاريخ <span class="num">${esc(f.promise.date)}</span> — يُراقب تلقائيًا ويُصعّد عند الإخلاف</div>` : ''}
      ${closed ? '<div style="background:var(--c-success-bg);border:1px solid #BFE8CC;border-radius:12px;padding:10px 14px;margin-bottom:11px;font-size:11px;font-weight:800;color:var(--c-success)">هذا الملف مسدد ومغلق بالكامل ✓ — محفوظ في السجل للتوثيق ولا إجراءات عليه.</div>' : ''}
      ${actions}
      ${dhBlock}
      <div style="margin-top:13px">
        <div style="font-size:11px;font-weight:800;color:#55506a;margin-bottom:7px">${viewer === 'b2b' ? 'سجل إجراءات التحصيل' : 'سجل المتابعة'}</div>
        <div style="border:1px solid var(--c-divider);border-radius:12px;overflow:hidden">
          <div style="display:grid;grid-template-columns:40px 1fr 170px;gap:8px;padding:8px 13px;background:var(--c-subtle);font-size:9.5px;font-weight:800;color:var(--c-faint)">
            <div>#</div><div>الإجراء</div><div>التاريخ والوقت</div>
          </div>
          <div style="max-height:200px;overflow-y:auto">
            ${(f.log || []).map((g, i) => `
              <div style="display:grid;grid-template-columns:40px 1fr 170px;gap:8px;align-items:center;padding:9px 13px;border-top:1px solid var(--c-divider)">
                <div class="num" style="width:22px;height:22px;border-radius:999px;background:var(--c-purple-soft);color:var(--c-purple);font-size:9.5px;font-weight:800;display:flex;align-items:center;justify-content:center">${i + 1}</div>
                <div style="font-size:10.5px;font-weight:700;color:#55506a;line-height:1.7">${esc(g.t)}</div>
                <div class="num" style="font-size:9.5px;font-weight:700;color:var(--c-muted)">${esc(g.d)}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

/** صفحة ملف التحصيل — B2B (عودة للمركز المالي) والعميل (عودة للمحفظة) */
export function renderColDet(st) {
  const f = (st.colFiles || []).find((x) => x.id === st.colSel);
  const isB2b = st.role === 'b2b';
  const backArg = st.colBack || (isB2b ? 'fintu' : 'wallet');
  const back = `
    <button class="btn" style="height:40px;padding:0 16px;border-radius:999px;background:#fff;border:1px solid var(--c-divider);color:#55506a;font-size:11.5px;font-weight:800;margin-bottom:14px" data-action="colBackGo" data-arg="${backArg}">→ ${backArg === 'fintu' ? 'عودة للمركز المالي' : backArg === 'clientdet' ? 'عودة للملف المالي للعميل' : 'عودة للمحفظة'}</button>`;
  if (!f) return back + emptyState('ملف التحصيل غير موجود.');
  return back + colFileCard(st, f, isB2b ? 'b2b' : 'client');
}

function ledgerRows(list, pad = '13px 18px') {
  return list.map((h) => `
    <div class="flex-center gap-10" style="padding:${pad};border-top:1px solid var(--c-divider)">
      <div class="grow">
        <div style="font-size:12px;font-weight:700">${esc(h.t)}</div>
        <div style="font-size:10px;color:var(--c-faint);margin-top:2px">${esc(h.d)}</div>
      </div>
      ${ledgerAmount(h.amt)}
    </div>`).join('');
}

/** بانر التحويلات البنكية المعلقة لمنشأة الجلسة */
function pendingTopupBanner(st) {
  const myOrg = (ROLES[st.role] || {}).org;
  const mine = (st.topupReqs || []).filter((r) => r.org === myOrg);
  if (!mine.length) return '';
  return `
    <div class="banner banner-warn" style="margin-bottom:14px;padding:12px 16px">
      ${mine.map((r) => `
        <div class="flex-center gap-8" style="font-size:11.5px;font-weight:800;color:var(--c-warn-deep);padding:3px 0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="#b26a16" stroke-width="1.8"></circle><path d="M12 8v4.5l2.8 1.6" stroke="#b26a16" stroke-width="1.8" stroke-linecap="round"></path></svg>
          تحويل بنكي <span class="num">${r.id}</span> بمبلغ <span class="num">${fmt0(r.amt)}</span> ر.س — بانتظار تعميد B2B، يُضاف للمحفظة فور التعميد
        </div>`).join('')}
    </div>`;
}

/** تبويب المحفظة (الأدوار العميلة) */
function renderWalletSeg(st) {
  const W = st.wallet;
  const crPct = Math.round(W.used / W.limit * 100);
  const orgCr = ORG_CR[st.role] || DEFAULT_CR;

  // v7: ذمم منشأة الجلسة — ملفات تحصيلها وطلبات الأجل والمهلة (الأدوار العميلة فقط)
  const canFrq = ['owner', 'fin', 'frz', 'frzs'].includes(st.role);
  const cid = sessionClientId(st.role);
  const myFiles = canFrq ? (st.colFiles || []).filter((f) => f.clientId === cid) : [];
  const openFile = myFiles.find((f) => f.st === 'open');
  const myFrq = canFrq ? (st.finReqs || []).filter((r) => r.clientId === cid) : [];
  const colBanner = openFile ? `
    <div class="flex-center gap-10" style="background:#fff;border:1.5px solid #F0DEB8;border-radius:14px;padding:12px 16px;margin-bottom:14px;cursor:pointer" data-action="openColView" data-arg="${openFile.id}">
      <div style="width:9px;height:9px;border-radius:999px;background:${colStageColor(openFile)};flex:none"></div>
      <div class="grow" style="font-size:11.5px;font-weight:800;line-height:1.7">
        عليك دين مفتوح <span class="num">${openFile.id}</span> بمبلغ <span class="num" style="color:var(--c-danger)">${fmt(openFile.amt)}</span> ر.س — المرحلة: ${COL_STAGES[openFile.stage - 1]}${openFile.lateDays ? ` · متأخر ${openFile.lateDays} يومًا` : ''}
      </div>
      <div style="font-size:10.5px;font-weight:800;color:var(--c-info);flex:none">فتح ملف التحصيل ←</div>
    </div>` : '';
  return `
    ${pendingTopupBanner(st)}
    ${colBanner}
    ${frqHistoryTable(st, myFrq, 'openColView')}
    <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:14px;align-items:start">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="grad-card" style="padding:20px 22px">
          <div class="flex-center"><div style="font-size:11px;font-weight:800;opacity:.85">رصيد المحفظة</div><div class="grow"></div><div class="num" style="font-size:10px;opacity:.75">C.R. ${orgCr}</div></div>
          <div class="num" style="font-size:32px;font-weight:700;margin-top:8px">${fmt(W.bal)} <span style="font-size:13px;font-family:var(--font-ar);font-weight:700;opacity:.8">ر.س</span></div>
          <div style="font-size:10.5px;opacity:.8;margin-top:2px">المحفظة تتبع السجل التجاري وتعمل على فروع منشأتك فقط.</div>
          <div class="flex gap-8 mt-16">
            <button class="btn grow" style="height:44px;border-radius:12px;background:#fff;color:var(--c-purple);font-size:12.5px" data-action="openTopup">شحن المحفظة</button>
            ${canFrq
              ? '<button class="btn grow" style="height:44px;border-radius:12px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.45);color:#fff;font-size:12.5px" data-action="openWcAjel">طلب أجل</button>'
              : '<button class="btn grow" style="height:44px;border-radius:12px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.45);color:#fff;font-size:12.5px" data-action="goInvoices">الفواتير</button>'}
          </div>
        </div>
        <div class="card" style="padding:18px">
          <div class="flex" style="font-size:12px;font-weight:800"><div>الحد الائتماني</div><div class="grow"></div><div class="num" style="color:var(--c-muted);font-weight:700">${fmt0(W.used)} / ${fmt0(W.limit)}</div></div>
          <div class="progress mt-10" style="height:8px"><div style="width:${crPct}%"></div></div>
          <div style="font-size:10.5px;color:var(--c-muted);margin-top:8px;line-height:1.8">المتاح للطلب الآجل: <span class="num" style="font-weight:700;color:var(--c-success)">${fmt0(W.limit - W.used)}</span> ر.س — يتوقف الاعتماد تلقائيًا عند تجاوز الحد.</div>
        </div>
        <div class="card" style="overflow:hidden">
          <div style="font-size:13px;font-weight:800;padding:14px 18px 8px">سجل التسويات</div>
          ${ledgerRows(W.settle, '12px 18px')}
        </div>
      </div>
      <div class="card" style="overflow:hidden">
        <div style="font-size:13px;font-weight:800;padding:14px 18px 8px">كشف الحركات</div>
        ${ledgerRows(W.hist)}
      </div>
    </div>`;
}

/** تبويب الفواتير */
function renderInvoicesSeg(st) {
  const iset = INVOICE_FILTERS[st.invFilter];
  const invoices = st.invoices.filter((x) => !iset || iset.includes(x.st));
  const canPay = CAN_PAY.includes(st.role);

  return `
    ${filterChips(Object.keys(INVOICE_FILTERS), st.invFilter, 'setInvFilter')}
    <div class="card mt-14" style="overflow:hidden">
      <div class="table-head">
        <div style="flex:1">الفاتورة</div><div style="flex:1.2">المرجع</div><div style="flex:1.2">الاستحقاق</div>
        <div style="flex:1">المبلغ</div><div style="width:130px">الحالة</div><div style="width:200px"></div>
      </div>
      ${invoices.map((x) => {
        const m = INVOICE_STATUS[x.st];
        return `
        <div class="table-row clickable" data-action="openInvoice" data-arg="${x.id}">
          <div class="num" style="flex:1;font-size:12.5px;font-weight:700">${x.id}</div>
          <div style="flex:1.2;font-size:11px;color:var(--c-muted)">${esc(x.ref)}</div>
          <div style="flex:1.2;font-size:11px;color:var(--c-muted)">${esc(x.due)}</div>
          <div class="num" style="flex:1;font-size:12.5px;font-weight:700">${fmt(Math.abs(x.amt))} <span style="font-size:9px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div>
          <div style="width:130px">${chip(m.label, m.chip)}</div>
          <div style="width:200px;display:flex;justify-content:flex-end;gap:7px">
            <button class="btn btn-sm num" style="border:1px solid var(--c-card-border);color:var(--c-info);font-size:10.5px;font-weight:700" data-action="invoicePdf" data-arg="${x.id}">PDF</button>
            ${(x.st === 'unpaid' || x.st === 'part') && canPay
              ? `<button class="btn btn-primary btn-sm" data-action="payInvoice" data-arg="${x.id}">سداد من المحفظة</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

/** محافظ العملاء (سوبر أدمن B2B) */
function renderB2bWallets(st) {
  return `
    <div class="section-hint">صلاحية سوبر أدمن — كل محافظ العملاء بأرصدتها وحدودها الائتمانية، مع التجميد وإيقاف الحسابات.</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));gap:14px">
      ${st.clients.map((c) => {
        const frozen = c.wst === 'frozen';
        const susp = c.st === 'susp';
        return `
        <div class="card" style="padding:18px">
          <div class="flex-center gap-8">
            <div class="grow" style="min-width:0">
              <div style="font-size:13.5px;font-weight:800">${esc(c.name)}</div>
              <div style="font-size:10px;color:var(--c-faint);margin-top:2px">${esc(c.city)} · <span class="num">C.R. ${esc(c.cr)}</span></div>
            </div>
            ${chip(susp ? 'حساب موقوف' : 'حساب نشط', susp ? 'chip-danger' : 'chip-info')}
            ${chip(frozen ? 'محفظة مجمدة' : 'محفظة نشطة', frozen ? 'chip-danger' : 'chip-success')}
          </div>
          <div class="flex" style="align-items:baseline;gap:6px;margin-top:13px">
            <div class="num" style="font-size:24px;font-weight:700;color:var(--c-purple)">${fmt(c.bal)}</div>
            <div style="font-size:10px;color:var(--c-faint);font-weight:700">ر.س رصيد المحفظة</div>
          </div>
          <div class="progress mt-10"><div style="width:${Math.min(100, Math.round(c.used / c.limit * 100))}%"></div></div>
          <div style="font-size:10.5px;color:var(--c-muted);margin-top:6px">الحد الائتماني: مستخدم <span class="num" style="font-weight:700">${fmt0(c.used)}</span> من <span class="num" style="font-weight:700">${fmt0(c.limit)}</span> ر.س</div>
          <div class="flex gap-8" style="margin-top:13px">
            <button class="btn btn-sm ${frozen ? 'btn-success-solid' : 'btn-warn-outline'}" style="font-size:10.5px;border-width:1px" data-action="toggleClientWallet" data-arg="${c.id}">${frozen ? 'فك تجميد المحفظة' : 'تجميد المحفظة'}</button>
            <button class="btn btn-sm ${susp ? 'btn-success-solid' : 'btn-danger-outline'}" style="font-size:10.5px;border-width:1px" data-action="toggleClientAccount" data-arg="${c.id}">${susp ? 'إعادة تفعيل الحساب' : 'إيقاف الحساب'}</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

export function renderFinance(st) {
  if (st.role === 'b2b') return renderB2bWallets(st);
  return `
    <div class="seg" style="margin-bottom:16px">
      <div class="seg-item ${st.finSeg === 'w' ? 'active' : ''}" data-action="setFinSeg" data-arg="w">المحفظة</div>
      <div class="seg-item ${st.finSeg === 'i' ? 'active' : ''}" data-action="setFinSeg" data-arg="i">الفواتير</div>
    </div>
    ${st.finSeg === 'w' ? renderWalletSeg(st) : renderInvoicesSeg(st)}`;
}

/** المركز المالي (B2B): تعميدات + طلبات أجل/مهلة + أعمار الذمم + ملفات التحصيل + محافظ العملاء */
export function renderFintu(st) {
  const reqs = st.topupReqs || [];
  const topupTable = reqs.length ? `
      <div class="card" style="overflow:hidden;margin-bottom:14px">
        <div style="font-size:13px;font-weight:800;padding:13px 18px 9px">تحويلات بنكية بانتظار تعميدك</div>
        <div class="table-head" style="border-top:1px solid var(--c-divider)">
          <div style="flex:.8">الطلب</div><div style="flex:1.6">العميل · مقدّمه</div><div style="flex:.8">الوسيلة</div>
          <div style="flex:1.1">صورة الحوالة</div><div style="flex:1">المبلغ</div><div style="width:230px"></div>
        </div>
        ${reqs.map((r) => `
          <div class="table-row gap-10">
            <div class="num" style="flex:.8;font-size:12.5px;font-weight:700">${r.id}</div>
            <div style="flex:1.6;font-size:11px;color:var(--c-muted)">${esc(r.org)} · ${esc(r.by)}</div>
            <div style="flex:.8">${chip('تحويل بنكي', 'chip-warn')}</div>
            <div style="flex:1.1">
              <div class="flex-center" style="display:inline-flex;gap:6px;padding:6px 11px;border-radius:10px;border:1px solid var(--c-card-border);background:var(--c-subtle);cursor:pointer" data-action="viewProof" data-arg="${esc(r.proof)}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2.4" stroke="#0d7f93" stroke-width="1.7"></rect><circle cx="9" cy="10" r="1.7" stroke="#0d7f93" stroke-width="1.6"></circle><path d="M5 17l4.5-4 3.5 3 2.8-2.4L20 17.5" stroke="#0d7f93" stroke-width="1.7" stroke-linejoin="round"></path></svg>
                <div class="num" style="font-size:10px;font-weight:800;color:var(--c-info)">${esc(r.proof)}</div>
              </div>
            </div>
            <div class="num" style="flex:1;font-size:13px;font-weight:700">${fmt(r.amt)} <span style="font-size:9px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div>
            <div style="width:230px;display:flex;justify-content:flex-end;gap:7px">
              <button class="btn btn-sm btn-success-solid" data-action="approveTopup" data-arg="${r.id}">تعميد الإضافة</button>
              <button class="btn btn-sm btn-danger-outline" data-action="rejectTopup" data-arg="${r.id}">رفض</button>
            </div>
          </div>`).join('')}
      </div>`
    : '<div style="padding:13px 18px;color:var(--c-muted);font-size:11.5px;background:#fff;border:1px dashed #DDD9E6;border-radius:14px;margin-bottom:14px">لا تحويلات بنكية بانتظار التعميد حاليًا.</div>';

  // طلبات الأجل والمهلة المعلقة
  const frqPend = (st.finReqs || []).filter((r) => r.st === 'pend');
  const frqTable = frqPend.length ? `
    <div class="card" style="overflow:hidden;border:1.5px solid var(--c-purple-border);margin-bottom:14px">
      <div style="font-size:13px;font-weight:800;padding:13px 18px 9px">طلبات الأجل والمهلة من العملاء — بانتظار قرارك</div>
      <div class="table-head" style="padding:8px 18px;border-top:1px solid var(--c-divider)">
        <div style="width:80px">النوع</div><div style="flex:1.3">العميل</div><div style="flex:1.4">التفاصيل</div><div style="flex:1.4">مبرر العميل</div><div style="width:170px"></div>
      </div>
      ${frqPend.map((r) => `
        <div class="table-row gap-8" style="padding:11px 18px">
          <div style="width:80px">${chip(FRQ_KIND[r.kind] || r.kind, r.kind === 'ajel' ? 'chip-purple' : 'chip-warn')}</div>
          <div style="flex:1.3;min-width:0">
            <div style="font-size:11.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(clientNameById(st, r.clientId))}</div>
            <div class="num" style="font-size:8.5px;color:var(--c-faint);margin-top:1px">${r.id}</div>
          </div>
          <div style="flex:1.4;font-size:11px;font-weight:700;color:var(--c-purple)">${esc(frqDetTxt(r))}</div>
          <div style="flex:1.4;font-size:10px;color:var(--c-muted);line-height:1.6">${esc(r.note || '—')}</div>
          <div style="width:170px;display:flex;justify-content:flex-end;gap:6px">
            <button class="btn btn-sm btn-success-solid" style="font-size:10.5px" data-action="frqApprove" data-arg="${r.id}">موافقة</button>
            <button class="btn btn-sm btn-danger-outline" style="font-size:10.5px" data-action="frqReject" data-arg="${r.id}">رفض</button>
          </div>
        </div>`).join('')}
    </div>` : '';

  // مؤشرات وأعمار الذمم من ملفات التحصيل والفواتير المستحقة
  const openFiles = (st.colFiles || []).filter((f) => f.st === 'open');
  const dueInv = st.invoices.filter((x) => x.st === 'unpaid' || x.st === 'part');
  const withinDue = dueInv.reduce((s, x) => s + x.rem, 0);
  const lateSum = (a, b) => openFiles.filter((f) => f.lateDays >= a && f.lateDays <= b).reduce((s, f) => s + f.amt, 0);
  const buckets = [
    { l: 'ضمن الاستحقاق', amt: withinDue + openFiles.filter((f) => f.lateDays === 0).reduce((s, f) => s + f.amt, 0), color: 'var(--c-info)' },
    { l: 'متأخر 1–15 يومًا', amt: lateSum(1, 15), color: '#b26a16' },
    { l: 'متأخر 16–30 يومًا', amt: lateSum(16, 30), color: 'var(--c-danger)' },
    { l: 'متأخر +30 يومًا', amt: lateSum(31, 100000), color: '#8a2432' },
  ];
  const bMax = Math.max(...buckets.map((b) => b.amt), 1);
  const promises = openFiles.filter((f) => f.promise).length;
  const kpis = [
    { v: fmt0(buckets.reduce((s, b) => s + b.amt, 0)), u: 'ر.س', l: 'إجمالي الذمم المفتوحة', color: 'var(--c-purple)' },
    { v: fmt0(openFiles.reduce((s, f) => s + f.amt, 0)), u: 'ر.س', l: 'ديون في ملفات تحصيل', color: 'var(--c-danger)' },
    { v: openFiles.length, u: 'ملف', l: 'ملفات تحصيل نشطة', color: 'var(--c-warn)' },
    { v: promises, u: 'وعد', l: 'وعود سداد قيد المراقبة', color: 'var(--c-info)' },
  ];

  const colRows = openFiles.map((f) => `
    <div class="table-row clickable gap-8" style="padding:11px 18px" data-action="openColDet" data-arg="${f.id}">
      <div style="flex:1.4;min-width:0">
        <div style="font-size:11.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(clientNameById(st, f.clientId))}</div>
        <div style="font-size:8.5px;color:var(--c-faint);margin-top:1px"><span class="num">${f.id} · ${esc(f.inv)}</span> · استحق ${esc(f.due)}</div>
      </div>
      <div class="num" style="flex:1;font-size:12px;font-weight:700;color:var(--c-danger)">${fmt(f.amt)}</div>
      <div style="width:76px;font-size:10.5px;color:var(--c-muted);font-weight:700">${f.lateDays > 0 ? `${f.lateDays} يومًا` : '—'}</div>
      <div style="width:110px"><span style="display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;font-size:9.5px;font-weight:800;background:${colStageColor(f)}18;color:${colStageColor(f)};border:1px solid ${colStageColor(f)}44">${COL_STAGES[f.stage - 1]}</span></div>
      <div style="flex:1.2;font-size:10px;color:var(--c-purple);font-weight:700">${f.promise ? `${fmt0(f.promise.amt)} ر.س · ${esc(f.promise.date)}` : '—'}</div>
      <div style="width:24px;color:var(--c-faint)">←</div>
    </div>`).join('');

  const wallets = st.clients.map((c) => {
    const pendN = reqs.filter((r) => r.org === c.name || (c.id === 1 && r.org === 'مطاعم البلدة')).length;
    const frozen = c.wst === 'frozen';
    return `
    <div class="table-row clickable gap-8" style="padding:12px 18px" data-action="openClientWallet" data-arg="${c.id}">
      <div style="flex:1.5;min-width:0">
        <div style="font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</div>
        <div style="font-size:9px;color:var(--c-faint);margin-top:2px">${esc(c.city)} · <span class="num">C.R. ${esc(c.cr)}</span></div>
      </div>
      <div class="num" style="flex:1;font-size:13px;font-weight:700;color:var(--c-purple)">${fmt0(c.bal)} <span style="font-size:8.5px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div>
      <div style="flex:1.4">
        <div class="progress" style="height:6px"><div style="width:${Math.min(100, Math.round(c.used / Math.max(c.limit, 1) * 100))}%"></div></div>
        <div style="font-size:9px;color:var(--c-faint);margin-top:4px"><span class="num" style="font-weight:700">${fmt0(c.used)}</span> من <span class="num" style="font-weight:700">${fmt0(c.limit)}</span> ر.س</div>
      </div>
      <div style="width:130px">
        ${pendN ? `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;background:var(--c-warn-bg);color:var(--c-warn-deep);font-size:10px;font-weight:800"><span style="width:6px;height:6px;border-radius:999px;background:currentColor"></span>${pendN} تحويل معلق</span>` : '<span style="font-size:10px;color:var(--c-faint);font-weight:700">لا طلبات</span>'}
      </div>
      <div style="width:100px">${chip(frozen ? 'مجمدة' : 'نشطة', frozen ? 'chip-danger' : 'chip-success')}</div>
      <div style="width:24px;color:var(--c-faint)">←</div>
    </div>`;
  }).join('');

  return `
    <div class="section-hint">نظرة مالية واحدة على كل العملاء — التحويلات البنكية المعلقة تظهر أولًا للتعميد، واضغط أي عميل لفتح ملفه المالي الكامل: محفظته وعملياته وفواتيره.</div>
    ${topupTable}
    ${frqTable}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
      ${kpis.map((k) => `
        <div class="card" style="padding:14px 16px">
          <div class="num" style="font-size:19px;font-weight:700;color:${k.color}">${k.v}<span style="font-size:9.5px;font-family:var(--font-ar);font-weight:700;color:var(--c-faint)"> ${k.u}</span></div>
          <div style="font-size:10px;font-weight:800;color:var(--c-muted);margin-top:3px">${k.l}</div>
        </div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:14px;margin-bottom:14px;align-items:start">
      <div class="card" style="padding:16px 18px">
        <div style="font-size:13px;font-weight:800;margin-bottom:12px">أعمار الذمم (Aging)</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${buckets.map((b) => `
            <div>
              <div class="flex" style="font-size:10px;font-weight:800;color:#55506a"><div>${b.l}</div><div class="grow"></div><div class="num" style="color:${b.color}">${fmt0(b.amt)} <span style="font-size:8px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div></div>
              <div style="margin-top:4px;height:8px;border-radius:999px;background:var(--c-divider);overflow:hidden"><div style="height:100%;border-radius:999px;background:${b.color};width:${Math.round(b.amt / bMax * 100)}%"></div></div>
            </div>`).join('')}
        </div>
        <div style="font-size:9.5px;color:var(--c-faint);line-height:1.8;margin-top:12px">تُفتح ملفات التحصيل تلقائيًا بعد 7 أيام من الاستحقاق، والتصعيد يتدرج: ودي ← رسمي ← إنذار ← تجميد ائتمان ← إحالة قانونية.</div>
      </div>
      <div class="card" style="overflow:hidden">
        <div style="font-size:13px;font-weight:800;padding:13px 18px 9px">ملفات التحصيل النشطة — اضغط ملفًا لإدارته</div>
        <div class="table-head" style="padding:8px 18px;border-top:1px solid var(--c-divider)">
          <div style="flex:1.4">العميل · الفاتورة</div><div style="flex:1">المبلغ المستحق</div><div style="width:76px">التأخر</div>
          <div style="width:110px">المرحلة</div><div style="flex:1.2">وعد السداد</div><div style="width:24px"></div>
        </div>
        ${colRows || '<div style="padding:22px;text-align:center;font-size:11px;color:var(--c-faint)">لا ملفات تحصيل نشطة — كل الذمم ضمن مواعيدها ✓</div>'}
      </div>
    </div>
    <div class="card" style="overflow:hidden">
      <div style="font-size:13px;font-weight:800;padding:13px 18px 9px">محافظ العملاء — اضغط عميلًا للملف المالي الكامل</div>
      <div class="table-head" style="padding:8px 18px;border-top:1px solid var(--c-divider)">
        <div style="flex:1.5">العميل</div><div style="flex:1">رصيد المحفظة</div><div style="flex:1.4">الحد الائتماني</div>
        <div style="width:130px">طلبات التعميد</div><div style="width:100px">المحفظة</div><div style="width:24px"></div>
      </div>
      ${wallets}
    </div>`;
}
