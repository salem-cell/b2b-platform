// ============================================================
// إدارة المنشأة: اليوزرات، الفروع، الإعدادات + ملف العميل (صفحة كاملة)
// ============================================================
import { esc, ICONS } from '../core/dom.js';
import { fmt, fmt0 } from '../core/format.js';
import { chip, input, ledgerAmount, emptyState } from '../ui.js';
import { ROLES, STAFF_ROLE_LABEL, STAFF_ROLE_CHIP, INVOICE_STATUS } from '../data/constants.js';

// ---------- اليوزرات والصلاحيات ----------
export function renderUsers(st) {
  const rows = st.users.map((u) => {
    const pend = u.st === 'pend';
    const off = u.st === 'off';
    const canAct = st.role !== 'ops' || u.role === 'worker';   // مدير العمليات يدير العمال فقط
    return `
      <div class="table-row clickable" style="padding:11px 18px" data-action="openUserEdit" data-arg="${u.id}" data-can="${canAct ? 1 : 0}">
        <div style="flex:1.4">
          <div style="font-size:12px;font-weight:800">${esc(u.name)}</div>
          <div class="num" style="font-size:9.5px;color:var(--c-faint);margin-top:2px" dir="ltr">${esc(u.email || '—')}</div>
        </div>
        <div style="flex:1">${chip(STAFF_ROLE_LABEL[u.role] || u.role, STAFF_ROLE_CHIP[u.role] || 'chip-purple')}</div>
        <div style="flex:1;font-size:10.5px;color:var(--c-muted)">${esc(u.branch)}</div>
        <div style="width:220px;display:flex;justify-content:flex-end;gap:7px">
          ${pend && canAct ? `
            <div class="chip chip-warn" style="height:34px;border-radius:10px;font-size:10px">بانتظار التفعيل</div>
            <button class="btn btn-xs btn-success-solid" data-action="confirmUser" data-arg="${u.id}">تفعيل الحساب</button>
            <button class="btn btn-xs btn-danger-outline" style="border-width:1px" data-action="holdUser" data-arg="${u.id}">تعطيل</button>`
          : canAct ? `
            <button class="btn btn-xs ${off ? 'btn-success-solid' : 'btn-danger-outline'}" style="border-width:1px" data-action="toggleUser" data-arg="${u.id}">${off ? 'إعادة تفعيل' : 'إيقاف'}</button>`
          : ''}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="card" style="overflow:hidden">
      <div class="flex-center" style="padding:14px 18px 10px">
        <div class="card-title grow">اليوزرات والصلاحيات</div>
        <button class="btn btn-primary btn-pill btn-sm" style="height:38px" data-action="openUserNew">إضافة مستخدم</button>
      </div>
      <div class="table-head" style="padding:8px 18px;border-top:1px solid var(--c-divider)">
        <div style="flex:1.4">الاسم · الإيميل</div><div style="flex:1">الدور</div><div style="flex:1">الفرع</div><div style="width:220px"></div>
      </div>
      ${rows}
    </div>`;
}

// ---------- إدارة الفروع ----------
export function renderBranches(st) {
  return `
    <div class="card" style="overflow:hidden;max-width:560px">
      <div class="card-title" style="padding:14px 18px 10px">الفروع</div>
      ${st.branches.map((b) => `
        <div class="flex-center gap-10" style="padding:12px 18px;border-top:1px solid var(--c-divider)">
          <div style="width:34px;height:34px;border-radius:10px;background:var(--c-purple-soft);display:flex;align-items:center;justify-content:center">${ICONS.branch()}</div>
          <div class="grow">
            <div style="font-size:12px;font-weight:800">${esc(b.name)}</div>
            <div style="font-size:10px;color:var(--c-faint);margin-top:1px">${esc(b.city)}</div>
          </div>
        </div>`).join('')}
      <div class="flex gap-8" style="padding:12px 18px;border-top:1px solid var(--c-divider)">
        ${input('brName', st.brName, 'اسم فرع جديد…', { cls: 'input input-sm grow', extra: 'style="flex:1"' })}
        <button class="btn btn-purple btn-sm" style="height:40px;font-size:11.5px;border-radius:11px" data-action="addBranch">إضافة</button>
      </div>
    </div>`;
}

// ---------- الإعدادات ----------
export function renderSettings(st) {
  const R = ROLES[st.role];
  return `
    <div style="max-width:560px;display:flex;flex-direction:column;gap:14px">
      <div class="card flex-center" style="padding:16px 18px;gap:13px">
        <div style="width:48px;height:48px;border-radius:999px;background:var(--c-purple);color:#fff;font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center">${esc(R.ini)}</div>
        <div>
          <div style="font-size:14px;font-weight:800">${esc(R.user)}</div>
          <div style="font-size:11px;color:var(--c-muted);margin-top:2px">${esc(R.name)} · ${esc(R.org)}</div>
        </div>
      </div>
      <div class="card" style="overflow:hidden">
        <div class="flex-center gap-10" style="padding:0 18px;min-height:54px;border-bottom:1px solid var(--c-divider)">
          <div class="grow" style="font-size:13px;font-weight:700">اللغة</div>
          <div style="font-size:11px;font-weight:800;color:var(--c-purple);background:var(--c-purple-soft);border-radius:8px;padding:4px 10px">عربي · E</div>
        </div>
        <div class="flex-center gap-10 clickable" style="padding:0 18px;min-height:54px;border-bottom:1px solid var(--c-divider);cursor:pointer" data-action="rowSoon">
          <div class="grow" style="font-size:13px;font-weight:700">تفضيلات الإشعارات</div>
          ${ICONS.chevronL()}
        </div>
        <div style="padding:14px 18px">
          <div class="flex-center gap-10">
            <div class="grow" style="font-size:13px;font-weight:700">السجل التجاري</div>
            <div class="num" style="font-size:11px;color:var(--c-muted)">4030-118842</div>
          </div>
          <div class="banner banner-warn mt-9" style="border-radius:11px;padding:9px 12px;font-size:10.5px;line-height:1.8">ينتهي في 12 سبتمبر 2026 — يُعلَّق الحساب تلقائيًا فور الانتهاء حتى تحديث السجل.</div>
        </div>
      </div>
    </div>`;
}

// ---------- ملف العميل / الممنوح (صفحة كاملة لدى B2B والمانح) ----------
export function renderClientProfile(st) {
  const c = st.clients.find((x) => x.id === st.clientSel);
  if (!c) return emptyState('العميل غير موجود.');
  const susp = c.st === 'susp';
  const frozen = c.wst === 'frozen';

  const head = `
    <div class="flex-center gap-8">
      <button class="icon-btn" style="background:#fff;border:1px solid var(--c-card-border);width:42px;height:42px" data-action="backClients">${ICONS.chevronR()}</button>
      <div class="grow" style="font-size:21px;font-weight:800;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</div>
      ${chip(susp ? 'حساب موقوف' : 'حساب نشط', susp ? 'chip-danger' : 'chip-info')}
      ${chip(frozen ? 'محفظة مجمدة' : 'محفظة نشطة', frozen ? 'chip-danger' : 'chip-success')}
    </div>
    <div style="font-size:11px;color:var(--c-muted);margin-top:3px">${esc(c.city)} · <span class="num">C.R. ${esc(c.cr)}</span></div>`;

  const stats = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:11px">
      <div style="background:var(--c-subtle);border:1px solid var(--c-divider);border-radius:14px;padding:16px 18px">
        <div class="num" style="font-size:22px;font-weight:700">${c.orders}</div>
        <div style="font-size:10.5px;font-weight:800;color:var(--c-muted);margin-top:3px">طلبات يوليو</div>
      </div>
      <div style="background:var(--c-subtle);border:1px solid var(--c-divider);border-radius:14px;padding:16px 18px">
        <div class="num" style="font-size:22px;font-weight:700">${fmt0(c.spend)}</div>
        <div style="font-size:10.5px;font-weight:800;color:var(--c-muted);margin-top:3px">مشتريات (ر.س)</div>
      </div>
      <div style="background:var(--c-purple-soft);border:1.5px solid var(--c-purple-border);border-radius:14px;padding:16px 18px;cursor:pointer" data-action="toggleClientWalletView">
        <div class="num" style="font-size:22px;font-weight:700;color:var(--c-purple)">${fmt0(c.bal)} <span style="font-size:12px">←</span></div>
        <div style="font-size:10.5px;font-weight:800;color:var(--c-purple);margin-top:3px">رصيد المحفظة — العمليات والفواتير</div>
      </div>
    </div>`;

  // عرض المحفظة: العميل 1 بياناته الحية؛ البقية عيّنات حتمية
  let walletView = '';
  if (st.clWalletOpen) {
    const kk = (c.id % 7) + 1;
    const hist = c.id === 1 ? st.wallet.hist : c.orders === 0 ? [] : [
      { t: 'شحن المحفظة — تحويل بنكي', d: '20 يوليو', amt: kk * 1000 + 4000 },
      { t: 'حجز آجل — طلب توريد',      d: '17 يوليو', amt: -(kk * 800 + 3200) },
      { t: 'سداد فاتورة مستحقة',       d: '11 يوليو', amt: -(kk * 500 + 2500) },
      { t: 'إشعار دائن — تسوية نواقص', d: '8 يوليو',  amt: 180 + kk * 40 },
    ];
    const invs = c.id === 1 ? st.invoices : c.orders === 0 ? [] : [
      { id: `INV-9${300 + kk * 7}`, ref: `ORD-2${430 + kk * 9}`, due: 'الاستحقاق 30 يوليو', amt: kk * 1500 + 4200, st: 'unpaid' },
      { id: `INV-9${280 + kk * 7}`, ref: `ORD-2${410 + kk * 9}`, due: 'سُددت 14 يوليو',    amt: kk * 1100 + 3600, st: 'paid' },
    ];

    walletView = `
      <div class="flex-center gap-8" style="display:inline-flex;height:40px;padding:0 16px;border-radius:999px;background:var(--c-purple-soft);color:var(--c-purple);font-size:11.5px;font-weight:800;cursor:pointer;margin-top:16px" data-action="toggleClientWalletView">
        ${ICONS.chevronR('#654e92')} عودة لملف العميل
      </div>
      <div class="card mt-16" style="overflow:hidden">
        <div class="flex-center" style="padding:15px 18px 11px">
          <div class="card-title">كشف حركات المحفظة</div><div class="grow"></div>
          <div style="font-size:10px;color:var(--c-faint)">الأحدث أولًا</div>
        </div>
        <div class="table-head" style="padding:9px 18px;border-top:1px solid var(--c-divider)">
          <div style="flex:2">العملية</div><div style="flex:1">التاريخ</div><div style="width:130px;text-align:left">المبلغ (ر.س)</div>
        </div>
        ${hist.map((h) => `
          <div class="table-row" style="padding:12px 18px">
            <div style="flex:2;font-size:12px;font-weight:700">${esc(h.t)}</div>
            <div style="flex:1;font-size:10.5px;color:var(--c-faint)">${esc(h.d)}</div>
            <div style="width:130px;display:flex;justify-content:flex-end">${ledgerAmount(h.amt)}</div>
          </div>`).join('')}
        ${hist.length === 0 ? '<div style="padding:24px;text-align:center;font-size:11.5px;color:var(--c-faint);border-top:1px solid var(--c-divider)">لا عمليات بعد — تظهر الحركات فور أول شحن أو طلب.</div>' : ''}
      </div>
      <div class="card mt-14" style="overflow:hidden">
        <div class="card-title" style="padding:15px 18px 11px">فواتير العميل</div>
        <div class="table-head" style="padding:9px 18px;border-top:1px solid var(--c-divider)">
          <div style="flex:1">الفاتورة</div><div style="flex:1.1">المرجع</div><div style="flex:1.1">الاستحقاق</div><div style="flex:.9">المبلغ (ر.س)</div><div style="width:120px">الحالة</div>
        </div>
        ${invs.map((x) => {
          const m = INVOICE_STATUS[x.st];
          return `
          <div class="table-row" style="padding:12px 18px">
            <div class="num" style="flex:1;font-size:12px;font-weight:700">${x.id}</div>
            <div style="flex:1.1;font-size:10.5px;color:var(--c-muted)">${esc(x.ref)}</div>
            <div style="flex:1.1;font-size:10.5px;color:var(--c-muted)">${esc(x.due)}</div>
            <div class="num" style="flex:.9;font-size:12px;font-weight:700">${fmt(Math.abs(x.amt))}</div>
            <div style="width:120px">${chip(m.label, m.chip)}</div>
          </div>`;
        }).join('')}
        ${invs.length === 0 ? '<div style="padding:24px;text-align:center;font-size:11.5px;color:var(--c-faint);border-top:1px solid var(--c-divider)">لا فواتير بعد — تصدر مع أول طلب مستلم.</div>' : ''}
      </div>`;
  }

  // العرض الرئيسي: الفروع + الفريق
  let mainView = '';
  if (!st.clWalletOpen) {
    const staffRoles = { worker: 'عامل', ops: 'مدير عمليات', fin: 'مالية' };
    mainView = `
      <div style="font-size:11.5px;font-weight:800;color:var(--c-muted);margin:16px 2px 8px">الفروع — ${c.branches.length}</div>
      <div class="flex gap-7 wrap">
        ${c.branches.map((b, bi) => `
          <div class="flex-center gap-7" style="height:36px;padding:0 6px 0 13px;border-radius:999px;background:var(--c-purple-soft);color:var(--c-purple);font-size:11px;font-weight:800">
            ${ICONS.branch('#654e92', 12)} ${esc(b.name)} <span style="font-weight:400;opacity:.7">· ${esc(b.city)}</span>
            <div style="width:24px;height:24px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:rgba(101,78,146,.12)" data-action="clientDelBranch" data-arg="${bi}">${ICONS.close('#654e92', 9, 2.4)}</div>
          </div>`).join('')}
      </div>
      <div class="flex gap-8 mt-9">
        ${input('clBrName', st.clBrName, 'اسم فرع جديد…', { cls: 'input input-sm', extra: 'style="flex:1"' })}
        <button class="btn btn-purple btn-sm" style="height:40px;border-radius:11px;font-size:11.5px" data-action="clientAddBranch">إضافة فرع</button>
      </div>
      <div class="card mt-16" style="overflow:hidden">
        <div class="flex-center" style="padding:15px 18px 11px">
          <div class="card-title">العمال والمستخدمون — ${c.staff.length}</div>
          <div class="grow"></div>
          <div style="font-size:10px;color:var(--c-faint)">اضغط الفرع لنقل المستخدم</div>
        </div>
        <div class="table-head" style="padding:9px 18px;border-top:1px solid var(--c-divider)">
          <div style="flex:1.3">الاسم</div><div style="flex:1">الدور</div><div style="flex:1">الفرع</div><div style="width:90px"></div>
        </div>
        ${c.staff.map((u, ui) => {
          const off = u.st === 'off';
          return `
          <div class="flex-center gap-10" style="padding:11px 18px;border-top:1px solid var(--c-divider)">
            <div style="flex:1.3;font-size:12px;font-weight:800">${esc(u.name)}${off ? '<span style="color:var(--c-danger);font-size:9.5px;font-weight:800"> · موقوف</span>' : ''}</div>
            <div style="flex:1">${chip(STAFF_ROLE_LABEL[u.role] || u.role, STAFF_ROLE_CHIP[u.role] || 'chip-gray')}</div>
            <div style="flex:1;display:flex;justify-content:flex-start">
              <div style="height:30px;display:flex;align-items:center;gap:5px;padding:0 11px;border-radius:999px;background:var(--c-chip-bg);border:1px dashed #D8D4E2;font-size:10px;font-weight:800;color:var(--c-purple);cursor:pointer" data-action="clientMoveStaff" data-arg="${ui}">${esc(u.branch)} ⇄</div>
            </div>
            <div style="width:90px;display:flex;justify-content:flex-end">
              <button class="btn ${off ? 'btn-success-solid' : 'btn-danger-outline'}" style="height:30px;padding:0 12px;border-radius:9px;font-size:10px;border-width:1px" data-action="clientToggleStaff" data-arg="${ui}">${off ? 'تفعيل' : 'إيقاف'}</button>
            </div>
          </div>`;
        }).join('')}
        <div class="flex-center gap-8 wrap" style="padding:12px 18px;border-top:1px solid var(--c-divider);background:var(--c-subtle)">
          ${input('clStaffName', st.clStaffName, 'اسم عامل / مستخدم جديد…', { cls: 'input input-sm', extra: 'style="flex:1;min-width:160px;background:#fff"' })}
          ${Object.entries(staffRoles).map(([k, label]) => `
            <div style="height:36px;display:flex;align-items:center;padding:0 13px;border-radius:10px;font-size:10.5px;font-weight:800;cursor:pointer;flex:none;${(st.clStaffRole || 'worker') === k ? 'background:var(--c-purple);color:#fff' : 'background:#fff;color:var(--c-muted);border:1px solid var(--c-card-border)'}"
              data-action="setClStaffRole" data-arg="${k}">${label}</div>`).join('')}
          <button class="btn btn-primary btn-sm" style="height:40px;border-radius:11px;font-size:11.5px" data-action="clientAddStaff">إنشاء الحساب</button>
        </div>
      </div>`;
  }

  return `
    ${head}
    <div style="padding-top:16px;max-width:920px">
      ${stats}
      ${walletView}
      ${mainView}
      <div class="flex gap-8 mt-14">
        <button class="btn grow ${frozen ? 'btn-success-solid' : 'btn-warn-outline'}" style="height:44px;border-radius:12px;font-size:12px" data-action="toggleClientWallet" data-arg="${c.id}">${frozen ? 'فك تجميد المحفظة' : 'تجميد المحفظة'}</button>
        <button class="btn grow ${susp ? 'btn-success-solid' : 'btn-danger-outline'}" style="height:44px;border-radius:12px;font-size:12px" data-action="toggleClientAccount" data-arg="${c.id}">${susp ? 'إعادة تفعيل الحساب' : 'إيقاف الحساب'}</button>
      </div>
    </div>`;
}
