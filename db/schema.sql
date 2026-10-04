-- ============================================================
-- مخطط قاعدة بيانات منصة B2B (Neon Postgres)
-- الكيانات تطابق نموذج الواجهة؛ الحقول المركبة قليلة التغير كـ JSONB
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  unit        text NOT NULL,
  cat         text NOT NULL,
  price       numeric(12,2) NOT NULL,
  h           int NOT NULL DEFAULT 200,       -- درجة لون الخلفية الاحتياطية
  img         text NOT NULL DEFAULT '',
  is_out      boolean NOT NULL DEFAULT false  -- نافد (يُخفى زر الإضافة)
);

CREATE TABLE IF NOT EXISTS orders (
  id           text PRIMARY KEY,              -- ORD-xxxx (واللاحقة -B لطلبات النواقص التابعة)
  by_user      text NOT NULL,
  branch       text NOT NULL,
  date_label   text NOT NULL,                 -- تسمية عرض (اليوم 09:12 / الآن…)
  st           text NOT NULL,                 -- ops|purch|b2b|hold|ship|done|short|rej
  items        jsonb NOT NULL,                -- [{pid, qty}] (كمية 0 = صنف محذوف يظهر مشطوبًا)
  stamps       jsonb NOT NULL,                -- 6 طوابع زمنية
  log          jsonb NOT NULL DEFAULT '[]',   -- سجل الإجراءات [{who, role, txt, t}]
  backorder    boolean NOT NULL DEFAULT false,-- طلب نواقص تابع
  parent_ref   text,                          -- الطلب الأصل لطلب النواقص
  reason       text,
  hold_reason  text,
  rej_at       int,
  ticket_id    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS log jsonb NOT NULL DEFAULT '[]';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS backorder boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_ref text;

CREATE TABLE IF NOT EXISTS wallet (
  org_cr    text PRIMARY KEY,                 -- السجل التجاري
  bal       numeric(14,2) NOT NULL,
  cr_limit  numeric(14,2) NOT NULL,
  used      numeric(14,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS wallet_tx (
  id         bigserial PRIMARY KEY,
  org_cr     text NOT NULL,
  t          text NOT NULL,                   -- الوصف
  d          text NOT NULL,                   -- تسمية التاريخ
  amt        numeric(14,2) NOT NULL,
  kind       text NOT NULL DEFAULT 'tx',      -- tx | settle
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id   text PRIMARY KEY,                      -- INV-/CN-
  ref  text NOT NULL,
  due  text NOT NULL,
  amt  numeric(14,2) NOT NULL,
  rem  numeric(14,2) NOT NULL,
  st   text NOT NULL,                         -- unpaid|part|paid|credit
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id          text PRIMARY KEY,               -- TKT-xxxx
  ord         text NOT NULL,
  customer    text NOT NULL,
  descr       text NOT NULL,
  qty         text NOT NULL,
  val         numeric(14,2) NOT NULL,
  st          text NOT NULL,                  -- open|held|resolved
  cn          text,
  hold_reason text,
  date_label  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prod_reqs (
  id         text PRIMARY KEY,                -- REQ-xxx
  name       text NOT NULL,
  unit       text NOT NULL DEFAULT '',
  by_org     text NOT NULL,
  by_user    text NOT NULL DEFAULT '',
  note       text NOT NULL DEFAULT '—',
  date_label text NOT NULL,
  st         text NOT NULL,                   -- pend|priced|ok|no
  price      numeric(12,2),                   -- سعر B2B المقترح (حالة priced)
  kind       text NOT NULL DEFAULT 'prod',    -- prod: اقتراح منتج جديد | cat: طلب إضافة من الكتالوج (سلة)
  items      jsonb,                           -- لطلبات السلة: [{pid, price?}] والسعر بعد تسعير B2B
  client_id  bigint                           -- عميل مقدّم طلب السلة (تنزل الأسعار في كتالوجه)
);
ALTER TABLE prod_reqs ADD COLUMN IF NOT EXISTS price numeric(12,2);
ALTER TABLE prod_reqs ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'prod';
ALTER TABLE prod_reqs ADD COLUMN IF NOT EXISTS items jsonb;
ALTER TABLE prod_reqs ADD COLUMN IF NOT EXISTS client_id bigint;

-- طلبات شحن المحفظة بالتحويل البنكي (بانتظار تعميد B2B)
CREATE TABLE IF NOT EXISTS topup_reqs (
  id         text PRIMARY KEY,                -- TU-xxx
  org        text NOT NULL,
  by_user    text NOT NULL,
  amt        numeric(14,2) NOT NULL,
  proof      text NOT NULL,                   -- اسم ملف صورة الحوالة
  date_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS frs (
  id      bigint PRIMARY KEY,
  name    text NOT NULL,
  city    text NOT NULL,
  cr      text NOT NULL,
  orders  int NOT NULL DEFAULT 0,
  spend   numeric(14,2) NOT NULL DEFAULT 0,
  pay     int NOT NULL DEFAULT 0,
  st      text NOT NULL,                      -- ok|late|new
  bal     numeric(14,2) NOT NULL DEFAULT 0,
  active  boolean NOT NULL DEFAULT true,
  parent  bigint,                             -- تابع لممنوح سوبر
  super   boolean NOT NULL DEFAULT false,
  region  text
);

CREATE TABLE IF NOT EXISTS clients (
  id        bigint PRIMARY KEY,
  name      text NOT NULL,
  cr        text NOT NULL,
  city      text NOT NULL,
  orders    int NOT NULL DEFAULT 0,
  spend     numeric(14,2) NOT NULL DEFAULT 0,
  st        text NOT NULL,                    -- ok|susp
  bal       numeric(14,2) NOT NULL DEFAULT 0,
  cr_limit  numeric(14,2) NOT NULL DEFAULT 0,
  used      numeric(14,2) NOT NULL DEFAULT 0,
  wst       text NOT NULL DEFAULT 'ok',       -- ok|frozen
  branches  jsonb NOT NULL DEFAULT '[]',
  staff     jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS org_users (
  id     bigint PRIMARY KEY,
  name   text NOT NULL,
  email  text,
  role   text NOT NULL,                       -- worker|ops|fin|owner
  branch text NOT NULL,
  st     text NOT NULL DEFAULT 'ok'           -- ok|pend|off
);

CREATE TABLE IF NOT EXISTS branches (
  name text PRIMARY KEY,
  city text NOT NULL,
  st   text NOT NULL DEFAULT 'ok',            -- ok|off
  loc  jsonb                                  -- {x,y,addr,coords}
);

CREATE TABLE IF NOT EXISTS saved_lists (
  id    bigserial PRIMARY KEY,
  name  text NOT NULL,
  items jsonb NOT NULL                        -- [[pid, qty]]
);

CREATE TABLE IF NOT EXISTS notifs (
  id         bigserial PRIMARY KEY,
  role       text NOT NULL,                   -- الدور المستهدف
  c          text NOT NULL,                   -- الفئة
  body       text NOT NULL,
  t          text NOT NULL,                   -- تسمية الوقت
  created_at timestamptz NOT NULL DEFAULT now()
);

-- كتالوج العميل الخاص: أسعار متفق عليها تتقدم على سعر الكتالوج الأساسي
CREATE TABLE IF NOT EXISTS client_products (
  client_id bigint NOT NULL,
  pid       text NOT NULL,
  price     numeric(12,2) NOT NULL,
  PRIMARY KEY (client_id, pid)
);

-- نوع العميل (مستقل | مانح | ممنوح بيسك | ممنوح سوبر) — يُشتق للبيانات القديمة
ALTER TABLE clients ADD COLUMN IF NOT EXISTS type text;

-- طلبات تسجيل المنشآت من فورم «سجّل منشأتك»
CREATE TABLE IF NOT EXISTS new_clients (
  id          text PRIMARY KEY,               -- NC-xxx
  name        text NOT NULL,
  activity    text NOT NULL DEFAULT '',       -- نوع النشاط
  model       text NOT NULL DEFAULT 'مستقل',  -- نموذج التشغيل (يحدد نوع العميل)
  city        text NOT NULL DEFAULT '',
  cities      text NOT NULL DEFAULT '',       -- مدن التغطية
  branches_n  int  NOT NULL DEFAULT 1,
  cr          text NOT NULL DEFAULT '',
  vat         text NOT NULL DEFAULT '',
  docs        jsonb NOT NULL DEFAULT '[]',    -- أسماء المستندات المرفقة
  mgr_name    text NOT NULL DEFAULT '',
  mgr_role    text NOT NULL DEFAULT '',
  mgr_contact text NOT NULL DEFAULT '',
  cats        jsonb NOT NULL DEFAULT '[]',    -- احتياجات التوريد
  monthly     text NOT NULL DEFAULT '',       -- متوسط المشتريات الشهرية
  payment     text NOT NULL DEFAULT '',       -- الدفع ونوافذ الاستلام
  st          text NOT NULL DEFAULT 'pend',   -- pend|ok|no
  client_id   bigint,                         -- العميل المُنشأ عند الاعتماد
  date_label  text NOT NULL DEFAULT 'الآن',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- مصفوفة الأنواع واليوزرات (وثيقة صلاحيات مُصدَّرة بإصدارات)
CREATE TABLE IF NOT EXISTS roles_matrix (
  id         bigserial PRIMARY KEY,
  ver        text NOT NULL,                   -- 1.0, 1.1 …
  note       text NOT NULL DEFAULT '',
  meta       text NOT NULL DEFAULT '',
  cells      jsonb NOT NULL,                  -- [[mark×8]×4] بترتيب الأنواع
  cur        boolean NOT NULL DEFAULT false,  -- الإصدار المنشور الحالي
  draft      boolean NOT NULL DEFAULT false,  -- مسودة غير منشورة
  created_at timestamptz NOT NULL DEFAULT now()
);

-- طلبات الأجل والمهلة ووعود السداد من العملاء (v7)
CREATE TABLE IF NOT EXISTS fin_reqs (
  id         text PRIMARY KEY,                -- FRQ-xxx
  client_id  bigint NOT NULL,
  kind       text NOT NULL,                   -- ajel (أجل) | delay (مهلة) | promise (وعد سداد)
  amt        numeric(14,2),
  months     int,
  to_date    text,                            -- التاريخ المقترح / الموعود
  note       text NOT NULL DEFAULT '',
  st         text NOT NULL DEFAULT 'pend',    -- pend | ok | no (الوعد يسجَّل ok مباشرة)
  file_id    text,                            -- ملف التحصيل المرتبط / الناتج
  date_label text NOT NULL DEFAULT 'الآن',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ملفات التحصيل (v7): دين مفتوح بمراحل تصعيد خمس وسجل موثق
CREATE TABLE IF NOT EXISTS col_files (
  id         text PRIMARY KEY,                -- COL-xxx
  client_id  bigint NOT NULL,
  inv        text NOT NULL DEFAULT '',        -- الفاتورة المرجعية
  ref        text NOT NULL DEFAULT '',        -- وصف الدين
  amt        numeric(14,2) NOT NULL,          -- المستحق المتبقي
  orig_amt   numeric(14,2) NOT NULL,
  created    text NOT NULL,                   -- تاريخ إنشاء الدين (تسمية)
  due        text NOT NULL,                   -- تاريخ الاستحقاق الحالي (تسمية)
  late_days  int NOT NULL DEFAULT 0,
  stage      int NOT NULL DEFAULT 1,          -- 1 ودي | 2 رسمي | 3 إنذار | 4 تجميد ائتمان | 5 إحالة قانونية
  promise    jsonb,                           -- {date, amt} وعد السداد القائم
  due_hist   jsonb NOT NULL DEFAULT '[]',     -- [{old,to,why,d}] بحد أقصى 5 جدولات
  log        jsonb NOT NULL DEFAULT '[]',     -- [{t,d}] سجل الإجراءات
  st         text NOT NULL DEFAULT 'open',    -- open | closed
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seqs (
  key text PRIMARY KEY,                       -- order|ticket|cn|req|tu|nc|frq|col
  val bigint NOT NULL
);
INSERT INTO seqs (key, val) VALUES ('tu', 101) ON CONFLICT (key) DO NOTHING;
INSERT INTO seqs (key, val) VALUES ('nc', 504) ON CONFLICT (key) DO NOTHING;
INSERT INTO seqs (key, val) VALUES ('frq', 204) ON CONFLICT (key) DO NOTHING;
INSERT INTO seqs (key, val) VALUES ('col', 303) ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS sessions (
  token      text PRIMARY KEY,
  phone      text NOT NULL,
  role       text,                            -- null قبل اختيار الحساب
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_org ON wallet_tx (org_cr, id DESC);
CREATE INDEX IF NOT EXISTS idx_notifs_role   ON notifs (role, id DESC);
CREATE INDEX IF NOT EXISTS idx_orders_st     ON orders (st);

-- ============================================================
-- تكامل B2B OPS (docs/INTEGRATION.md) — جداول خاصة بالمنصة، لا تُشارَك مع أي نظام آخر
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_id   bigint;                        -- المنشأة صاحبة الطلب
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ops_ref     text;                          -- رقم أمر البيع في العمليات SO-…
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ops_status  text;                          -- حالة التنفيذ كما تبلّغها العمليات
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ops_eta     text;                          -- موعد التوفر المتوقع للنواقص
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ops_events  jsonb NOT NULL DEFAULT '[]';   -- [{type,status,text,at}] رحلة التنفيذ
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ops_sent_at timestamptz;                   -- متى أُرسل للعمليات
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS integration_outbox (
  id          text PRIMARY KEY,                -- معرّف الحدث (يُرسل كما هو — مفتاح منع التكرار عند المستقبل)
  type        text NOT NULL,
  subject     text NOT NULL,
  seq         bigint NOT NULL,                 -- تسلسل لكل subject
  correlation text NOT NULL,
  data        jsonb NOT NULL,
  st          text NOT NULL DEFAULT 'pending',  -- pending | sent | failed | dead
  attempts    int NOT NULL DEFAULT 0,
  next_at     timestamptz NOT NULL DEFAULT now(),
  last_error  text,
  result      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_int_outbox_due ON integration_outbox (st, next_at);

CREATE TABLE IF NOT EXISTS integration_inbox (
  event_id    text PRIMARY KEY,                -- حدث مستلم مرة واحدة فقط
  type        text NOT NULL,
  subject     text NOT NULL,
  seq         bigint,
  st          text NOT NULL,                   -- applied | stale | rejected
  error       text,
  data        jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_subjects (
  source      text NOT NULL,                   -- sales (تسلسل ما نرسله) | ops (آخر ما طُبّق مما نستلمه)
  subject     text NOT NULL,
  last_seq    bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (source, subject)
);

CREATE TABLE IF NOT EXISTS ops_stock (
  pid          text PRIMARY KEY,               -- المتاح للبيع كما يحسبه نظام العمليات (نسخة للعرض فقط)
  mapped       boolean NOT NULL DEFAULT false,
  atp          int,
  incoming     int,
  incoming_eta text,
  as_of        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_hashes (
  entity  text NOT NULL,                       -- customer | product : بصمة آخر نسخة أُرسلت للعمليات
  id      text NOT NULL,
  hash    text NOT NULL,
  PRIMARY KEY (entity, id)
);

-- ============================================================
-- الحسابات والرمز السري وفصل بيانات المنشآت (docs/SECURITY.md) — إضافات فقط
-- ============================================================
-- org_users = حسابات الدخول: كل حساب له جوال فريد ورمز سري (PIN) ودور ثابت ومنشأة (NULL = فريق B2B)
ALTER TABLE org_users ADD COLUMN IF NOT EXISTS client_id bigint;
ALTER TABLE org_users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE org_users ADD COLUMN IF NOT EXISTS pin_hash text;                          -- salt:hash (scrypt + pepper من البيئة)
ALTER TABLE org_users ADD COLUMN IF NOT EXISTS must_change_pin boolean NOT NULL DEFAULT true;
ALTER TABLE org_users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_users_phone ON org_users (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_users_client ON org_users (client_id);

-- قفل المحاولات: مفتاح = p:<جوال> أو ip:<عنوان>
CREATE TABLE IF NOT EXISTS login_throttle (
  key          text PRIMARY KEY,
  fails        int NOT NULL DEFAULT 0,
  locks        int NOT NULL DEFAULT 0,         -- عدد مرات القفل المتتالية (يصعّد المدة)
  window_start timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id bigint;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- المنشأة على كل سجل يخص عميلًا
ALTER TABLE invoices    ADD COLUMN IF NOT EXISTS client_id bigint;
ALTER TABLE tickets     ADD COLUMN IF NOT EXISTS client_id bigint;
ALTER TABLE topup_reqs  ADD COLUMN IF NOT EXISTS client_id bigint;
ALTER TABLE saved_lists ADD COLUMN IF NOT EXISTS client_id bigint;
ALTER TABLE notifs      ADD COLUMN IF NOT EXISTS client_id bigint;                     -- NULL = لكل من يحمل الدور
ALTER TABLE wallet      ADD COLUMN IF NOT EXISTS client_id bigint;
ALTER TABLE wallet_tx   ADD COLUMN IF NOT EXISTS client_id bigint;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_client ON wallet (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_tx_client ON wallet_tx (client_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders (client_id, created_at DESC);

-- الفروع لكل منشأة (كان الاسم مفتاحًا عامًا لكل المنصة)
ALTER TABLE branches ADD COLUMN IF NOT EXISTS client_id bigint NOT NULL DEFAULT 1;
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_client_name ON branches (client_id, name);

-- شبكة الفرنشايز: عميل الممنوح نفسه وعميل مانحه
ALTER TABLE frs ADD COLUMN IF NOT EXISTS client_id bigint;
ALTER TABLE frs ADD COLUMN IF NOT EXISTS granter_id bigint;
