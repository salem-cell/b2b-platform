// ============================================================
// العمليات المالية: المحفظة / الفواتير (عملاء) + محافظ العملاء (B2B)
// ============================================================
import { esc } from '../core/dom.js';
import { fmt, fmt0 } from '../core/format.js';
import { chip, filterChips, ledgerAmount } from '../ui.js';
import { INVOICE_STATUS, INVOICE_FILTERS, CAN_PAY, ORG_CR, DEFAULT_CR } from '../data/constants.js';

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

/** تبويب المحفظة (الأدوار العميلة) */
function renderWalletSeg(st) {
  const W = st.wallet;
  const crPct = Math.round(W.used / W.limit * 100);
  const orgCr = ORG_CR[st.role] || DEFAULT_CR;
  return `
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
        <div class="table-row">
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
