// ============================================================
// مولّد ملف القضية القانوني — مستند A4 حقيقي جاهز للطباعة / الحفظ PDF
// يُبنى من حالة المنصة (ملف التحصيل + بيانات العميل) ويُفتح بنافذة طباعة
// ============================================================
import { esc } from './core/dom.js';
import { fmt, fmt0 } from './core/format.js';

const STAGES = ['تواصل ودي', 'مطالبة رسمية', 'إنذار نهائي', 'تجميد الائتمان', 'إحالة قانونية'];

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
function todayLabel() {
  const d = new Date();
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function kvTable(rows) {
  return `
    <table class="kv">
      ${rows.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('')}
    </table>`;
}

/** يبني مستند القضية ويفتحه في نافذة طباعة — يعمل من إيماءة نقر المستخدم */
export function openLegalDocument(st, fileId) {
  const f = (st.colFiles || []).find((x) => x.id === fileId);
  if (!f) return false;
  const c = st.clients.find((x) => x.id === f.clientId) || { name: '—', cr: '—', city: '—' };
  const dueHist = f.dueHist || [];
  const log = f.log || [];

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>ملف القضية ${esc(f.id)} — ${esc(c.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&family=Quicksand:wght@500;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Almarai', sans-serif; color: #262433; margin: 0; padding: 32px; font-size: 12px; line-height: 1.9; }
  .num { font-family: 'Quicksand', 'Almarai', sans-serif; }
  header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #262433; padding-bottom: 14px; }
  header img { height: 42px; }
  header .t1 { font-size: 19px; font-weight: 800; }
  header .t2 { font-size: 10.5px; color: #7d7990; margin-top: 2px; }
  .meta { text-align: left; margin-inline-start: auto; font-size: 10.5px; color: #55506a; }
  .meta b { font-size: 13px; }
  .conf { display: inline-block; background: #262433; color: #fff; border-radius: 6px; padding: 2px 10px; font-size: 9.5px; font-weight: 800; margin-top: 4px; }
  h2 { font-size: 13px; font-weight: 800; color: #654e92; border-inline-start: 4px solid #654e92; padding-inline-start: 9px; margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  table.kv th { width: 170px; background: #F4F3F8; text-align: right; font-weight: 800; color: #55506a; }
  table.kv th, table.kv td { border: 1px solid #DDD9E6; padding: 6px 11px; font-size: 11px; }
  table.grid th { background: #654e92; color: #fff; font-size: 10px; padding: 6px 9px; }
  table.grid td { border: 1px solid #DDD9E6; padding: 6px 9px; font-size: 10.5px; vertical-align: top; }
  table.grid tr:nth-child(even) td { background: #FAF9FC; }
  .old { color: #a8a4b8; text-decoration: line-through; }
  .red { color: #b23b3b; font-weight: 800; }
  .note { background: #FBF0DD; border: 1px solid #F0DEB8; border-radius: 8px; padding: 9px 13px; font-size: 10.5px; color: #8a5f10; margin-top: 18px; }
  .sig { display: flex; gap: 24px; margin-top: 34px; page-break-inside: avoid; }
  .sig div { flex: 1; border-top: 1.5px solid #262433; padding-top: 7px; font-size: 10.5px; font-weight: 800; color: #55506a; text-align: center; }
  footer { margin-top: 26px; padding-top: 9px; border-top: 1px solid #DDD9E6; font-size: 9px; color: #a8a4b8; display: flex; justify-content: space-between; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <header>
    <img src="${location.origin}/assets/logo-1.png" alt="B2B" onerror="this.style.display='none'">
    <div>
      <div class="t1">ملف القضية القانوني — مطالبة مالية تجارية</div>
      <div class="t2">منصة B2B للطلب والتوريد · إدارة التحصيل والائتمان</div>
    </div>
    <div class="meta">
      <div>مرجع الملف: <b class="num">${esc(f.id)}</b></div>
      <div>تاريخ الإصدار: ${esc(todayLabel())}</div>
      <div class="conf">سري — للمستشار القانوني</div>
    </div>
  </header>

  <h2>أولًا — بيانات المدين</h2>
  ${kvTable([
    ['اسم المنشأة', esc(c.name)],
    ['السجل التجاري', `<span class="num">${esc(c.cr)}</span>`],
    ['المدينة', esc(c.city)],
    ['نوع العميل بالمنصة', esc(c.type || 'مستقل')],
    ['حالة الحساب', c.st === 'susp' ? 'موقوف' : 'نشط'],
    ['حالة المحفظة', c.wst === 'frozen' ? 'مجمدة (تصعيد ائتماني)' : 'نشطة'],
  ])}

  <h2>ثانيًا — بيانات المديونية</h2>
  ${kvTable([
    ['مرجع الدين', `<span class="num">${esc(f.inv)}</span> — ${esc(f.ref)}`],
    ['أصل المبلغ', `<span class="num">${fmt(f.origAmt)}</span> ريال سعودي`],
    ['المستحق المتبقي', `<span class="num red">${fmt(f.amt)}</span> ريال سعودي`],
    ['تاريخ إنشاء الدين', `<span class="num">${esc(f.created)}</span>`],
    ['تاريخ الاستحقاق الحالي', `<span class="num">${esc(f.due)}</span>`],
    ['مدة التأخر عن السداد', f.lateDays > 0 ? `<span class="num">${f.lateDays}</span> يومًا` : 'ضمن الاستحقاق'],
    ['مرحلة التحصيل عند الإصدار', `${STAGES[f.stage - 1]} (${f.stage}/5)`],
    ...(f.promise ? [['آخر وعد سداد مسجل', `<span class="num">${fmt0(f.promise.amt)}</span> ر.س بتاريخ <span class="num">${esc(f.promise.date)}</span>`]] : []),
  ])}

  <h2>ثالثًا — سجل تعديل تاريخ الاستحقاق (المهل والجدولات)</h2>
  ${dueHist.length ? `
    <table class="grid">
      <tr><th style="width:28px">#</th><th>الاستحقاق السابق</th><th>الاستحقاق الجديد</th><th>السبب</th><th style="width:150px">تاريخ التعديل</th></tr>
      ${dueHist.map((h, i) => `
        <tr>
          <td class="num" style="text-align:center">${i + 1}</td>
          <td class="num old">${esc(h.old)}</td>
          <td class="num red">${esc(h.to)}</td>
          <td>${esc(h.why)}</td>
          <td class="num">${esc(h.d)}</td>
        </tr>`).join('')}
    </table>`
    : '<div style="border:1px dashed #DDD9E6;border-radius:8px;padding:9px 13px;font-size:10.5px;color:#7d7990">لا توجد تعديلات — الدين قائم على تاريخ الاستحقاق الأصلي دون أي مهل أو جدولات.</div>'}

  <h2>رابعًا — السجل الزمني الموثق لإجراءات التحصيل</h2>
  <table class="grid">
    <tr><th style="width:28px">#</th><th>الإجراء</th><th style="width:160px">التاريخ والوقت</th></tr>
    ${log.map((g, i) => `
      <tr>
        <td class="num" style="text-align:center">${i + 1}</td>
        <td>${esc(g.t)}</td>
        <td class="num">${esc(g.d)}</td>
      </tr>`).join('')}
  </table>

  <div class="note">
    استنفدت المنصة الإجراءات الودية الموثقة أعلاه دون سداد كامل المديونية — الملف مُعد للمطالبة القضائية
    وفق نظام المعاملات التجارية ونظام التنفيذ في المملكة العربية السعودية، وكل البيانات أعلاه مستخرجة
    آليًا من سجلات المنصة الموثقة بتواريخها.
  </div>

  <div class="sig">
    <div>فريق التحصيل — منصة B2B</div>
    <div>المدير المالي</div>
    <div>المستشار القانوني (المستلم)</div>
  </div>

  <footer>
    <div>وثيقة مولّدة آليًا من منصة B2B — <span class="num">${esc(f.id)}</span></div>
    <div class="num">${location.host}</div>
  </footer>
</body>
</html>`;

  // طباعة عبر إطار مخفي — لا نوافذ منبثقة فلا يحظرها المتصفح
  const prev = document.getElementById('legal-print-frame');
  if (prev) prev.remove();
  const frame = document.createElement('iframe');
  frame.id = 'legal-print-frame';
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  frame.srcdoc = html;
  frame.onload = () => {
    const w = frame.contentWindow;
    // مهلة قصيرة لاكتمال تحميل الخط قبل فتح حوار الطباعة
    setTimeout(() => { try { w.focus(); w.print(); } catch { /* بيئات بلا طباعة */ } }, 350);
    // يبقى الإطار ما دام حوار الطباعة مفتوحًا ثم يُزال
    if (w) w.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 500));
    setTimeout(() => { if (document.getElementById('legal-print-frame') === frame) frame.remove(); }, 120000);
  };
  return true;
}
