# LSA BIMBEL

Aplikasi ini memakai Google Sheets sebagai database, Google Apps Script sebagai API, dan Cloudflare Pages untuk hosting file HTML.

## Menyiapkan database dan API Google

1. Buat project di [Google Apps Script](https://script.google.com/) dan salin isi `Code.gs` ke file script.
2. Pada **Project Settings → Script properties**, tambahkan `LSA_BIMBEL_API_SECRET` dengan nilai acak yang panjang. Jangan simpan nilai ini di GitHub.
3. Pilih **Deploy → New deployment → Web app**. Atur **Execute as** ke akun Anda dan **Who has access** ke **Anyone**, lalu deploy dan salin URL yang berakhiran `/exec`.
4. Buka URL `/exec` untuk memastikan status API tampil. Spreadsheet dan tab database dibuat otomatis di akun pemilik ketika aplikasi Cloudflare pertama kali dibuka.

## Deploy ke Cloudflare Pages

1. Upload `index.html`, folder `functions`, dan `README.md` ke repository GitHub. Jangan upload secret.
2. Di Cloudflare, buat project **Pages** dengan **Connect to Git** dan pilih repository tersebut. Set **Build command** kosong dan **Build output directory** ke `.` (root repository).
3. Di **Pages → Settings → Variables and Secrets**, tambahkan:
   - `GOOGLE_APPS_SCRIPT_URL`: URL Web App `/exec` dari langkah sebelumnya.
   - `LSA_BIMBEL_API_SECRET`: nilai yang sama dengan Script Property Google Apps Script, simpan sebagai secret.
4. Karena aplikasi menyimpan data siswa dan belum memiliki login internal, batasi akses website dengan **Cloudflare Access** sebelum dibagikan.
5. Redeploy project. Buka URL Cloudflare Pages untuk memakai aplikasi.

Semua baca/tulis dari browser melewati Pages Function pada `/api`; secret hanya dikirim dari Cloudflare ke Apps Script, bukan dari browser.
