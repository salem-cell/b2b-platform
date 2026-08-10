// ============================================================
// الحالة الأولية للتطبيق — بيانات عيّنة (in-memory).
// في الإنتاج تُستبدل باستدعاءات API؛ الهيكل يطابق كيانات الواجهة الخلفية المقترحة.
// ============================================================

/** لستات محفوظة (قوالب طلب قابلة لإعادة الاستخدام) */
export const SAVED_LISTS = [
  { name: 'الطلبية الأسبوعية',  items: [['P-1042', 2], ['P-1118', 2], ['P-2210', 4], ['P-3305', 3], ['P-4408', 2], ['P-3312', 2], ['P-1207', 1], ['P-1310', 1]] },
  { name: 'مستلزمات التغليف',   items: [['P-5501', 3], ['P-5590', 2]] },
  { name: 'طلبية الدواجن',      items: [['P-2210', 6], ['P-2264', 4]] },
];

/** إشعارات أولية ثابتة لكل دور */
export const BASE_NOTIFS = {
  worker: [
    { c: 'طلبات',    text: 'وصل طلبك ORD-2481 إلى الفرع — أكّد الاستلام بعد الفحص', t: 'قبل 20 دقيقة' },
    { c: 'اعتمادات', text: 'رُفض ORD-2459: تجاوز ميزانية الأسبوع — عدّل وأعد الإرسال', t: '16 يوليو' },
  ],
  ops: [
    { c: 'اعتمادات', text: 'طلب جديد بانتظار تعميدك — ORD-2478 من خالد الدوسري', t: 'قبل 30 دقيقة' },
    { c: 'طلبات',    text: 'B2B قبل الطلب ORD-2465 وبدأ التجهيز', t: '18 يوليو' },
  ],
  owner: [
    { c: 'اعتمادات', text: 'ORD-2476 بانتظار تعميدك النهائي', t: 'أمس' },
    { c: 'مالية',    text: 'فاتورة INV-9312 تستحق خلال 7 أيام — 8,420.50 ر.س', t: 'اليوم' },
  ],
  fin: [
    { c: 'مالية', text: 'فاتورة INV-9312 تستحق خلال 7 أيام — 8,420.50 ر.س', t: 'اليوم' },
    { c: 'مالية', text: 'وصل إشعار دائن CN-1102 — 320.00 ر.س أُضيف للمحفظة', t: '12 يوليو' },
  ],
  frz: [
    { c: 'اعتمادات', text: 'ORD-2476 بانتظار تعميدك النهائي', t: 'أمس' },
    { c: 'مالية',    text: 'حدّث المانح قائمة أسعار الفرنشايز — سرت على الطلبات الجديدة', t: 'اليوم' },
  ],
  frzs: [
    { c: 'اعتمادات', text: 'ORD-2476 بانتظار تعميدك النهائي', t: 'أمس' },
    { c: 'طلبات',    text: 'انخفضت طلبات ممنوحك «كرسبر برجر» 38% هذا الأسبوع', t: 'اليوم' },
    { c: 'مالية',    text: 'حدّث المانح الرئيسي قائمة الأسعار — سرت عليك وعلى ممنوحيك', t: 'أمس' },
  ],
  fr: [
    { c: 'مالية', text: 'تأخر سداد بروست الخليج 12 يومًا — 9,200 ر.س', t: 'اليوم' },
    { c: 'طلبات', text: 'ارتفعت طلبات الريف الشمالي 12% هذا الأسبوع', t: 'أمس' },
  ],
  b2b: [
    { c: 'تذاكر', text: 'تذكرة نواقص TKT-3035 حُلّت — صدر CN-1102', t: '12 يوليو' },
    { c: 'طلبات', text: '3 طلبات جديدة دخلت قائمة التجهيز اليوم', t: 'اليوم' },
  ],
};

