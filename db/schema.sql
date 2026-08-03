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
  id           text PRIMARY KEY,              -- ORD-xxxx
  by_user      text NOT NULL,
  branch       text NOT NULL,
  date_label   text NOT NULL,                 -- تسمية عرض (اليوم 09:12 / الآن…)
  st           text NOT NULL,                 -- ops|purch|b2b|hold|ship|done|short|rej
  items        jsonb NOT NULL,                -- [{pid, qty}]
  stamps       jsonb NOT NULL,                -- 6 طوابع زمنية
  reason       text,
  hold_reason  text,
  rej_at       int,
  ticket_id    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

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
  st         text NOT NULL                    -- pend|ok|no
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

CREATE TABLE IF NOT EXISTS seqs (
  key text PRIMARY KEY,                       -- order|ticket|cn|req
  val bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      text PRIMARY KEY,
  phone      text NOT NULL,
  role       text,                            -- null قبل اختيار الحساب
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_org ON wallet_tx (org_cr, id DESC);
CREATE INDEX IF NOT EXISTS idx_notifs_role   ON notifs (role, id DESC);
CREATE INDEX IF NOT EXISTS idx_orders_st     ON orders (st);
