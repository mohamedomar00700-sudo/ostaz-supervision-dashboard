# Ostaz Online — Supervision Dashboard

لوحة إشراف داخلية لفريق "أكاديمية أستاذ أونلاين".

- **الواجهة:** `index.html` + `app.js` + `styles.css` (بدون build — تُنشر مباشرة على GitHub Pages من فرع `main`).
- **الخلفية:** Supabase (Auth بالإيميل وجوجل + Postgres + Row Level Security + Realtime).
- الأدمن: يوافق على المشرفين، ويحذف، ويعدّل أسعار الصرف. المشرف: يضيف ويعدّل كل البيانات.
- سعر الصرف يُثبَّت على كل حصة لحظة تسجيلها "تمت" (trigger `close_session`)، ورصيد الأسر/مستحقات المعلمين من الـ views `family_balances` و `tutor_balances`.

الـ anon key الموجود في `app.js` آمن للنشر العلني؛ الحماية الفعلية عبر RLS.
