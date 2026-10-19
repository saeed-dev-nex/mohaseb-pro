# محاسب پرو | Mohaseb Pro

سامانهٔ فارسی مدیریت مالی و صدور فاکتور، ساخته‌شده با React و Django. رابط کاربری راست‌چین است و تاریخ شمسی و ارقام فارسی را پشتیبانی می‌کند.

**وضعیت پروژه:** در حال توسعه

## امکانات

- مدیریت مشتریان، خدمات، فاکتورها و پرداخت‌ها
- گفتگوی زندهٔ کاربران با پیوست فایل و اعلان پیام جدید
- مدیریت هزینه‌ها، چک‌ها، کارکنان و کاربران
- گزارش‌های مدیریتی، سابقهٔ تغییرات و پشتیبان‌گیری از داده‌ها
- رابط کاربری فارسی و راست‌چین با تاریخ شمسی
- افزونهٔ صدور سریع فاکتور برای Chrome و Firefox
- اجرای محلی و دسترسی در شبکهٔ محلی از طریق اسکریپت‌های Windows

## پیش‌نیازها

- Windows 10 یا جدیدتر برای اسکریپت‌های آماده
- Python 3.10 یا جدیدتر (برای Python 3.15 در Windows، راه‌انداز پروژه به‌طور خودکار وابستگی شبکه را بدون افزونهٔ اختیاری C++ نصب می‌کند.)
- Node.js 18 یا جدیدتر و npm

## راه‌اندازی در Windows

1. مخزن را دریافت کنید:

   ```powershell
   git clone https://github.com/saeed-dev-nex/mohaseb-pro.git
   cd mohaseb-pro
   ```

2. فایل `run.bat` را اجرا کنید و حالت `dev` را انتخاب کنید. اسکریپت محیط مجازی Python و وابستگی‌های backend را آماده می‌کند؛ وابستگی‌های frontend را نیز در اولین اجرا با npm نصب کنید:

   ```powershell
   cd frontend
   npm install
   cd ..
   .\run.bat
   ```

3. برنامه را در نشانی `http://localhost:5173` باز کنید. API در `http://localhost:8000/api/` در دسترس است.

در نخستین راه‌اندازی backend، حساب مدیر ساخته می‌شود و گذرواژهٔ اولیه فقط همان‌بار در خروجی ترمینال نمایش داده می‌شود. آن را امن نگه دارید و پس از ورود تغییر دهید.

### اجرای دستی

Backend:

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
$env:AUTOBAHN_USE_NVX = "0" # برای Python 3.15 در Windows
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py ensure_admin
python manage.py runserver
```

Frontend، در ترمینال جداگانه:

```powershell
cd frontend
npm install
npm run dev
```

## پیکربندی

تنظیمات Django را با متغیرهای محیطی انجام دهید. برای محیط واقعی، `DJANGO_SECRET_KEY` را به یک مقدار تصادفی و خصوصی تغییر دهید، `DJANGO_DEBUG` را خاموش کنید و دامنه‌های مورداعتماد را صریحاً تعیین کنید.

| متغیر | پیش‌فرض توسعه | توضیح |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | کلید تصادفی در هر اجرا | کلید خصوصی و پایدار Django را برای محیط واقعی تنظیم کنید. |
| `DJANGO_DEBUG` | `true` | برای محیط واقعی روی `false` بگذارید. |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1,[::1]` | نام میزبان‌های مجاز، جداشده با ویرگول. |
| `DJANGO_CORS_ALLOWED_ORIGINS` | آدرس‌های loopback روی 5173 و 4173 | مبدأهای مجاز frontend، جداشده با ویرگول. |
| `VITE_API_URL` | نشانی backend بر اساس میزبان فعلی مرورگر | نشانی پایهٔ API برای frontend؛ `/api/` را نیز اضافه کنید. |

پایگاه‌دادهٔ SQLite و فایل‌های بارگذاری‌شده در پوشهٔ `backend/` نگهداری می‌شوند و بخشی از مخزن نیستند. از آن‌ها جداگانه پشتیبان بگیرید.

## افزونه‌های مرورگر

- **Chrome:** از صفحهٔ افزونه‌ها حالت Developer mode را فعال و `chrome-extension/` را بارگذاری کنید.
- **Firefox:** برای آزمایش موقت، `about:debugging` → `This Firefox` → `Load Temporary Add-on` را باز کنید و `firefox-extension/manifest.json` را انتخاب کنید؛ نصب موقت با بستن Firefox پاک می‌شود. برای نصب پایدار، بسته را با `firefox-extension/package.ps1` بسازید و پس از دریافت امضای AMO، فایل XPI را نصب کنید. راهنمای تصویری مرحله‌به‌مرحله در [`firefox-extension/INSTALL_FIREFOX_FA.md`](firefox-extension/INSTALL_FIREFOX_FA.md) است.

افزونه‌ها به backend محلی در `http://localhost:8000` متصل می‌شوند.

## ساخت frontend

```powershell
cd frontend
npm install
npm run build
```

## ساختار مخزن

```text
backend/           Django REST API، مدل‌ها و مهاجرت‌های پایگاه‌داده
frontend/          برنامهٔ React و ابزارهای Vite
chrome-extension/  افزونهٔ Chrome
firefox-extension/ افزونهٔ Firefox
fonts/             قلم‌های موردنیاز رابط فارسی
run.bat            راه‌انداز تعاملی Windows
run_network.bat    اجرای برنامه در شبکهٔ محلی
```

## امنیت و داده‌های خصوصی

پایگاه‌داده، اسناد مشتریان، رسانه‌های بارگذاری‌شده، محیط‌های مجازی و خروجی‌های ساخت در `.gitignore` هستند. پیش از انتشار تغییرات، مطمئن شوید اطلاعات واقعی مشتری یا پشتیبان پایگاه‌داده به مخزن اضافه نشده باشد. حالت شبکهٔ محلی را فقط در شبکه‌ای اجرا کنید که به آن اعتماد دارید.

## مشارکت

برای تغییرات بزرگ، ابتدا یک Issue بسازید تا دربارهٔ راهکار هماهنگ شویم. تغییرات را در شاخه‌ای جداگانه انجام دهید و Pull Request را با شرح تغییر و مراحل بازبینی ارسال کنید.

## مجوز

مجوز انتشار هنوز تعیین نشده است. تا زمان افزودن فایل مجوز، حقوق استفاده و بازتوزیع کد محفوظ است.
