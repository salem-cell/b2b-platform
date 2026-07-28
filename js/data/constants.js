// ============================================================
// الثوابت: الأدوار، حالات الطلب/الفاتورة/التذكرة، صفحات التنقل
// ============================================================

/** حالات الطلب: التسمية + فئة الشريحة اللونية */
export const ORDER_STATUS = {
  ops:   { label: 'بانتظار تعميد العمليات',  chip: 'chip-info' },
  purch: { label: 'بانتظار تعميد المشتريات', chip: 'chip-info' },
  b2b:   { label: 'قيد التجهيز لدى B2B',     chip: 'chip-blue' },
  hold:  { label: 'معلق لدى B2B',            chip: 'chip-warn' },
  ship:  { label: 'قيد التوصيل',             chip: 'chip-purple' },
  done:  { label: 'مستلم',                   chip: 'chip-success' },
  short: { label: 'مستلم بنواقص',            chip: 'chip-warn' },
  rej:   { label: 'مرفوض',                   chip: 'chip-danger' },
};

/** خطوات رحلة الطلب (6 خطوات) */
export const ORDER_STEPS = ['أُرسل الطلب', 'تعميد العمليات', 'تعميد المشتريات', 'قبول B2B', 'التوصيل', 'تأكيد الاستلام'];
export const ORDER_STEPS_EN = ['Submitted', 'Ops approval', 'Purchasing', 'B2B accepted', 'Delivery', 'Received'];
/** فهرس الخطوة الحالية لكل حالة */
export const STEP_INDEX = { ops: 1, purch: 2, b2b: 4, hold: 4, ship: 4, done: 6, short: 6 };

/** حالات الفواتير */
export const INVOICE_STATUS = {
  unpaid: { label: 'غير مدفوعة',   chip: 'chip-danger' },
  part:   { label: 'مدفوعة جزئيًا', chip: 'chip-warn' },
  paid:   { label: 'مدفوعة',       chip: 'chip-success' },
  credit: { label: 'إشعار دائن',   chip: 'chip-purple' },
};

/** حالات اقتراحات المنتجات */
export const REQUEST_STATUS = {
  pend: { label: 'قيد المراجعة',   chip: 'chip-warn' },
  ok:   { label: 'أُضيف للكتالوج', chip: 'chip-success' },
  no:   { label: 'مرفوض',          chip: 'chip-danger' },
};

/** حالات الممنوحين (شبكة الفرنشايز) */
export const FRANCHISEE_STATUS = {
  ok:   { label: 'نشط',               chip: 'chip-success' },
  late: { label: 'متأخر سداد',        chip: 'chip-danger' },
  new:  { label: 'بانتظار تعميد B2B', chip: 'chip-warn' },
  off:  { label: 'موقوف',             chip: 'chip-gray' },
};

/** تسميات أدوار الفريق داخل المنشأة */
export const STAFF_ROLE_LABEL = { worker: 'عامل مطعم', ops: 'مدير عمليات', fin: 'مدير مالية', owner: 'مالك / مشتريات' };
export const STAFF_ROLE_CHIP = { worker: 'chip-gray', ops: 'chip-info', fin: 'chip-blue', owner: 'chip-purple' };

/** الأدوار السبعة (personas) وتنقّل كل دور */
export const ROLES = {
  worker: { name: 'عامل المطعم',              user: 'سالم العتيبي',      ini: 'س', org: 'مطاعم البلدة — فرع العليا', nav: ['dash', 'catalog', 'orders'] },
  ops:    { name: 'مدير العمليات',            user: 'أحمد الحربي',       ini: 'أ', org: 'مطاعم البلدة — فرع العليا', nav: ['dash', 'approvals', 'catalog', 'orders', 'users'] },
  owner:  { name: 'مدير المشتريات / المالك',  user: 'م. ناصر القحطاني',  ini: 'ن', org: 'مطاعم البلدة',              nav: ['dash', 'approvals', 'catalog', 'orders', 'wallet', 'reqs', 'users', 'branches', 'settings'] },
  fin:    { name: 'مدير المالية',             user: 'أ. سارة الشمري',    ini: 'س', org: 'مطاعم البلدة',              nav: ['dash', 'wallet', 'orders'] },
  frz:    { name: 'الممنوح (فرنشايز)',        user: 'فهد المطيري',       ini: 'ف', org: 'مطاعم الريف الشمالي',       nav: ['dash', 'approvals', 'catalog', 'orders', 'wallet', 'users', 'branches', 'settings'] },
  fr:     { name: 'مانح الفرنشايز',           user: 'عبدالله السالم',    ini: 'ع', org: 'مجموعة السالم',             nav: ['dash', 'analytics', 'frs', 'catalog', 'orders', 'wallet', 'reqs', 'users', 'branches', 'settings'] },
  b2b:    { name: 'B2B — سوبر أدمن',          user: 'فريق العمليات B2B', ini: 'B', org: 'منصة B2B',                  nav: ['dash', 'orders', 'approvals', 'tickets', 'reqs', 'clients', 'cadmin', 'catalog', 'analytics', 'frs', 'users', 'branches'] },
};

