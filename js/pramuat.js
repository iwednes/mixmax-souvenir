/* ============================================================
   WEBSITE MIXMAX SOUVENIR — Persiapan selagi cover tampil
   Berkas website, data publik, semua testimoni, dan foto diambil di belakang
   layar, supaya saat pengunjung masuk website langsung tampil tanpa menunggu.
   Hanya membaca. Bila gagal, website memuat sendiri seperti biasa.
   ============================================================ */
(function () {
  var API = (window.MMX_CONFIG && window.MMX_CONFIG.GAS_URL) || '';
  var IKON = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css';
  var MAKS_TESTI = 120;

  function simpan(kunci, nilai) {
    try { localStorage.setItem(kunci, nilai); } catch (e) { /* abaikan */ }
  }
  function ambilApi(tanya) {
    return fetch(API + '?' + tanya).then(function (r) { return r.json(); });
  }
  function foto(id, lebar) {
    if (id) new Image().src = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + lebar;
  }

  function berkas() {
    ['./', 'css/style.css', 'js/app.js', 'js/latar3d.js', 'js/kunang.js'].forEach(function (u) {
      fetch(u).catch(function () { /* abaikan */ });
    });
    var l = document.createElement('link');
    l.rel = 'prefetch';
    l.as = 'style';
    l.href = IKON;
    document.head.appendChild(l);
  }

  function dataPublik() {
    return ambilApi('action=getDataPublik').then(function (res) {
      if (!res.success) return;
      simpan('mmx_publik_v12', JSON.stringify(res.data));
      (res.data.banner || []).forEach(function (b) { foto(b.idGambar, 1920); });
      (res.data.produk || []).forEach(function (p) { foto(p.idFoto, 600); });
    });
  }

  function semuaTestimoni(items) {
    return ambilApi('action=getTestimoniPublik&offset=' + items.length).then(function (res) {
      if (!res.success) return;
      var baru = res.data.items || [], gabung = items.concat(baru);
      if (baru.length && gabung.length < Math.min(res.data.total || 0, MAKS_TESTI)) return semuaTestimoni(gabung);
      if (gabung.length) simpan('mmx_testi_semua_v1', JSON.stringify(gabung));
    });
  }

  setTimeout(function () {
    berkas();
    if (!/^https:\/\//.test(API) || API.indexOf('ISI_') >= 0) return;
    dataPublik().then(function () { return semuaTestimoni([]); }).catch(function () { /* abaikan */ });
  }, 1000);
})();
