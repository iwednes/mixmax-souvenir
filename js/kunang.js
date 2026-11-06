/* ============================================================
   WEBSITE MIXMAX SOUVENIR — Kunang-kunang halaman Beranda (uji coba)
   Bola cahaya melayang ke kanan-kiri, berkelip, punya kedalaman 3D, dan menghindar
   dari kursor. Di banner gelap menyala terang; di latar krem berpendar emas.
   Canvas 2D supaya ringan, dan hanya berjalan selama Beranda terbuka.
   Untuk mencabutnya: hapus berkas ini dan barisnya di index.html.
   ============================================================ */
(function () {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (navigator.connection && navigator.connection.saveData) return;
  var banner = document.getElementById('banner'), vAdmin = document.getElementById('vAdmin');
  if (!banner) return;

  var kecil = window.innerWidth < 760;
  var JANGKAU = 150;                 // px: jarak kursor mulai mendorong bola

  /* Satu gambar pendar dipakai ulang oleh semua bola: jauh lebih ringan daripada membuat gradasi tiap frame. */
  function pendar(warnaTengah, warnaTepi, kuat) {
    var c = document.createElement('canvas'), g = c.getContext('2d'), r = 64;
    c.width = c.height = r * 2;
    var gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, 'rgba(' + warnaTengah + ',1)');
    gr.addColorStop(0.09, 'rgba(' + warnaTengah + ',0.95)');
    gr.addColorStop(0.2, 'rgba(' + warnaTepi + ',' + 0.6 * kuat + ')');
    gr.addColorStop(0.5, 'rgba(' + warnaTepi + ',' + 0.17 * kuat + ')');
    gr.addColorStop(1, 'rgba(' + warnaTepi + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, r * 2, r * 2);
    return c;
  }
  var SINAR_GELAP = [pendar('255,250,225', '255,196,92', 1), pendar('255,252,235', '255,214,130', 1), pendar('245,255,215', '186,232,120', 1)];
  var SINAR_KREM = [pendar('255,226,150', '214,152,44', 1), pendar('255,233,178', '197,150,70', 0.95)];

  function acak(a, b) { return a + Math.random() * (b - a); }

  function buatBola(L, sinar) {
    var z = Math.random();           // kedalaman: 0 jauh, 1 dekat; yang dekat lebih besar dan lebih cepat
    return {
      x: acak(0, L.w), y: acak(0, L.h), z: z, ukur: L.ukur[0] + z * z * L.ukur[1],
      laju: (Math.random() < 0.5 ? -1 : 1) * (8 + z * 26),
      a1: acak(18, 60), f1: acak(0.25, 0.7), p1: acak(0, 6.3),
      a2: acak(12, 42), f2: acak(0.3, 0.8), p2: acak(0, 6.3),
      kedip: acak(0.5, 1.5), p3: acak(0, 6.3), dx: 0, dy: 0,
      gbr: sinar[Math.floor(Math.random() * sinar.length)]
    };
  }

  function buatLapisan(kanvas, opsi) {
    var L = { kanvas: kanvas, ctx: kanvas.getContext('2d'), w: 1, h: 1, x: 0, y: 0, dpr: 1, tampak: true,
      tambah: opsi.tambah, ukur: opsi.ukur, gulir: opsi.gulir, bola: [], debu: [] };
    L.ukurUlang = function () {
      var r = kanvas.getBoundingClientRect();
      L.x = r.left; L.y = r.top;
      if (!r.width || !r.height) return;
      if (r.width === L.w && r.height === L.h) return;
      var sx = r.width / L.w, sy = r.height / L.h;   // bola ikut menyebar saat ukuran kanvas berubah
      L.bola.concat(L.debu).forEach(function (b) { b.x *= sx; b.y *= sy; });
      L.w = r.width; L.h = r.height;
      L.dpr = Math.min(window.devicePixelRatio || 1, opsi.dpr);
      kanvas.width = Math.round(L.w * L.dpr);
      kanvas.height = Math.round(L.h * L.dpr);
    };
    L.ukurUlang();
    for (var i = 0; i < opsi.bola; i++) L.bola.push(buatBola(L, opsi.sinar));
    for (var j = 0; j < opsi.debu; j++) L.debu.push({ x: acak(0, L.w), y: acak(0, L.h), r: acak(0.5, 1.6), laju: acak(-7, 7), a: acak(0.15, 0.6), p: acak(0, 6.3) });
    return L;
  }

  var kanvasLatar = document.createElement('canvas');
  kanvasLatar.className = 'kunang-latar';
  kanvasLatar.setAttribute('aria-hidden', 'true');
  var latar3d = document.getElementById('latar3d');
  latar3d.parentNode.insertBefore(kanvasLatar, latar3d.nextSibling);   // tepat di atas latar 3D, di bawah isi halaman
  var kanvasHero = document.createElement('canvas');
  kanvasHero.className = 'kunang-hero';
  kanvasHero.setAttribute('aria-hidden', 'true');
  banner.appendChild(kanvasHero);

  var latar = buatLapisan(kanvasLatar, { tambah: false, ukur: [9, 26], gulir: true, dpr: 1, bola: kecil ? 16 : 30, debu: 0, sinar: SINAR_KREM });
  var hero = buatLapisan(kanvasHero, { tambah: true, ukur: [10, 40], gulir: false, dpr: 1.5, bola: kecil ? 26 : 50, debu: kecil ? 70 : 170, sinar: SINAR_GELAP });
  var lapisan = [latar, hero];

  if (window.IntersectionObserver) new IntersectionObserver(function (e) { hero.tampak = e[0].isIntersecting; }).observe(banner);

  /* ---------- Kursor: bola menghindar, seluruh lapisan sedikit bergeser mengikuti (terasa 3D) ---------- */
  var kx = -9999, ky = -9999, geserX = 0, geserY = 0, geserTX = 0, geserTY = 0;
  window.addEventListener('pointermove', function (e) {
    kx = e.clientX; ky = e.clientY;
    geserTX = kx / window.innerWidth - 0.5;
    geserTY = ky / window.innerHeight - 0.5;
  }, { passive: true });
  window.addEventListener('pointerdown', function (e) {       // klik: bola di sekitarnya terhambur
    lapisan.forEach(function (L) {
      L.bola.forEach(function (b) {
        var ax = b.px - (e.clientX - L.x), ay = b.py - (e.clientY - L.y), d = Math.sqrt(ax * ax + ay * ay) || 1;
        if (d < JANGKAU * 2) { var k = (1 - d / (JANGKAU * 2)) * 340; b.dx += ax / d * k; b.dy += ay / d * k; }
      });
    });
  }, { passive: true });
  function ukurSemua() { lapisan.forEach(function (L) { L.ukurUlang(); }); }
  window.addEventListener('resize', ukurSemua);
  window.addEventListener('scroll', function () { hero.ukurUlang(); }, { passive: true });

  /* ---------- Gambar ---------- */
  function gambarLapisan(L, t, dt) {
    var g = L.ctx, w = L.w, h = L.h, gulir = L.gulir ? window.scrollY : 0;
    g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = L.tambah ? 'lighter' : 'source-over';
    var i, b;
    g.fillStyle = 'rgba(255,240,205,1)';
    for (i = 0; i < L.debu.length; i++) {
      b = L.debu[i];
      b.x += b.laju * dt;
      if (b.x < 0) b.x += w; else if (b.x > w) b.x -= w;
      g.globalAlpha = b.a * (0.55 + 0.45 * Math.sin(t * 0.9 + b.p));
      g.fillRect(b.x, b.y, b.r, b.r);
    }
    var redam = Math.exp(-dt * 2.2), batas = 90;
    for (i = 0; i < L.bola.length; i++) {
      b = L.bola[i];
      b.x += b.laju * dt;                                     // bergerak ke kanan atau kiri, lalu muncul lagi di sisi lain
      if (b.x < -batas) b.x += w + batas * 2; else if (b.x > w + batas) b.x -= w + batas * 2;
      var x = b.x + Math.sin(t * b.f1 + b.p1) * b.a1 + geserX * b.z * 46 + b.dx;
      var y = b.y + Math.sin(t * b.f2 + b.p2) * b.a2 + geserY * b.z * 30 + b.dy - gulir * (0.06 + b.z * 0.22);
      y = ((y % (h + batas * 2)) + h + batas * 2) % (h + batas * 2) - batas;
      b.px = x; b.py = y;
      var ax = x - (kx - L.x), ay = y - (ky - L.y), d = Math.sqrt(ax * ax + ay * ay) || 1;
      if (d < JANGKAU) { var k = (1 - d / JANGKAU) * 900 * dt; b.dx += ax / d * k; b.dy += ay / d * k; }
      b.dx *= redam; b.dy *= redam;
      var nyala = 0.32 + 0.68 * Math.pow(0.5 + 0.5 * Math.sin(t * b.kedip + b.p3), 2);
      var s = b.ukur * (1.7 + 0.5 * nyala) * 2;
      g.globalAlpha = nyala * (0.55 + 0.45 * b.z);
      g.drawImage(b.gbr, x - s / 2, y - s / 2, s, s);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  var aktif = false, raf = 0, lalu = 0, waktu = 0;
  function langkah(now) {
    if (!aktif) return;
    if (!vAdmin.hidden) { henti(); return; }
    raf = requestAnimationFrame(langkah);
    if (document.body.classList.contains('modal-terbuka')) { lalu = now; return; }
    var dt = Math.min(0.05, (now - lalu) / 1000);
    lalu = now;
    waktu += dt;
    geserX += (geserTX - geserX) * (1 - Math.exp(-dt * 3));
    geserY += (geserTY - geserY) * (1 - Math.exp(-dt * 3));
    gambarLapisan(latar, waktu, dt);
    if (hero.tampak) gambarLapisan(hero, waktu, dt);
  }
  function mulai() {
    kanvasLatar.hidden = false;
    kanvasHero.hidden = false;
    ukurSemua();
    if (aktif) return;
    aktif = true;
    lalu = performance.now();
    raf = requestAnimationFrame(langkah);
  }
  function henti() {
    aktif = false;
    cancelAnimationFrame(raf);
    kanvasLatar.hidden = true;
    kanvasHero.hidden = true;
  }
  function aturHalaman(rute) { if (rute === 'beranda') mulai(); else henti(); }

  window.addEventListener('mmx-rute', function (e) { aturHalaman(e.detail); });
  henti();
  if (window.MMX_RUTE) aturHalaman(window.MMX_RUTE);
})();
