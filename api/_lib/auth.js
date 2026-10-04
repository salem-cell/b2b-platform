// ============================================================
// الحسابات والدخول — docs/SECURITY.md
// الدخول: رقم الجوال + رمز سري من 4 أرقام (PIN) لحساب مسجّل له دور ومنشأة ثابتان.
// الرمز قصير، فالحماية في القفل: 5 محاولات خاطئة تقفل الجوال 15 دقيقة، ثم ساعة، ثم 24 ساعة،
// مع حد لكل عنوان IP. الرمز يُخزَّن مجزّأً (scrypt + ملح لكل حساب + PIN_PEPPER من البيئة).
// نقطة التوسعة لاحقًا: استبدال التحقق من الرمز بـ OTP عبر SMS في verifyLogin() فقط.
// ============================================================
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { sql } from './db.js';
import { httpError } from './http.js';

export const PIN_RE = /^\d{4}$/;
const MAX_FAILS = 5;                 // محاولات قبل القفل
const WINDOW_MIN = 15;               // نافذة عدّ المحاولات
const LOCK_MIN = [15, 60, 1440];     // مدة القفل تتصاعد مع تكراره
const IP_MAX_FAILS = 30;             // لكل عنوان خلال النافذة
export const SESSION_DAYS = 30;

/** رموز بديهية تُرفض عند الإنشاء والتغيير */
const WEAK_PINS = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '1212', '0123']);

