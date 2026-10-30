# Website Mixmax Souvenir — Frontend (v1.2)

Situs statis (HTML/CSS/JavaScript murni) yang di-host di **GitHub Pages**.
Data, pesanan, nota PDF, email, dan login admin diproses oleh **Google Apps Script**
yang berperan sebagai REST API (JSON) — kode backend-nya **tidak** disimpan di repository ini.

```
index.html        ← semua halaman publik + panel admin (SPA)
css/style.css     ← tampilan "Mixmax Souvenir Blue-Green"
js/config.js      ← GAS_URL: alamat Web App Apps Script (/exec)  ← satu-satunya yang diedit
js/app.js         ← logika halaman, keranjang, form, panel admin
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
