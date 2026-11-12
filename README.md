# LSA BIMBEL

Aplikasi ini memakai Google Sheets sebagai database, Google Apps Script sebagai API, dan Cloudflare Pages untuk hosting file HTML.

## Menyiapkan database dan API Google

1. Buat project di [Google Apps Script](https://script.google.com/) dan salin isi `Code.gs` ke file script.
2. Pada **Project Settings → Script properties**, tambahkan `LSA_BIMBEL_API_SECRET` dengan nilai acak yang panjang. Jangan simpan nilai ini di GitHub.
3. Pilih fungsi `setupDatabase` di editor Apps Script, klik **Run**, lalu setujui izin Google Sheets. Spreadsheet database akan dibuat di akun Anda.
4. Pilih **Deploy → New deployment → Web app**. Atur **Execute as** ke akun Anda dan **Who has access** ke **Anyone**, lalu deploy dan salin URL yang berakhiran `/exec`.
5. Buka URL `/exec` untuk memastikan status API tampil.

Saat memperbarui `Code.gs`, deploy versi Web App terbaru. Tab `payments` dan `tutorPayments` akan dibuat otomatis saat API berikutnya membaca database yang sudah ada.

## Keuangan

Pemasukan dicatat per pembayaran dan mengurangi sisa tagihan siswa, termasuk pembayaran sebagian. Pengeluaran mencatat pembayaran honor dan mengalokasikannya ke honor tentor yang tertunggak. Kedua riwayat disimpan di Google Sheets dan menyediakan bukti cetak dengan format thermal 80 mm.

Pada **Data Tentor → Detail Profil**, owner dapat melihat jadwal hari ini, minggu berjalan (Senin–Minggu), atau bulan berjalan; jumlah sesi terjadwal/berjalan, selesai, dan batal; serta riwayat transaksi pembayaran honor. Honor dibayar dan tertunggak dihitung dari alokasi pada sesi yang selesai dalam periode terpilih. Estimasi sesi terjadwal/berjalan menggunakan aturan fee aktif, jumlah siswa terdaftar, dan durasi jadwal; nominal untuk aturan **Persentase** hanya dapat dihitung jika honor manual sesi sudah diatur. Estimasi dapat berubah setelah sesi selesai dan presensi aktual tercatat.

Pada **Data Siswa**, tombol mata membuka profil dengan jadwal hari ini, minggu berjalan, atau bulan berjalan; jumlah sesi selesai/terjadwal; invoice, pembayaran, sisa tagihan, serta estimasi biaya. Tarif siswa bersifat bulanan, sehingga estimasi tidak dikalikan per jumlah sesi. Data siswa dapat diedit. Tombol hapus melakukan penghapusan permanen: invoice, pembayaran siswa, jurnal, laporan WhatsApp, presensi, sesi khusus siswa, dan honor sesi tersebut dihapus. Pada sesi kelompok, siswa yang dihapus dilepas tetapi sesi dan honor untuk siswa lain tetap ada. Transaksi pengeluaran tentor yang sudah terjadi tetap tersimpan; alokasi ke honor sesi yang dihapus dilepas. Penghapusan ini tidak dapat dibatalkan.

Pada **Data Tentor**, aksi edit memperbarui profil tanpa mengubah aturan fee. Hapus tentor menghapus permanen jadwal/presensi, jurnal, laporan yang hanya terkait, dan catatan honor tentor tersebut. Transaksi pengeluaran yang sudah terjadi tetap ada sebagai riwayat uang keluar, tetapi alokasinya ke catatan honor yang dihapus dilepas. Penghapusan meminta konfirmasi dan tidak dapat dibatalkan.

## Jadwal dan presensi

- Jadwal dapat dibuat satu kali atau diulang pada hari-hari tertentu setiap minggu, dengan tanggal akhir maksimal satu tahun.
- Aplikasi menandai bentrok tentor, siswa, dan ruangan. Owner dapat memilih untuk tetap menyimpan jadwal setelah konfirmasi.
- Jadwal yang belum dimulai dapat di-reschedule dengan alasan; perubahan menyimpan riwayat dan mengganti token sehingga tautan lama tidak berlaku.
- Setiap sesi mempunyai tautan token bersama untuk check-in siswa/tentor dan check-out tentor. Presensi hanya dapat dilakukan pada tanggal sesi. Pemegang tautan memilih nama sendiri, jadi token tidak membuktikan identitas peserta—bagikan hanya kepada peserta terkait.
- Check-in tentor mencatat jam masuk; check-out mencatat jam pulang, menyelesaikan sesi, dan membuat tagihan honor. Aturan **Per Pertemuan**, **Per Siswa yang check-in**, dan **Per Jam aktual** dihitung otomatis. Aturan **Persentase** harus diisi manual per sesi sebelum check-out.
- Status sesi juga dapat dimulai/diselesaikan owner; penyelesaian oleh owner tetap memerlukan check-in tentor. Data presensi tersimpan di record jadwal Google Sheets dan tidak memerlukan tab baru.

Atur zona waktu project Apps Script ke zona waktu operasional bimbel (misalnya `Asia/Jakarta`) agar pembatasan tanggal dan waktu presensi sesuai waktu setempat.

## Jurnal belajar, tagihan bulanan, dan laporan WhatsApp

- Materi sesi wajib diisi sebelum tentor check-out atau owner menyelesaikan sesi. Tentor/owner juga mengisi evaluasi untuk setiap siswa yang check-in; siswa yang tidak hadir tidak memerlukan evaluasi.
- Sesi selesai otomatis menambahkan honor tentor berdasarkan aturan fee dan membuat tagihan bulanan nominal tetap untuk siswa aktif yang terdaftar pada sesi. Pembuatan tagihan hanya sekali per siswa per bulan, dengan jatuh tempo pada hari terakhir bulan tersebut. Tarif fee bulanan tidak ditentukan otomatis dari jumlah sesi.
- Atur tarif pada data setiap siswa melalui kolom **Tarif Bulanan** sebelum sesi pertama bulan itu diselesaikan. Nilai `0` berarti tarif belum diatur; tanpa tarif, invoice tidak dibuat dan aplikasi menampilkan pemberitahuan. Sesi yang selesai berikutnya pada bulan yang sama dapat membuat invoice setelah tarif diperbarui.
- Jurnal, rekap kehadiran, dan status sesi tersimpan di Google Sheets. Owner dapat melihat jurnal serta rekap kehadiran/keuangan bulanan di aplikasi.
- Laporan WhatsApp dibuat per siswa berdasarkan sesi pada tanggal tersebut. Tombol WhatsApp membuka chat dengan nomor wali dan pesan yang sudah diisi; owner tetap harus menekan **Kirim** di WhatsApp, lalu menandai laporan sebagai terkirim di aplikasi. Pastikan nomor telepon wali sudah benar pada data siswa. Fitur ini tidak mengirim pesan otomatis.

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

Login Owner/Admin dan tentor diverifikasi di Pages Function. Sesi memakai cookie `HttpOnly`, `Secure`, dan `SameSite=Strict` yang berlaku 8 jam; operasi database admin `/api` memerlukan sesi Owner/Admin. Endpoint presensi publik hanya menerima token sesi yang kuat dan data peserta yang terdaftar pada sesi. Jangan menyimpan username/password atau secret di GitHub maupun HTML. Untuk perlindungan tambahan, aktifkan rate limiting Cloudflare pada endpoint login dan presensi.

### Akun tentor

Tambahkan secret `TUTOR_ACCOUNTS` di **Pages → Settings → Variables and Secrets** dengan nilai JSON array. Setiap akun harus memakai `username` unik, `password` minimal 16 karakter, dan `tutorId` berupa ID numerik tentor pada sheet `tutors`, misalnya:

```json
[
  {
    "username": "tentor.rina",
    "password": "ganti-dengan-password-acak-minimal-16-karakter",
    "tutorId": 1
  }
]
```

Simpan secret di Cloudflare, bukan di repository. Buat atau perbarui satu entri untuk setiap akun tentor, lalu redeploy Pages. Tentor masuk lewat halaman login yang sama. Portal tentor hanya memuat profil, jadwal, presensi, dan jurnal untuk jadwalnya sendiri; tentor tidak memperoleh akses ke database penuh, data keuangan, atau modul owner. Jurnal hanya dapat disimpan untuk sesi berstatus **Selesai** dan siswa yang hadir pada sesi tersebut. Pastikan ID pada `tutorId` cocok dengan ID tentor di Google Sheets dan akun terkait berstatus **Aktif**.

Setelah mengubah `Code.gs`, deploy versi Web App terbaru di Apps Script. Setelah mengubah file aplikasi atau `functions/api.js`, push perubahan ke GitHub dan tunggu Cloudflare Pages menyelesaikan deployment.
