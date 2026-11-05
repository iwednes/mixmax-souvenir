/* ============================================================
   WEBSITE MIXMAX SOUVENIR — Latar 3D seluruh halaman
   Partikel bergerak dan berubah bentuk sendiri di belakang isi halaman,
   tanpa suara. Kursor membuat butir menghindar dan berwarna; klik membuat riak.
   Dimuat setelah halaman siap: bila gagal, website tetap berjalan seperti biasa.
   ============================================================ */
(function () {
  var kanvas = document.getElementById('latar3d');
  if (!kanvas) return;
  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var TAHAN = 6, MORF = 2.2;   // detik diam pada satu bentuk; detik perpindahan bentuk

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
    if (window.requestIdleCallback) requestIdleCallback(mulai, { timeout: 1500 });
    else setTimeout(mulai, 300);
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

    var lampu = MMX3D.buatLampu(), bentuk = [lampu, lampu, lampu, lampu, lampu, lampu, lampu], siap = { 0: true };
    var dari = 0, ke = 0, mulaiMorf = -1, gantiPada = TAHAN, antre = null, waktu = 0;

    function pindahKe(k) {                     // mulai perpindahan bentuk; bentuk yang belum siap dilewati dulu
      if (k === ke || !siap[k]) return;
      if (mulaiMorf >= 0) { antre = k; return; }
      dari = ke; ke = k;
      A.pasang(bentuk[dari], bentuk[ke]);
      mulaiMorf = waktu;
      gantiPada = waktu + MORF + TAHAN;
    }
    function bentukHalaman(rute) {
      var k = BENTUK_HALAMAN[rute];
      if (k !== undefined) pindahKe(k);
    }
    MMX3D.muatBentuk(function (k, s) {
      bentuk[k] = s;
      siap[k] = true;
      if (diam && k === BENTUK_HALAMAN[window.MMX_RUTE]) { dari = ke = k; A.pasang(s, s); gambarSekali(); }
      else if (k === BENTUK_HALAMAN[window.MMX_RUTE] && waktu < TAHAN) pindahKe(k);
    });
    A.pasang(lampu, lampu);
    window.addEventListener('mmx-rute', function (e) {
      if (!diam) { bentukHalaman(e.detail); return; }
      var k = BENTUK_HALAMAN[e.detail];
      if (k !== undefined && siap[k]) { dari = ke = k; A.pasang(bentuk[k], bentuk[k]); gambarSekali(); }
    });

    /* ---------- Tata letak: objek di sisi kanan layar lebar, di tengah pada ponsel ---------- */
    var dpr = Math.min(window.devicePixelRatio || 1, 2), lebarLalu = 0, tinggiLalu = 0;
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
    window.addEventListener('resize', function () { tata(false); if (diam) gambarSekali(); });
    var jagaMulus = MMX3D.penjagaMulus(function () { return dpr; }, function (v) { dpr = v; tata(true); });

    function tampak() { kanvas.classList.add('siap'); }
    function gambarSekali() {
      A.group.rotation.set(0.16, 0, 0);
      A.perbarui(0, 0, 1, ke === 0 ? 1 : 0);
      A.gambar();
      tampak();
    }
    if (diam) { bentukHalaman(window.MMX_RUTE); gambarSekali(); return; }

    /* ---------- Putaran utama ---------- */
    var lalu = performance.now();
    function bingkai(now) {
      requestAnimationFrame(bingkai);
      var ms = now - lalu;
      lalu = now;
      if (document.body.classList.contains('modal-terbuka')) return;   // tertutup jendela modal: hemat tenaga
      jagaMulus(ms);
      var dt = Math.min(0.05, ms / 1000);
      waktu += dt;

      var prog = 1;
      if (mulaiMorf >= 0) {
        var p = (waktu - mulaiMorf) / MORF;
        if (p >= 1) {
          mulaiMorf = -1;
          if (antre !== null) { var k = antre; antre = null; pindahKe(k); }
        }
        prog = mulaiMorf >= 0 ? easeInOut(Math.min(1, Math.max(0, (waktu - mulaiMorf) / MORF))) : 1;
      } else if (waktu >= gantiPada) {
        var berikut = (ke + 1) % MMX3D.JUMLAH;
        if (siap[berikut]) pindahKe(berikut); else gantiPada = waktu + 1;
        prog = mulaiMorf >= 0 ? 0 : 1;
      }

      var lampuNyala = (ke === 0 ? prog : 0) + (dari === 0 && ke !== 0 ? 1 - prog : 0);
      A.perbarui(dt, waktu, prog, lampuNyala);
      var ayun = Math.sin(waktu * 0.3) * 0.32;
      A.group.rotation.y = Math.sin(prog * Math.PI) * 0.8 + ayun + window.scrollY * 0.0005;
      A.group.rotation.x = 0.16 + Math.sin(waktu * 0.23) * 0.04;
      A.gambar();
      tampak();
    }
    bentukHalaman(window.MMX_RUTE);
    requestAnimationFrame(bingkai);
  }
})();
