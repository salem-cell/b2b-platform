// ============================================================
// شاشة الدخول: جوال → OTP → اختيار الحساب (7 أدوار)
// ============================================================
import { esc, ICONS } from '../core/dom.js';
import { input } from '../ui.js';
import { ROLES } from '../data/constants.js';

export function renderLogin(st) {
  let body = '';

  if (st.auth === 'phone') {
    body = `
      <div class="login-title">تسجيل الدخول</div>
      <div class="login-sub">منصة الطلب والتوريد للمطاعم — أدخل رقم جوالك وسنرسل رمز تحقق.</div>
      <div class="field-label" style="margin-top:22px">رقم الجوال</div>
      ${input('phone', st.phone, '05xxxxxxxx', { dir: 'ltr', extra: 'style="height:52px;font-size:16px;font-family:var(--font-num);text-align:left;border-radius:14px"' })}
      <button class="btn btn-primary btn-block mt-14" style="height:52px;border-radius:14px" data-action="sendOtp">إرسال رمز التحقق</button>
      <div class="login-note">نسخة تجريبية — أي رقم يعمل. الحسابات مربوطة بالسجل التجاري للمنشأة.</div>`;
  } else if (st.auth === 'otp') {
    body = `
      <div class="login-title">رمز التحقق</div>
      <div class="login-sub">أُرسل الرمز إلى <span class="num" dir="ltr">${esc(st.phone || '05xxxxxxxx')}</span> — اكتب أي 4 أرقام.</div>
      ${input('otp', st.otp, '• • • •', { dir: 'ltr', extra: 'maxlength="4" style="height:60px;margin-top:18px;font-size:26px;letter-spacing:14px;text-align:center;font-family:var(--font-num);border-radius:14px"' })}
      <button class="btn btn-primary btn-block mt-14 ${st.otp.length === 4 ? '' : 'disabled'}" style="height:52px;border-radius:14px" data-action="verifyOtp">تحقق ودخول</button>
      <div class="login-link" data-action="backPhone">تغيير الرقم</div>`;
  } else {
    body = `
      <div class="login-title">اختر حسابك</div>
      <div class="login-sub">هذا الرقم مرتبط بعدة حسابات — اختر الحساب الذي تريد الدخول به.</div>
      <div class="persona-list">
        ${Object.entries(ROLES).map(([key, r]) => `
          <div class="persona" data-action="pickRole" data-arg="${key}">
            <div class="persona-avatar">${esc(r.ini)}</div>
            <div class="grow">
              <div class="persona-name">${esc(r.user)}</div>
              <div class="persona-meta">${esc(r.name)} · ${esc(r.org)}</div>
            </div>
            ${ICONS.chevronL()}
          </div>`).join('')}
      </div>`;
  }

  return `
    <div class="login-page">
      <div class="login-card">
        <img class="login-logo" src="assets/logo-1.png" alt="B2B">
        ${body}
      </div>
    </div>`;
}
