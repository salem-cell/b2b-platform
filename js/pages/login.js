// ============================================================
// شاشة الدخول: رقم الجوال + الرمز السري (4 أرقام) لحساب مسجّل.
// الدور والمنشأة يحددهما الخادم من سجل الحساب — لا اختيار للحساب من الواجهة.
// أول دخول برمز مؤقت → شاشة تعيين رمز جديد قبل أي شيء آخر.
// ============================================================
import { input, pinInput } from '../ui.js';

const BIG = 'style="height:52px;font-size:16px;font-family:var(--font-num);text-align:left;border-radius:14px"';

export function renderLogin(st) {
  // بوابة الإدارة /admin.html: حسابات فريق B2B تتطلب أيضًا رمز الإدارة (يتحقق منه الخادم)
  const isAdminPortal = typeof window !== 'undefined' && window.__B2B_ADMIN__;
  let body = '';

  if (st.auth === 'pin') {
    const ready = (st.npOld || '').length === 4 && (st.npNew || '').length === 4 && (st.npNew2 || '').length === 4;
    body = `
      <div class="login-title">عيّن رمزك السري</div>
      <div class="login-sub">دخلت برمز مؤقت — اختر رمزًا من 4 أرقام تعرفه أنت فقط. لن يُفتح حسابك قبل تغييره.</div>
      <div class="field-label" style="margin-top:20px">الرمز المؤقت</div>
      ${pinInput('npOld', st.npOld)}
      <div class="field-label" style="margin-top:12px">الرمز الجديد</div>
      ${pinInput('npNew', st.npNew)}
      <div class="field-label" style="margin-top:12px">تأكيد الرمز الجديد</div>
      ${pinInput('npNew2', st.npNew2, { enter: 'submitNewPin' })}
      <button class="btn btn-primary btn-block mt-14 ${ready && !st.busy ? '' : 'disabled'}" style="height:52px;border-radius:14px" data-action="submitNewPin">حفظ الرمز والدخول</button>
      <div class="login-link" data-action="logout">الدخول بحساب آخر</div>`;
  } else {
    const ready = (st.phone || '').replace(/[^0-9]/g, '').length >= 9 && (st.pin || '').length === 4;
    body = `
      <div class="login-title">${isAdminPortal ? 'بوابة الإدارة' : 'تسجيل الدخول'}</div>
      <div class="login-sub">${isAdminPortal
        ? 'دخول فريق B2B — رقم الجوال والرمز السري ثم رمز الإدارة.'
        : 'منصة الطلب والتوريد للمطاعم — ادخل برقم جوالك ورمزك السري.'}</div>
      <div class="field-label" style="margin-top:22px">رقم الجوال</div>
      ${input('phone', st.phone, '05xxxxxxxx', { dir: 'ltr', type: 'tel', extra: `inputmode="numeric" autocomplete="username" ${BIG}` })}
      <div class="field-label" style="margin-top:12px">الرمز السري (4 أرقام)</div>
      ${pinInput('pin', st.pin, { enter: isAdminPortal ? '' : 'login' })}
      ${isAdminPortal ? `
        <div class="field-label" style="margin-top:12px">رمز الإدارة</div>
        ${input('adminKey', st.adminKey, '••••••••', { dir: 'ltr', type: 'password', extra: 'data-enter="login" autocomplete="off" style="font-family:var(--font-num);text-align:left;border-color:var(--c-purple-border);background:#F7F5FB"' })}` : ''}
      <button class="btn btn-primary btn-block mt-14 ${ready && !st.busy ? '' : 'disabled'}" style="height:52px;border-radius:14px" data-action="login">${st.busy ? 'جارٍ الدخول…' : 'دخول'}</button>
      <div class="login-note">نسيت رمزك؟ اطلب من مدير منشأتك رمزًا مؤقتًا من «اليوزرات والصلاحيات».<br>بعد 5 محاولات خاطئة يُقفل الدخول مؤقتًا.</div>`;
  }

  return `
    <div class="login-page">
      <div class="login-card">
        <img class="login-logo" src="assets/logo-1.png" alt="B2B">
        ${body}
      </div>
    </div>`;
}
