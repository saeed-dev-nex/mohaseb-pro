# استقرار محاسب‌پرو روی Hugging Face Spaces (رایگان)

این پوشه بستهٔ استقرار آماده است: یک کانتینر داکر که کل برنامه (API،
وب‌سوکت چت، فرانت‌اند ساخته‌شده و فایل‌های آپلودی) را روی پورت ۷۸۶۰
اجرا می‌کند — دقیقاً همان حالت تک‌پورتی پروداکشن ویندوز.

فایل‌ها:

| فایل | نقش |
|---|---|
| `Dockerfile` | ساخت فرانت‌اند + ایمیج نهایی؛ در ریشهٔ ریپوی Space قرار می‌گیرد |
| `entrypoint.sh` | آماده‌سازی ذخیره‌سازی، ساخت کلید مخفی در صورت نیاز، مایگریشن، ساخت ادمین اول، اجرای Daphne |
| `README.md` | فایل README مخصوص Space (هدر YAML آن برای هاگینگ‌فیس لازم است)؛ در ریشهٔ ریپوی Space جایگزین README پروژه می‌شود |
| `.dockerignore` | حذف فایل‌های اضافی از کانتکست ساخت؛ در ریشهٔ ریپوی Space قرار می‌گیرد |

## قدم ۱ — ساخت Space

1. در [huggingface.co](https://huggingface.co) ثبت‌نام کنید.
2. از منوی پروفایل: **New Space** ← یک نام انتخاب کنید ← SDK را روی
   **Docker** بگذارید ← Create.
3. توجه: در پلن رایگان، Space عمومی است؛ یعنی کد و خود برنامه برای
   همه قابل مشاهده/دسترسی است (ورود به برنامه همچنان با نام کاربری و
   رمز خود برنامه محافظت می‌شود). هیچ رمز یا کلیدی را داخل کد نگذارید؛
   فقط از Secrets استفاده کنید (قدم ۳).

## قدم ۲ — رساندن کد به Space (دو روش)

### روش الف — دستی (ساده، برای شروع)

```bash
git clone https://huggingface.co/spaces/<username>/<space-name>
cd <space-name>
# فایل‌های پروژه (پوشه‌های backend و frontend و deploy) را اینجا کپی کنید
# سپس فایل‌های این پوشه را به ریشه بیاورید:
cp deploy/huggingface/Dockerfile .
cp deploy/huggingface/.dockerignore .
cp deploy/huggingface/README.md .
git add -A
git commit -m "Deploy Mohaseb Pro"
git push
```

برای push به هاگینگ‌فیس به یک Access Token با دسترسی write نیاز دارید
(Settings ← Access Tokens در هاگینگ‌فیس).

### روش ب — همگام‌سازی خودکار از گیت‌هاب

یک فایل `.github/workflows/sync-hf.yml` در ریپوی گیت‌هاب بسازید (مثل
ci.yml که دستی ساختید) تا با هر push روی `main`، کد خودکار به Space
برود:

```yaml
name: Sync to Hugging Face Space
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Prepare Space layout
        run: |
          cp deploy/huggingface/Dockerfile .
          cp deploy/huggingface/.dockerignore .
          cp deploy/huggingface/README.md .
      - name: Push to Space
        env:
          HF_TOKEN: ${{ secrets.HF_TOKEN }}
        run: |
          git config user.email "actions@github.com"
          git config user.name "github-actions"
          git add -A
          git commit -m "Sync from GitHub" || echo "no changes"
          git push https://<username>:$HF_TOKEN@huggingface.co/spaces/<username>/<space-name> main --force
```

توکن هاگینگ‌فیس را در Secrets ریپوی گیت‌هاب با نام `HF_TOKEN` بگذارید.

## قدم ۳ — سکرت‌ها (Settings ← Variables and secrets در Space)

- `DJANGO_SECRET_KEY` — **توصیه‌شده:** یک رشتهٔ تصادفی بلند. اگر
  نگذارید، entrypoint خودش یکی می‌سازد و در پوشهٔ داده نگه می‌دارد؛
  اما بدون دیسک ماندگار با هر ری‌استارت عوض می‌شود و همهٔ نشست‌ها
  باطل می‌شوند.
- `DJANGO_ALLOWED_HOSTS` — لازم نیست؛ پیش‌فرض `.hf.space` است و
  زیردامنه‌های هاگینگ‌فیس را پوشش می‌دهد. برای دامنهٔ اختصاصی،
  دامنه‌تان را با کاما اضافه کنید.

## قدم ۴ — اولین ورود

Space بعد از Build به‌صورت خودکار اجرا می‌شود. در اولین اجرا کاربر
`admin` با یک رمز تصادفی ساخته می‌شود و رمز **فقط یک بار** در لاگ
چاپ می‌شود: در صفحهٔ Space ← منوی ⋮ ← **View logs** ← دنبال خط
`Initial password` بگردید. وارد شوید و از بخش کاربران رمز را عوض کنید.

## واقعیت‌های پلن رایگان (مهم)

- **خواب:** Space رایگان بعد از مدتی بیکاری (معمولاً حدود ۴۸ ساعت)
  می‌خوابد؛ اولین بازدید بعدی آن را بیدار می‌کند (چند ده ثانیه طول
  می‌کشد) و اتصال‌های چت هنگام خواب قطع می‌شوند.
- **دیسک موقت:** بدون Persistent Storage، دیتابیس SQLite و فایل‌های
  آپلودی با هر ری‌استارت/بیداری از خواب **پاک می‌شوند**. دو راه:
  1. فعال‌کردن **Persistent Storage** (پولی، حدود ۵ دلار/ماه): روی
     `/data` سوار می‌شود و entrypoint خودکار از همان استفاده می‌کند.
     توجه: دفعهٔ اولِ فعال‌سازی، دیتابیس تازه ساخته می‌شود.
  2. بک‌آپ‌گیری منظم از داخل خود برنامه (بک‌آپ رمزنگاری‌شده) و
     دانلود آن؛ بعد از هر ری‌استارت می‌توانید ری‌استور کنید.
- **فونت وزیرمتن:** تا وقتی سه فایل woff2 روی برنچ اصلی با `git mv`
  به `frontend/public/fonts/` منتقل نشده‌اند، فونت‌ها در نسخهٔ
  آنلاین هم لود نمی‌شوند و فونت جایگزین سیستم نمایش داده می‌شود
  (فقط ظاهری است).

## عیب‌یابی سریع

- Space در وضعیت Build error ماند: لاگ Build را ببینید؛ معمولاً
  `Dockerfile` یا `README.md` در ریشهٔ ریپوی Space نیست.
- خطای DisallowedHost: دامنه با `DJANGO_ALLOWED_HOSTS` پوشش داده
  نشده است.
- برنامه بالا می‌آید ولی API خطا می‌دهد: در لاگ Runtime ببینید
  `DJANGO_SECRET_KEY` تنظیم شده یا فایل کلید ساخته شده است.
