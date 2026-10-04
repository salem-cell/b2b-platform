// ============================================================
// هوية الجلسة: الاسم والمنشأة والفرع من الحساب الفعلي (st.me من الخادم)،
// وتسمية الدور وتنقّله من ROLES. لا شخصيات ثابتة في الواجهة.
// ============================================================
import { ROLES } from '../data/constants.js';

/** الحرف الأول من الاسم (بعد لقب م./أ./د.) لدائرة الأفاتار */
export const initial = (name) => String(name || '').replace(/^(م|أ|د)\.\s*/, '').trim().charAt(0);

/** أول فرع يتبعه الحساب (الحساب قد يتبع عدة فروع «أ · ب») */
export const firstBranch = (me) => String((me && me.branch) || '').split(' · ')[0].trim();

/** {name: تسمية الدور, nav, user: اسم صاحب الحساب, org: منشأته (مع فرعه لأدوار الفروع), ini} */
export function persona(st) {
  const R = ROLES[st.role] || { name: '', nav: [], user: '', org: '', ini: '' };
  const me = st.me;
  if (!me) return R;
  const user = me.name || R.user;
  const br = firstBranch(me);
  const org = me.clientId == null ? 'منصة B2B'
    : ['worker', 'ops'].includes(st.role) && br && br !== 'الإدارة' ? `${me.org} — ${br}` : (me.org || R.org);
  return { ...R, user, org, ini: initial(user) || R.ini };
}

/** منشأة الجلسة (null لفريق B2B) */
export const myClientId = (st) => (st.me ? st.me.clientId : null);

/** حساب بمعرّفه: من حسابات منشأتي أو من حسابات أي عميل ظاهر في ملفه */
export function findAccount(st, id) {
  const n = Number(id);
  return (st.users || []).find((u) => u.id === n)
    || (st.clients || []).flatMap((c) => c.staff || []).find((u) => u.id === n) || null;
}

/** فروع منشأة الحساب (لنافذة إدارته) */
export function accountBranches(st, u) {
  if (!u || u.clientId == null) return [];
  if (u.clientId === myClientId(st)) return st.branches || [];
  return ((st.clients || []).find((c) => c.id === u.clientId) || {}).branches || [];
}

const WEAK = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '1212', '0123'];
/** رمز مؤقت عشوائي من 4 أرقام (غير بديهي) يعطيه المدير لصاحب الحساب */
export function randomPin() {
  for (;;) {
    const a = new Uint16Array(1);
    crypto.getRandomValues(a);
    const pin = String(a[0] % 10000).padStart(4, '0');
    if (!WEAK.includes(pin)) return pin;
  }
}
