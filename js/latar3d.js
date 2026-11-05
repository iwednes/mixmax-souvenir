/* ============================================================
   WEBSITE MIXMAX SOUVENIR — Latar 3D seluruh halaman
   Partikel bergerak dan berubah bentuk sendiri di belakang isi halaman,
   tanpa suara. Kursor membuat butir menghindar dan berwarna; klik membuat riak.
   Objek berputar terus dengan mulus di semua halaman, dan ikut berputar saat digulir.
   Mulai setelah halaman siap dan resolusinya turun sendiri bila perangkat kewalahan.
   Bila gagal dimuat, website tetap berjalan seperti biasa.
   ============================================================ */
(function () {
  var kanvas = document.getElementById('latar3d');
  if (!kanvas) return;
  // Mode hemat data atau perangkat sangat terbatas: website tampil tanpa latar 3D.
  if ((navigator.connection && navigator.connection.saveData) || (navigator.deviceMemory && navigator.deviceMemory <= 2)) return;

  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var TAHAN = 6, MORF = 2.2;   // detik diam pada satu bentuk; detik perpindahan bentuk
  var JEDA_MULAI = 1200;       // ms setelah halaman siap, supaya tampilan awal tidak terganggu
  var LAJU_PUTAR = 0.6;        // radian per detik: satu putaran penuh sekitar 10 detik
  var PUTAR_GULIR = 0.0006;    // tambahan putaran per piksel digulir

  // Bentuk pembuka tiap halaman: 0 lampu, 1 kotak, 2 handuk, 3 mug, 4 tumbler, 5 hati, 6 tulisan.
  var BENTUK_HALAMAN = { beranda: 0, produk: 1, keranjang: 1, nota: 5, testimonial: 5, tentang: 6, login: 0 };

  function muatSkrip(src, lalu) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = lalu;
    document.head.appendChild(s);
  }
  function mulai() { muatSkrip(THREE_URL, function () { muatSkrip('js/bentuk3d.js', bangun); }); }
  function saatLuang() {
    setTimeout(function () {
      if (window.requestIdleCallback) requestIdleCallback(mulai, { timeout: 2000 });
      else mulai();
    }, JEDA_MULAI);
  }
  if (document.readyState === 'complete') saatLuang();
  else window.addEventListener('load', saatLuang);

  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function bangun() {
    var diam = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var A;
    try {
      A = MMX3D.buatAdegan(kanvas, {
        pelangi: false, diam: diam, kuat: false, lembut: 0.36, lembutCincin: 0.62, dorong: 0.3, jangkau: 0.85, riak: true, cahaya: 0.16, tintMaks: 0.62
      });
    } catch (e) { return; }

    var bentuk = [], dari = 0, ke = 0, mulaiMorf = -1, gantiPada = TAHAN, antre = null, waktu = 0;
    var TULISAN = MMX3D.JUMLAH - 1, putaran = MMX3D.buatPutaran(LAJU_PUTAR);

    function pindahKe(k) {                     // mulai perpindahan bentuk; bentuk yang belum siap dilewati dulu
      if (k === ke || !bentuk[k]) return;
      if (mulaiMorf >= 0) { antre = k; return; }
      dari = ke; ke = k;
      A.pasang(bentuk[dari], bentuk[ke]);
      mulaiMorf = waktu;
      gantiPada = waktu + MORF + TAHAN;
    }
    function tampilkanLangsung(k) {            // gerak minimal: tanpa perpindahan, satu gambar saja
      dari = ke = k;
      A.pasang(bentuk[k], bentuk[k]);
      A.group.rotation.set(0.16, 0, 0);
      A.perbarui(0, 0, 1, k === 0 ? 1 : 0);
      A.gambar();
      kanvas.classList.add('siap');
    }
    function bentukHalaman(rute) {
      var k = BENTUK_HALAMAN[rute];
      if (k === undefined || !bentuk[k]) return;
      if (diam) tampilkanLangsung(k); else pindahKe(k);
    }

    /* ---------- Tata letak: objek di sisi kanan layar lebar, di tengah pada ponsel ---------- */
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5), lebarLalu = 0, tinggiLalu = 0;
    function tata(paksa) {
      var W = window.innerWidth, H = window.innerHeight;
      // bilah alamat ponsel mengubah tinggi saat menggulir: abaikan supaya tidak mengukur ulang terus
      if (!paksa && W === lebarLalu && Math.abs(H - tinggiLalu) < 120) return;
      lebarLalu = W; tinggiLalu = H;
      var aspek = W / H, R = 2.15, lebar = W >= 960, jarak, x, y;
      if (lebar) {
        jarak = R * 1.5 / A.tanH;
        var hh = jarak * A.tanH;
        x = hh * aspek * 0.42; y = -0.02 * hh;
      } else {
        jarak = Math.max(R * 1.12 / (A.tanH * aspek), R * 1.6 / A.tanH);
        x = 0; y = 0.1 * jarak * A.tanH;
      }
      A.ukur(W, H, dpr, jarak);
      A.tempatkan(x, y, lebar ? 0 : 0.2);
    }
    tata(true);
    window.addEventListener('resize', function () {
      tata(false);
      if (diam && bentuk[ke]) tampilkanLangsung(ke);
    });
    var jagaMulus = MMX3D.penjagaMulus(function () { return dpr; }, function (v) { dpr = v; tata(true); }, 24);

    /* ---------- Putaran utama ---------- */
    var lalu = performance.now();
    function bingkai(now) {
      requestAnimationFrame(bingkai);
      if (document.body.classList.contains('modal-terbuka') && kanvas.classList.contains('siap')) { lalu = now; return; }   // tertutup jendela modal
      var ms = now - lalu;
      lalu = now;
      jagaMulus(ms);
      var dt = Math.min(0.1, ms / 1000);
      waktu += dt;

      var prog = 1;
      if (mulaiMorf >= 0) {
        if ((waktu - mulaiMorf) / MORF >= 1) {
          mulaiMorf = -1;
          if (antre !== null) { var k = antre; antre = null; pindahKe(k); }
        }
        prog = mulaiMorf >= 0 ? easeInOut(Math.min(1, Math.max(0, (waktu - mulaiMorf) / MORF))) : 1;
      } else if (waktu >= gantiPada) {
        var berikut = (ke + 1) % MMX3D.JUMLAH;
        if (bentuk[berikut]) pindahKe(berikut); else gantiPada = waktu + 1;
        prog = mulaiMorf >= 0 ? 0 : 1;
      }

      A.perbarui(dt, waktu, prog, (ke === 0 ? prog : 0) + (dari === 0 && ke !== 0 ? 1 - prog : 0));
      A.group.rotation.y = putaran.hitung(dt, ke === TULISAN && mulaiMorf >= 0, ke === TULISAN && mulaiMorf < 0, prog);
      A.group.rotation.x = 0.16 + Math.sin(waktu * 0.23) * 0.04;
      A.gambar();
      kanvas.classList.add('siap');
    }

    var gulirLalu = window.scrollY;
    window.addEventListener('scroll', function () {
      if (ke !== TULISAN) putaran.tambah((window.scrollY - gulirLalu) * PUTAR_GULIR);
      gulirLalu = window.scrollY;
    }, { passive: true });
    window.addEventListener('mmx-rute', function (e) { bentukHalaman(e.detail); });
    MMX3D.muatBentuk(function (k, s) {
      bentuk[k] = s;
      if (k === 0) {
        A.pasang(s, s);
        if (!diam) requestAnimationFrame(bingkai);
      }
      if (k === 0 || k === BENTUK_HALAMAN[window.MMX_RUTE]) bentukHalaman(window.MMX_RUTE);
      if (diam && k === 0 && BENTUK_HALAMAN[window.MMX_RUTE] !== 0) tampilkanLangsung(0);
    }, { lampu: true });
  }
})();
