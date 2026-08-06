// ============================================================
// العمليات المالية: المحفظة / الفواتير (عملاء) + محافظ العملاء (B2B)
// ============================================================
import { esc } from '../core/dom.js';
import { fmt, fmt0 } from '../core/format.js';
import { chip, filterChips, ledgerAmount } from '../ui.js';
import { INVOICE_STATUS, INVOICE_FILTERS, CAN_PAY, ORG_CR, DEFAULT_CR, ROLES } from '../data/constants.js';

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
  return `
    ${pendingTopupBanner(st)}
    <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:14px;align-items:start">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="grad-card" style="padding:20px 22px">
          <div class="flex-center"><div style="font-size:11px;font-weight:800;opacity:.85">رصيد المحفظة</div><div class="grow"></div><div class="num" style="font-size:10px;opacity:.75">C.R. ${orgCr}</div></div>
          <div class="num" style="font-size:32px;font-weight:700;margin-top:8px">${fmt(W.bal)} <span style="font-size:13px;font-family:var(--font-ar);font-weight:700;opacity:.8">ر.س</span></div>
          <div style="font-size:10.5px;opacity:.8;margin-top:2px">المحفظة تتبع السجل التجاري وتعمل على فروع منشأتك فقط.</div>
          <div class="flex gap-8 mt-16">
            <button class="btn grow" style="height:44px;border-radius:12px;background:#fff;color:var(--c-purple);font-size:12.5px" data-action="openTopup">شحن المحفظة</button>
            <button class="btn grow" style="height:44px;border-radius:12px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.45);color:#fff;font-size:12.5px" data-action="goInvoices">الفواتير</button>
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

/** التعميدات المالية (B2B): تحويلات بنكية بانتظار التعميد مع إثبات الحوالة */
export function renderFintu(st) {
  const reqs = st.topupReqs || [];
  return `
    <div class="section-hint">تحويلات بنكية لشحن محافظ العملاء — تُضاف الأموال للمحفظة فور تعميدك، ويُشعر العميل بالنتيجة.</div>
    ${reqs.length ? `
      <div class="card" style="overflow:hidden">
        <div class="table-head">
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
    : '<div class="empty-state">لا تحويلات بنكية بانتظار التعميد.</div>'}`;
}
