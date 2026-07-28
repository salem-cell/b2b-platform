// ============================================================
// كتالوج المنتجات — بيانات أولية (عيّنة). في الإنتاج تأتي من API.
// h: درجة لون الخلفية المخططة الاحتياطية، img: صورة عيّنة (استبدلوها بصور CDN حقيقية)
// ============================================================

const IMGS = {
  'P-1042': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=60',
  'P-1118': 'https://images.pexels.com/photos/33783/olive-oil-salad-dressing-cooking-olive.jpg?auto=compress&cs=tinysrgb&w=300',
  'P-4408': 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=300&q=60',
  'P-1207': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=60',
  'P-1310': 'https://commons.wikimedia.org/wiki/Special:FilePath/Wiener%20Zucker.JPG?width=300',
  'P-1415': 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?auto=format&fit=crop&w=300&q=60',
  'P-1428': 'https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=300&q=60',
  'P-2210': 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=300&q=60',
  'P-2264': 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=300&q=60',
  'P-2301': 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?auto=format&fit=crop&w=300&q=60',
  'P-3305': 'https://images.unsplash.com/photo-1552767059-ce182ead6c1b?auto=format&fit=crop&w=300&q=60',
  'P-3312': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=300&q=60',
  'P-3320': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=300&q=60',
  'P-6101': 'https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?auto=format&fit=crop&w=300&q=60',
  'P-6110': 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=300&q=60',
  'P-6122': 'https://images.unsplash.com/photo-1587496679742-bad502958fbf?auto=format&fit=crop&w=300&q=60',
  'P-7001': 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=300&q=60',
  'P-7010': 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=300&q=60',
  'P-7022': 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=300&q=60',
  'P-8001': 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?auto=format&fit=crop&w=300&q=60',
  'P-8010': 'https://images.unsplash.com/photo-1585155770447-2f66e2a397b5?auto=format&fit=crop&w=300&q=60',
  'P-8022': 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=300&q=60',
  'P-8030': 'https://images.unsplash.com/photo-1589010588553-46e8e7c21788?auto=format&fit=crop&w=300&q=60',
  'P-5501': 'https://images.pexels.com/photos/7262911/pexels-photo-7262911.jpeg?auto=compress&cs=tinysrgb&w=300',
  'P-5590': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=60',
};

export const PRODUCTS = [
  { id: 'P-1042', name: 'أرز بسمتي هندي',          unit: 'كيس 40 كجم',      cat: 'مواد غذائية',   price: 218.5,  h: 262 },
  { id: 'P-1118', name: 'زيت دوار الشمس',          unit: 'كرتون 4×4 لتر',   cat: 'مواد غذائية',   price: 96,     h: 196 },
  { id: 'P-4408', name: 'طماطم معلبة مقشرة',       unit: 'كرتون 12 علبة',   cat: 'مواد غذائية',   price: 54.5,   h: 222 },
  { id: 'P-1207', name: 'دقيق فاخر',               unit: 'كيس 45 كجم',      cat: 'مواد غذائية',   price: 74.25,  h: 250 },
  { id: 'P-1310', name: 'سكر ناعم',                unit: 'كيس 50 كجم',      cat: 'مواد غذائية',   price: 118,    h: 196 },
  { id: 'P-1415', name: 'معكرونة بيني',            unit: 'كيس 5 كجم',       cat: 'مواد غذائية',   price: 42.5,   h: 38 },
  { id: 'P-1428', name: 'بطاطس مقلية مجمدة 9مم',   unit: 'كرتون 4×2.5 كجم', cat: 'مواد غذائية',   price: 64,     h: 52 },
  { id: 'P-2210', name: 'صدور دجاج مجمدة',         unit: 'كرتون 10 كجم',    cat: 'لحوم ودواجن',   price: 172.25, h: 262 },
  { id: 'P-2264', name: 'دجاج كامل 1100 جم',       unit: 'كرتون 10 حبات',   cat: 'لحوم ودواجن',   price: 148,    h: 222 },
  { id: 'P-2301', name: 'لحم بقري مفروم مجمد',     unit: 'كرتون 10 كجم',    cat: 'لحوم ودواجن',   price: 198,    h: 8 },
  { id: 'P-3305', name: 'جبنة موزاريلا مبشورة',    unit: 'كيس 2.5 كجم',     cat: 'ألبان وأجبان',  price: 89.75,  h: 250 },
  { id: 'P-3312', name: 'لبنة بلدية',              unit: 'سطل 5 كجم',       cat: 'ألبان وأجبان',  price: 62,     h: 196 },
  { id: 'P-3320', name: 'حليب طويل الأجل',         unit: 'كرتون 12×1 لتر',  cat: 'ألبان وأجبان',  price: 58.5,   h: 210 },
  { id: 'P-6101', name: 'بصل أحمر',                unit: 'شوال 25 كجم',     cat: 'خضار وفواكه',   price: 34,     h: 310 },
  { id: 'P-6110', name: 'طماطم طازجة',             unit: 'صندوق 10 كجم',    cat: 'خضار وفواكه',   price: 28.5,   h: 2 },
  { id: 'P-6122', name: 'ليمون',                   unit: 'صندوق 8 كجم',     cat: 'خضار وفواكه',   price: 46,     h: 58 },
  { id: 'P-7001', name: 'مشروب غازي — علب',        unit: 'كرتون 24×330 مل', cat: 'مشروبات',       price: 42,     h: 352 },
  { id: 'P-7010', name: 'مياه 330 مل',             unit: 'شد 40 حبة',       cat: 'مشروبات',       price: 18.5,   h: 200 },
  { id: 'P-7022', name: 'عصير برتقال 1 لتر',       unit: 'كرتون 12 حبة',    cat: 'مشروبات',       price: 54,     h: 36 },
  { id: 'P-8001', name: 'كاتشب',                   unit: 'جالون 4 لتر × 4', cat: 'صلصات وتوابل',  price: 68,     h: 10 },
  { id: 'P-8010', name: 'مايونيز',                 unit: 'سطل 10 لتر',      cat: 'صلصات وتوابل',  price: 82.5,   h: 48 },
  { id: 'P-8022', name: 'فلفل أسود مطحون',         unit: 'كيس 1 كجم × 10',  cat: 'صلصات وتوابل',  price: 96,     h: 28 },
  { id: 'P-8030', name: 'صوص حار',                 unit: 'جالون 3.78 لتر',  cat: 'صلصات وتوابل',  price: 51,     h: 4 },
  { id: 'P-5501', name: 'أكياس تغليف حراري',       unit: 'رزمة 500 كيس',    cat: 'تغليف وتشغيل',  price: 38,     h: 262 },
  { id: 'P-5590', name: 'عبوات سلطة 750 مل',       unit: 'كرتون 400 عبوة',  cat: 'تغليف وتشغيل',  price: 126.5,  h: 250 },
].map((p) => ({ ...p, img: IMGS[p.id] || '', out: false }));

/** فهرس سريع للمنتج حسب المعرف */
export const PRODUCT_MAP = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