/** الحالة الأولية الكاملة */
export function createInitialState() {
  return {
    // الجلسة والتنقل
    auth: 'phone',          // phone | otp | user
    role: null,             // null = شاشة الدخول
    page: 'dash',
    mTab: 'home', mStack: [],   // تنقّل واجهة الجوال (تبويب سفلي + مكدس push)
    phone: '', otp: '', adminKey: '',
    notifOpen: false, toast: null,

    // الكتالوج والسلة
    cart: {}, search: '', cat: 'الكل',
    ordFilter: 'الكل', invFilter: 'الكل', finSeg: 'w',

    // الطبقات المنبثقة
    drawer: null,           // {k:'order', id}
    modal: null,            // {k, id?}

    // حقول النماذج المؤقتة
    approveQty: null, recv: null,
    rejectText: '', holdText: '', tHoldText: '',
    topupAmt: 2500, topupMethod: 'مدى', tuProof: false, topupReqs: [], reqPrice: 64,
    frSel: null, frName: '', frCr: '', frKind: 'normal', frRegion: '',
    lists: SAVED_LISTS, lnName: '', lnQty: {}, lnSearch: '',
    reqName: '', reqUnit: '', reqNote: '', reqSearch: '', reqCat: 'الكل',
    usName: '', usEmail: '', usPass: '', usRole: 'worker', usBranches: [], brName: '',
    ueRole: null, ueBranches: [],
    clientSel: null, clientPrev: null, clWalletOpen: false, clStaffName: '', clStaffRole: 'worker', clBrName: '',
    clSubName: '', clSubCr: '', clBrLoc: null,

    // v5: العملاء الجدد + إنشاء عميل + إدارة الكتالوج + كتالوج العميل + مصفوفة الأنواع
    ncSel: null,                                    // طلب التسجيل المفتوح في صفحة المراجعة
    cnName: '', cnCr: '', cnCity: '', cnType: 'مستقل', cnGranter: null, cnRegion: '',
    cadSearch: '', cadCat: 'الكل',
    cadnName: '', cadnUnit: '', cadnPrice: '', cadnCat: 'مواد غذائية',
    cpSearch: '',                                   // بحث نافذة إضافة منتج لكتالوج العميل

    // الخرائط وتفاصيل الفروع
    brLoc: null,            // موقع الفرع الجديد المُثبّت (صفحة إدارة الفروع)
    mapPin: null,           // الدبوس الحالي في نافذة اختيار الموقع {x,y}
    mapSearch: '', mapTarget: null,   // br | cl
    mapView: null,          // {name,x,y,addr,coords} لنافذة عرض الموقع
    brDetName: null,        // اسم الفرع المفتوح في نافذة التفاصيل

    // الطلبات
    orders: [
      { id: 'ORD-2481', by: 'سالم العتيبي', branch: 'فرع العليا', date: 'اليوم 09:12', st: 'ship',
        items: [{ pid: 'P-2210', qty: 4 }, { pid: 'P-1042', qty: 2 }, { pid: 'P-5501', qty: 1 }],
        stamps: ['09:12', '09:40', '10:05', '10:30', '11:20', ''] },
      { id: 'ORD-2478', by: 'خالد الدوسري', branch: 'فرع العليا', date: 'اليوم 08:47', st: 'ops',
        items: [{ pid: 'P-3305', qty: 6 }, { pid: 'P-4408', qty: 3 }, { pid: 'P-1118', qty: 2 }, { pid: 'P-5590', qty: 1 }],
        stamps: ['08:47', '', '', '', '', ''] },
      { id: 'ORD-2476', by: 'أحمد الحربي', branch: 'فرع الروضة', date: 'أمس 17:20', st: 'purch',
        items: [{ pid: 'P-1207', qty: 5 }, { pid: 'P-1310', qty: 2 }, { pid: 'P-2264', qty: 3 }],
        stamps: ['17:20', '18:05', '', '', '', ''] },
      { id: 'ORD-2465', by: 'سالم العتيبي', branch: 'فرع العليا', date: '18 يوليو', st: 'done',
        items: [{ pid: 'P-1042', qty: 3 }, { pid: 'P-3312', qty: 4 }],
        stamps: ['09:02', '09:30', '10:15', '10:40', '13:05', '13:32'] },
      { id: 'ORD-2459', by: 'خالد الدوسري', branch: 'فرع الروضة', date: '16 يوليو', st: 'rej', rejAt: 1,
        items: [{ pid: 'P-2210', qty: 9 }],
        stamps: ['11:10', '', '', '', '', ''],
        reason: 'تجاوز ميزانية الأسبوع للفرع — قلّل الكمية إلى ٤ كراتين وأعد الإرسال.' },
    ],
    orderSeq: 2482,

    // المحفظة (تتبع السجل التجاري)
    wallet: {
      bal: 48250, limit: 100000, used: 36500,
      hist: [
        { t: 'شحن المحفظة — مدى',              d: '18 يوليو', amt: 5000 },
        { t: 'حجز آجل — ORD-2465',             d: '18 يوليو', amt: -8420.5 },
        { t: 'سداد فاتورة INV-9297 (جزئي)',    d: '15 يوليو', amt: -6000 },
        { t: 'إشعار دائن CN-1102 — نواقص',     d: '12 يوليو', amt: 320 },
      ],
      settle: [
        { t: 'تسوية أسبوعية — يوليو (أ3)', d: '14 يوليو', amt: -14200 },
        { t: 'تسوية أسبوعية — يوليو (أ2)', d: '7 يوليو',  amt: -11750 },
      ],
    },

    // الفواتير
    invoices: [
      { id: 'INV-9312', ref: 'ORD-2465',      due: 'الاستحقاق 28 يوليو', amt: 8420.5,   rem: 8420.5, st: 'unpaid' },
      { id: 'INV-9297', ref: 'ORD-2452',      due: 'الاستحقاق 25 يوليو', amt: 12480,    rem: 6480,   st: 'part' },
      { id: 'INV-9280', ref: 'ORD-2440',      due: 'سُددت 10 يوليو',     amt: 6180.75,  rem: 0,      st: 'paid' },
      { id: 'CN-1102',  ref: 'نواقص ORD-2452', due: 'إشعار دائن',        amt: -320,     rem: 0,      st: 'credit' },
    ],

    // شبكة الفرنشايز — parent: تابع لممنوح سوبر، super/region: ممنوح سوبر بمنطقة امتياز
    frs: [
      { id: 1, name: 'مطاعم الريف الشمالي', city: 'الرياض', cr: '4030-102211', orders: 41, spend: 486200, pay: 96,  st: 'ok',   bal: 22400, active: true },
      { id: 2, name: 'بروست الخليج',        city: 'جدة',    cr: '4030-118563', orders: 34, spend: 412500, pay: 71,  st: 'late', bal: 9200,  active: true },
      { id: 3, name: 'شاورما البلد',        city: 'الدمام', cr: '4030-125770', orders: 26, spend: 301800, pay: 88,  st: 'ok',   bal: 14750, active: true, parent: 5 },
      { id: 4, name: 'كرسبر برجر',          city: 'الخبر',  cr: '4030-131208', orders: 9,  spend: 96400,  pay: 100, st: 'new',  bal: 3000,  active: true, parent: 5 },
      { id: 5, name: 'الشرقية للفرنشايز',   city: 'الدمام', cr: '4030-140552', orders: 18, spend: 214600, pay: 94,  st: 'ok',   bal: 48250, active: true, super: true, region: 'المنطقة الشرقية' },
    ],

    // تذاكر النواقص
    tickets: [
      { id: 'TKT-3035', ord: 'ORD-2452', customer: 'مطاعم البلدة — فرع العليا', desc: 'زيت دوار الشمس',
        qty: 'ناقص 1 × كرتون 4×4 لتر', val: 320, st: 'resolved', cn: 'CN-1102', date: '12 يوليو' },
    ],
    ticketSeq: 3041, cnSeq: 1108,

    // اقتراحات المنتجات
    prodReqs: [
      { id: 'REQ-118', name: 'صوص رانش — جالون 3.78 لتر', by: 'مطاعم البلدة', user: 'أحمد الحربي', note: 'نحتاجه للفروع الثلاثة أسبوعيًا', date: 'أمس', st: 'pend' },
      { id: 'REQ-102', name: 'خل تفاح — عبوة 5 لتر',      by: 'مطاعم البلدة', user: 'أحمد الحربي', note: 'بديل للصنف المتوقف',            date: '14 يوليو', st: 'ok' },
    ],
    reqSeq: 119,

    // العملاء (منشآت مسجلة لدى B2B)
    clients: [
      { id: 1, name: 'مطاعم البلدة', cr: '4030-118842', city: 'الرياض', orders: 58, spend: 512400, st: 'ok', bal: 48250, limit: 100000, used: 36500, wst: 'ok',
        branches: [{ name: 'فرع العليا', city: 'الرياض' }, { name: 'فرع الروضة', city: 'الرياض' }, { name: 'فرع النسيم', city: 'الرياض' }],
        staff: [
          { name: 'م. ناصر القحطاني', role: 'owner',  branch: 'الإدارة' },
          { name: 'أحمد الحربي',      role: 'ops',    branch: 'فرع العليا' },
          { name: 'أ. سارة الشمري',   role: 'fin',    branch: 'الإدارة' },
          { name: 'سالم العتيبي',     role: 'worker', branch: 'فرع العليا' },
          { name: 'خالد الدوسري',     role: 'worker', branch: 'فرع الروضة' },
          { name: 'ماجد العنزي',      role: 'worker', branch: 'فرع النسيم' },
        ] },
      { id: 2, name: 'مطاعم الريف الشمالي', cr: '4030-102211', city: 'الرياض', orders: 41, spend: 486200, st: 'ok', bal: 22400, limit: 60000, used: 18200, wst: 'ok',
        branches: [{ name: 'فرع النرجس', city: 'الرياض' }, { name: 'فرع القيروان', city: 'الرياض' }],
        staff: [
          { name: 'فهد المطيري',   role: 'owner',  branch: 'الإدارة' },
          { name: 'يوسف الشهراني', role: 'ops',    branch: 'فرع النرجس' },
          { name: 'عمر باوزير',    role: 'worker', branch: 'فرع النرجس' },
          { name: 'تركي الحقيل',   role: 'worker', branch: 'فرع القيروان' },
        ] },
      { id: 3, name: 'بروست الخليج', cr: '4030-118563', city: 'جدة', orders: 34, spend: 412500, st: 'ok', bal: 9200, limit: 50000, used: 41300, wst: 'ok',
        branches: [{ name: 'فرع الحمراء', city: 'جدة' }, { name: 'فرع السلامة', city: 'جدة' }],
        staff: [
          { name: 'وليد بخاري',  role: 'owner',  branch: 'الإدارة' },
          { name: 'هاني فلمبان', role: 'worker', branch: 'فرع الحمراء' },
          { name: 'مازن قاضي',   role: 'worker', branch: 'فرع السلامة' },
        ] },
      { id: 4, name: 'شاورما البلد', cr: '4030-125770', city: 'الدمام', orders: 26, spend: 301800, st: 'ok', bal: 14750, limit: 40000, used: 9800, wst: 'ok',
        branches: [{ name: 'فرع الشاطئ', city: 'الدمام' }],
        staff: [
          { name: 'إبراهيم الملحم', role: 'owner',  branch: 'الإدارة' },
          { name: 'سعود العوض',     role: 'worker', branch: 'فرع الشاطئ' },
        ] },
      { id: 5, name: 'كرسبر برجر', cr: '4030-131208', city: 'الخبر', orders: 9, spend: 96400, st: 'ok', bal: 3000, limit: 30000, used: 5400, wst: 'ok',
        branches: [{ name: 'فرع العقربية', city: 'الخبر' }],
        staff: [
          { name: 'بدر الجبرين',   role: 'owner',  branch: 'الإدارة' },
          { name: 'راكان السبيعي', role: 'worker', branch: 'فرع العقربية' },
        ] },
      { id: 6, name: 'الشرقية للفرنشايز', cr: '4030-140552', city: 'الدمام', orders: 18, spend: 214600, st: 'ok', bal: 48250, limit: 100000, used: 36500, wst: 'ok',
        branches: [{ name: 'فرع الكورنيش', city: 'الدمام' }, { name: 'فرع الظهران مول', city: 'الظهران' }],
        staff: [
          { name: 'م. فيصل الدوسري', role: 'owner',  branch: 'الإدارة' },
          { name: 'نايف العتيق',     role: 'ops',    branch: 'فرع الكورنيش' },
          { name: 'حمد الدخيل',      role: 'worker', branch: 'فرع الظهران مول' },
        ] },
    ],

    // مستخدمو المنشأة الحالية
    users: [
      { id: 1, name: 'سالم العتيبي',  role: 'worker', branch: 'فرع العليا',  st: 'ok' },
      { id: 2, name: 'خالد الدوسري',  role: 'worker', branch: 'فرع الروضة',  st: 'ok' },
      { id: 3, name: 'أحمد الحربي',   role: 'ops',    branch: 'فرع العليا',  st: 'ok' },
      { id: 4, name: 'أ. سارة الشمري', role: 'fin',   branch: 'الإدارة',     st: 'ok' },
      { id: 5, name: 'ماجد العنزي', email: 'majed@baldah.sa', role: 'worker', branch: 'فرع العليا', st: 'pend' },
    ],
    // الفروع — لكل فرع موقع خريطة {x,y بالنسبة المئوية, العنوان, الإحداثيات}
    branches: [
      { name: 'فرع العليا', city: 'الرياض', loc: { x: 55, y: 50, addr: 'حي العليا، الرياض', coords: '24.7050°N, 46.7540°E' } },
      { name: 'فرع الروضة', city: 'الرياض', loc: { x: 30, y: 85, addr: 'حي الروضة، الرياض', coords: '24.7785°N, 46.6840°E' } },
      { name: 'فرع النسيم', city: 'الرياض', loc: { x: 80, y: 40, addr: 'حي الملز، الرياض', coords: '24.6840°N, 46.8240°E' } },
    ],

    // v5: كتالوج العميل الخاص — أسعار متفق عليها لعميل «مطاعم البلدة»
    clientProds: [
      { clientId: 1, pid: 'P-1042', price: 43.5 },
      { clientId: 1, pid: 'P-2210', price: 116 },
      { clientId: 1, pid: 'P-5501', price: 27 },
      { clientId: 6, pid: 'P-2210', price: 114.5 },
    ],

    // v5: طلبات تسجيل المنشآت الواردة من فورم «سجّل منشأتك»
    newClients: [
      { id: 'NC-503', name: 'مذاق الشرق للتموين', activity: 'تموين وضيافة', model: 'مستقل', city: 'الرياض', cities: 'الرياض · الخرج',
        branchesN: 4, cr: '1010-556231', vat: '310556231400003', docs: ['السجل التجاري.pdf', 'شهادة الضريبة.pdf'],
        mgrName: 'عبدالله السالم', mgrRole: 'مدير المشتريات', mgrContact: '055 611 2234 · a.salem@mathaq.sa',
        cats: ['مواد غذائية', 'لحوم ودواجن', 'تغليف وتشغيل'], monthly: '45,000 – 60,000 ر.س',
        payment: 'آجل 30 يومًا · الاستلام صباحًا 6–10', st: 'pend', date: 'اليوم 10:20' },
      { id: 'NC-502', name: 'بيت الشاورما الحديث', activity: 'مطاعم وجبات سريعة', model: 'ممنوح بيسك', city: 'جدة', cities: 'جدة',
        branchesN: 2, cr: '4030-771902', vat: '300771902100003', docs: ['السجل التجاري.pdf'],
        mgrName: 'مروان خياط', mgrRole: 'المالك', mgrContact: '056 402 8871 · marwan@shawarma-h.sa',
        cats: ['لحوم ودواجن', 'خضار وفواكه', 'صلصات وتوابل'], monthly: '18,000 – 25,000 ر.س',
        payment: 'دفع فوري من المحفظة · الاستلام مساءً 4–8', st: 'pend', date: 'أمس 16:45' },
      { id: 'NC-501', name: 'قهوة أول الصبح', activity: 'مقاهي مختصة', model: 'مستقل', city: 'الدمام', cities: 'الدمام · الخبر',
        branchesN: 3, cr: '2050-334127', vat: '', docs: [],
        mgrName: 'ريان الغامدي', mgrRole: 'مدير التشغيل', mgrContact: '053 998 7120 · rayan@morningcup.sa',
        cats: ['ألبان وأجبان', 'مشروبات', 'تغليف وتشغيل'], monthly: '9,000 – 14,000 ر.س',
        payment: 'آجل 14 يومًا · نافذتا استلام', st: 'ok', date: '14 يوليو' },
    ],
    ncSeq: 504,

    // v5: مصفوفة الأنواع واليوزرات — الإصدار المنشور 1.0
    // العلامات: on ممكّن كامل · part جزئي (حسب الفرع/السقف) · admin مدير الحساب · off غير متاح
    rolesMatrix: [
      { id: 1, ver: '1.0', note: 'الإصدار التأسيسي لصلاحيات الأنواع الأربعة', meta: 'نُشر 12 يوليو — فريق B2B', cur: true, draft: false,
        cells: [
          ['admin', 'on',  'on',  'part', 'on',  'off', 'off', 'off'],   // مستقل
          ['admin', 'on',  'on',  'on',   'on',  'on',  'part', 'off'],  // مانح
          ['admin', 'on',  'part', 'part', 'on', 'off', 'off', 'off'],   // ممنوح بيسك
          ['admin', 'on',  'on',  'part', 'on',  'part', 'on', 'off'],   // ممنوح سوبر
        ] },
    ],

    notifUnread: 2,
    extraNotifs: {},   // إشعارات مولدة أثناء الجلسة حسب الدور
  };
}
