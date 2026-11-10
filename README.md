# Website Mixmax Souvenir — Frontend (v1.2)

Situs statis (HTML/CSS/JavaScript murni) yang di-host di **GitHub Pages**.
Data, pesanan, nota PDF, email, dan login admin diproses oleh **Google Apps Script**
yang berperan sebagai REST API (JSON) — kode backend-nya **tidak** disimpan di repository ini.

```
cover.html        ← cover 3D 25 detik sebelum masuk website (sekali per sesi browser)
cerita.mp3        ← suara narator + musik untuk cover
index.html        ← semua halaman publik + panel admin (SPA)
vercel.json       ← alamat /produk, /testimonial, /tentang dibuka oleh index.html
sitemap.xml       ← daftar halaman untuk Google
halaman/          ← halaman khusus kata kunci (souvenir murah, perusahaan, seminar, sertijab, handuk bordir);
                    dibuat oleh ../alat-halaman/buat-halaman.js — ubah isinya di sana lalu jalankan ulang
robots.txt        ← izin baca untuk mesin pencari + letak sitemap
css/style.css     ← tampilan "Haute Archive" (krem, espresso, bronze)
js/config.js      ← GAS_URL: alamat Web App Apps Script (/exec)  ← satu-satunya yang diedit
js/app.js         ← logika halaman, keranjang, form, panel admin
js/latar3d.js     ← latar 3D yang bergerak di semua halaman website
js/bentuk3d.js    ← bentuk & shader partikel, dipakai cover dan latar 3D
js/pramuat.js     ← menyiapkan isi website selagi cover tampil
js/kunang.js      ← kunang-kunang di semua halaman, termasuk admin dan cover
```

## Konfigurasi

Buka `js/config.js`, isi `GAS_URL` dengan URL Web App Apps Script yang berakhiran `/exec`.
URL ini memang alamat publik; password admin dan rahasia lain tetap di Script Properties Apps Script.

## Memperbarui situs

```bash
git add .
git commit -m "Deskripsi perubahan"
git push
```

GitHub Pages memperbarui situs dalam 1–2 menit. Bila masih tampil versi lama, tekan **Ctrl+Shift+R**.