/** الصفحات: العنوان + مسارا أيقونة SVG */
export const PAGES = {
  dash:      { label: 'لوحة التحكم',        p: 'M4 11.2 12 4.4l8 6.8', p2: 'M6.6 10.4V19.4h10.8v-9' },
  catalog:   { label: 'منتجاتي',            p: 'M4.5 4.5h6.2v6.2H4.5zM13.3 4.5h6.2v6.2h-6.2zM4.5 13.3h6.2v6.2H4.5zM13.3 13.3h6.2v6.2h-6.2z', p2: '' },
  orders:    { label: 'الطلبات',            p: 'M6.2 3.6h11.6V20l-1.9-1.4-2 1.4-1.9-1.4-2 1.4-1.9-1.4L6.2 20z', p2: 'M9.3 8.2h5.4M9.3 11.7h5.4' },
  approvals: { label: 'التعميدات',          p: 'M12 3.4a8.6 8.6 0 1 1 0 17.2 8.6 8.6 0 0 1 0-17.2z', p2: 'M8.4 12.1l2.5 2.5 4.7-5' },
  wallet:    { label: 'العمليات المالية',   p: 'M4 8A2.6 2.6 0 0 1 6.6 5.4h10.8A2.6 2.6 0 0 1 20 8v8a2.6 2.6 0 0 1-2.6 2.6H6.6A2.6 2.6 0 0 1 4 16z', p2: 'M14.6 12H20' },
  analytics: { label: 'لوحة البيانات',      p: 'M5.2 20v-7.4M12 20V4.8M18.8 20V9.6', p2: '' },
  frs:       { label: 'الممنوحون',          p: 'M9.2 11.2a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2zM3.6 19.6c0-3.1 2.5-5 5.6-5s5.6 1.9 5.6 5', p2: 'M15.8 4.5a3.6 3.6 0 0 1 0 6.9M17.4 15c2 .7 3.4 2.1 3.4 4.6' },
  tickets:   { label: 'تذاكر النواقص',      p: 'M10.3 4.2 3.5 16.4a2 2 0 0 0 1.7 3h13.6a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z', p2: 'M12 9.5v4M12 16.6v.01' },
  reqs:      { label: 'اقتراح المنتجات',    p: 'M12 3.4a8.6 8.6 0 1 1 0 17.2 8.6 8.6 0 0 1 0-17.2z', p2: 'M12 8.5v7M8.5 12h7' },
  clients:   { label: 'العملاء',            p: 'M4 8.5A2 2 0 0 1 6 6.5h12a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', p2: 'M9 6.5V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M4 12h16' },
  cadmin:    { label: 'إدارة الكتالوج',     p: 'M12 3.6 20 8v8l-8 4.4L4 16V8z', p2: 'M4 8l8 4.4L20 8M12 12.4V20' },
  users:     { label: 'اليوزرات والصلاحيات', p: 'M9.2 11.2a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2zM3.6 19.6c0-3.1 2.5-5 5.6-5s5.6 1.9 5.6 5', p2: 'M16.5 8.5h5M19 6v5' },
  branches:  { label: 'إدارة فروعي',        p: 'M4 10 12 4l8 6', p2: 'M6 9.4V20h12V9.4M10 20v-5h4v5' },
  settings:  { label: 'الإعدادات',          p: 'M12 8.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8z', p2: 'M12 3.6v2M12 18.4v2M3.6 12h2M18.4 12h2M6.1 6.1l1.4 1.4M16.5 16.5l1.4 1.4M6.1 17.9l1.4-1.4M16.5 7.5l1.4-1.4' },
};

/** تسميات بديلة لصفحات دور المانح، وB2B */
export const FR_PAGE_LABELS = { catalog: 'منتجاتي', orders: 'طلباتي', analytics: 'لوحة عرض البيانات', frs: 'إدارة الممنوحين', reqs: 'المنتجات الجديدة' };

/** أقسام الكتالوج */
export const CATEGORIES = ['الكل', 'مواد غذائية', 'لحوم ودواجن', 'ألبان وأجبان', 'خضار وفواكه', 'مشروبات', 'صلصات وتوابل', 'تغليف وتشغيل'];

/** فلاتر صفحات الطلبات والفواتير */
export const ORDER_FILTERS = {
  'الكل': null,
  'بانتظار التعميد': ['ops', 'purch'],
  'قيد التنفيذ': ['b2b', 'hold', 'ship'],
  'مكتملة': ['done', 'short'],
  'مرفوضة': ['rej'],
};
export const INVOICE_FILTERS = { 'الكل': null, 'مستحقة': ['unpaid', 'part'], 'مدفوعة': ['paid', 'credit'] };

/** فئات الإشعارات وألوانها */
export const NOTIF_CHIP = { 'اعتمادات': 'chip-info', 'مالية': 'chip-blue', 'تذاكر': 'chip-warn', 'طلبات': 'chip-purple' };

/** إعدادات سلوكية (تكافئ props في النموذج الأصلي) */
export const POLICY = {
  workerSeesPrices: false,  // سياسة المنشأة: هل يرى العامل الأسعار؟
  statusEnglish: true,      // إظهار الترجمة الإنجليزية تحت خطوات الرحلة
};

/** الأدوار المخولة بالطلب من الكتالوج */
export const CAN_ORDER = ['worker', 'ops', 'owner', 'frz'];
/** الأدوار المخولة باقتراح المنتجات */
export const CAN_REQUEST = ['owner', 'fr'];
/** الأدوار المخولة بالدفع من المحفظة */
export const CAN_PAY = ['owner', 'fin', 'frz', 'fr'];
