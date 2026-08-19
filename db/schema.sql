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
