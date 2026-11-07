/* ============================================================
   WEBSITE MIXMAX SOUVENIR — Desain & gerak seluruh situs (gaya kingriver.com.au)
   Pola yang ditiru (angka & kurva dari kode King River):
   - header muncul bertahap, tersembunyi saat digulir turun, kembali saat digulir naik
   - menu samping layar penuh: panel geser dari kanan, garis tergambar, label naik
   - tombol: isi menyapu miring, ikon menembus keluar-masuk, tertarik ke kursor
   - Beranda: banner jadi hero layar penuh (zoom 1.24 → 1.1, garis & meta di bawah),
     Visi/Misi/Pilar jadi kolom bergaris, testimoni satu per satu, ajakan terbuka dari atas
   - Testimonial & Tentang Kami: kepala halaman dengan aksen besar dan judul per baris,
     foto terbuka dari bawah, angka berhitung naik, daftar kontak bergaris
   - footer: isi muncul berurutan, nama usaha besar muncul huruf demi huruf
   - gulir halus Lenis di semua halaman publik
   Data, warna, font, latar 3D dan kunang-kunang tetap milik Mixmax; app.js tidak diubah.
   Halaman Produk diatur js/gerak-produk.js (dimuat sesudah berkas ini).
   ============================================================ */
(function () {
  'use strict';
  if (window.MMXSitus) return;
  var publik = document.getElementById('vPublik');
  var hdr = document.querySelector('#vPublik .hdr');
  if (!publik || !hdr) return;

  var g = window.gsap, ST = window.ScrollTrigger, Split = window.SplitText, LenisKelas = window.Lenis;
  var reduksi = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var halus = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);
  var gerak = !!(g && ST && Split) && !reduksi;
  if (gerak) g.registerPlugin(ST, Split);

  var BERSIH = 'opacity,visibility,transform';
  var KUNCI_DATA = 'mmx_publik_v12';
  var rute = null, token = 0, lenis = null, rafLenis = null, menuBuka = false;
  var grup = {}, siapRute = {};

  window.MMXSitus = { lenis: function () { return lenis; } };

  /* ---------- Alat bantu ---------- */
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function arr(x) { return Array.prototype.slice.call(x || []); }
  function ada(x) { return !!x; }
  function dua(n) { return (n < 10 ? '0' : '') + n; }
  function buat(tag, kelas, html) { var e = document.createElement(tag); if (kelas) e.className = kelas; if (html !== undefined) e.innerHTML = html; return e; }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function teks(c, s) { var e = c.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function namaUsaha() { var n = document.getElementById('hdrNama'); return ((n && n.textContent) || 'Mixmax Souvenir').trim(); }
  function simpan(nama, x) { (grup[nama] = grup[nama] || []).push(x); return x; }
  function bunuh(nama) { (grup[nama] || []).forEach(function (t) { if (t && t.kill) t.kill(); }); grup[nama] = []; }
  function jeda(fn, ms) { var t = null; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function siapFont(fn) {
    var sudah = false;
    function sekali() { if (!sudah) { sudah = true; fn(); } }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sekali, sekali); else sekali();
    setTimeout(sekali, 1500);
  }
  function dataPublik() { try { return JSON.parse(localStorage.getItem(KUNCI_DATA) || 'null'); } catch (e) { return null; } }
  function garisAtas(el) {
    var r = el.querySelector(':scope > .gs-garis');
    if (!r) { r = buat('span', 'gs-garis'); r.setAttribute('aria-hidden', 'true'); el.insertBefore(r, el.firstChild); }
    return r;
  }
  function isiItem(el) {
    return arr(el.children).filter(function (x) { return !x.classList.contains('gs-garis') && getComputedStyle(x).display !== 'none'; });
  }

  /* Judul terbuka baris demi baris dari balik topeng (fungsi yang sama dengan King River). */
  function lepasSplit(el) {
    if (!el || !el._gsSplit) return;
    g.killTweensOf(el._gsSplit.lines);
    el._gsSplit.revert();
    el._gsSplit = null;
  }
  function baris(tl, el, pos) {
    if (!el) return;
    lepasSplit(el);
    var s = Split.create(el, { type: 'lines', mask: 'lines', linesClass: 'gs-baris' });
    el._gsSplit = s;
    var masks = (s.masks && s.masks.length) ? s.masks : s.lines.map(function (l) { return l.parentNode; });
    masks.forEach(function (m) { m.style.paddingBottom = '0.12em'; m.style.marginBottom = '-0.12em'; });
    g.set(s.lines, { yPercent: 115, willChange: 'transform' });
    tl.set(el, { autoAlpha: 1, y: 0 }, pos);
    tl.to(s.lines, {
      yPercent: 0, duration: 1.1, stagger: 0.08, ease: 'power3.out',
      onComplete: function () { if (el._gsSplit === s) { lepasSplit(el); g.set(el, { clearProps: BERSIH }); } }
    }, pos);
  }
  function tlGulir(trigger, nama, start) {
    return simpan(nama, g.timeline({ scrollTrigger: { trigger: trigger, start: start || 'top bottom-=15%' }, defaults: { ease: 'power3.out' } }));
  }
  function naikSembunyi(els, y) { els = els.filter(ada); if (els.length) g.set(els, { autoAlpha: 0, y: y || 16 }); }

  /* ---------- Gulir halus (Lenis) di halaman publik ---------- */
  function aturLenis() {
    if (!gerak || !LenisKelas) return;
    var boleh = !publik.hidden && !menuBuka && !document.body.classList.contains('modal-terbuka');
    if (boleh && !lenis) {
      try { lenis = new LenisKelas({ autoRaf: false, anchors: false }); } catch (e) { lenis = null; return; }
      lenis.on('scroll', ST.update);
      rafLenis = function (t) { if (lenis) lenis.raf(t * 1000); };
      g.ticker.add(rafLenis);
      g.ticker.lagSmoothing(0);
    } else if (!boleh && lenis) {
      g.ticker.remove(rafLenis);
      lenis.destroy();
      lenis = null;
    }
  }

  /* ---------- Header ---------- */
  function ukurHeader() { document.body.style.setProperty('--gs-hdr-h', hdr.offsetHeight + 'px'); }
  function tampilkanHeader(langsung) {
    if (!g) return;
    if (langsung || !gerak) g.set(hdr, { y: 0, overwrite: true });
    else g.to(hdr, { y: 0, duration: 0.65, ease: 'expo.out', overwrite: true });
  }
  function siapHeader() {
    var item = [$('.brand', hdr)].concat($$('.nav > button', hdr), $$('.hdr-aksi > *', hdr)).filter(ada);
    item.forEach(function (el, i) { el.setAttribute('data-gs-i', ''); el.style.setProperty('--gs-i', i); });
    if (!reduksi) {
      document.body.classList.add('gs-intro');
      setTimeout(function () { document.body.classList.remove('gs-intro'); }, 2600);
    }
    ukurHeader();
    window.addEventListener('resize', jeda(function () { ukurHeader(); keadaanHeader(); }, 120));
    var lalu = window.scrollY, akum = 0, tampil = true;
    window.addEventListener('scroll', function () {
      var y = window.scrollY, d = y - lalu;
      lalu = y;
      keadaanHeader();
      if (!gerak || !d || menuBuka || publik.hidden) return;
      akum = (d > 0) === (akum > 0) ? akum + d : d;
      if (d > 0) {
        var h = hdr.offsetHeight;
        var kini = Math.min(-(g.getProperty(hdr, 'y') || 0) + d, h);
        g.set(hdr, { y: -kini, overwrite: true });
        tampil = kini === 0;
      } else if (!tampil && akum < -12) {
        tampil = true;
        tampilkanHeader(false);
      }
    }, { passive: true });
    hdr.addEventListener('focusin', function () { tampil = true; tampilkanHeader(false); });
  }
  function keadaanHeader() {
    var adaHero = document.body.classList.contains('gs-ada-hero') && hero.el;
    var gelap = !!adaHero && !menuBuka && window.scrollY < hero.el.offsetHeight - hdr.offsetHeight;
    document.body.classList.toggle('gs-hdr-gelap', gelap);
  }

  /* ---------- Menu samping layar penuh ---------- */
  var menu = null;
  function siapMenu() {
    var burger = document.getElementById('btnBurger');
    var sumber = $$('#navMobile > button');
    if (!g || !burger || !sumber.length) return;
    var latar = buat('div', 'gs-menu-latar');
    latar.setAttribute('aria-hidden', 'true');
    var el = buat('div', 'gs-menu');
    el.id = 'gsMenu';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Menu utama');
    var daftar = sumber.map(function (b) {
      var atr = '';
      ['data-go', 'data-aksi'].forEach(function (a) { if (b.hasAttribute(a)) atr += ' ' + a + '="' + esc(b.getAttribute(a)) + '"'; });
      if (b.hasAttribute('data-nav')) atr += ' data-gs-nav="' + esc(b.getAttribute('data-nav')) + '"';
      return '<li class="gs-menu-baris"><span class="gs-menu-garis" aria-hidden="true"></span>' +
        '<button type="button" class="gs-menu-link"' + atr + '><span class="gs-menu-topeng"><span class="gs-menu-label">' + esc(b.textContent.trim()) + '</span></span>' +
        '<i class="bi bi-arrow-right" aria-hidden="true"></i></button></li>';
    }).join('');
    el.innerHTML = '<div class="gs-menu-dalam">' +
      '<div class="gs-menu-atas"><span class="gs-menu-logo">' + esc(namaUsaha()) + '</span>' +
      '<button type="button" class="gs-menu-tutup" aria-label="Tutup menu"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div>' +
      '<ul class="gs-menu-daftar">' + daftar + '<li class="gs-menu-garis-akhir" aria-hidden="true"><span class="gs-menu-garis"></span></li></ul>' +
      '<div class="gs-menu-kaki"></div></div>';
    document.body.appendChild(latar);
    document.body.appendChild(el);
    burger.setAttribute('aria-controls', 'gsMenu');

    var dalam = $('.gs-menu-dalam', el), logo = $('.gs-menu-logo', el), tutup = $('.gs-menu-tutup', el), kaki = $('.gs-menu-kaki', el);
    var garis = $$('.gs-menu-garis', el), label = $$('.gs-menu-label', el), panah = $$('.gs-menu-link > .bi', el);
    g.set(el, { xPercent: 100 });
    var tl;
    if (!gerak) {
      tl = g.timeline({ paused: true }).to(el, { autoAlpha: 1, xPercent: 0, duration: 0.01 }, 0).to(latar, { autoAlpha: 1, duration: 0.01 }, 0);
    } else {
      g.set(dalam, { xPercent: 14 });
      g.set([logo, kaki], { autoAlpha: 0, y: -12 });
      g.set(tutup, { autoAlpha: 0, rotate: -90 });
      g.set(panah, { autoAlpha: 0 });
      g.set(garis, { scaleX: 0 });
      g.set(label, { yPercent: 110 });
      tl = g.timeline({ paused: true, defaults: { ease: 'expo.out' } })
        .to(el, { autoAlpha: 1, xPercent: 0, duration: 0.9 }, 0)
        .to(latar, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' }, 0)
        .to(dalam, { xPercent: 0, duration: 1 }, 0.06)
        .to(logo, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.18)
        .to(tutup, { autoAlpha: 1, rotate: 0, duration: 0.7 }, 0.24)
        .to(garis, { scaleX: 1, duration: 0.8, stagger: 0.05 }, 0.22)
        .to(label, { yPercent: 0, duration: 0.9, stagger: 0.06 }, 0.28)
        .to(panah, { autoAlpha: 1, duration: 0.6, stagger: 0.06 }, 0.34)
        .to(kaki, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.55);
    }
    menu = { el: el, latar: latar, tl: tl, burger: burger, kaki: kaki };

    // Tombol burger membuka menu baru ini (menu ponsel bawaan disembunyikan lewat CSS)
    burger.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); bukaMenu(!menuBuka, true); }, true);
    tutup.addEventListener('click', function () { bukaMenu(false, true); });
    latar.addEventListener('click', function () { bukaMenu(false, true); });
    el.addEventListener('click', function (e) { if (e.target.closest('.gs-menu-link')) bukaMenu(false, false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuBuka) bukaMenu(false, true); });
  }
  function isiKakiMenu() {
    var li = $$('#ftrKontak > li');
    menu.kaki.innerHTML = li.map(function (x) {
      var ikon = x.querySelector('.bi');
      return '<p>' + (ikon ? ikon.outerHTML : '') + '<span>' + esc(x.textContent.trim()) + '</span></p>';
    }).join('');
  }
  function bukaMenu(buka, kembalikanFokus) {
    if (!menu || buka === menuBuka) return;
    menuBuka = buka;
    document.body.classList.toggle('gs-menu-buka', buka);
    document.documentElement.style.overflow = buka ? 'hidden' : '';
    menu.burger.setAttribute('aria-expanded', String(buka));
    if (buka) {
      isiKakiMenu();
      $$('.gs-menu-link', menu.el).forEach(function (b) {
        var aktif = b.getAttribute('data-gs-nav') === (rute === 'keranjang' || rute === 'nota' ? 'produk' : rute);
        b.classList.toggle('aktif', aktif);
        if (aktif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      tampilkanHeader(true);
    }
    menu.tl.timeScale(buka ? 1 : 1.7);
    if (buka) menu.tl.play(); else menu.tl.reverse();
    aturLenis();
    keadaanHeader();
    if (buka) setTimeout(function () { $('.gs-menu-tutup', menu.el).focus(); }, 60);
    else if (kembalikanFokus) menu.burger.focus({ preventScroll: true });
  }

  /* ---------- Tombol tertarik ke kursor (magnet) ---------- */
  function siapMagnet() {
    if (!gerak || !halus) return;
    var kini = null, pusat = null;
    var PILIH = '#vPublik .btn:not(.gp-more):not(.btn-ghost):not(.btn-block)';
    function lepas(el) { if (el) g.to(el, { '--gs-mx': '0px', '--gs-my': '0px', duration: 0.9, ease: 'elastic.out(1, 0.45)' }); }
    document.addEventListener('pointermove', function (e) {
      var t = e.target instanceof Element ? e.target.closest(PILIH) : null;
      if (t && (t.disabled || t.getAttribute('aria-disabled') === 'true')) t = null;
      if (t !== kini) {
        lepas(kini);
        kini = t;
        if (t) {
          if (!t.style.getPropertyValue('--gs-mx')) g.set(t, { '--gs-mx': '0px', '--gs-my': '0px' });
          var r = t.getBoundingClientRect(), cs = getComputedStyle(t);
          pusat = { x: r.left + r.width / 2 - (parseFloat(cs.getPropertyValue('--gs-mx')) || 0), y: r.top + r.height / 2 - (parseFloat(cs.getPropertyValue('--gs-my')) || 0) };
        }
      }
      if (!kini) return;
      var x = g.utils.clamp(-14, 14, (e.clientX - pusat.x) * 0.28);
      var y = g.utils.clamp(-14, 14, (e.clientY - pusat.y) * 0.28);
      g.to(kini, { '--gs-mx': x + 'px', '--gs-my': y + 'px', duration: 0.5, ease: 'power3.out' });
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { lepas(kini); kini = null; });
  }

  /* ---------- Kepala halaman (Testimonial, Tentang Kami) ---------- */
  function siapKepala(sec) {
    if (!sec) return null;
    if (sec._gsK) return sec._gsK;
    var wrap = sec.querySelector('.wrap');
    var head = wrap && wrap.querySelector('.page-head');
    if (!head) return null;
    var kiri = head.firstElementChild;
    sec.classList.add('gs-kepala');
    var aksen = buat('div', 'gs-aksen');
    aksen.setAttribute('aria-hidden', 'true');
    aksen.textContent = namaUsaha().split(/\s+/)[0];
    sec.insertBefore(aksen, sec.firstChild);
    var kanan = buat('div', 'gs-kanan');
    var muted = kiri.querySelector(':scope > .muted');
    if (muted) kanan.appendChild(muted);
    arr(head.children).forEach(function (c) { if (c !== kiri) kanan.appendChild(c); });
    head.appendChild(kanan);
    sec._gsK = { sec: sec, head: head, aksen: aksen, crumb: wrap.querySelector('.crumb'), label: kiri.querySelector('.lbl'), judul: kiri.querySelector('.h1'), kanan: kanan };
    return sec._gsK;
  }
  function sembunyiKepala(k) {
    if (!k) return;
    lepasSplit(k.judul);
    g.set(k.aksen, { clipPath: 'inset(0% 100% 0% 0%)', xPercent: -2, yPercent: 0 });
    naikSembunyi([k.crumb, k.label], 12);
    if (k.judul) g.set(k.judul, { autoAlpha: 0 });
    naikSembunyi(arr(k.kanan.children), 16);
  }
  function introKepala(k, nama) {
    if (!k) return;
    var tl = simpan(nama, g.timeline({ defaults: { ease: 'power3.out' } }));
    tl.to(k.aksen, { clipPath: 'inset(0% 0% 0% 0%)', xPercent: 0, duration: 1.8, ease: 'power2.out' }, 0);
    tl.to([k.crumb, k.label].filter(ada), { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08, clearProps: BERSIH }, 0.1);
    baris(tl, k.judul, 0.37);
    tl.to(arr(k.kanan.children), { autoAlpha: 1, y: 0, duration: 1, stagger: 0.12, clearProps: BERSIH }, 0.6);
    simpan(nama, g.fromTo(k.aksen, { yPercent: 0 }, { yPercent: -12, ease: 'none', scrollTrigger: { trigger: k.head, start: 'top top', end: 'bottom top', scrub: true } }));
  }

  /* ---------- Judul bagian & kolom bergaris (Visi, Misi, Pilar) ---------- */
  function sembunyiSecHead(sh) {
    if (!sh) return;
    var h = sh.querySelector('.h2, .h3');
    lepasSplit(h);
    if (h) g.set(h, { autoAlpha: 0 });
    naikSembunyi(arr(sh.children).filter(function (x) { return x !== h; }), 16);
  }
  function pemicuSecHead(sh, nama) {
    if (!sh) return;
    var h = sh.querySelector('.h2, .h3');
    var lain = arr(sh.children).filter(function (x) { return x !== h; });
    var tl = tlGulir(sh, nama);
    if (lain[0]) tl.to(lain[0], { autoAlpha: 1, y: 0, duration: 0.9, clearProps: BERSIH }, 0);
    baris(tl, h, 0.1);
    if (lain.length > 1) tl.to(lain.slice(1), { autoAlpha: 1, y: 0, duration: 1, stagger: 0.1, clearProps: BERSIH }, 0.4);
  }
  function itemKolom(c) { return c ? arr(c.children).filter(function (x) { return !x.classList.contains('empty'); }) : []; }
  function sembunyiKolom(c) {
    itemKolom(c).forEach(function (it) {
      g.set(garisAtas(it), { scaleX: 0 });
      isiItem(it).forEach(function (x) { lepasSplit(x); g.set(x, { autoAlpha: 0, y: 16 }); });
    });
  }
  function pemicuKolom(c, nama) {
    var items = itemKolom(c);
    if (!items.length) return;
    var tl = tlGulir(c, nama);
    items.forEach(function (it, i) {
      var a = 0.1 + i * 0.15;
      tl.to(garisAtas(it), { scaleX: 1, duration: 1.2, ease: 'power2.inOut', clearProps: 'transform' }, a);
      var isi = isiItem(it);
      var judul = isi.filter(function (x) { return x.matches('.h4, .visi-teks'); });
      judul.forEach(function (j) { baris(tl, j, a + 0.18); });
      var sisa = isi.filter(function (x) { return judul.indexOf(x) < 0; });
      if (sisa.length) tl.to(sisa, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, clearProps: BERSIH }, a + 0.28);
    });
  }

  /* ---------- Beranda: hero ---------- */
  var hero = { el: null };
  var heroIdx = -1;
  function siapHero() {
    if (hero.el) return hero;
    var banner = document.getElementById('banner');
    var beranda = document.getElementById('pg-beranda');
    if (!banner || !beranda) return null;
    var wadah = banner.parentNode;
    beranda.insertBefore(banner, wadah);
    if (!wadah.children.length) wadah.classList.add('gs-hero-wadah');
    banner.classList.add('gs-hero');
    var bar = buat('div', 'gs-hero-bar');
    bar.innerHTML = '<span class="gs-hero-garis" aria-hidden="true"></span><div class="gs-hero-meta">' +
      '<div><span class="gs-hero-hitung" aria-hidden="true"></span><span class="gs-hero-jalur" aria-hidden="true"></span></div>' +
      '<div><span class="gs-hero-slogan"></span></div></div>';
    var kanan = bar.querySelector('.gs-hero-meta > :nth-child(2)');
    [$('.banner-nav.prev', banner), $('.banner-nav.next', banner)].filter(ada).forEach(function (b) { kanan.appendChild(b); });
    banner.appendChild(bar);
    hero = { el: banner, track: document.getElementById('bannerTrack'), bar: bar, hitung: $('.gs-hero-hitung', bar), jalur: $('.gs-hero-jalur', bar), slogan: $('.gs-hero-slogan', bar) };
    new MutationObserver(function (m) {
      var baru = m.some(function (x) { return x.type === 'childList' && x.target === hero.track; });
      var ganti = baru || m.some(function (x) { return x.type === 'attributes' && x.target.classList && x.target.classList.contains('slide'); });
      if (baru) heroIdx = -1;
      if (ganti) perbaruiHero();
    }).observe(hero.track, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    new MutationObserver(function () { aturHeroHeader(); }).observe(banner, { attributes: true, attributeFilter: ['hidden'] });
    return hero;
  }
  function perbaruiHero() {
    if (!hero.el) return;
    var slides = $$('.slide', hero.track);
    var i = slides.findIndex(function (s) { return s.classList.contains('aktif'); });
    var n = slides.length;
    hero.slogan.textContent = (($('#hdrSlogan') || {}).textContent || '').trim();
    hero.hitung.innerHTML = n ? dua(Math.max(i, 0) + 1) + ' <span>/ ' + dua(n) + '</span>' : '';
    hero.jalur.innerHTML = n > 1 ? slides.map(function (s, k) { return '<i class="' + (k < i ? 'lewat' : (k === i ? 'kini' : '')) + '"></i>'; }).join('') : '';
    aturHeroHeader();
    if (i >= 0 && i !== heroIdx && rute === 'beranda') {
      var sebelumnya = heroIdx;
      heroIdx = i;
      animasiSlide(slides[i], sebelumnya >= 0);
    }
  }
  function animasiSlide(s, ganti) {
    var bg = $('.slide-bg', s);
    if (bg) { bg.classList.remove('gs-zoom'); void bg.offsetWidth; bg.classList.add('gs-zoom'); }
    if (!gerak) return;
    var kartu = $('.slide-card', s);
    if (!kartu) return;
    var judul = $('.slide-judul', kartu);
    var lain = arr(kartu.children).filter(function (c) { return c !== judul; });
    g.killTweensOf(lain);
    g.set(lain, { autoAlpha: 0, y: 16 });
    if (judul) { lepasSplit(judul); g.set(judul, { autoAlpha: 0 }); }
    var tl = g.timeline({ defaults: { ease: 'power3.out' }, delay: ganti ? 0.12 : 0.3 });
    if (lain[0] && lain[0].classList.contains('lbl')) tl.to(lain[0], { autoAlpha: 1, y: 0, duration: 0.8, clearProps: BERSIH }, 0);
    baris(tl, judul, 0.1);
    tl.to(lain.filter(function (x) { return !x.classList.contains('lbl'); }), { autoAlpha: 1, y: 0, duration: 1, stagger: 0.14, clearProps: BERSIH }, 0.45);
  }
  function aturHeroHeader() {
    var adaHero = rute === 'beranda' && hero.el && !hero.el.hidden && !publik.hidden && $$('.slide', hero.track).length > 0;
    document.body.classList.toggle('gs-ada-hero', !!adaHero);
    keadaanHeader();
  }

  /* ---------- Beranda: testimoni satu per satu ---------- */
  var testi = { akar: null, data: [], i: 0, putar: null, diam: false };
  function siapTesti() {
    var src = document.getElementById('berandaTesti');
    if (!src) return;
    if (!testi.akar) {
      var a = buat('div', 'gs-testi');
      a.setAttribute('role', 'region');
      a.setAttribute('aria-roledescription', 'carousel');
      a.setAttribute('aria-label', 'Testimoni pelanggan');
      a.innerHTML = '<div class="gs-testi-panggung"><figure class="gs-testi-slide" aria-live="polite"><span class="gs-garis" aria-hidden="true"></span>' +
        '<blockquote class="gs-testi-kutip"></blockquote><figcaption class="gs-testi-orang"></figcaption></figure></div>' +
        '<div class="gs-testi-kendali"><span class="gs-testi-hitung"></span><span class="gs-testi-jalur" aria-hidden="true"><span class="gs-testi-isi"></span></span>' +
        '<div class="gs-testi-tombol"><button type="button" class="gs-kotak" data-gs-testi="-1" aria-label="Testimoni sebelumnya"><i class="bi bi-arrow-left" aria-hidden="true"></i></button>' +
        '<button type="button" class="gs-kotak" data-gs-testi="1" aria-label="Testimoni berikutnya"><i class="bi bi-arrow-right" aria-hidden="true"></i></button></div></div>';
      src.parentNode.insertBefore(a, src);
      testi.akar = a;
      a.addEventListener('click', function (e) {
        var b = e.target.closest('[data-gs-testi]');
        if (b) { geserTesti(parseInt(b.getAttribute('data-gs-testi'), 10)); mulaiPutarTesti(); }
      });
      a.addEventListener('mouseenter', function () { testi.diam = true; hentiPutarTesti(); });
      a.addEventListener('mouseleave', function () { testi.diam = false; mulaiPutarTesti(); });
      a.addEventListener('focusin', function () { testi.diam = true; hentiPutarTesti(); });
      a.addEventListener('focusout', function () { testi.diam = false; mulaiPutarTesti(); });
      new MutationObserver(bacaTesti).observe(src, { childList: true });
    }
    bacaTesti();
  }
  function bacaTesti() {
    var src = document.getElementById('berandaTesti');
    var kolom = $$('.tbaris', src).map(function (b) { return $$('.tbaris-grup:first-child > .tcard:not([aria-hidden])', b); });
    var hasil = [];
    var maks = kolom.reduce(function (m, k) { return Math.max(m, k.length); }, 0);
    for (var i = 0; i < maks; i++) kolom.forEach(function (k) { if (k[i]) hasil.push(k[i]); });
    testi.data = hasil.map(function (c) {
      var ava = c.querySelector('.tava');
      return { nama: teks(c, '.tnama'), inst: teks(c, '.tinst'), tgl: teks(c, '.ttgl'), isi: teks(c, '.tisi').replace(/^[“"]+|[”"]+$/g, ''), prod: teks(c, '.tprod'), ava: ava ? ava.outerHTML : '' };
    });
    var kosong = !testi.data.length;
    src.classList.toggle('gs-ganti', !kosong);
    testi.akar.hidden = kosong;
    if (testi.i >= testi.data.length) testi.i = 0;
    if (!kosong) tampilTesti(testi.i, 0, false);
  }
  function isiTesti(i) {
    var d = testi.data[i];
    var kutip = $('.gs-testi-kutip', testi.akar), orang = $('.gs-testi-orang', testi.akar);
    lepasSplit(kutip);
    kutip.textContent = '“' + d.isi + '”';
    kutip.classList.toggle('panjang', d.isi.length > 180);
    orang.innerHTML = d.ava + '<span class="gs-testi-nama"><strong>' + esc(d.nama) + '</strong>' +
      (d.inst ? '<span>' + esc(d.inst) + '</span>' : '') + (d.tgl ? '<span class="ttgl">' + esc(d.tgl) + '</span>' : '') + '</span>' +
      (d.prod ? '<span class="tprod"><i class="bi bi-box-seam" aria-hidden="true"></i> ' + esc(d.prod) + '</span>' : '');
    $('.gs-testi-hitung', testi.akar).innerHTML = dua(i + 1) + ' <span>/ ' + dua(testi.data.length) + '</span>';
    $$('[data-gs-testi]', testi.akar).forEach(function (b) { b.hidden = testi.data.length < 2; });
    var isiJalur = $('.gs-testi-isi', testi.akar), skala = (i + 1) / testi.data.length;
    if (gerak) g.to(isiJalur, { scaleX: skala, duration: 0.8, ease: 'power3.out' }); else isiJalur.style.transform = 'scaleX(' + skala + ')';
  }
  function tampilTesti(i, arah, animasi) {
    if (!testi.data[i]) return;
    testi.i = i;
    if (!animasi || !gerak) { isiTesti(i); return; }
    var fig = $('.gs-testi-slide', testi.akar), kutip = $('.gs-testi-kutip', fig), orang = $('.gs-testi-orang', fig);
    g.killTweensOf([fig, kutip, orang]);
    g.to([kutip, orang], {
      autoAlpha: 0, y: arah > 0 ? -12 : 12, duration: 0.35, ease: 'power2.in',
      onComplete: function () {
        isiTesti(i);
        g.set(orang, { autoAlpha: 0, y: 12 });
        var tl = g.timeline({ defaults: { ease: 'power3.out' } });
        tl.fromTo(fig, { clipPath: arah > 0 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, clearProps: 'clipPath' }, 0);
        baris(tl, kutip, 0.1);
        tl.to(orang, { autoAlpha: 1, y: 0, duration: 0.8, clearProps: BERSIH }, 0.45);
      }
    });
  }
  function geserTesti(arah) {
    var n = testi.data.length;
    if (n < 2) return;
    tampilTesti((testi.i + arah + n) % n, arah, true);
  }
  function hentiPutarTesti() { clearInterval(testi.putar); testi.putar = null; }
  function mulaiPutarTesti() {
    hentiPutarTesti();
    if (!gerak || testi.diam || rute !== 'beranda' || testi.data.length < 2) return;
    testi.putar = setInterval(function () { if (!document.hidden) geserTesti(1); }, 8000);
  }
  function sembunyiTesti() {
    if (!testi.akar || testi.akar.hidden) return;
    var kutip = $('.gs-testi-kutip', testi.akar);
    lepasSplit(kutip);
    g.set($('.gs-testi-slide > .gs-garis', testi.akar), { scaleX: 0 });
    g.set(kutip, { autoAlpha: 0 });
    naikSembunyi([$('.gs-testi-orang', testi.akar), $('.gs-testi-kendali', testi.akar)], 16);
  }
  function pemicuTesti(nama) {
    if (!testi.akar || testi.akar.hidden) return;
    var tl = tlGulir(testi.akar, nama);
    tl.to($('.gs-testi-slide > .gs-garis', testi.akar), { scaleX: 1, duration: 1.2, ease: 'power2.inOut', clearProps: 'transform' }, 0);
    baris(tl, $('.gs-testi-kutip', testi.akar), 0.15);
    tl.to([$('.gs-testi-orang', testi.akar), $('.gs-testi-kendali', testi.akar)], { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.12, clearProps: BERSIH }, 0.5);
  }

  /* ---------- Beranda: ajakan dengan foto workshop ---------- */
  function siapCta(cta) {
    if (!cta || cta._gs) return;
    cta._gs = true;
    var d = dataPublik();
    var id = d && d.pengaturan && d.pengaturan.id_foto_tentang;
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(id || '')) return;
    var m = buat('div', 'gs-cta-media');
    m.innerHTML = '<img src="https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&amp;sz=w1600" alt="Workshop ' + esc(namaUsaha()) + '" loading="lazy">';
    m.querySelector('img').addEventListener('error', function () { m.remove(); });
    cta.appendChild(m);
  }
  function bagianCta(cta) {
    var media = $('.gs-cta-media', cta);
    return { judul: $('.h2', cta), lain: arr(cta.children).filter(function (x) { return !x.matches('.h2, .gs-cta-media'); }), media: media, img: media && $('img', media) };
  }
  function sembunyiCta(cta) {
    if (!cta) return;
    var b = bagianCta(cta);
    lepasSplit(b.judul);
    g.set(cta, { clipPath: 'inset(0% 0% 100% 0%)' });
    if (b.judul) g.set(b.judul, { autoAlpha: 0 });
    naikSembunyi(b.lain, 16);
    if (b.media) { g.set(b.media, { clipPath: 'inset(0% 0% 100% 0%)' }); g.set(b.img, { scale: 1.24 }); }
  }
  function pemicuCta(cta, nama) {
    if (!cta) return;
    var b = bagianCta(cta);
    var tl = tlGulir(cta, nama);
    tl.to(cta, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power4.out', clearProps: 'clipPath' }, 0);
    if (b.lain[0]) tl.to(b.lain[0], { autoAlpha: 1, y: 0, duration: 0.9, clearProps: BERSIH }, 0.25);
    baris(tl, b.judul, 0.35);
    tl.to(b.lain.slice(1), { autoAlpha: 1, y: 0, duration: 1, stagger: 0.14, clearProps: BERSIH }, 0.6);
    if (b.media) {
      tl.to(b.media, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, clearProps: 'clipPath' }, 0.7).to(b.img, { scale: 1, duration: 1.6 }, 0.7);
      simpan(nama, g.fromTo(b.img, { yPercent: -3 }, { yPercent: 3, ease: 'none', scrollTrigger: { trigger: b.media, start: 'top bottom', end: 'bottom top', scrub: true } }));
    }
  }

  /* ---------- Halaman ---------- */
  function bangunBeranda() {
    var h = siapHero();
    var heads = $$('#pg-beranda .sec-head');
    var visiMisi = document.getElementById('berandaVisiMisi'), pilar = document.getElementById('berandaPilar');
    var cta = $('#pg-beranda .cta');
    siapTesti();
    siapCta(cta);
    heroIdx = -1;
    perbaruiHero();
    return {
      sembunyi: function () {
        heads.forEach(sembunyiSecHead);
        sembunyiKolom(visiMisi);
        sembunyiKolom(pilar);
        sembunyiTesti();
        sembunyiCta(cta);
      },
      mulai: function () {
        if (h) {
          h.el.classList.remove('gs-siap'); void h.el.offsetWidth; h.el.classList.add('gs-siap');
          simpan('beranda', g.timeline({ scrollTrigger: { trigger: h.el, start: 'top top', end: 'bottom top', scrub: true } })
            .fromTo(h.track, { yPercent: 0 }, { yPercent: 6, ease: 'none' }, 0)
            .fromTo(h.bar, { autoAlpha: 1 }, { autoAlpha: 0, ease: 'none' }, 0));
        }
        heads.forEach(function (x) { pemicuSecHead(x, 'beranda'); });
        pemicuKolom(visiMisi, 'beranda');
        pemicuKolom(pilar, 'beranda');
        pemicuTesti('beranda');
        pemicuCta(cta, 'beranda');
        mulaiPutarTesti();
      }
    };
  }

  function kartuTesti(grid) { return $$(':scope > .tcard', grid); }
  function pasangKartuTesti(grid) {
    bunuh('testimonial-kartu');
    var belum = kartuTesti(grid).filter(function (c) { return !c.getAttribute('data-gs-tampil'); });
    belum.forEach(function (c) { g.set(garisAtas(c), { scaleX: 0 }); g.set(isiItem(c), { autoAlpha: 0, y: 14 }); });
    if (!belum.length) return;
    grup['testimonial-kartu'] = ST.batch(belum, {
      start: 'top bottom', once: true,
      onEnter: function (els) {
        els.forEach(function (c, i) {
          c.setAttribute('data-gs-tampil', '1');
          g.timeline({ delay: i * 0.12, defaults: { ease: 'power3.out' } })
            .to(garisAtas(c), { scaleX: 1, duration: 1, ease: 'power3.inOut', clearProps: 'transform' }, 0)
            .to(isiItem(c), { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.06, clearProps: BERSIH }, 0.2);
        });
      }
    });
  }
  function bangunTestimonial() {
    var sec = document.getElementById('pg-testimonial');
    var k = siapKepala(sec);
    var form = document.getElementById('formTesti');
    var lh = $('#pg-testimonial .list-head');
    var grid = document.getElementById('gridTesti');
    kartuTesti(grid).forEach(function (c) { garisAtas(c); });
    if (grid && !grid._gs) {
      grid._gs = true;
      new MutationObserver(function () {
        kartuTesti(grid).forEach(function (c) { garisAtas(c); });
        if (gerak && rute === 'testimonial' && siapRute.testimonial) { pasangKartuTesti(grid); ST.refresh(); }
      }).observe(grid, { childList: true });
    }
    return {
      sembunyi: function () {
        sembunyiKepala(k);
        if (form) { g.set(form, { clipPath: 'inset(0% 0% 100% 0%)' }); naikSembunyi(arr(form.children), 16); }
        sembunyiSecHead(lh);
        kartuTesti(grid).forEach(function (c) { c.removeAttribute('data-gs-tampil'); });
      },
      mulai: function () {
        introKepala(k, 'testimonial');
        if (form) {
          tlGulir(form, 'testimonial', 'top bottom-=10%')
            .to(form, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, clearProps: 'clipPath' }, 0.2)
            .to(arr(form.children), { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.1, clearProps: BERSIH }, 0.5);
        }
        pemicuSecHead(lh, 'testimonial');
        siapRute.testimonial = true;
        pasangKartuTesti(grid);
      }
    };
  }

  var angkaAktif = [];
  function pulihkanAngka() { angkaAktif.forEach(function (x) { x.el.textContent = x.asli; }); angkaAktif = []; }
  function hitungNaik(tl, el, pos) {
    var asli = el.textContent;
    var m = asli.match(/^(\D*?)(\d[\d.,]*)(.*)$/);
    if (!m) return;
    var mentah = m[2].replace(/[.,](?=\d{3}(?:\D|$))/g, '');
    var titik = /\d\.\d{3}(?:\D|$)/.test(m[2]), koma = /\d,\d{3}(?:\D|$)/.test(m[2]);
    var nilai = parseFloat(mentah.replace(',', '.'));
    if (!isFinite(nilai)) return;
    var desimal = (mentah.split(/[.,]/)[1] || '').length;
    function format(v) {
      var s = v.toFixed(desimal);
      if (titik) return Number(s).toLocaleString('id-ID', { minimumFractionDigits: desimal, maximumFractionDigits: desimal });
      if (koma) return Number(s).toLocaleString('en-US', { minimumFractionDigits: desimal, maximumFractionDigits: desimal });
      return s;
    }
    var o = { v: 0 };
    angkaAktif.push({ el: el, asli: asli });
    el.textContent = m[1] + format(0) + m[3];
    tl.to(o, { v: nilai, duration: 1.8, ease: 'power2.out', onUpdate: function () { el.textContent = m[1] + format(o.v) + m[3]; }, onComplete: function () { el.textContent = asli; } }, pos);
  }
  function bangunTentang() {
    var sec = document.getElementById('pg-tentang');
    var k = siapKepala(sec);
    var about = $('#pg-tentang .about-grid');
    var prose = document.getElementById('tentangTeks');
    var foto = document.getElementById('tentangFoto');
    var stats = $$('#tentangStat .stat');
    stats.forEach(function (s) { garisAtas(s); });
    var head = $('#pg-tentang .sec-head');
    var vm = document.getElementById('tentangVisiMisi'), pilar = document.getElementById('tentangPilar');
    var kontak = $('#pg-tentang .kontak-grid');
    var kKiri = kontak && kontak.children[0], kKanan = kontak && kontak.children[1];
    function img() { return foto && $('img', foto); }
    function kiriBagian() {
      if (!kKiri) return { judul: null, lain: [], li: [] };
      var judul = $('.h3', kKiri);
      return { judul: judul, lain: arr(kKiri.children).filter(function (x) { return x !== judul && !x.matches('.kontak-list'); }), li: $$('.kontak-list > li', kKiri) };
    }
    return {
      sembunyi: function () {
        pulihkanAngka();
        sembunyiKepala(k);
        if (prose) naikSembunyi(arr(prose.children), 16);
        if (foto) g.set(foto, { clipPath: 'inset(100% 0% 0% 0%)' });
        if (img()) g.set(img(), { scale: 1.24 });
        stats.forEach(function (s) { g.set(garisAtas(s), { scaleX: 0 }); naikSembunyi(isiItem(s), 12); });
        sembunyiSecHead(head);
        sembunyiKolom(vm);
        sembunyiKolom(pilar);
        var kb = kiriBagian();
        lepasSplit(kb.judul);
        if (kb.judul) g.set(kb.judul, { autoAlpha: 0 });
        naikSembunyi(kb.lain.concat(kb.li), 16);
        if (kKanan) g.set(kKanan, { clipPath: 'inset(0% 0% 100% 0%)' });
      },
      mulai: function () {
        introKepala(k, 'tentang');
        if (about) {
          var tl = tlGulir(about, 'tentang', 'top bottom-=10%');
          if (foto) tl.to(foto, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, clearProps: 'clipPath' }, 0);
          if (img()) {
            tl.to(img(), { scale: 1.08, duration: 1.6 }, 0);
            simpan('tentang', g.fromTo(img(), { yPercent: -3 }, { yPercent: 3, ease: 'none', scrollTrigger: { trigger: foto, start: 'top bottom', end: 'bottom top', scrub: true } }));
          }
          if (prose) tl.to(arr(prose.children), { autoAlpha: 1, y: 0, duration: 1, stagger: 0.14, clearProps: BERSIH }, 0.25);
          stats.forEach(function (s, i) {
            var a = 0.5 + i * 0.18;
            tl.to(garisAtas(s), { scaleX: 1, duration: 1.2, ease: 'power2.inOut', clearProps: 'transform' }, a);
            tl.to(isiItem(s), { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08, clearProps: BERSIH }, a + 0.15);
            var angka = $('strong', s);
            if (angka) hitungNaik(tl, angka, a + 0.15);
          });
        }
        pemicuSecHead(head, 'tentang');
        pemicuKolom(vm, 'tentang');
        pemicuKolom(pilar, 'tentang');
        if (kontak) {
          var kb = kiriBagian();
          var tk = tlGulir(kontak, 'tentang');
          if (kb.lain[0]) tk.to(kb.lain[0], { autoAlpha: 1, y: 0, duration: 0.9, clearProps: BERSIH }, 0);
          baris(tk, kb.judul, 0.1);
          tk.to(kb.li, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1, clearProps: BERSIH }, 0.3);
          tk.to(kb.lain.slice(1), { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1, clearProps: BERSIH }, 0.6);
          if (kKanan) tk.to(kKanan, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, clearProps: 'clipPath' }, 0.2);
        }
      }
    };
  }

  var HALAMAN = { beranda: bangunBeranda, testimonial: bangunTestimonial, tentang: bangunTentang };

  /* ---------- Footer ---------- */
  function siapFooter() {
    var f = $('#vPublik .ftr');
    if (!f || f._gs) return;
    f._gs = true;
    var dalam = buat('div', 'ftr-dalam');
    while (f.firstChild) dalam.appendChild(f.firstChild);
    f.appendChild(dalam);
    var merek = buat('div', 'wrap gs-ftr-merek');
    merek.setAttribute('aria-hidden', 'true');
    merek.innerHTML = '<span class="gs-ftr-merek-teks">' + namaUsaha().split('').map(function (c) { return '<span>' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>'; }).join('') + '</span>';
    var bawah = $('.ftr-bawah', dalam);
    dalam.insertBefore(merek, bawah);
    var teksMerek = $('.gs-ftr-merek-teks', merek);
    function pas() {
      teksMerek.style.fontSize = '100px';
      var ruang = merek.clientWidth - parseFloat(getComputedStyle(merek).paddingLeft) - parseFloat(getComputedStyle(merek).paddingRight);
      var lebar = teksMerek.scrollWidth;
      if (ruang > 0 && lebar > 0) teksMerek.style.fontSize = Math.min(240, 100 * ruang / lebar) + 'px';
    }
    pas();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(pas);
    window.addEventListener('resize', jeda(pas, 150));
    if (!gerak) return;
    var item = $$('.ftr-grid > div > :not(ul), .ftr-grid li', dalam);
    var huruf = $$('.gs-ftr-merek-teks > span', merek);
    var legal = bawah ? arr(bawah.children) : [];
    g.set(item.concat(legal), { autoAlpha: 0, y: 12 });
    g.set(huruf, { autoAlpha: 0, filter: 'blur(12px)' });
    g.timeline({ scrollTrigger: { trigger: f, start: 'top bottom-=5%', once: true }, defaults: { ease: 'power3.out' } })
      .to(item, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.04, clearProps: BERSIH }, 0)
      .to(huruf, { autoAlpha: 1, filter: 'blur(0px)', duration: 0.9, stagger: 0.04, ease: 'power2.out', clearProps: 'opacity,visibility,filter' }, 0.25)
      .to(legal, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1, clearProps: BERSIH }, 0.65);
    g.fromTo(dalam, { yPercent: -18 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: f, start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }

  /* ---------- Pergantian halaman (rute SPA dari app.js) ---------- */
  function keluarRute(lama) {
    bunuh(lama);
    if (lama === 'testimonial') bunuh('testimonial-kartu');
    if (lama === 'tentang') pulihkanAngka();
    siapRute[lama] = false;
    hentiPutarTesti();
  }
  function gantiRute(baru) {
    var lama = rute;
    rute = baru;
    if (lama) keluarRute(lama);
    if (menuBuka) bukaMenu(false, false);
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    tampilkanHeader(true);
    aturHeroHeader();
    aturLenis();
    var bangun = HALAMAN[baru];
    var sec = document.getElementById('pg-' + baru);
    var tok = ++token;
    if (bangun && gerak && sec) sec.classList.add('gs-tunggu');
    setTimeout(function () {
      if (tok !== token) return;
      var o = null;
      try { o = bangun ? bangun() : null; } catch (e) { console.error('[Mixmax gerak]', e); }
      aturHeroHeader();
      if (!gerak) { if (sec) sec.classList.remove('gs-tunggu'); return; }
      try { if (o) o.sembunyi(); } catch (e) { console.error('[Mixmax gerak]', e); }
      if (sec) sec.classList.remove('gs-tunggu');
      siapFont(function () {
        if (tok !== token) return;
        try { if (o) o.mulai(); } catch (e) { console.error('[Mixmax gerak]', e); }
        ST.refresh();
      });
    }, 0);
  }

  /* ---------- Mulai ---------- */
  document.body.classList.add('gs');
  siapHeader();
  siapMenu();
  siapMagnet();
  siapFooter();
  new MutationObserver(function () {
    aturLenis();
    if (publik.hidden && menuBuka) bukaMenu(false, false);
    aturHeroHeader();
    if (!publik.hidden && gerak) ST.refresh();
  }).observe(publik, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(aturLenis).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', function () { if (document.hidden) hentiPutarTesti(); else mulaiPutarTesti(); });
  window.addEventListener('mmx-rute', function (e) { gantiRute(e.detail); });
  if (window.MMX_RUTE) gantiRute(window.MMX_RUTE);
  aturLenis();
})();