export function normPhone(v) {
  let p = String(v || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+966')) p = `0${p.slice(4)}`;
  else if (p.startsWith('966') && p.length === 12) p = `0${p.slice(3)}`;
  else if (p.length === 9 && p.startsWith('5')) p = `0${p}`;
  return p;
}
export const validPhone = (p) => /^05\d{8}$/.test(p);

export function hashPin(pin) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(String(pin), salt + (process.env.PIN_PEPPER || ''), 32).toString('hex')}`;
}

export function checkPin(pin, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = scryptSync(String(pin), salt + (process.env.PIN_PEPPER || ''), 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** يتحقق أن الرمز 4 أرقام وغير بديهي — يرمي رسالة واضحة */
export function assertPin(pin, { allowWeak = false } = {}) {
  if (!PIN_RE.test(String(pin || ''))) throw httpError(400, 'الرمز السري 4 أرقام');
  if (!allowWeak && WEAK_PINS.has(String(pin))) throw httpError(400, 'اختر رمزًا أقل بداهة (ليس 1234 أو أرقامًا مكررة)');
}

export function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return String(req.headers['x-real-ip'] || xf || req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

// ───────────── قفل المحاولات ─────────────

async function throttleState(key) {
  const [t] = await sql`SELECT fails, locks, window_start, locked_until FROM login_throttle WHERE key = ${key}`;
  return t || null;
}

/** يرمي 429 إن كان المفتاح مقفلًا الآن */
async function assertNotLocked(key, msg) {
  const t = await throttleState(key);
  if (t?.locked_until && new Date(t.locked_until) > new Date()) {
    const mins = Math.max(1, Math.ceil((new Date(t.locked_until) - Date.now()) / 60000));
    throw httpError(429, `${msg} — حاول بعد ${mins >= 60 ? `${Math.ceil(mins / 60)} ساعة` : `${mins} دقيقة`}`);
  }
}

/** يسجّل محاولة فاشلة؛ يقفل عند بلوغ الحد ويعيد عدد المحاولات المتبقية */
async function recordFail(key, max, lockMinutes) {
  const [t] = await sql`
    INSERT INTO login_throttle (key, fails, window_start) VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      fails = CASE WHEN login_throttle.window_start < now() - (${WINDOW_MIN} || ' minutes')::interval THEN 1 ELSE login_throttle.fails + 1 END,
      window_start = CASE WHEN login_throttle.window_start < now() - (${WINDOW_MIN} || ' minutes')::interval THEN now() ELSE login_throttle.window_start END
    RETURNING fails, locks`;
  if (Number(t.fails) >= max) {
    const minutes = lockMinutes[Math.min(Number(t.locks), lockMinutes.length - 1)];
    await sql`UPDATE login_throttle SET fails = 0, locks = locks + 1, window_start = now(),
              locked_until = now() + (${minutes} || ' minutes')::interval WHERE key = ${key}`;
    return 0;
  }
  return max - Number(t.fails);
}

// ───────────── الدخول ─────────────

/**
 * يتحقق من الجوال والرمز (ورمز الإدارة لحسابات B2B) ويعيد الحساب.
 * الرسالة واحدة للجوال غير المسجّل وللرمز الخاطئ (لا يُكشف وجود الحساب).
 */
export async function verifyLogin(req, { phone, pin, adminKey }) {
  const p = normPhone(phone);
  const ip = clientIp(req);
  if (!validPhone(p)) throw httpError(400, 'أدخل رقم جوال صحيحًا (05xxxxxxxx)');
  if (!PIN_RE.test(String(pin || ''))) throw httpError(400, 'الرمز السري 4 أرقام');
  await assertNotLocked(`ip:${ip}`, 'محاولات كثيرة من هذا الجهاز');
  await assertNotLocked(`p:${p}`, 'الحساب مقفل مؤقتًا بعد محاولات خاطئة');

  const [u] = await sql`SELECT * FROM org_users WHERE phone = ${p}`;
  let ok = !!u && !!u.pin_hash && checkPin(pin, u.pin_hash);
  if (!u) checkPin(pin, 'deadbeefdeadbeefdeadbeefdeadbeef:00'); // زمن متقارب للجوال غير المسجّل
  if (ok && u.role === 'b2b') {
    // حساب الإدارة: عامل ثانٍ — رمز الإدارة من البيئة
    const expected = Buffer.from(String(process.env.ADMIN_KEY || '').trim());
    const given = Buffer.from(String(adminKey || '').trim());
    ok = expected.length > 0 && expected.length === given.length && timingSafeEqual(expected, given);
  }
  if (!ok) {
    const left = await recordFail(`p:${p}`, MAX_FAILS, LOCK_MIN);
    await recordFail(`ip:${ip}`, IP_MAX_FAILS, [WINDOW_MIN]);
    throw httpError(401, left > 0
      ? `رقم الجوال أو الرمز السري غير صحيح — بقي ${left} ${left === 1 ? 'محاولة' : 'محاولات'}`
      : 'قُفل الدخول لهذا الجوال مؤقتًا بعد محاولات خاطئة متكررة');
  }
  if (u.st !== 'ok') throw httpError(403, u.st === 'pend' ? 'الحساب بانتظار التفعيل من مدير منشأتك' : 'الحساب موقوف — تواصل مع مدير منشأتك');
  if (u.client_id != null) {
    const [c] = await sql`SELECT st FROM clients WHERE id = ${u.client_id}`;
    if (!c) throw httpError(403, 'المنشأة غير موجودة');
  }
  await sql`DELETE FROM login_throttle WHERE key = ${`p:${p}`}`;
  await sql`UPDATE org_users SET last_login_at = now() WHERE id = ${u.id}`;
  return u;
}

export async function createSession(user) {
  const token = randomBytes(32).toString('hex');
  await sql`INSERT INTO sessions (token, phone, role, user_id, expires_at)
            VALUES (${token}, ${user.phone}, ${user.role}, ${user.id}, now() + (${SESSION_DAYS} || ' days')::interval)`;
  return token;
}

/**
 * سياق الجلسة: الدور والمنشأة من سجل الحساب الحي (تغيير الدور أو الإيقاف يسري فورًا).
 * @returns {Promise<null|{token,userId,phone,role,clientId,name,branch,org,frsId,mustChangePin}>}
 */
export async function loadContext(token) {
  if (!token) return null;
  const [s] = await sql`
    SELECT s.token, u.id AS user_id, u.phone, u.role, u.client_id, u.name, u.branch, u.st, u.must_change_pin, c.name AS org, c.st AS client_st
    FROM sessions s JOIN org_users u ON u.id = s.user_id LEFT JOIN clients c ON c.id = u.client_id
    WHERE s.token = ${token} AND (s.expires_at IS NULL OR s.expires_at > now())`;
  if (!s || s.st !== 'ok') return null;
  let frsId = null;
  if (s.client_id != null && (s.role === 'frzs' || s.role === 'frz')) {
    const [f] = await sql`SELECT id FROM frs WHERE client_id = ${s.client_id}`;
    frsId = f ? Number(f.id) : null;
  }
  return {
    token: s.token, userId: Number(s.user_id), phone: s.phone, role: s.role,
    clientId: s.client_id == null ? null : Number(s.client_id), name: s.name, branch: s.branch,
    org: s.client_id == null ? 'منصة B2B' : s.org, clientSuspended: s.client_st === 'susp', frsId,
    mustChangePin: !!s.must_change_pin,
  };
}

/** تغيير الرمز: يتحقق من الحالي (بنفس قفل المحاولات) ثم يضع الجديد ويلغي الجلسات الأخرى */
export async function changePin(req, ctx, { oldPin, newPin }) {
  assertPin(newPin);
  await assertNotLocked(`p:${ctx.phone}`, 'الحساب مقفل مؤقتًا بعد محاولات خاطئة');
  const [u] = await sql`SELECT pin_hash FROM org_users WHERE id = ${ctx.userId}`;
  if (!u || !checkPin(oldPin, u.pin_hash)) {
    await recordFail(`p:${ctx.phone}`, MAX_FAILS, LOCK_MIN);
    throw httpError(401, 'الرمز الحالي غير صحيح');
  }
  if (String(oldPin) === String(newPin)) throw httpError(400, 'اختر رمزًا مختلفًا عن الحالي');
  await sql`UPDATE org_users SET pin_hash = ${hashPin(newPin)}, must_change_pin = false WHERE id = ${ctx.userId}`;
  await sql`DELETE FROM sessions WHERE user_id = ${ctx.userId} AND token <> ${ctx.token}`;
}
