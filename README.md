# LSA BIMBEL

Aplikasi ini memakai Google Sheets sebagai database, Google Apps Script sebagai API, dan Cloudflare Pages untuk hosting file HTML.

## Menyiapkan database dan API Google

1. Buat project di [Google Apps Script](https://script.google.com/) dan salin isi `Code.gs` ke file script.
2. Pada **Project Settings → Script properties**, tambahkan `LSA_BIMBEL_API_SECRET` dengan nilai acak yang panjang. Jangan simpan nilai ini di GitHub.
3. Pilih fungsi `setupDatabase` di editor Apps Script, klik **Run**, lalu setujui izin Google Sheets. Spreadsheet database akan dibuat di akun Anda.
4. Pilih **Deploy → New deployment → Web app**. Atur **Execute as** ke akun Anda dan **Who has access** ke **Anyone**, lalu deploy dan salin URL yang berakhiran `/exec`.
5. Buka URL `/exec` untuk memastikan status API tampil.

## Deploy ke Cloudflare Pages

1. Upload `index.html`, folder `functions`, dan `README.md` ke repository GitHub. Jangan upload secret.
2. Di Cloudflare, buat project **Pages** dengan **Connect to Git** dan pilih repository tersebut. Set **Build command** kosong dan **Build output directory** ke `.` (root repository).
3. Di **Pages → Settings → Variables and Secrets**, tambahkan variabel untuk environment **Production**:
   - `GOOGLE_APPS_SCRIPT_URL`: URL Web App `/exec` dari langkah sebelumnya.
   - `LSA_BIMBEL_API_SECRET`: nilai yang sama dengan Script Property Google Apps Script, simpan sebagai secret.
   - `ADMIN_USERNAME`: username owner/admin.
   - `ADMIN_PASSWORD`: password admin yang kuat (minimal 16 karakter), simpan sebagai secret.
   - `AUTH_SESSION_SECRET`: secret acak minimal 32 karakter, simpan sebagai secret. Contoh membuatnya dengan Node.js: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
4. Redeploy project. Buka URL Cloudflare Pages untuk memakai aplikasi.

Login admin diverifikasi di Pages Function. Sesi memakai cookie `HttpOnly`, `Secure`, dan `SameSite=Strict` yang berlaku 8 jam; semua operasi database `/api` memerlukan sesi tersebut. Jangan menyimpan username/password atau secret di GitHub maupun HTML. Untuk perlindungan tambahan, aktifkan rate limiting Cloudflare pada endpoint login.
