/* ============================================================
   WEBSITE MIXMAX SOUVENIR — Gerak halaman Produk (gaya King River "Insights")
   Meniru efek & gerakan kingriver.com.au/insights dengan angka yang sama:
   - judul terbuka baris demi baris dari balik topeng (SplitText, 1.1 dtk, jeda 0.08)
   - aksen besar terbuka dari kiri ke kanan lalu ikut bergeser saat digulir
   - kartu terbuka dari bawah (clip-path 1.2 dtk), foto menyusut 1.2 → 1 (1.8 dtk),
     isi naik pelan, garis bawah tombol tergambar; kartu muncul berurutan saat tergulir
   - 9 produk per halaman; ganti halaman: kartu lama naik menghilang, kartu baru masuk
   - ajakan WhatsApp di bawah terbuka dari atas; gulir halus dengan Lenis
   Font, warna, latar 3D, kunang-kunang, dan data tetap milik Mixmax (app.js tidak diubah).
   Hanya aktif di rute Produk. Bila GSAP gagal dimuat atau pengunjung memilih
   "kurangi gerakan", tata letak baru tetap tampil tanpa animasi.
   ============================================================ */
(function () {
  'use strict';
  var akar = document.getElementById('sub-katalog');
  var grid = document.getElementById('gridProduk');
  if (!akar || !grid || akar.getAttribute('data-gp')) return;
  akar.setAttribute('data-gp', '1');

  var PER_HAL = 9;                       // King River: 9 tulisan per halaman (3 × 3)
  var JEDA_KARTU = 0.12;                 // jeda antar-kartu dalam satu kelompok
  var GESER_GULIR = -140;                // jarak berhenti di atas grid saat ganti halaman
  var FRAME_TUTUP = 'inset(100% 0% 0% 0%)', FRAME_BUKA = 'inset(0% 0% 0% 0%)';

  var g = window.gsap, ST = window.ScrollTrigger, Split = window.SplitText, LenisKelas = window.Lenis;
  var reduksi = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var gerak = !!(g && ST && Split) && !reduksi;
  if (gerak) g.registerPlugin(ST, Split);

  var aktif = false, siap = false, sibuk = false, hal = 1, jmlHal = 1;
  var lenis = null, rafLenis = null;
  var grup = { kartu: [], statis: [] };

  var head = akar.querySelector('.page-head');
  var kiri = head ? head.firstElementChild : null;
  var judul = kiri ? kiri.querySelector('.h1') : null;
  var label = kiri ? kiri.querySelector('.lbl') : null;
  var crumb = akar.querySelector('.crumb');
  var garis = akar.querySelector('.garis-gradasi');
  var toolbar = akar.querySelector('.toolbar');
  var aksen = null, kanan = null, nav = null, cta = null;

  function arr(x) { return Array.prototype.slice.call(x || []); }
  function ada(x) { return !!x; }

  /* ---------- Kerangka: aksen, kolom kanan, nomor halaman, ajakan ---------- */
  function siapkanKerangka() {
    akar.classList.add('gp');
    var nama = document.getElementById('hdrNama');
    aksen = document.createElement('div');
    aksen.className = 'gp-aksen';
    aksen.setAttribute('aria-hidden', 'true');
    aksen.textContent = ((nama && nama.textContent) || 'Mixmax').trim().split(/\s+/)[0];
    akar.insertBefore(aksen, akar.firstChild);

    if (head && kiri) {
      kanan = document.createElement('div');
      kanan.className = 'gp-kanan';
      [kiri.querySelector('.muted'), head.querySelector('.info-box')].filter(ada).forEach(function (el) { kanan.appendChild(el); });
      head.appendChild(kanan);
    }

    nav = document.createElement('nav');
    nav.className = 'gp-halaman';
    nav.setAttribute('aria-label', 'Halaman katalog');
    nav.hidden = true;
    grid.parentNode.insertBefore(nav, grid.nextSibling);
    nav.addEventListener('click', function (e) {
      var t = e.target.closest('button[data-hal]');
      if (t && !sibuk) gantiHal(parseInt(t.getAttribute('data-hal'), 10));
    });

    cta = document.createElement('section');
    cta.className = 'gp-cta';
    cta.setAttribute('aria-labelledby', 'gpCtaJudul');
    cta.innerHTML =
      '<div class="gp-cta-panel">' +
        '<div class="gp-cta-kiri">' +
          '<span class="lbl">Siap Memulai Pesanan?</span>' +
          '<h2 class="h2" id="gpCtaJudul">Wujudkan Souvenir <em>Eksklusif</em> <span class="h2-sub">untuk Bisnis &amp; Acara Anda</span></h2>' +
        '</div>' +
        '<div class="gp-cta-kanan">' +
          '<span class="gp-cta-garis" aria-hidden="true"></span>' +
          '<p class="muted">Pilih produk, tentukan jumlah, lalu dapatkan nota pesanan langsung di layar. Pembayaran DP 50% dan desain dibahas lewat WhatsApp.</p>' +
          '<a class="btn btn-wa btn-lg" data-wa="umum" target="_blank" rel="noopener"><i class="bi bi-whatsapp" aria-hidden="true"></i> Konsultasi via WhatsApp</a>' +
          '<ul class="cta-poin">' +
            '<li><i class="bi bi-check2" aria-hidden="true"></i>Harga jelas per pcs</li>' +
            '<li><i class="bi bi-check2" aria-hidden="true"></i>DP 50% sebagai tanda jadi</li>' +
            '<li><i class="bi bi-check2" aria-hidden="true"></i>Konsultasi desain via WhatsApp</li>' +
          '</ul>' +
        '</div>' +
      '</div>';
    grid.parentNode.appendChild(cta);
  }

  /* Tautan WhatsApp diisi app.js saat data dimuat; ajakan ini menyalin alamat yang sama. */
  function salinLinkWa() {
    var a = cta && cta.querySelector('[data-wa]');
    var asal = document.querySelector('#waFloat[href]') || document.querySelector('[data-wa="umum"][href]');
    if (!a) return;
    if (asal && asal !== a) { a.href = asal.href; a.removeAttribute('aria-disabled'); }
    else if (!a.getAttribute('href')) a.setAttribute('aria-disabled', 'true');
  }

  /* ---------- Kartu: bingkai foto, baris jumlah + tombol, garis bawah ---------- */
  function rapikanKartu(k) {
    if (k.getAttribute('data-gp-siap')) return;
    k.setAttribute('data-gp-siap', '1');
    var box = k.querySelector('.pimg');
    if (box && !box.querySelector('.gp-frame')) {
      var f = document.createElement('div');
      f.className = 'gp-frame';
      while (box.firstChild) f.appendChild(box.firstChild);
      box.appendChild(f);
    }
    var qty = k.querySelector('.pqty');
    var btn = k.querySelector('[data-aksi="masukKeranjang"]');
    if (btn) {
      btn.classList.add('gp-more');
      var r = document.createElement('span');
      r.className = 'gp-rule';
      r.setAttribute('aria-hidden', 'true');
      btn.appendChild(r);
    }
    if (qty || btn) {
      var baris = document.createElement('div');
      baris.className = 'gp-aksi';
      var acuan = qty || btn;
      acuan.parentNode.insertBefore(baris, acuan);
      if (qty) baris.appendChild(qty);
      if (btn) baris.appendChild(btn);
    }
  }

  function bagian(k) {
    return {
      frame: k.querySelector('.gp-frame'),
      img: k.querySelector('.gp-frame img'),
      meta: k.querySelector('.pmeta'),
      title: k.querySelector('.ptitle'),
      isi: arr(k.querySelectorAll('.pprice, .pdesc')),
      aksi: k.querySelector('.gp-aksi'),
      rule: k.querySelector('.gp-rule')
    };
  }

  function semuaKartu() { return arr(grid.querySelectorAll('.pcard')); }
  function kartuTampil() { return semuaKartu().filter(function (k) { return !k.hidden; }); }

  /* ---------- Judul baris demi baris (sama dengan fungsi King River) ---------- */
  function lepasSplit(el) {
    if (!el || !el._gpSplit) return;
    g.killTweensOf(el._gpSplit.lines);
    el._gpSplit.revert();
    el._gpSplit = null;
  }
  function barisMuncul(tl, el, pos) {
    lepasSplit(el);
    var s = Split.create(el, { type: 'lines', mask: 'lines', linesClass: 'gp-baris' });
    el._gpSplit = s;
    var masks = (s.masks && s.masks.length) ? s.masks : s.lines.map(function (l) { return l.parentNode; });
    masks.forEach(function (m) { m.style.paddingBottom = '0.12em'; m.style.marginBottom = '-0.12em'; });
    g.set(s.lines, { yPercent: 115, willChange: 'transform' });
    tl.set(el, { autoAlpha: 1 }, pos);
    tl.to(s.lines, {
      yPercent: 0, duration: 1.1, stagger: 0.08,
      onComplete: function () { if (el._gpSplit === s) { lepasSplit(el); g.set(el, { clearProps: 'opacity,visibility' }); } }
    }, pos);
  }

  /* ---------- Kartu: keadaan awal & animasi masuk ---------- */
  function sembunyikanKartu(k) {
    var b = bagian(k);
    k.removeAttribute('data-gp-tampil');
    lepasSplit(b.title);
    g.killTweensOf([k, b.frame, b.img, b.meta, b.title, b.aksi, b.rule].concat(b.isi).filter(ada));
    g.set(k, { clearProps: 'opacity,visibility,transform' });
    if (b.frame) g.set(b.frame, { clipPath: FRAME_TUTUP });
    if (b.img) g.set(b.img, { scale: 1.2 });
    g.set([b.meta, b.aksi].concat(b.isi).filter(ada), { autoAlpha: 0, y: 14 });
    if (b.title) g.set(b.title, { autoAlpha: 0 });
    if (b.rule) g.set(b.rule, { scaleX: 0 });
  }

  function munculkanKartu(k, jeda) {
    var b = bagian(k);
    k.setAttribute('data-gp-tampil', '1');
    k.classList.add('gp-masuk');
    var bersih = 'opacity,visibility,transform';
    var tl = g.timeline({ delay: jeda || 0, defaults: { ease: 'power3.out' }, onComplete: function () { k.classList.remove('gp-masuk'); } });
    if (b.frame) tl.to(b.frame, { clipPath: FRAME_BUKA, duration: 1.2, ease: 'power3.inOut', clearProps: 'clipPath' }, 0);
    if (b.img) tl.to(b.img, { scale: 1, duration: 1.8, ease: 'power2.out', clearProps: 'transform' }, 0);
    if (b.meta) tl.to(b.meta, { autoAlpha: 1, y: 0, duration: 0.8, clearProps: bersih }, 0.5);
    if (b.title) barisMuncul(tl, b.title, 0.6);
    if (b.isi.length) tl.to(b.isi, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.06, clearProps: bersih }, 0.72);
    if (b.aksi) tl.to(b.aksi, { autoAlpha: 1, y: 0, duration: 0.8, clearProps: bersih }, 0.85);
    if (b.rule) tl.to(b.rule, { scaleX: 1, duration: 1, ease: 'power3.inOut', clearProps: 'transform' }, 1);
    return tl;
  }

  function bunuh(nama) {
    grup[nama].forEach(function (t) { if (t && t.kill) t.kill(); });
    grup[nama] = [];
  }

  /* Kartu yang belum tampil muncul berkelompok saat ujung atasnya masuk layar. */
  function pasangPemicuKartu() {
    bunuh('kartu');
    var belum = kartuTampil().filter(function (k) { return !k.getAttribute('data-gp-tampil'); });
    if (!belum.length) return;
    grup.kartu = ST.batch(belum, {
      start: 'top bottom',
      once: true,
      onEnter: function (els) { els.forEach(function (k, i) { munculkanKartu(k, i * JEDA_KARTU); }); }
    });
  }

  /* ---------- Nomor halaman ---------- */
  function tombolHal(arah, ke, mati, label) {
    var ikon = '<i class="bi bi-arrow-' + (arah === 'prev' ? 'left' : 'right') + '" aria-hidden="true"></i>';
    return mati
      ? '<span class="gp-hal gp-hal-' + arah + '" aria-disabled="true">' + ikon + '<span class="sr-only">' + label + '</span></span>'
      : '<button type="button" class="gp-hal gp-hal-' + arah + '" data-hal="' + ke + '" aria-label="' + label + '">' + ikon + '</button>';
  }
  function gambarNav() {
    nav.hidden = jmlHal <= 1;
    var h = tombolHal('prev', hal - 1, hal <= 1, 'Halaman sebelumnya');
    for (var i = 1; i <= jmlHal; i++) {
      h += i === hal
        ? '<button type="button" class="gp-hal" aria-current="page" aria-label="Halaman ' + i + ', sedang dibuka">' + i + '</button>'
        : '<button type="button" class="gp-hal" data-hal="' + i + '" aria-label="Halaman ' + i + '">' + i + '</button>';
    }
    h += tombolHal('next', hal + 1, hal >= jmlHal, 'Halaman berikutnya');
    var fokusDiNav = nav.contains(document.activeElement);
    nav.innerHTML = h;
    if (fokusDiNav) { var c = nav.querySelector('[aria-current]'); if (c) c.focus({ preventScroll: true }); }
  }
  function terapkanHal() {
    var semua = semuaKartu();
    jmlHal = Math.max(1, Math.ceil(semua.length / PER_HAL));
    if (hal > jmlHal) hal = jmlHal;
    semua.forEach(function (k, i) { k.hidden = Math.floor(i / PER_HAL) + 1 !== hal; });
    gambarNav();
  }

  function gulirKeGrid(langsung) {
    var top = grid.getBoundingClientRect().top;
    if (top > 0 && top < window.innerHeight * 0.5) return;
    var L = lenisAktif();
    if (L && !langsung) { L.scrollTo(grid, { offset: GESER_GULIR, duration: 1.1 }); return; }
    window.scrollTo({ top: window.scrollY + top + GESER_GULIR, behavior: 'auto' });
  }

  function gantiHal(n) {
    if (!(n >= 1 && n <= jmlHal) || n === hal) return;
    if (!gerak || !aktif) { hal = n; terapkanHal(); gulirKeGrid(true); return; }
    sibuk = true;
    grid.setAttribute('aria-busy', 'true');
    gulirKeGrid(false);
    var lama = kartuTampil();
    g.to(lama, {
      autoAlpha: 0, y: -24, duration: 0.45, stagger: 0.03, ease: 'power2.in',
      onComplete: function () {
        g.set(lama, { clearProps: 'opacity,visibility,transform' });
        hal = n;
        terapkanHal();
        kartuTampil().forEach(sembunyikanKartu);
        ST.refresh();
        pasangPemicuKartu();
        sibuk = false;
        grid.removeAttribute('aria-busy');
      }
    });
  }

  /* ---------- Grid digambar ulang oleh app.js (kategori, urutan, data baru) ---------- */
  function siapkanGrid() {
    semuaKartu().forEach(rapikanKartu);
    hal = 1;
    terapkanHal();
    if (!gerak || !aktif) return;
    bunuh('kartu');
    kartuTampil().forEach(sembunyikanKartu);
    if (siap) { ST.refresh(); pasangPemicuKartu(); }
  }

  /* ---------- Kepala halaman, nomor halaman, ajakan ---------- */
  function isiKanan() { return kanan ? arr(kanan.children) : []; }
  function bagianCta() {
    return {
      panel: cta.querySelector('.gp-cta-panel'),
      garis: cta.querySelector('.gp-cta-garis'),
      kiri: arr(cta.querySelectorAll('.gp-cta-kiri > *')),
      kanan: arr(cta.querySelectorAll('.gp-cta-kanan > :not(.gp-cta-garis)'))
    };
  }

  function sembunyikanStatis() {
    var c = bagianCta();
    var semua = [aksen, crumb, label, judul, garis, nav, c.panel, c.garis].concat(isiKanan(), toolbar ? arr(toolbar.children) : [], c.kiri, c.kanan).filter(ada);
    lepasSplit(judul);
    g.killTweensOf(semua);
    g.set(aksen, { clipPath: 'inset(0% 100% 0% 0%)', xPercent: -2, yPercent: 0 });
    g.set([crumb, label].filter(ada), { autoAlpha: 0, y: 12 });
    if (judul) g.set(judul, { autoAlpha: 0 });
    g.set(isiKanan(), { autoAlpha: 0, y: 16 });
    if (garis) g.set(garis, { scaleX: 0 });
    if (toolbar) g.set(toolbar.children, { autoAlpha: 0, y: 16 });
    g.set(nav, { autoAlpha: 0, y: 16 });
    g.set(c.panel, { clipPath: 'inset(0% 0% 100% 0%)' });
    g.set(c.garis, { scaleX: 0 });
    g.set(c.kiri.concat(c.kanan), { autoAlpha: 0, y: 16 });
  }

  function introKepala() {
    var bersih = 'opacity,visibility,transform';
    var tl = g.timeline({ defaults: { ease: 'power3.out' } });
    tl.to(aksen, { clipPath: 'inset(0% 0% 0% 0%)', xPercent: 0, duration: 1.8, ease: 'power2.out' }, 0);
    tl.to([crumb, label].filter(ada), { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08, clearProps: bersih }, 0.1);
    if (judul) barisMuncul(tl, judul, 0.37);
    tl.to(isiKanan(), { autoAlpha: 1, y: 0, duration: 1, stagger: 0.12, clearProps: bersih }, 0.6);
    if (garis) tl.to(garis, { scaleX: 1, duration: 1.2, ease: 'power3.inOut', clearProps: 'transform' }, 0.5);
    if (toolbar) tl.to(toolbar.children, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08, clearProps: bersih }, 0.75);
    grup.statis.push(tl);
  }

  function pasangPemicuStatis() {
    bunuh('statis');
    introKepala();
    // aksen ikut bergeser naik saat kepala halaman digulir (King River: yPercent -12)
    grup.statis.push(g.to(aksen, { yPercent: -12, ease: 'none', scrollTrigger: { trigger: head || akar, start: 'top top', end: 'bottom top', scrub: true } }));
    grup.statis.push(ST.create({
      trigger: nav, start: 'top bottom', once: true,
      onEnter: function () { g.to(nav, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', clearProps: 'opacity,visibility,transform' }); }
    }));
    var c = bagianCta();
    var tlCta = g.timeline({ scrollTrigger: { trigger: cta, start: 'top bottom-=12%' }, defaults: { ease: 'power3.out' } });
    tlCta.to(c.panel, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, clearProps: 'clipPath' }, 0)
      .to(c.garis, { scaleX: 1, duration: 1.2, clearProps: 'transform' }, 0.15)
      .to(c.kiri, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08, clearProps: 'opacity,visibility,transform' }, 0.4)
      .to(c.kanan, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.06, clearProps: 'opacity,visibility,transform' }, 0.5);
    grup.statis.push(tlCta);
  }

  /* ---------- Gulir halus Lenis, hanya selama halaman Produk tampil ---------- */
  // Bila js/gerak-situs.js aktif, gulir halus sudah diatur di sana untuk semua halaman.
  function lenisAktif() { return window.MMXSitus ? window.MMXSitus.lenis() : lenis; }
  function mulaiLenis() {
    if (window.MMXSitus || lenis || !LenisKelas) return;
    try { lenis = new LenisKelas({ autoRaf: false, anchors: false }); } catch (e) { lenis = null; return; }
    lenis.on('scroll', ST.update);
    rafLenis = function (t) { if (lenis) lenis.raf(t * 1000); };
    g.ticker.add(rafLenis);
    g.ticker.lagSmoothing(0);
    if (document.body.classList.contains('modal-terbuka')) lenis.stop();
  }
  function hentikanLenis() {
    if (!lenis) return;
    g.ticker.remove(rafLenis);
    lenis.destroy();
    lenis = null;
  }
  // jendela modal (mis. login, konfirmasi) mengunci gulir: Lenis ikut berhenti
  if (!window.MMXSitus) new MutationObserver(function () {
    if (!lenis) return;
    if (document.body.classList.contains('modal-terbuka')) lenis.stop(); else lenis.start();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  function siapFont(fn) {
    var sudah = false;
    function sekali() { if (!sudah) { sudah = true; fn(); } }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sekali, sekali);
    else sekali();
    setTimeout(sekali, 1500);
  }

  /* ---------- Masuk & keluar rute Produk ---------- */
  function masuk() {
    if (aktif) return;
    aktif = true;
    siap = false;
    salinLinkWa();
    if (gerak) sembunyikanStatis();
    siapkanGrid();
    setTimeout(mulai, 0);
  }
  function mulai() {
    if (!aktif) return;
    salinLinkWa();
    if (!gerak) return;
    mulaiLenis();
    siapFont(function () {
      if (!aktif || siap) return;
      siap = true;
      pasangPemicuStatis();
      ST.refresh();
      pasangPemicuKartu();
    });
  }
  function keluar() {
    if (!aktif) return;
    aktif = false;
    siap = false;
    if (!gerak) return;
    bunuh('kartu');
    bunuh('statis');
    hentikanLenis();
  }

  siapkanKerangka();
  new MutationObserver(function (m) {
    var berubah = m.some(function (x) { return x.addedNodes.length || x.removedNodes.length; });
    if (berubah) siapkanGrid();
  }).observe(grid, { childList: true });
  window.addEventListener('mmx-rute', function (e) { if (e.detail === 'produk') masuk(); else keluar(); });

  // Halaman Produk sudah tampil saat berkas ini dimuat (misalnya pengunjung memuat ulang di rute Produk).
  if (window.MMX_RUTE === 'produk' && !akar.hidden && !akar.closest('[hidden]')) masuk();
  else siapkanGrid();
})();
