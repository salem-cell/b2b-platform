// ============================================================
// شبكة الفرنشايز: لوحة البيانات (المانح) + إدارة الممنوحين
// ============================================================
import { esc, ICONS } from '../core/dom.js';
import { fmt, fmt0 } from '../core/format.js';
import { chip } from '../ui.js';
import { FRANCHISEE_STATUS } from '../data/constants.js';

export function renderAnalytics(st) {
  const maxSpend = Math.max(...st.frs.map((f) => f.spend), 1);
  const kpis = [
    { v: fmt0(st.frs.reduce((s, f) => s + f.spend, 0)), u: 'ر.س', l: 'مشتريات الشبكة' },
    { v: st.frs.reduce((s, f) => s + f.orders, 0), u: 'طلب', l: 'طلبات الممنوحين' },
    { v: `${Math.round(st.frs.reduce((s, f) => s + f.pay, 0) / st.frs.length)}%`, u: '', l: 'متوسط الالتزام بالسداد' },
    { v: st.frs.length, u: '', l: 'ممنوحون في الشبكة' },
  ];

  return `
    <div class="flex-center" style="margin-bottom:14px">
      <div style="font-size:12px;color:var(--c-muted)">شبكة الفرنشايز · يوليو 2026</div>
      <div class="grow"></div>
      <button class="btn btn-sm btn-pill num" style="border:1px solid var(--c-card-border);background:#fff;color:var(--c-info);font-weight:700;margin-inline-start:6px" data-action="reportPdf">PDF</button>
      <button class="btn btn-sm btn-pill num" style="border:1px solid var(--c-card-border);background:#fff;color:var(--c-success);font-weight:700;margin-inline-start:6px" data-action="reportXls">Excel</button>
    </div>
    <div class="kpi-grid">
      ${kpis.map((k) => `
        <div class="kpi" style="cursor:default">
          <div class="kpi-value" style="color:var(--c-purple);font-size:24px">${k.v}<span class="kpi-unit"> ${k.u}</span></div>
          <div class="kpi-label">${k.l}</div>
        </div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:14px;margin-top:16px;align-items:start">
      <div class="card" style="padding:18px">
        <div style="font-size:13px;font-weight:800;margin-bottom:14px">مقارنة المشتريات</div>
        <div style="display:flex;flex-direction:column;gap:13px">
          ${st.frs.filter((f) => f.spend > 0).map((f) => `
            <div>
              <div class="flex" style="font-size:11.5px;font-weight:700"><div>${esc(f.name)}</div><div class="grow"></div><div class="num" style="color:var(--c-muted)">${fmt0(f.spend)}</div></div>
              <div class="progress" style="margin-top:5px;height:8px"><div style="width:${Math.round(f.spend / maxSpend * 100)}%"></div></div>
            </div>`).join('')}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card" style="overflow:hidden">
          <div style="font-size:13px;font-weight:800;padding:14px 18px 8px">الالتزام بالسداد</div>
          ${st.frs.map((f) => `
            <div class="flex-center gap-10" style="padding:11px 18px;border-top:1px solid var(--c-divider)">
              <div class="grow" style="font-size:12px;font-weight:700">${esc(f.name)}</div>
              <div class="chip num ${f.pay >= 90 ? 'chip-success' : f.pay >= 80 ? 'chip-warn' : 'chip-danger'}">${f.pay}%</div>
            </div>`).join('')}
        </div>
        <div class="banner banner-danger" style="padding:13px 16px">
          <div style="font-size:12px;font-weight:800;color:var(--c-danger-deep)">تأخر سداد — بروست الخليج</div>
          <div style="font-size:10.5px;margin-top:3px;opacity:.85;line-height:1.7;color:var(--c-danger-deep)">فاتورة متأخرة 12 يومًا بقيمة 9,200 ر.س — أُرسل تذكير تلقائي.</div>
        </div>
        <div class="banner banner-warn" style="padding:13px 16px">
          <div style="font-size:12px;font-weight:800">انخفاض طلبات — كرسبر برجر</div>
          <div style="font-size:10.5px;margin-top:3px;opacity:.85;line-height:1.7">انخفاض 38% عن متوسط 4 أسابيع — قد يشير لمشكلة تشغيلية.</div>
        </div>
      </div>
    </div>`;
}

export function renderFranchisees(st) {
  const rows = st.frs.map((f) => {
    const m = FRANCHISEE_STATUS[f.active ? f.st : 'off'];
    const canApprove = st.role === 'b2b' && f.st === 'new' && f.active;
    return `
      <div class="table-row clickable" data-action="openFranchisee" data-arg="${f.id}">
        <div style="flex:1.6;font-size:12.5px;font-weight:800">${esc(f.name)}</div>
        <div style="flex:1;font-size:10.5px;color:var(--c-muted)">${esc(f.city)} · <span class="num">${esc(f.cr)}</span></div>
        <div class="num" style="flex:.7;font-size:12px;font-weight:700">${f.orders}</div>
        <div class="num" style="flex:1;font-size:12px;font-weight:700">${fmt0(f.bal)} <span style="font-size:9px;font-family:var(--font-ar);color:var(--c-faint)">ر.س</span></div>
        <div class="num" style="flex:.7;font-size:12px;font-weight:700">${f.pay}%</div>
        <div style="width:130px">${chip(m.label, m.chip)}</div>
        <div style="width:130px;display:flex;justify-content:flex-end">
          ${canApprove
            ? `<button class="btn btn-primary btn-sm" data-action="approveFranchisee" data-arg="${f.id}">تعميد وتفعيل</button>`
            : '<div style="font-size:10.5px;font-weight:800;color:var(--c-info)">الملف ←</div>'}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="flex-center" style="margin-bottom:14px">
      <div style="font-size:12px;color:var(--c-muted)">لكل ممنوح محفظة مستقلة باسم سجله التجاري — تطّلع عليها دون الصرف منها.</div>
      <div class="grow"></div>
      <button class="btn btn-primary btn-pill" style="height:42px;font-size:12px" data-action="openFrNew">${ICONS.plus('#fff', 13, 2.6)} دعوة ممنوح</button>
    </div>
    <div class="card" style="overflow:hidden">
      <div class="table-head">
        <div style="flex:1.6">المنشأة</div><div style="flex:1">المدينة · السجل</div><div style="flex:.7">طلبات</div>
        <div style="flex:1">محفظته</div><div style="flex:.7">السداد</div><div style="width:130px">الحالة</div><div style="width:100px"></div>
      </div>
      ${rows}
    </div>`;
}
