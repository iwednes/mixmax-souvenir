/* ============================================================
   WEBSITE MIXMAX SOUVENIR — Frontend (js/app.js) · v1.2
   - Situs statis (GitHub Pages). Backend = Google Apps Script sebagai REST API
     JSON; alamatnya diatur di js/config.js (GAS_URL). Tanpa google.script.run.
   - SPA: semua halaman sudah ada di index.html; navigasi tanpa memuat ulang.
   - Data publik terakhir disimpan di localStorage → kunjungan berikutnya tampil
     instan, lalu diperbarui di latar (hanya digambar ulang bila datanya berubah).
   - Keranjang hanya di browser: [{id, jumlah}] (harga selalu dari data terbaru).
   - Data admin di-cache di memori: menu tampil instan, lalu diperbarui di latar.
   - Pesan Sekarang, kirim testimoni, login, dan simpan admin MENUNGGU server.
   - Semua data pengguna di-escape sebelum masuk HTML.
   ============================================================ */
(function () {
  'use strict';

  // ============================================================
  // 1. UTILITAS
  // ============================================================
  const byId = function (id) { return document.getElementById(id); };
  const $ = function (s, el) { return (el || document).querySelector(s); };
  const $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  const PETA_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const GERAK_MINIM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const STATUS_PESANAN = ['Baru', 'DP Diterima', 'Batal'];
  const HALAMAN_OPSI = [['beranda', 'Beranda'], ['produk', 'Produk'], ['testimonial', 'Testimonial'], ['tentang', 'Tentang Kami']];
  const LABEL_KUNCI = { slogan: 'Slogan', alamat: 'Alamat', jam_operasional: 'Jam operasional', visi: 'Visi', tentang_kami: 'Tentang kami', no_wa_admin: 'Nomor WhatsApp admin', misi: 'Misi', pilar: 'Pilar keunggulan' };

  function esc(v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) { return PETA_ESC[c]; });
  }
  function rupiah(n) {
    const x = Math.round(Number(n) || 0);
    return 'Rp' + String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function desimal(x) { return String(Math.round(x * 10) / 10).replace('.', ','); }
  function singkatRp(v) {
    v = Number(v) || 0;
    if (v >= 1e9) return 'Rp' + desimal(v / 1e9) + ' M';
    if (v >= 1e6) return 'Rp' + desimal(v / 1e6) + ' jt';
    if (v >= 1e3) return 'Rp' + desimal(v / 1e3) + ' rb';
    return 'Rp' + v;
  }
  function normalWa(v) {
    let s = String(v === null || v === undefined ? '' : v).replace(/[\s.\-()]/g, '');
    if (s.indexOf('+62') === 0) s = '0' + s.slice(3);
    else if (s.indexOf('62') === 0) s = '0' + s.slice(2);
    return /^08[0-9]{7,13}$/.test(s) ? s : '';
  }
  function wa62(s) { return '62' + String(s || '').replace(/^0/, ''); }
  function formatWa(no) {
    const s = String(no || '');
    return /^\d{10,}$/.test(s) ? s.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3') : s;
  }
  function idValid(id) { return /^[A-Za-z0-9_-]{10,200}$/.test(String(id || '')); }
  function gambar(id, w) {
    return idValid(id) ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + (w || 600) : '';
  }
  function inisial(nama) {
    const p = String(nama || '').replace(/<[^>]*>/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return (p[0].charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
  }
  function debounce(fn, ms) {
    let t = null;
    return function () {
      const a = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, a); }, ms);
    };
  }
  function dua(n) { return (n < 10 ? '0' : '') + n; }
  function jamSekarang() { const d = new Date(); return dua(d.getHours()) + '.' + dua(d.getMinutes()); }
  function tglInput(d) { return d.getFullYear() + '-' + dua(d.getMonth() + 1) + '-' + dua(d.getDate()); }
  function hariIni() { return tglInput(new Date()); }
  function awalBulanIni() { const d = new Date(); return tglInput(new Date(d.getFullYear(), d.getMonth(), 1)); }

  function simpanLokal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* abaikan */ } }
  function bacaLokal(k, def) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function simpanSesi(k, v) {
    try { if (v === null || v === undefined) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { /* abaikan */ }
  }
  function bacaSesi(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }

  /**
   * Panggil aksi backend GAS lewat fetch(); hasil selalu Promise { success, data, message, kode }.
   * - Aksi baca publik → GET ?action=… (tanpa preflight).
   * - Aksi lain → POST {action, args}. Content-Type WAJIB text/plain: application/json
   *   memicu CORS preflight (OPTIONS) yang tidak didukung GAS.
   */
  const AKSI_GET = { getDataPublik: [], getTestimoniPublik: ['offset'], getVideoBanner: ['id'] };
  const RESPON_KOSONG = { success: false, message: 'Respons kosong dari server. Silakan coba lagi.', kode: 'KOSONG' };

  function alamatApi() {
    const url = String((window.MMX_CONFIG && window.MMX_CONFIG.GAS_URL) || '').trim();
    return (/^https:\/\/\S+$/.test(url) && url.indexOf('ISI_') < 0) ? url : '';
  }

  function panggil(nama) {
    const args = Array.prototype.slice.call(arguments, 1);
    const url = alamatApi();
    if (!url) return Promise.reject(errPengguna('Alamat server belum diatur. Isi GAS_URL di file js/config.js dengan URL Web App Apps Script (berakhiran /exec).'));
    let req;
    if (Object.prototype.hasOwnProperty.call(AKSI_GET, nama)) {
      const q = ['action=' + encodeURIComponent(nama)];
      AKSI_GET[nama].forEach(function (k, i) {
        if (args[i] !== undefined && args[i] !== null) q.push(k + '=' + encodeURIComponent(args[i]));
      });
      req = fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + q.join('&'), { method: 'GET' });
    } else {
      req = fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: nama, args: args })
      });
    }
    return req.then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }, function (e) {
      console.error('[Mixmax] API tidak dapat dihubungi. Bila internet normal, periksa deployment Web App: "Who has access" harus Anyone.', e);
      throw e;
    }).then(function (teks) {
      let res;
      try {
        res = JSON.parse(teks);
      } catch (e) {
        console.error('[Mixmax] Respons API bukan JSON. Periksa GAS_URL di js/config.js dan pastikan Kode.gs v1.2 sudah di-deploy (New version).', String(teks).slice(0, 300));
        throw new Error('Respons API bukan JSON');
      }
      return (res && typeof res === 'object') ? res : RESPON_KOSONG;
    });
  }

  function errPengguna(pesan) { const e = new Error(pesan); e.pengguna = true; return e; }
  function pesanGagal(err) {
    const m = String((err && err.message) || err || '');
    if (/network|connection|HTTP 0|timeout|NetworkError|Failed to fetch/i.test(m)) return 'Koneksi terputus. Periksa internet Anda lalu coba lagi.';
    if (/exceeded maximum execution time/i.test(m)) return 'Server terlalu lama merespons. Silakan coba lagi.';
    return 'Terjadi kendala pada sistem. Silakan coba lagi beberapa saat lagi.';
  }
  function pesanDari(err) { return err && err.pengguna ? err.message : pesanGagal(err); }

  function toast(pesan, jenis, aksi) {
    jenis = jenis || 'info';
    const el = document.createElement('div');
    el.className = 'toast toast-' + jenis;
    el.setAttribute('role', jenis === 'err' ? 'alert' : 'status');
    const ikon = { ok: 'bi-check-circle-fill', err: 'bi-exclamation-octagon-fill', info: 'bi-info-circle-fill' }[jenis];
    el.innerHTML = '<i class="bi ' + ikon + '" aria-hidden="true"></i><div class="toast-isi"><p>' + esc(pesan) + '</p>' +
      (aksi ? '<button type="button" class="toast-aksi" data-go="' + esc(aksi.go) + '">' + esc(aksi.label) + '</button>' : '') +
      '</div><button type="button" class="toast-x" aria-label="Tutup notifikasi"><i class="bi bi-x" aria-hidden="true"></i></button>';
    byId('toasts').appendChild(el);
    let selesai = false;
    const hapus = function () {
      if (selesai) return;
      selesai = true;
      el.classList.add('keluar');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    };
    el.querySelector('.toast-x').addEventListener('click', hapus);
    el.addEventListener('click', function (e) { if (e.target.closest('.toast-aksi')) hapus(); });
    setTimeout(hapus, jenis === 'err' ? 7000 : 4500);
  }

  function setTombolProses(btn, proses, teks) {
    if (!btn) return;
    if (proses) {
      if (btn.dataset.asli === undefined) btn.dataset.asli = btn.innerHTML;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.innerHTML = '<span class="spin" aria-hidden="true"></span> <span>' + esc(teks || 'Memproses…') + '</span>';
    } else {
      if (btn.dataset.asli !== undefined) { btn.innerHTML = btn.dataset.asli; delete btn.dataset.asli; }
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  }

  function tampilAlert(id, pesan, htmlTambahan) {
    const el = byId(id);
    if (!el) return;
    el.innerHTML = '<i class="bi bi-exclamation-triangle" aria-hidden="true"></i><div><p>' + esc(pesan) + '</p>' + (htmlTambahan || '') + '</div>';
    el.hidden = false;
  }
  function sembunyikan(id) { const el = byId(id); if (el) el.hidden = true; }

  function setErr(idInput, pesan) {
    const el = byId(idInput);
    const e = byId('e-' + idInput);
    if (e) e.textContent = pesan || '';
    if (el) {
      el.classList.toggle('salah', !!pesan);
      el.setAttribute('aria-invalid', pesan ? 'true' : 'false');
    }
  }
  function fokusSalah(selForm) { const el = $(selForm + ' .inp.salah'); if (el) el.focus(); }

  function htmlKosong(ikon, judul, teks, aksiHtml) {
    return '<div class="empty"><i class="bi ' + ikon + '" aria-hidden="true"></i><h3 class="h4">' + esc(judul) + '</h3>' +
      (teks ? '<p class="small muted">' + esc(teks) + '</p>' : '') + (aksiHtml || '') + '</div>';
  }
  function skeletonKpi(n) {
    let s = '';
    for (let i = 0; i < n; i++) s += '<div class="kpi skeleton" aria-hidden="true"></div>';
    return s;
  }
  function skeletonBaris(kolom, baris) {
    let s = '';
    for (let i = 0; i < baris; i++) {
      s += '<tr aria-hidden="true">';
      for (let j = 0; j < kolom; j++) s += '<td><div class="skeleton" style="height:16px"></div></td>';
      s += '</tr>';
    }
    return s;
  }
  function tampilPemuat(ya, teks) {
    byId('pemuat').hidden = !ya;
    if (teks) byId('pemuatTeks').textContent = teks;
  }

  /**
   * Kecilkan foto di browser: sisi terpanjang ≤ maks px dan ≤ 2 MB.
   * Foto biasa menjadi JPEG berlatar putih; opsi.transparan mempertahankan PNG/WEBP (untuk logo).
   */
  function kompresGambar(file, maks, opsi) {
    opsi = opsi || {};
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) { reject(errPengguna('Format foto harus JPG, PNG, atau WEBP.')); return; }
      if (file.size > 20 * 1024 * 1024) { reject(errPengguna('File terlalu besar. Pilih foto di bawah 20 MB.')); return; }
      const transparan = !!opsi.transparan && file.type !== 'image/jpeg';
      const tipe = transparan ? (file.type === 'image/webp' ? 'image/webp' : 'image/png') : 'image/jpeg';
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        const skala = Math.min(1, maks / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * skala));
        const h = Math.max(1, Math.round(img.naturalHeight * skala));
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = h;
        const cx = cv.getContext('2d');
        if (!transparan) {
          cx.fillStyle = '#FFFFFF';
          cx.fillRect(0, 0, w, h);
        }
        cx.drawImage(img, 0, 0, w, h);
        let mutu = 0.86;
        const coba = function () {
          cv.toBlob(function (blob) {
            if (!blob) { reject(errPengguna('Foto gagal diproses. Pilih foto lain.')); return; }
            if (blob.size > 2 * 1024 * 1024 && tipe !== 'image/png' && mutu > 0.46) { mutu -= 0.1; coba(); return; }
            if (blob.size > 2 * 1024 * 1024) { reject(errPengguna('Foto masih di atas 2 MB setelah dikecilkan. Pilih foto lain.')); return; }
            const mime = /^image\/(jpeg|png|webp)$/.test(blob.type) ? blob.type : tipe;
            const fr = new FileReader();
            fr.onload = function () { resolve({ base64: String(fr.result).split(',')[1], mime: mime, url: URL.createObjectURL(blob) }); };
            fr.onerror = function () { reject(errPengguna('Foto gagal dibaca. Pilih ulang fotonya.')); };
            fr.readAsDataURL(blob);
          }, tipe, mutu);
        };
        coba();
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(errPengguna('File bukan gambar yang valid.')); };
      img.src = url;
    });
  }
  function pilihGambar(file, maks, idErr, opsi) {
    if (idErr && byId(idErr)) byId(idErr).textContent = '';
    return kompresGambar(file, maks, opsi).catch(function (e) {
      if (idErr && byId(idErr)) byId(idErr).textContent = pesanDari(e);
      else toast(pesanDari(e), 'err');
      return null;
    });
  }

  // Video banner: MP4/WEBM/MOV tanpa suara, maks. 5 detik & 15 MB.
  // Cuplikan awal video dijadikan gambar sampul (tampil saat video dimuat / bila video gagal).
  const VIDEO_MAKS_DETIK = 5;
  const VIDEO_MAKS_MB = 15;
  function jenisVideo(file) {
    if (!file) return '';
    if (/^video\/(mp4|webm|quicktime)$/.test(file.type)) return file.type;
    const n = String(file.name || '').toLowerCase();
    if (/\.mp4$/.test(n)) return 'video/mp4';
    if (/\.webm$/.test(n)) return 'video/webm';
    if (/\.mov$/.test(n)) return 'video/quicktime';
    return /^video\//.test(file.type) ? file.type : '';
  }
  function bacaBase64(blob) {
    return new Promise(function (resolve, reject) {
      const fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(',')[1]); };
      fr.onerror = function () { reject(errPengguna('File gagal dibaca. Pilih ulang filenya.')); };
      fr.readAsDataURL(blob);
    });
  }
  function siapkanVideo(file, maks) {
    return new Promise(function (resolve, reject) {
      const mime = jenisVideo(file);
      if (!/^video\/(mp4|webm|quicktime)$/.test(mime)) { reject(errPengguna('Format video harus MP4, WEBM, atau MOV.')); return; }
      if (file.size > VIDEO_MAKS_MB * 1024 * 1024) {
        reject(errPengguna('Video terlalu besar (' + (file.size / 1048576).toFixed(1) + ' MB). Maksimal ' + VIDEO_MAKS_MB + ' MB. Rekam ulang dengan resolusi 1080p atau 720p.'));
        return;
      }
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      let selesai = false;
      const gagal = function (pesan) {
        if (selesai) return;
        selesai = true;
        clearTimeout(batas);
        URL.revokeObjectURL(url);
        reject(errPengguna(pesan));
      };
      const batas = setTimeout(function () { gagal('Video tidak bisa dibaca. Gunakan video MP4 (H.264).'); }, 20000);
      v.onerror = function () { gagal('Video tidak bisa diputar di browser ini. Gunakan video MP4 (H.264).'); };
      v.onloadedmetadata = function () {
        if (!isFinite(v.duration) || v.duration <= 0) { gagal('Durasi video tidak terbaca. Gunakan video MP4 (H.264).'); return; }
        if (v.duration > VIDEO_MAKS_DETIK + 0.5) {
          gagal('Video berdurasi ' + v.duration.toFixed(1).replace('.', ',') + ' detik. Maksimal ' + VIDEO_MAKS_DETIK + ' detik, potong dulu videonya.');
          return;
        }
        v.currentTime = Math.min(0.1, v.duration / 2);
      };
      v.onseeked = function () {
        if (selesai) return;
        if (!v.videoWidth || !v.videoHeight) { gagal('Video tidak bisa diputar di browser ini. Gunakan video MP4 (H.264).'); return; }
        const skala = Math.min(1, maks / Math.max(v.videoWidth, v.videoHeight));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(v.videoWidth * skala));
        cv.height = Math.max(1, Math.round(v.videoHeight * skala));
        cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
        cv.toBlob(function (blob) {
          if (!blob) { gagal('Sampul video gagal dibuat. Pilih video lain.'); return; }
          selesai = true;
          clearTimeout(batas);
          Promise.all([bacaBase64(blob), bacaBase64(file)]).then(function (h) {
            resolve({ base64: h[0], mime: 'image/jpeg', url: URL.createObjectURL(blob), video: { base64: h[1], mime: mime, url: url, durasi: v.duration } });
          }, reject);
        }, 'image/jpeg', 0.82);
      };
      v.src = url;
    });
  }
  /** Banner menerima gambar atau video; video dicek dulu durasi dan ukurannya. */
  function pilihMediaBanner(file) {
    const proses = jenisVideo(file) ? siapkanVideo(file, 1920) : kompresGambar(file, 1920);
    return proses.catch(function (e) { toast(pesanDari(e), 'err'); return null; });
  }

  function unduhPdf(base64, nama) {
    try {
      const biner = atob(base64);
      const arr = new Uint8Array(biner.length);
      for (let i = 0; i < biner.length; i++) arr[i] = biner.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = nama;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.parentNode.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      toast('PDF sedang diunduh. Bila tidak muncul, pakai tombol Cetak lalu pilih “Simpan sebagai PDF”.', 'info');
    } catch (e) {
      toast('PDF gagal diunduh. Pakai tombol Cetak lalu pilih “Simpan sebagai PDF”.', 'err');
    }
  }

  function cetakElemen(el) {
    if (!el) return;
    el.classList.add('target-cetak');
    document.body.classList.add('sedang-cetak');
    const selesai = function () {
      el.classList.remove('target-cetak');
      document.body.classList.remove('sedang-cetak');
      window.removeEventListener('afterprint', selesai);
    };
    window.addEventListener('afterprint', selesai);
    setTimeout(function () {
      try { window.print(); } catch (e) { toast('Browser tidak mengizinkan cetak dari halaman ini.', 'err'); }
      setTimeout(selesai, 1000);
    }, 60);
  }

  // ============================================================
  // 2. STATE
  // ============================================================
  const S = {
    data: null,
    dataTeks: '',
    produkMap: {},
    keranjang: [],
    qty: {},
    qtyErr: {},
    cartErr: {},
    kategori: 'Semua',
    urut: 'terbaru',
    rute: 'beranda',
    nota: null,
    pdf: null,
    testi: { items: [], total: 0, dimuat: false, memuat: false },
    testiSemua: { items: null, teks: '', cacheDibaca: false, dimuat: false, memuat: false },
    tFoto: null,
    tSentuh: {},
    bio: { sentuh: {} },
    mengirim: false,
    kirimTesti: false,
    publikKotor: false,
    sudahRender: {},
    sudahInit: false,
    kunciSampai: 0,
    kunciTimer: null
  };

  const ADM = {
    token: null,
    username: '',
    menu: 'laporan',
    cache: {},
    seq: {},
    terverifikasiPada: 0,
    wajibGanti: false,
    periode: { jenis: 'bulan' },
    periodeUI: 'bulan',
    chart: null,
    detail: null,
    kategori: [],
    psn: { cari: '', status: '', periode: 'bulan', dari: '', sampai: '', halaman: 1 },
    prd: { edit: null, fotoBaru: null, idFotoBaru: '', cari: '', kat: '', status: '' },
    bnr: { slides: [], fotoBaru: {}, idx: 0, kotor: false },
    prf: { misi: [''], stat: [], pilar: [], idFoto: '', fotoBaru: null, idFotoBaru: '', idLogo: '', logoBaru: null, idLogoBaru: '', kotor: false },
    tsa: { cari: '', halaman: 1, opsi: 'A', edit: null, idPesanan: '', idFoto: '', fotoBaru: null, idFotoBaru: '', baris: [], hasil: [], seqCari: 0 },
    kontakKotor: false
  };

  // ============================================================
  // 3. DATA PUBLIK & TAUTAN WHATSAPP
  // ============================================================
  function pasangData(d) {
    S.data = d || {};
    if (!S.data.pengaturan) S.data.pengaturan = {};
    if (!Array.isArray(S.data.banner)) S.data.banner = [];
    if (!Array.isArray(S.data.produk)) S.data.produk = [];
    if (!S.data.testimoni) S.data.testimoni = { items: [], total: 0 };
    const p = S.data.pengaturan;
    ['misi', 'statistik', 'pilar', 'kategori_produk'].forEach(function (k) { if (!Array.isArray(p[k])) p[k] = []; });
    S.produkMap = {};
    S.data.produk.forEach(function (x) { S.produkMap[x.id] = x; });
    if (!S.testi.dimuat) {
      S.testi.items = (S.data.testimoni.items || []).slice();
      S.testi.total = S.data.testimoni.total || 0;
    }
    S.testiSemua.dimuat = false;
    S.sudahRender = {};
  }

  function namaUsaha() { return (S.data && S.data.pengaturan.nama_usaha) || 'Mixmax Souvenir'; }

  /** Logo usaha dari Drive; tanpa logo (atau gagal dimuat) kembali ke kotak "M". */
  function htmlLogo(kelasTambah, urlGanti) {
    const kelas = 'brand-logo' + (kelasTambah ? ' ' + kelasTambah : '');
    const url = urlGanti || gambar(S.data && S.data.pengaturan.id_logo, 200);
    return url ? '<img class="' + kelas + ' brand-logo-img" src="' + esc(url) + '" alt="">'
      : '<span class="' + kelas + '" aria-hidden="true">M</span>';
  }
  function pasangLogo() {
    $$('[data-logo]').forEach(function (el) { el.innerHTML = htmlLogo(); });
  }
  function waLink(pesan, nomor) {
    const no = nomor || (S.data && S.data.pengaturan.no_wa_admin);
    if (!normalWa(no)) return '';
    return 'https://wa.me/' + wa62(normalWa(no)) + '?text=' + encodeURIComponent(pesan);
  }
  function pesanWa(jenis) {
    const nama = namaUsaha();
    if (jenis === 'kunjungan') return 'Halo ' + nama + ', saya ingin mengatur jadwal kunjungan ke workshop.';
    return 'Halo ' + nama + ', saya ingin bertanya tentang produk souvenir.';
  }
  function pesanNota(n) {
    return 'Halo ' + namaUsaha() + ', saya sudah membuat pesanan ' + n.id + ' atas nama ' + n.nama + '. Total ' + rupiah(n.total) + ', DP 50% ' + rupiah(n.dp) + '. Mohon info pembayaran DP dan langkah selanjutnya.';
  }
  function waCustomer(x) {
    return waLink('Halo ' + x.nama + ', kami dari ' + namaUsaha() + ' ingin menindaklanjuti pesanan ' + x.id + ' (total ' + rupiah(x.total) + ', DP 50% ' + rupiah(x.dp) + ').', x.noWa);
  }
  function pasangLink(a, url) {
    if (!a) return;
    if (url) { a.href = url; a.removeAttribute('aria-disabled'); }
    else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); }
  }
  function pasangLinkWa() {
    $$('[data-wa]').forEach(function (a) { pasangLink(a, waLink(pesanWa(a.getAttribute('data-wa')))); });
  }

  function renderShell() {
    const p = S.data.pengaturan;
    const nama = namaUsaha();
    byId('hdrNama').textContent = nama;
    byId('hdrSlogan').textContent = p.slogan || '';
    byId('ftrNama').textContent = nama;
    byId('ftrSlogan').textContent = p.slogan || '';
    byId('admNama').textContent = nama;
    byId('ftrKontak').innerHTML =
      (p.alamat ? '<li><i class="bi bi-geo-alt" aria-hidden="true"></i><span>' + esc(p.alamat) + '</span></li>' : '') +
      (p.no_wa_admin ? '<li><i class="bi bi-whatsapp" aria-hidden="true"></i><span>' + esc(formatWa(p.no_wa_admin)) + '</span></li>' : '') +
      (p.jam_operasional ? '<li><i class="bi bi-clock" aria-hidden="true"></i><span>' + esc(p.jam_operasional) + '</span></li>' : '');
    byId('ftrCopy').textContent = '© ' + new Date().getFullYear() + ' ' + nama + '. Hak cipta dilindungi.';
    document.title = nama;
    pasangLogo();
    pasangLinkWa();
    perbaruiBadgeKeranjang();
  }

  // Salinan data publik terakhir di browser (pengganti data awal yang dulu disisipkan doGet).
  const KUNCI_DATA_PUBLIK = 'mmx_publik_v12';
  function simpanDataPublik(teks) {
    try { localStorage.setItem(KUNCI_DATA_PUBLIK, teks); } catch (e) { /* abaikan */ }
  }
  function bacaDataPublik() {
    try {
      const teks = localStorage.getItem(KUNCI_DATA_PUBLIK);
      const d = teks ? JSON.parse(teks) : null;
      return (d && d.pengaturan) ? { teks: teks, data: d } : null;
    } catch (e) { return null; }
  }

  /** Ambil data publik terbaru; halaman digambar ulang hanya bila isinya berubah. */
  function segarkanPublik() {
    S.publikKotor = false;
    return panggil('getDataPublik').then(function (res) {
      if (!res.success) return;
      const teks = JSON.stringify(res.data);
      simpanDataPublik(teks);
      if (teks === S.dataTeks) return;
      S.dataTeks = teks;
      pasangData(res.data);
      renderShell();
      rekonsiliasiKeranjang();
      if (!byId('vPublik').hidden) renderRute(S.rute);
    }).catch(function () { S.publikKotor = true; });
  }

  // ============================================================
  // 4. ROUTER SPA
  // ============================================================
  const RUTE_PUBLIK = ['beranda', 'produk', 'keranjang', 'nota', 'testimonial', 'tentang', 'login'];

  function tampilkanPublik() {
    byId('vAdmin').hidden = true;
    byId('vPublik').hidden = false;
  }

  function buka(rute) {
    if (rute === 'admin') { bukaAdmin(); return; }
    if (RUTE_PUBLIK.indexOf(rute) < 0) rute = 'beranda';
    if (rute === 'nota' && !S.nota) rute = 'produk';
    tutupMenuMobile();
    tampilkanPublik();
    if (S.publikKotor) segarkanPublik();
    S.rute = rute;
    window.MMX_RUTE = rute;
    window.dispatchEvent(new CustomEvent('mmx-rute', { detail: rute }));
    const halaman = (rute === 'keranjang' || rute === 'nota') ? 'produk' : rute;
    $$('#main > .page').forEach(function (pg) { pg.hidden = pg.id !== 'pg-' + halaman; });
    byId('sub-katalog').hidden = rute !== 'produk';
    byId('sub-keranjang').hidden = rute !== 'keranjang';
    byId('sub-nota').hidden = rute !== 'nota';
    $$('[data-nav]').forEach(function (b) {
      const aktif = b.getAttribute('data-nav') === halaman;
      b.classList.toggle('aktif', aktif);
      if (aktif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    renderRute(rute);
    perbaruiBarKeranjang();
    byId('waFloat').hidden = rute === 'login';
    aturBanner(rute === 'beranda');
    simpanSesi('mmx_rute', rute);
    window.scrollTo(0, 0);
    if (S.sudahInit) {
      const target = rute === 'produk' ? '#sub-katalog' : rute === 'keranjang' ? '#sub-keranjang' : rute === 'nota' ? '#sub-nota' : '#pg-' + rute;
      const h1 = $(target + ' h1');
      if (h1) { try { h1.focus({ preventScroll: true }); } catch (e) { /* abaikan */ } }
    }
  }

  function renderRute(rute) {
    if (rute === 'beranda') {
      if (!S.sudahRender.beranda) renderBeranda();
      if (!S.testiSemua.dimuat) muatSemuaTesti();
    }
    else if (rute === 'produk') renderKatalog();
    else if (rute === 'keranjang') renderKeranjang();
    else if (rute === 'nota') renderNotaPelanggan();
    else if (rute === 'testimonial') {
      renderTestimonialHalaman();
      if (!S.testi.dimuat) muatTesti(true);
    } else if (rute === 'tentang') { if (!S.sudahRender.tentang) renderTentang(); }
    else if (rute === 'login') siapkanLogin();
  }

  function tutupMenuMobile() {
    const nav = byId('navMobile');
    if (!nav.hidden) {
      nav.hidden = true;
      byId('btnBurger').setAttribute('aria-expanded', 'false');
    }
  }

  // ============================================================
  // 5. BERANDA (banner, visi misi, pilar, testimoni)
  // ============================================================
  const BNR = { idx: 0, timer: null, jeda: GERAK_MINIM, hover: false, aktif: false };

  function htmlSlide(b, i, total, urlGanti, videoGanti) {
    const url = urlGanti || gambar(b.idGambar, 1920);
    const vid = videoGanti !== undefined ? videoGanti : '';
    const idVid = videoGanti === undefined && idValid(b.idVideo) ? b.idVideo : '';
    let tombol = '';
    if (b.teksTombol) {
      if (b.jenisTautan === 'URL' && /^https:\/\//.test(b.tautan || '')) {
        tombol = '<a class="btn btn-primary" href="' + esc(b.tautan) + '" target="_blank" rel="noopener">' + esc(b.teksTombol) + ' <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a>';
      } else {
        tombol = '<button type="button" class="btn btn-primary" data-go="' + esc(b.tautan || 'produk') + '">' + esc(b.teksTombol) + ' <i class="bi bi-arrow-right" aria-hidden="true"></i></button>';
      }
    }
    return '<div class="slide' + (i === 0 ? ' aktif' : '') + '" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' dari ' + total + '"' + (i === 0 ? '' : ' aria-hidden="true"') + '>' +
      (url ? '<div class="slide-bg" style="background-image:url(&quot;' + esc(url) + '&quot;)"></div>' : '') +
      ((vid || idVid) ? '<video class="slide-video"' + (vid ? ' src="' + esc(vid) + '"' : ' data-vid="' + esc(idVid) + '"') + (url ? ' poster="' + esc(url) + '"' : '') + ' muted loop playsinline preload="none" disablepictureinpicture aria-hidden="true"></video>' : '') +
      ((url || vid || idVid) ? '<div class="slide-overlay"></div>' : '') +
      '<div class="slide-card"><span class="lbl">Promo &amp; Event</span><h2 class="slide-judul">' + esc(b.judul || 'Judul banner') + '</h2>' +
      (b.subjudul ? '<p class="slide-sub">' + esc(b.subjudul) + '</p>' : '') +
      (tombol ? '<div class="slide-cta">' + tombol + '</div>' : '') + '</div></div>';
  }

  function renderBanner() {
    const daftar = (S.data.banner || []).filter(function (b) { return b && (b.judul || b.idGambar); });
    byId('bannerTrack').innerHTML = daftar.map(function (b, i) { return htmlSlide(b, i, daftar.length); }).join('');
    BNR.idx = 0;
    const banyak = daftar.length > 1;
    $$('#banner .banner-nav').forEach(function (el) { el.hidden = !banyak; });
    byId('banner').hidden = daftar.length === 0;
    rapikanCacheVideo(daftar.map(function (b) { return b.idVideo; }).filter(idValid));
    aturVideoBanner();
  }

  // Video banner: Drive menolak <video> dari situs lain (HTTP 503), jadi isi video diambil
  // lewat API (getVideoBanner, base64), disimpan di Cache Storage browser, lalu diputar dari blob.
  const VIDEO_CACHE = 'mmx-video-banner-v1';
  const VIDEO_URL = {};
  function kunciCacheVideo(id) { return location.origin + '/__video-banner/' + encodeURIComponent(id); }
  function base64KeBlob(b64, mime) {
    const biner = atob(b64);
    const n = biner.length;
    const buf = new Uint8Array(n);
    for (let i = 0; i < n; i++) buf[i] = biner.charCodeAt(i);
    return new Blob([buf], { type: mime || 'video/mp4' });
  }
  function bukaCacheVideo() {
    try { return ('caches' in window) ? caches.open(VIDEO_CACHE).catch(function () { return null; }) : Promise.resolve(null); } catch (e) { return Promise.resolve(null); }
  }
  function muatVideoBanner(id) {
    if (!idValid(id)) return Promise.reject(new Error('ID video tidak valid'));
    if (VIDEO_URL[id]) return VIDEO_URL[id];
    VIDEO_URL[id] = bukaCacheVideo().then(function (c) {
      return (c ? c.match(kunciCacheVideo(id)).catch(function () { return null; }) : Promise.resolve(null)).then(function (r) {
        if (r) return r.blob();
        return panggil('getVideoBanner', id).then(function (res) {
          if (!res.success || !res.data || !res.data.base64) throw new Error(res.message || 'Video kosong');
          const blob = base64KeBlob(res.data.base64, res.data.mime);
          if (c) c.put(kunciCacheVideo(id), new Response(blob, { headers: { 'Content-Type': blob.type } })).catch(function () {});
          return blob;
        });
      });
    }).then(function (blob) {
      if (!blob || !blob.size) throw new Error('Video kosong');
      return URL.createObjectURL(blob);
    });
    VIDEO_URL[id].catch(function (e) {
      delete VIDEO_URL[id];
      console.warn('[Mixmax] Video banner belum bisa dimuat. Pastikan Kode.gs v1.3.1 sudah di-deploy (New version).', e && e.message);
    });
    return VIDEO_URL[id];
  }
  // Hapus video lama dari cache browser bila sudah tidak dipakai banner.
  function rapikanCacheVideo(idDipakai) {
    bukaCacheVideo().then(function (c) {
      if (!c) return;
      return c.keys().then(function (ks) {
        ks.forEach(function (k) {
          const id = decodeURIComponent(String(k.url).split('/__video-banner/')[1] || '');
          if (id && idDipakai.indexOf(id) < 0) c.delete(k).catch(function () {});
        });
      });
    }).catch(function () {});
  }
  function hematData() {
    try { return !!(navigator.connection && navigator.connection.saveData); } catch (e) { return false; }
  }
  /** Pasang sumber video (bila belum) lalu jalankan callback setelah siap. */
  function siapkanSumberVideo(v, lalu) {
    if (v.getAttribute('src') || !v.dataset.vid || v.dataset.muat) { if (lalu) lalu(); return; }
    v.dataset.muat = '1';
    muatVideoBanner(v.dataset.vid).then(function (u) {
      if (!v.isConnected) return;
      v.src = u;
      if (lalu) lalu();
    }, function () {
      delete v.dataset.muat;
    });
  }
  function aturVideoBanner() {
    const vids = $$('#bannerTrack .slide-video');
    if (!vids.length) return;
    const bolehMuat = BNR.aktif && !GERAK_MINIM && !hematData();
    if (bolehMuat) {
      // Muat video slide aktif dulu, lalu slide berikutnya agar siap saat bergeser.
      const slides = $$('#bannerTrack .slide');
      [BNR.idx, BNR.idx + 1].forEach(function (k) {
        const s = slides[(k + slides.length) % slides.length];
        const v = s && s.querySelector('.slide-video');
        if (v && !v.getAttribute('src') && !v.dataset.muat) siapkanSumberVideo(v, aturVideoBanner);
      });
    }
    vids.forEach(function (v) {
      const putar = BNR.aktif && !GERAK_MINIM && !document.hidden && v.parentNode.classList.contains('aktif') && !!v.getAttribute('src');
      if (putar) {
        v.muted = true;
        if (v.preload !== 'auto') v.preload = 'auto';
        if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(function () {}); }
      } else if (!v.paused) {
        v.pause();
        try { v.currentTime = 0; } catch (e) { /* abaikan */ }
      }
    });
  }

  function keSlide(i) {
    const slides = $$('#bannerTrack .slide');
    if (!slides.length) return;
    BNR.idx = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) {
      const a = k === BNR.idx;
      s.classList.toggle('aktif', a);
      if (a) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
    });
    aturVideoBanner();
  }

  function aturBanner(aktif) {
    BNR.aktif = aktif;
    aturVideoBanner();
    clearInterval(BNR.timer);
    BNR.timer = null;
    if (!aktif || BNR.jeda || BNR.hover || document.hidden || $$('#bannerTrack .slide').length < 2) return;
    BNR.timer = setInterval(function () { keSlide(BNR.idx + 1); }, 5000);
  }

  function htmlVisi(p) {
    return '<div class="card visi-card"><div class="kartu-ikon"><i class="bi bi-eye" aria-hidden="true"></i></div><span class="lbl">Visi</span>' +
      '<p class="visi-teks">' + esc(p.visi || '—') + '</p>' +
      (p.tahun_berdiri ? '<p class="xs muted mt-16 mono">Berdiri sejak ' + esc(p.tahun_berdiri) + '</p>' : '') + '</div>';
  }
  function htmlMisi(misi, denganTautan) {
    return '<div class="card-green misi-card"><div class="kartu-ikon hijau"><i class="bi bi-flag" aria-hidden="true"></i></div><span class="lbl lbl-green">Misi</span>' +
      '<ol class="misi-list">' + misi.map(function (m, i) {
        return '<li><span class="nomor">' + dua(i + 1) + '</span><span>' + esc(m) + '</span></li>';
      }).join('') + '</ol>' +
      (denganTautan ? '<button type="button" class="btn btn-ghost btn-sm" data-go="tentang">Selengkapnya tentang kami <i class="bi bi-arrow-right" aria-hidden="true"></i></button>' : '') + '</div>';
  }
  function htmlPilar(pilar) {
    const ikon = ['bi-patch-check', 'bi-stopwatch', 'bi-palette', 'bi-truck'];
    return (pilar || []).filter(function (x) { return x && x.judul; }).map(function (x, i) {
      return '<div class="pilar"><span class="pilar-no">' + dua(i + 1) + '</span><i class="bi ' + ikon[i % 4] + '" aria-hidden="true"></i>' +
        '<h3 class="h4">' + esc(x.judul) + '</h3>' + (x.penjelasan ? '<p class="small muted">' + esc(x.penjelasan) + '</p>' : '') + '</div>';
    }).join('');
  }
  function htmlTesti(t, baru) {
    const foto = gambar(t.idFoto, 200);
    return '<article class="tcard' + (baru ? ' baru' : '') + '">' +
      (baru ? '<span class="badge badge-green tbaru">Baru ditambahkan</span>' : '') +
      '<div class="thead">' +
      (foto ? '<img class="tava" src="' + esc(foto) + '" alt="Foto ' + esc(t.nama) + '" loading="lazy" width="48" height="48" data-inisial="' + esc(inisial(t.nama)) + '">'
        : '<span class="tava tava-inisial" aria-hidden="true">' + esc(inisial(t.nama)) + '</span>') +
      '<div class="tmeta"><strong class="tnama">' + esc(t.nama) + '</strong>' +
      (t.instansi ? '<span class="tinst">' + esc(t.instansi) + '</span>' : '') +
      '<span class="ttgl">' + esc(t.tanggal) + '</span></div></div>' +
      (t.terverifikasi ? '<span class="badge badge-green tverif"><i class="bi bi-patch-check-fill" aria-hidden="true"></i> Pemesan Terverifikasi</span>' : '') +
      '<blockquote class="tisi">“' + esc(t.isi) + '”</blockquote>' +
      (t.produk ? '<span class="tprod"><i class="bi bi-box-seam" aria-hidden="true"></i> ' + esc(t.produk) + '</span>' : '') +
      '</article>';
  }

  function renderBeranda() {
    renderBanner();
    const p = S.data.pengaturan;
    byId('berandaNama').textContent = namaUsaha();
    byId('berandaSlogan').textContent = p.slogan || '';
    byId('berandaVisiMisi').innerHTML = htmlVisi(p) + htmlMisi(p.misi.slice(0, 3), true);
    const pilar = htmlPilar(p.pilar);
    byId('berandaPilar').innerHTML = pilar;
    byId('secPilarBeranda').hidden = !pilar;
    renderTestiBeranda();
    S.sudahRender.beranda = true;
  }

  // Testimoni Beranda: dua baris berjalan berlawanan arah, berisi SEMUA testimoni yang tampil.
  const KUNCI_TESTI_SEMUA = 'mmx_testi_semua_v1';
  const MAKS_TESTI_BERANDA = 120;
  const DETIK_PER_KARTU = 12;

  function htmlBarisTesti(daftar, arah) {
    // Satu grup minimal 6 kartu agar jalur selalu lebih lebar dari layar; grup kedua salinan untuk putaran tanpa sambungan.
    const ulang = Math.max(1, Math.ceil(6 / daftar.length));
    const asli = daftar.map(function (x) { return htmlTesti(x, false); }).join('');
    const salin = daftar.map(function (x) { return htmlTesti(x, false).replace('<article', '<article aria-hidden="true"'); }).join('');
    let grup1 = asli;
    let grup2 = '';
    for (let k = 0; k < ulang; k++) { if (k) grup1 += salin; grup2 += salin; }
    return '<div class="tbaris" data-arah="' + arah + '"><div class="tbaris-jalur" style="--durasi:' + (daftar.length * ulang * DETIK_PER_KARTU) + 's">' +
      '<div class="tbaris-grup">' + grup1 + '</div><div class="tbaris-grup" aria-hidden="true">' + grup2 + '</div></div></div>';
  }

  function renderTestiBeranda() {
    const ts = S.testiSemua;
    if (!ts.cacheDibaca) {
      ts.cacheDibaca = true;
      try {
        const teks = localStorage.getItem(KUNCI_TESTI_SEMUA);
        const d = teks ? JSON.parse(teks) : null;
        if (Array.isArray(d) && d.length) { ts.items = d; ts.teks = teks; }
      } catch (e) { /* abaikan */ }
    }
    const t = ts.items || S.data.testimoni.items || [];
    if (!t.length) {
      byId('berandaTesti').innerHTML = htmlKosong('bi-chat-square-quote', 'Belum ada testimoni', 'Jadilah yang pertama membagikan pengalaman Anda.', '<button type="button" class="btn btn-outline btn-sm" data-go="testimonial">Tulis testimoni</button>');
      return;
    }
    const atas = t.filter(function (x, i) { return i % 2 === 0; });
    const bawah = t.filter(function (x, i) { return i % 2 === 1; });
    byId('berandaTesti').innerHTML = htmlBarisTesti(atas, 'kanan') + (bawah.length ? htmlBarisTesti(bawah, 'kiri') : '');
  }

  /** Ambil semua testimoni tampil (per halaman); Beranda digambar ulang hanya bila isinya berubah. */
  async function muatSemuaTesti() {
    const ts = S.testiSemua;
    if (ts.memuat) return;
    ts.memuat = true;
    try {
      let items = [];
      let total = 1;
      while (items.length < Math.min(total, MAKS_TESTI_BERANDA)) {
        const res = await panggil('getTestimoniPublik', items.length);
        if (!res.success) return;
        total = res.data.total || 0;
        const baru = res.data.items || [];
        if (!baru.length) break;
        items = items.concat(baru);
      }
      const ada = {};
      items = items.filter(function (x) { if (ada[x.id]) return false; ada[x.id] = true; return true; });
      ts.dimuat = true;
      const teks = JSON.stringify(items);
      try { localStorage.setItem(KUNCI_TESTI_SEMUA, teks); } catch (e) { /* abaikan */ }
      if (teks === ts.teks) return;
      ts.teks = teks;
      ts.items = items;
      renderTestiBeranda();
    } catch (e) {
      /* Beranda tetap menampilkan testimoni yang sudah ada. */
    } finally {
      ts.memuat = false;
    }
  }

  // ============================================================
  // 6. KATALOG PRODUK
  // ============================================================
  function cekJumlah(v) {
    const s = String(v === null || v === undefined ? '' : v).trim();
    if (!s) return { ok: false, pesan: 'Isi jumlah pesanan (1–9999 pcs).' };
    if (!/^\d+$/.test(s)) return { ok: false, pesan: 'Jumlah harus angka bulat, tanpa huruf atau koma.' };
    const n = parseInt(s, 10);
    if (n < 1) return { ok: false, pesan: 'Jumlah minimal 1 pcs.' };
    if (n > 9999) return { ok: false, pesan: 'Jumlah maksimal 9999 pcs.' };
    return { ok: true, nilai: n };
  }

  function urutkan(d, u) {
    const a = d.slice();
    if (u === 'murah') a.sort(function (x, y) { return x.harga - y.harga; });
    else if (u === 'mahal') a.sort(function (x, y) { return y.harga - x.harga; });
    else if (u === 'nama') a.sort(function (x, y) { return x.judul.localeCompare(y.judul, 'id'); });
    else a.sort(function (x, y) { return (y.dibuat || 0) - (x.dibuat || 0); });
    return a;
  }

  function htmlProduk(p) {
    const q = S.qty[p.id] !== undefined ? S.qty[p.id] : '1';
    const err = S.qtyErr[p.id] || '';
    const foto = gambar(p.idFoto, 600);
    const judul = esc(p.judul);
    const id = esc(p.id);
    return '<article class="pcard' + (err ? ' salah' : '') + '" data-id="' + id + '">' +
      '<div class="pimg" data-img-box>' + (foto ? '<img src="' + esc(foto) + '" alt="' + judul + '" loading="lazy">' : '') + '<i class="bi bi-image pimg-ph" aria-hidden="true"></i></div>' +
      '<div class="pbody">' +
      '<div class="pmeta"><span class="chip-mono">' + id + '</span><span class="xs muted">' + esc(p.kategori) + '</span></div>' +
      '<h3 class="ptitle">' + judul + '</h3>' +
      '<p class="pprice">' + rupiah(p.harga) + ' <span>/ pcs</span></p>' +
      '<p class="pdesc">' + esc(p.keterangan) + '</p>' +
      '<div class="pqty"><div class="stepper">' +
      '<button type="button" data-aksi="qtyKurang" data-id="' + id + '" aria-label="Kurangi jumlah ' + judul + '"><i class="bi bi-dash" aria-hidden="true"></i></button>' +
      '<input type="text" inputmode="numeric" maxlength="4" value="' + esc(q) + '" data-input="qtyProduk" data-id="' + id + '" aria-label="Jumlah ' + judul + '" aria-invalid="' + (err ? 'true' : 'false') + '" aria-describedby="qe-' + id + '">' +
      '<button type="button" data-aksi="qtyTambah" data-id="' + id + '" aria-label="Tambah jumlah ' + judul + '"><i class="bi bi-plus" aria-hidden="true"></i></button>' +
      '</div><span class="xs muted">1–9999 pcs</span></div>' +
      '<p class="perr" id="qe-' + id + '" role="alert">' + esc(err) + '</p>' +
      '<button type="button" class="btn btn-primary btn-block" data-aksi="masukKeranjang" data-id="' + id + '"' + (err ? ' disabled' : '') + '><i class="bi bi-cart-plus" aria-hidden="true"></i> Tambah ke Keranjang</button>' +
      '</div></article>';
  }

  function renderKatalog() {
    // Kembali ke Produk tanpa perubahan apa pun: kartu lama dipakai lagi, foto tidak berkedip.
    const kunci = [S.kategori, S.urut, JSON.stringify(S.qty), JSON.stringify(S.qtyErr)].join('|');
    if (S.sudahRender.katalog === kunci) return;
    S.sudahRender.katalog = kunci;
    const produk = S.data.produk || [];
    const hitung = { Semua: produk.length };
    const kat = ['Semua'];
    produk.forEach(function (p) {
      if (hitung[p.kategori] === undefined) { hitung[p.kategori] = 0; kat.push(p.kategori); }
      hitung[p.kategori]++;
    });
    const urutan = S.data.pengaturan.kategori_produk || [];
    const posisi = function (k) { const i = urutan.indexOf(k); return i < 0 ? 999 : i; };
    kat.sort(function (a, b) { if (a === 'Semua') return -1; if (b === 'Semua') return 1; return posisi(a) - posisi(b); });
    if (kat.indexOf(S.kategori) < 0) S.kategori = 'Semua';
    byId('tabsKategori').innerHTML = kat.map(function (k) {
      const a = k === S.kategori;
      return '<button type="button" class="tab' + (a ? ' aktif' : '') + '" aria-pressed="' + a + '" data-aksi="pilihKategori" data-kat="' + esc(k) + '">' + esc(k) + ' <span>(' + hitung[k] + ')</span></button>';
    }).join('');
    byId('urutProduk').value = S.urut;
    const daftar = urutkan(produk.filter(function (p) { return S.kategori === 'Semua' || p.kategori === S.kategori; }), S.urut);
    byId('gridProduk').innerHTML = daftar.length ? daftar.map(htmlProduk).join('')
      : htmlKosong('bi-box-seam', 'Belum ada produk', produk.length ? 'Tidak ada produk pada kategori ini.' : 'Produk akan tampil di sini setelah ditambahkan admin.');
  }

  function kartuProduk(id) {
    return $$('#gridProduk .pcard').filter(function (el) { return el.getAttribute('data-id') === id; })[0] || null;
  }
  function tampilErrQty(id, hasil) {
    S.qtyErr[id] = hasil.ok ? '' : hasil.pesan;
    const kartu = kartuProduk(id);
    if (!kartu) return;
    kartu.classList.toggle('salah', !hasil.ok);
    kartu.querySelector('.perr').textContent = S.qtyErr[id];
    kartu.querySelector('input[data-input="qtyProduk"]').setAttribute('aria-invalid', hasil.ok ? 'false' : 'true');
    kartu.querySelector('[data-aksi="masukKeranjang"]').disabled = !hasil.ok;
  }
  function ubahQtyProduk(id, delta) {
    const kartu = kartuProduk(id);
    if (!kartu) return;
    const inp = kartu.querySelector('input[data-input="qtyProduk"]');
    const h = cekJumlah(inp.value);
    let n = h.ok ? h.nilai : 1;
    n = Math.min(9999, Math.max(1, n + delta));
    inp.value = String(n);
    S.qty[id] = inp.value;
    tampilErrQty(id, cekJumlah(inp.value));
  }

  function masukKeranjang(id) {
    const p = S.produkMap[id];
    if (!p) { toast('Produk tidak ditemukan. Muat ulang halaman.', 'err'); return; }
    const h = cekJumlah(S.qty[id] !== undefined ? S.qty[id] : '1');
    if (!h.ok) { tampilErrQty(id, h); return; }
    const ada = cariItem(id);
    const total = (ada ? ada.jumlah : 0) + h.nilai;
    if (total > 9999) {
      tampilErrQty(id, { ok: false, pesan: 'Total di keranjang maksimal 9999 pcs (sudah ada ' + (ada ? ada.jumlah : 0) + ' pcs).' });
      return;
    }
    if (ada) ada.jumlah = total; else S.keranjang.push({ id: id, jumlah: h.nilai });
    simpanKeranjang();
    S.qty[id] = '1';
    const kartu = kartuProduk(id);
    if (kartu) kartu.querySelector('input[data-input="qtyProduk"]').value = '1';
    toast(p.judul + ' (' + h.nilai + ' pcs) masuk ke keranjang.', 'ok', { go: 'keranjang', label: 'Lihat keranjang' });
  }

  // ============================================================
  // 7. KERANJANG & CHECKOUT
  // ============================================================
  function cariItem(id) { return S.keranjang.filter(function (x) { return x.id === id; })[0] || null; }

  function muatKeranjang() {
    const k = bacaLokal('mmx_keranjang_v1', []);
    S.keranjang = Array.isArray(k) ? k.filter(function (x) {
      return x && typeof x.id === 'string' && Number.isInteger(x.jumlah) && x.jumlah >= 1 && x.jumlah <= 9999;
    }) : [];
  }
  function simpanKeranjang() {
    simpanLokal('mmx_keranjang_v1', S.keranjang.map(function (x) { return { id: x.id, jumlah: x.jumlah }; }));
    perbaruiBadgeKeranjang();
    perbaruiBarKeranjang();
  }
  function rekonsiliasiKeranjang() {
    const awal = S.keranjang.length;
    S.keranjang = S.keranjang.filter(function (x) { return !!S.produkMap[x.id]; });
    const hilang = awal - S.keranjang.length;
    if (hilang) {
      simpanKeranjang();
      toast(hilang + ' produk di keranjang sudah tidak tersedia dan dikeluarkan.', 'info');
      if (S.rute === 'keranjang') renderKeranjang();
    } else {
      perbaruiBadgeKeranjang();
      perbaruiBarKeranjang();
    }
  }
  function hitungKeranjang() {
    let pcs = 0;
    let total = 0;
    S.keranjang.forEach(function (x) {
      const p = S.produkMap[x.id];
      if (p) { pcs += x.jumlah; total += x.jumlah * p.harga; }
    });
    return { jenis: S.keranjang.length, pcs: pcs, total: total, dp: Math.ceil(total / 2) };
  }
  function perbaruiBadgeKeranjang() {
    const h = hitungKeranjang();
    byId('jmlKeranjang').textContent = String(h.jenis);
    byId('btnKeranjang').setAttribute('aria-label', 'Buka keranjang, ' + h.jenis + ' produk');
  }
  function perbaruiBarKeranjang() {
    const h = hitungKeranjang();
    const tampil = S.rute === 'produk' && h.jenis > 0 && !byId('vPublik').hidden;
    byId('barKeranjang').hidden = !tampil;
    document.body.classList.toggle('ada-bar', tampil);
    if (tampil) {
      byId('barInfo').textContent = 'Keranjang (' + h.jenis + ' item · ' + h.pcs + ' pcs)';
      byId('barTotal').textContent = rupiah(h.total);
      byId('barDp').textContent = '(DP 50%: ' + rupiah(h.dp) + ')';
    }
  }

  function htmlItemKeranjang(x) {
    const p = S.produkMap[x.id];
    if (!p) return '';
    const foto = gambar(p.idFoto, 200);
    const id = esc(x.id);
    const judul = esc(p.judul);
    const err = S.cartErr[x.id] || '';
    return '<div class="citem" data-id="' + id + '">' +
      '<div class="cthumb" data-img-box>' + (foto ? '<img src="' + esc(foto) + '" alt="" loading="lazy">' : '') + '<i class="bi bi-image pimg-ph" aria-hidden="true"></i></div>' +
      '<div class="cinfo"><span class="chip-mono" style="align-self:flex-start">' + id + '</span><strong>' + judul + '</strong><span class="xs muted clamp2">' + esc(p.keterangan) + '</span></div>' +
      '<div class="charga"><span class="xs muted">' + rupiah(p.harga) + ' / pcs</span><strong class="csub" data-sub="' + id + '">' + rupiah(p.harga * x.jumlah) + '</strong></div>' +
      '<div class="cqty"><div class="stepper stepper-sm">' +
      '<button type="button" data-aksi="cKurang" data-id="' + id + '" aria-label="Kurangi jumlah ' + judul + '"><i class="bi bi-dash" aria-hidden="true"></i></button>' +
      '<input type="text" inputmode="numeric" maxlength="4" value="' + x.jumlah + '" data-input="qtyKeranjang" data-id="' + id + '" aria-label="Jumlah ' + judul + '" aria-invalid="' + (err ? 'true' : 'false') + '">' +
      '<button type="button" data-aksi="cTambah" data-id="' + id + '" aria-label="Tambah jumlah ' + judul + '"><i class="bi bi-plus" aria-hidden="true"></i></button>' +
      '</div><p class="perr" data-cerr="' + id + '" role="alert">' + esc(err) + '</p></div>' +
      '<button type="button" class="ikon-btn hapus" data-aksi="hapusItem" data-id="' + id + '" aria-label="Hapus ' + judul + ' dari keranjang"><i class="bi bi-trash3" aria-hidden="true"></i></button>' +
      '</div>';
  }

  function renderKeranjang() {
    const h = hitungKeranjang();
    byId('keranjangKosong').hidden = h.jenis > 0;
    byId('keranjangIsi').hidden = h.jenis === 0;
    if (h.jenis) byId('daftarKeranjang').innerHTML = S.keranjang.map(htmlItemKeranjang).join('');
    perbaruiTotalKeranjang();
    validasiBio(false);
  }

  function perbaruiTotalKeranjang() {
    const h = hitungKeranjang();
    byId('totalPcs').textContent = String(h.pcs);
    byId('totalBelanja').textContent = rupiah(h.total);
    byId('totalDp').textContent = rupiah(h.dp);
    byId('jmlItemTeks').textContent = h.jenis + ' item · ' + h.pcs + ' pcs';
    byId('chipKeranjang').innerHTML = h.jenis ? '<span class="chip-mono">' + h.jenis + ' item</span><span class="chip-mono">' + h.pcs + ' pcs</span>' : '';
    S.keranjang.forEach(function (x) {
      const p = S.produkMap[x.id];
      const el = $$('#daftarKeranjang [data-sub]').filter(function (e) { return e.getAttribute('data-sub') === x.id; })[0];
      if (el && p) el.textContent = rupiah(p.harga * x.jumlah);
    });
    perbaruiBadgeKeranjang();
  }

  function itemEl(id) {
    return $$('#daftarKeranjang .citem').filter(function (el) { return el.getAttribute('data-id') === id; })[0] || null;
  }
  function setJumlahKeranjang(id, nilaiTeks) {
    const el = itemEl(id);
    const h = cekJumlah(nilaiTeks);
    S.cartErr[id] = h.ok ? '' : h.pesan;
    if (el) {
      el.querySelector('[data-cerr]').textContent = S.cartErr[id];
      el.querySelector('input[data-input="qtyKeranjang"]').setAttribute('aria-invalid', h.ok ? 'false' : 'true');
    }
    if (h.ok) {
      const it = cariItem(id);
      if (it) { it.jumlah = h.nilai; simpanKeranjang(); perbaruiTotalKeranjang(); }
    }
    validasiBio(false);
  }
  function ubahQtyKeranjang(id, delta) {
    const it = cariItem(id);
    const el = itemEl(id);
    if (!it || !el) return;
    const n = Math.min(9999, Math.max(1, it.jumlah + delta));
    el.querySelector('input[data-input="qtyKeranjang"]').value = String(n);
    setJumlahKeranjang(id, String(n));
  }

  const BIO_WAJIB = { nama: 'Nama lengkap', noWa: 'Nomor WhatsApp', alamat: 'Alamat lengkap', provinsi: 'Provinsi', kotaKabupaten: 'Kota/Kabupaten', kecamatan: 'Kecamatan', kelurahanDesa: 'Kelurahan/Desa' };

  function ambilBio() {
    const o = {};
    $$('[data-bio]').forEach(function (el) { o[el.getAttribute('data-bio')] = el.value.trim(); });
    return o;
  }
  function errBio(k, v) {
    if (BIO_WAJIB[k] && !v) return BIO_WAJIB[k] + ' wajib diisi.';
    if (k === 'noWa' && v && !normalWa(v)) return 'Nomor WhatsApp tidak valid. Format: angka 9–15 digit (contoh: 081234567890).';
    return '';
  }
  function validasiBio(tampilSemua) {
    const b = ambilBio();
    const kurang = [];
    $$('[data-bio]').forEach(function (el) {
      const k = el.getAttribute('data-bio');
      const pesan = errBio(k, b[k]);
      if (pesan) kurang.push(BIO_WAJIB[k] || k);
      const tampil = tampilSemua || S.bio.sentuh[k];
      const e = byId('e-' + el.id);
      if (e) e.textContent = tampil ? pesan : '';
      el.classList.toggle('salah', !!(tampil && pesan));
      el.setAttribute('aria-invalid', tampil && pesan ? 'true' : 'false');
    });
    const h = hitungKeranjang();
    const adaErrCart = Object.keys(S.cartErr).some(function (k) { return S.cartErr[k] && cariItem(k); });
    const ok = !kurang.length && h.jenis > 0 && !adaErrCart;
    byId('btnPesan').disabled = !ok || S.mengirim;
    byId('ketPesan').textContent = h.jenis === 0 ? 'Keranjang masih kosong.'
      : adaErrCart ? 'Perbaiki jumlah produk yang belum valid.'
      : kurang.length ? 'Lengkapi: ' + kurang.join(', ') + '.'
      : 'Data lengkap. Periksa kembali sebelum memesan.';
    return ok;
  }

  async function kirimPesanan(e) {
    e.preventDefault();
    if (S.mengirim) return;
    $$('[data-bio]').forEach(function (el) { S.bio.sentuh[el.getAttribute('data-bio')] = true; });
    if (!validasiBio(true)) { fokusSalah('#formBiodata'); return; }
    S.mengirim = true;
    const btn = byId('btnPesan');
    setTombolProses(btn, true, 'Memproses pesanan…');
    sembunyikan('errPesan');
    try {
      const res = await panggil('buatPesanan', {
        biodata: ambilBio(),
        items: S.keranjang.map(function (x) { return { id: x.id, jumlah: x.jumlah }; }),
        hp: byId('bHp').value
      });
      if (res.success) {
        S.nota = res.data.nota;
        S.pdf = res.data.pdfBase64 || null;
        try { simpanSesi('mmx_nota', JSON.stringify({ nota: S.nota, pdf: S.pdf })); } catch (er) { simpanSesi('mmx_nota', JSON.stringify({ nota: S.nota, pdf: null })); }
        S.keranjang = [];
        S.cartErr = {};
        simpanKeranjang();
        byId('formBiodata').reset();
        S.bio.sentuh = {};
        S.mengirim = false;
        setTombolProses(btn, false);
        buka('nota');
        toast('Pesanan ' + S.nota.id + ' berhasil dibuat.', 'ok');
        return;
      }
      if (res.kode === 'PRODUK_TIDAK_TERSEDIA') {
        const ids = (res.data && res.data.ids) || [];
        S.keranjang = S.keranjang.filter(function (x) { return ids.indexOf(x.id) < 0; });
        simpanKeranjang();
        segarkanPublik();
        renderKeranjang();
      }
      tampilErrPesan(res.message);
    } catch (err) {
      tampilErrPesan(pesanGagal(err));
    } finally {
      S.mengirim = false;
      setTombolProses(btn, false);
      validasiBio(false);
    }
  }
  function tampilErrPesan(pesan) {
    const wa = waLink(pesanWa('umum'));
    tampilAlert('errPesan', pesan, '<p class="small mt-8">Silakan coba lagi' + (wa ? ', atau hubungi kami lewat <a href="' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a>.' : '.') + '</p>');
    byId('errPesan').focus();
  }

  // ============================================================
  // 8. NOTA
  // ============================================================
  function dt(label, nilai) { return '<div><dt>' + esc(label) + '</dt><dd>' + esc(nilai || '—') + '</dd></div>'; }

  function htmlNota(n) {
    const u = n.usaha || {};
    const alamat = [n.alamat, n.kelurahanDesa, n.kecamatan, n.kotaKabupaten, n.provinsi].filter(Boolean).join(', ');
    return '<article class="nota-paper" aria-label="Nota pesanan ' + esc(n.id) + '">' +
      '<header class="nota-kop"><div class="nota-brand">' + htmlLogo('brand-logo-lg') + '<div>' +
      '<h2 class="h3">' + esc(u.nama) + '</h2>' + (u.slogan ? '<p class="small muted">' + esc(u.slogan) + '</p>' : '') +
      '<p class="xs mt-8">' + esc(u.alamat) + (u.noWa ? ' · WhatsApp ' + esc(formatWa(u.noWa)) : '') + '</p></div></div>' +
      '<div class="nota-cap"><span class="lbl">Nota Pesanan</span><strong class="mono">' + esc(n.id) + '</strong></div></header>' +
      '<div class="nota-meta"><div><span class="lbl-abu">No. pesanan</span><strong class="mono">' + esc(n.id) + '</strong></div>' +
      '<div><span class="lbl-abu">Tanggal</span><strong>' + esc(n.tanggal) + '</strong></div>' +
      '<div><span class="lbl-abu">Langkah berikutnya</span><strong>Bayar DP 50% via WhatsApp</strong></div></div>' +
      '<section class="nota-blok"><h3 class="h4"><i class="bi bi-person-vcard" aria-hidden="true"></i> Data Pemesan &amp; Tujuan Pengiriman</h3>' +
      '<div class="nota-data"><dl>' + dt('Nama pemesan', n.nama) + (n.instansi ? dt('Instansi / perusahaan', n.instansi) : '') + dt('No. WhatsApp', n.noWa) + '</dl>' +
      '<dl>' + dt('Alamat pengiriman', alamat) + (n.catatan ? dt('Catatan pesanan', n.catatan) : '') + '</dl></div></section>' +
      '<section class="nota-blok"><h3 class="h4"><i class="bi bi-list-check" aria-hidden="true"></i> Rincian Item Pesanan</h3>' +
      '<div class="tbl-wrap"><table class="tbl nota-tbl"><thead><tr><th>No</th><th>Produk</th><th class="r">Harga satuan</th><th class="r">Jumlah</th><th class="r">Subtotal</th></tr></thead><tbody>' +
      (n.items || []).map(function (x, i) {
        return '<tr><td>' + (i + 1) + '</td><td><strong>' + esc(x.nama) + '</strong>' + (x.kategori ? '<span class="xs muted d-block">' + esc(x.kategori) + '</span>' : '') + '</td>' +
          '<td class="r mono nowrap">' + rupiah(x.harga) + '</td><td class="r mono nowrap">' + x.jumlah + ' pcs</td><td class="r mono nowrap">' + rupiah(x.subtotal) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="nota-total"><div><span>Total item</span><strong class="mono">' + n.totalPcs + ' pcs</strong></div>' +
      '<div><span>Ongkos kirim</span><span class="badge badge-gray">Dihitung via WhatsApp</span></div>' +
      '<div class="besar"><span>Total pesanan <small class="xs muted">(belum termasuk ongkir)</small></span><strong>' + rupiah(n.total) + '</strong></div></div></section>' +
      '<div class="nota-dp"><div><h3 class="h4"><i class="bi bi-cash-coin" aria-hidden="true"></i> Wajib DP 50% sebagai tanda jadi</h3>' +
      '<p class="small">Pesanan diproses (produksi/grafir) setelah DP 50% ditransfer dan bukti transfer dikonfirmasi lewat WhatsApp.</p></div>' +
      '<div class="nota-dp-nilai"><span class="lbl-abu">Nominal DP 50%</span><strong>' + rupiah(n.dp) + '</strong></div></div>' +
      '<div class="nota-perhatian"><h3 class="h4"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i> Perhatian</h3><ol>' +
      '<li>Harga belum termasuk ongkir/ekspedisi.</li>' +
      '<li>DP 50% sebagai tanda jadi; produksi dimulai setelah DP diterima.</li>' +
      '<li>Simpan nomor pesanan <strong class="mono">' + esc(n.id) + '</strong> untuk konfirmasi dengan admin.</li></ol></div>' +
      '<footer class="nota-kaki xs muted"><span>' + esc(u.nama) + ' · Dokumen dibuat otomatis</span><span>' + esc(n.tanggal) + '</span></footer>' +
      '</article>';
  }

  function renderNotaPelanggan() {
    const n = S.nota;
    if (!n) return;
    byId('notaKertas').innerHTML = htmlNota(n);
    byId('notaSuksesId').textContent = n.id;
    pasangLink(byId('waNota'), waLink(pesanNota(n)));
    byId('btnUnduhNota').hidden = !S.pdf;
    byId('notaPdfKet').hidden = !!S.pdf;
  }

  // ============================================================
  // 9. TESTIMONIAL (publik)
  // ============================================================
  function renderTestimonialHalaman() {
    const sel = byId('tProduk');
    const nilai = sel.value;
    sel.innerHTML = '<option value="">— Pilih produk (opsional) —</option>' +
      (S.data.produk || []).map(function (p) { return '<option value="' + esc(p.judul) + '">' + esc(p.judul) + '</option>'; }).join('');
    sel.value = nilai;
    if (sel.value !== nilai) sel.value = '';
    renderDaftarTesti();
  }
  function renderDaftarTesti() {
    const t = S.testi;
    byId('jmlTesti').textContent = t.total + ' ulasan';
    byId('gridTesti').innerHTML = t.items.length ? t.items.map(function (x) { return htmlTesti(x, !!x._baru); }).join('')
      : htmlKosong('bi-chat-square-quote', 'Belum ada testimoni', 'Bagikan pengalaman Anda lewat form di atas.');
    byId('btnMuatTesti').hidden = t.items.length >= t.total;
  }
  async function muatTesti(dariAwal) {
    if (S.testi.memuat) return;
    S.testi.memuat = true;
    const btn = byId('btnMuatTesti');
    if (!dariAwal) setTombolProses(btn, true, 'Memuat…');
    try {
      const res = await panggil('getTestimoniPublik', dariAwal ? 0 : S.testi.items.length);
      if (!res.success) { toast(res.message, 'err'); return; }
      const baru = res.data.items || [];
      if (dariAwal) {
        const lokal = S.testi.items.filter(function (x) { return x._baru; });
        const ada = {};
        baru.forEach(function (x) { ada[x.id] = true; });
        S.testi.items = lokal.filter(function (x) { return !ada[x.id]; }).concat(baru.map(function (x) {
          const l = lokal.filter(function (y) { return y.id === x.id; })[0];
          return l || x;
        }));
      } else {
        const ada = {};
        S.testi.items.forEach(function (x) { ada[x.id] = true; });
        baru.forEach(function (x) { if (!ada[x.id]) S.testi.items.push(x); });
      }
      S.testi.total = res.data.total;
      S.testi.dimuat = true;
      if (S.rute === 'testimonial') renderDaftarTesti();
    } catch (e) {
      toast(pesanGagal(e), 'err');
    } finally {
      S.testi.memuat = false;
      if (!dariAwal) setTombolProses(btn, false);
      if (S.rute === 'testimonial') byId('btnMuatTesti').hidden = S.testi.items.length >= S.testi.total;
    }
  }

  function validasiTesti(tampil) {
    const nama = byId('tNama').value.trim();
    const wa = byId('tWa').value.trim();
    const isi = byId('tIsi').value.trim();
    const err = {
      tNama: nama ? '' : 'Nama wajib diisi.',
      tWa: !wa ? 'Nomor WhatsApp wajib diisi.' : (normalWa(wa) ? '' : 'Nomor WhatsApp tidak valid. Format: angka 9–15 digit (contoh: 081234567890).'),
      tIsi: !isi ? 'Isi testimoni wajib diisi.' : (isi.length < 10 ? 'Isi testimoni minimal 10 karakter.' : '')
    };
    Object.keys(err).forEach(function (id) { setErr(id, (tampil || S.tSentuh[id]) ? err[id] : ''); });
    return !err.tNama && !err.tWa && !err.tIsi;
  }
  function hitungIsiTesti() { byId('tIsiHitung').textContent = byId('tIsi').value.length + '/500'; }
  async function prosesFotoTesti(file) {
    const h = await pilihGambar(file, 1280, 'e-tFoto');
    if (!h) return;
    if (S.tFoto && S.tFoto.url) URL.revokeObjectURL(S.tFoto.url);
    S.tFoto = h;
    byId('tFotoImg').src = h.url;
    byId('tFotoPrev').hidden = false;
  }
  function hapusFotoTesti() {
    if (S.tFoto && S.tFoto.url) URL.revokeObjectURL(S.tFoto.url);
    S.tFoto = null;
    byId('tFoto').value = '';
    byId('tFotoPrev').hidden = true;
    byId('tFotoImg').removeAttribute('src');
    byId('e-tFoto').textContent = '';
  }
  async function kirimTesti(e) {
    e.preventDefault();
    if (S.kirimTesti) return;
    S.tSentuh = { tNama: true, tWa: true, tIsi: true };
    if (!validasiTesti(true)) { fokusSalah('#formTesti'); return; }
    S.kirimTesti = true;
    const btn = byId('btnTesti');
    setTombolProses(btn, true, 'Mengirim…');
    sembunyikan('errTesti');
    try {
      const res = await panggil('kirimTestimoni', {
        nama: byId('tNama').value.trim(),
        noWa: byId('tWa').value.trim(),
        instansi: byId('tInstansi').value.trim(),
        produk: byId('tProduk').value,
        isi: byId('tIsi').value.trim(),
        foto: S.tFoto ? { base64: S.tFoto.base64, mime: S.tFoto.mime } : null,
        hp: byId('tHp').value
      });
      if (!res.success) { tampilAlert('errTesti', res.message); return; }
      const kartu = res.data;
      kartu._baru = true;
      S.testi.items.unshift(kartu);
      S.testi.total += 1;
      S.data.testimoni.items = [kartu].concat(S.data.testimoni.items || []).slice(0, 6);
      S.data.testimoni.total = (S.data.testimoni.total || 0) + 1;
      if (S.testiSemua.items) S.testiSemua.items = [kartu].concat(S.testiSemua.items);
      S.sudahRender.beranda = false;
      byId('formTesti').reset();
      hapusFotoTesti();
      S.tSentuh = {};
      validasiTesti(false);
      hitungIsiTesti();
      renderDaftarTesti();
      toast(res.message, 'ok');
      byId('gridTesti').scrollIntoView({ behavior: GERAK_MINIM ? 'auto' : 'smooth', block: 'start' });
    } catch (err) {
      tampilAlert('errTesti', pesanGagal(err));
    } finally {
      S.kirimTesti = false;
      setTombolProses(btn, false);
    }
  }

  // ============================================================
  // 10. TENTANG KAMI
  // ============================================================
  function urlEmbedPeta(p) {
    if (p.embed_google_map && p.embed_google_map.indexOf('https://www.google.com/maps/embed') === 0) return p.embed_google_map;
    return p.alamat ? 'https://maps.google.com/maps?q=' + encodeURIComponent(p.alamat) + '&output=embed' : '';
  }
  function urlLinkPeta(p) {
    if (p.link_google_map) return p.link_google_map;
    return p.alamat ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.alamat) : '';
  }
  function renderTentang() {
    const p = S.data.pengaturan;
    const nama = namaUsaha();
    byId('tentangNama').textContent = nama;
    byId('tentangSlogan').textContent = p.slogan || '';
    const th = byId('tentangTahun');
    th.hidden = !p.tahun_berdiri;
    th.textContent = 'Berdiri sejak ' + (p.tahun_berdiri || '');
    const paragraf = String(p.tentang_kami || '').split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    byId('tentangTeks').innerHTML = paragraf.length ? paragraf.map(function (x) { return '<p>' + esc(x).replace(/\n/g, '<br>') + '</p>'; }).join('')
      : '<p class="muted">Profil usaha belum diisi.</p>';
    byId('tentangStat').innerHTML = p.statistik.map(function (s) {
      return '<div class="stat"><span class="lbl-abu">' + esc(s.label) + '</span><strong>' + esc(s.nilai) + '</strong></div>';
    }).join('');
    const foto = gambar(p.id_foto_tentang, 1000);
    const kotak = byId('tentangFoto');
    kotak.classList.remove('img-gagal');
    kotak.innerHTML = foto ? '<img src="' + esc(foto) + '" alt="Foto workshop ' + esc(nama) + '" loading="lazy">'
      : '<div class="foto-ph"><i class="bi bi-building" aria-hidden="true"></i><span class="xs">Foto workshop belum diunggah</span></div>';
    byId('tentangVisiMisi').innerHTML = htmlVisi(p) + htmlMisi(p.misi, false);
    byId('tentangPilar').innerHTML = htmlPilar(p.pilar);
    byId('tentangKontak').innerHTML =
      '<li><i class="bi bi-geo-alt" aria-hidden="true"></i><div><span class="lbl-abu">Alamat workshop</span><span>' + esc(p.alamat || '—') + '</span></div></li>' +
      '<li><i class="bi bi-clock" aria-hidden="true"></i><div><span class="lbl-abu">Jam operasional</span><span>' + esc(p.jam_operasional || '—') + '</span></div></li>' +
      '<li><i class="bi bi-whatsapp" aria-hidden="true"></i><div><span class="lbl-abu">WhatsApp resmi</span><span class="mono">' + esc(p.no_wa_admin ? formatWa(p.no_wa_admin) : '—') + '</span></div></li>';
    const embed = urlEmbedPeta(p);
    byId('tentangPeta').innerHTML = embed
      ? '<iframe src="' + esc(embed) + '" title="Peta lokasi workshop ' + esc(nama) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>'
      : '<div class="foto-ph"><i class="bi bi-map" aria-hidden="true"></i><span class="xs">Lokasi belum diatur.</span></div>';
    const bp = byId('btnPetaPenuh');
    const link = urlLinkPeta(p);
    pasangLink(bp, link);
    bp.hidden = !link;
    S.sudahRender.tentang = true;
  }

  // ============================================================
  // 11. LOGIN ADMIN
  // ============================================================
  function siapkanLogin() {
    sembunyikan('lErr');
    if (S.kunciSampai > Date.now()) tampilKunci(); else byId('lKunci').hidden = true;
    setTimeout(function () { if (S.rute === 'login') byId('lUser').focus(); }, 60);
  }
  function tampilKunci() {
    sembunyikan('lErr');
    byId('lKunci').hidden = false;
    byId('btnLogin').disabled = true;
    clearInterval(S.kunciTimer);
    const tik = function () {
      const s = Math.max(0, Math.ceil((S.kunciSampai - Date.now()) / 1000));
      byId('lHitung').textContent = Math.floor(s / 60) + ' menit ' + dua(s % 60) + ' detik';
      if (s <= 0) {
        clearInterval(S.kunciTimer);
        byId('lKunci').hidden = true;
        byId('btnLogin').disabled = false;
      }
    };
    tik();
    S.kunciTimer = setInterval(tik, 1000);
  }
  async function kirimLogin(e) {
    e.preventDefault();
    const u = byId('lUser').value.trim();
    const p = byId('lPass').value;
    if (!u || !p) { tampilAlert('lErr', 'Isi username dan password.'); return; }
    const btn = byId('btnLogin');
    setTombolProses(btn, true, 'Memeriksa…');
    sembunyikan('lErr');
    try {
      const res = await panggil('loginAdmin', u, p);
      if (res.success) {
        ADM.token = res.data.token;
        ADM.username = res.data.username;
        ADM.wajibGanti = !!res.data.wajibGanti;
        ADM.terverifikasiPada = Date.now();
        simpanSesi('mmx_token', ADM.token);
        simpanSesi('mmx_user', ADM.username);
        byId('lPass').value = '';
        masukAdmin(ADM.wajibGanti ? 'pengaturan' : 'laporan');
        toast('Selamat datang, ' + ADM.username + '.', 'ok');
      } else if (res.kode === 'TERKUNCI') {
        S.kunciSampai = Date.now() + ((res.data && res.data.sisaDetik) || 900) * 1000;
      } else {
        tampilAlert('lErr', res.message);
      }
    } catch (err) {
      tampilAlert('lErr', pesanGagal(err));
    } finally {
      setTombolProses(btn, false);
      if (S.kunciSampai > Date.now()) tampilKunci();
    }
  }

  // ============================================================
  // 12. PANEL ADMIN — inti (sesi, navigasi, cache)
  // ============================================================
  const JUDUL_ADM = { laporan: 'Laporan & Analitik', pesanan: 'Pesanan Masuk', produk: 'Kelola Produk', banner: 'Banner Promo', profil: 'Profil & Visi Misi', testimoni: 'Testimoni', pengaturan: 'Pengaturan' };

  async function adminPanggil(nama) {
    const args = Array.prototype.slice.call(arguments, 1);
    const res = await panggil.apply(null, [nama, ADM.token].concat(args));
    if (res && res.kode === 'SESI_HABIS') {
      sesiHabis();
      const e = new Error('Sesi berakhir.');
      e.sesiHabis = true;
      throw e;
    }
    ADM.terverifikasiPada = Date.now();
    return res;
  }

  function hapusSesiAdmin() {
    ADM.token = null;
    ADM.cache = {};
    ADM.terverifikasiPada = 0;
    simpanSesi('mmx_token', null);
    simpanSesi('mmx_user', null);
    if (ADM.chart) { ADM.chart.destroy(); ADM.chart = null; }
  }
  function sesiHabis() {
    tutupKonfirm(false);
    tutupModal();
    hapusSesiAdmin();
    buka('login');
    toast('Sesi berakhir, silakan masuk lagi.', 'info');
  }

  async function bukaAdmin() {
    const token = ADM.token || bacaSesi('mmx_token');
    if (!token) { buka('login'); return; }
    ADM.token = token;
    ADM.username = ADM.username || bacaSesi('mmx_user') || 'admin';
    if (Date.now() - ADM.terverifikasiPada < 5 * 60 * 1000) { masukAdmin(ADM.menu); return; }
    tampilPemuat(true, 'Memeriksa sesi admin…');
    try {
      const res = await panggil('cekSesiAdmin', token);
      if (res.success) {
        ADM.username = res.data.username;
        ADM.wajibGanti = !!res.data.wajibGanti;
        ADM.terverifikasiPada = Date.now();
        masukAdmin(bacaSesi('mmx_adm') || ADM.menu || 'laporan');
      } else {
        hapusSesiAdmin();
        buka('login');
        if (res.kode === 'SESI_HABIS') toast('Sesi berakhir, silakan masuk lagi.', 'info');
      }
    } catch (e) {
      toast(pesanGagal(e), 'err');
      buka('login');
    } finally {
      tampilPemuat(false);
    }
  }

  function masukAdmin(menu) {
    tutupMenuMobile();
    byId('vPublik').hidden = true;
    byId('vAdmin').hidden = false;
    document.body.classList.remove('ada-bar');
    aturBanner(false);
    byId('admUser').textContent = ADM.username;
    byId('admPeringatan').hidden = !ADM.wajibGanti;
    simpanSesi('mmx_rute', 'admin');
    bukaMenuAdmin(menu);
    prefetchAdmin();
  }

  function bukaMenuAdmin(menu) {
    if (!JUDUL_ADM[menu]) menu = 'laporan';
    if (byId('vAdmin').hidden) { ADM.menu = menu; bukaAdmin(); return; }
    ADM.menu = menu;
    simpanSesi('mmx_adm', menu);
    $$('.adm-page').forEach(function (s) { s.hidden = s.id !== 'adm-' + menu; });
    $$('.adm-nav [data-adm]').forEach(function (b) {
      const a = b.getAttribute('data-adm') === menu;
      b.classList.toggle('aktif', a);
      if (a) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    byId('admJudul').textContent = JUDUL_ADM[menu];
    byId('admSide').classList.remove('buka');
    window.scrollTo(0, 0);
    MUAT_ADM[menu]();
    const h1 = $('#adm-' + menu + ' h1');
    if (h1) { try { h1.focus({ preventScroll: true }); } catch (e) { /* abaikan */ } }
  }

  function sinkron(teks) { byId('admSinkron').textContent = teks || ''; }
  function hapusCacheAdm(awalan) {
    Object.keys(ADM.cache).forEach(function (k) { if (k.indexOf(awalan) === 0) delete ADM.cache[k]; });
  }

  /** Tampilkan data cache (instan), lalu ambil data terbaru di latar. */
  async function muatAdm(kunci, fnServer, args, render) {
    if (ADM.cache[kunci]) render(ADM.cache[kunci], true);
    else render(null, false);
    const seq = (ADM.seq[kunci] || 0) + 1;
    ADM.seq[kunci] = seq;
    sinkron('Memperbarui data…');
    try {
      const res = await adminPanggil.apply(null, [fnServer].concat(args || []));
      if (seq !== ADM.seq[kunci]) return;
      if (res.success) {
        const sama = !!ADM.cache[kunci] && JSON.stringify(ADM.cache[kunci]) === JSON.stringify(res.data);
        ADM.cache[kunci] = res.data;
        if (!sama) render(res.data, false);
        sinkron('Diperbarui ' + jamSekarang());
      } else {
        toast(res.message, 'err');
        sinkron('');
      }
    } catch (e) {
      if (!e.sesiHabis) { toast(pesanGagal(e), 'err'); sinkron('Gagal memperbarui'); }
    }
  }

  function prefetchAdmin() {
    setTimeout(function () {
      if (!ADM.token) return;
      const kunciPsn = 'psn_' + JSON.stringify(ADM.psn);
      const isi = function (kunci, fn, args) {
        if (ADM.cache[kunci]) return;
        adminPanggil.apply(null, [fn].concat(args)).then(function (res) {
          if (res && res.success && !ADM.cache[kunci]) ADM.cache[kunci] = res.data;
        }).catch(function () { /* abaikan */ });
      };
      isi(kunciLaporan(), 'adminLaporan', [ADM.periode, false]);
      isi(kunciPsn, 'adminPesanan', [ADM.psn]);
      isi('produk', 'adminProduk', []);
      isi('banner', 'adminBanner', []);
      isi('pengaturan', 'adminPengaturan', []);
      isi(kunciTsa(), 'adminTestimoni', [{ cari: ADM.tsa.cari, halaman: ADM.tsa.halaman }]);
      muatChartJs().catch(function () { /* grafik mencoba lagi saat dibuka */ });
    }, 1200);
  }

  const MUAT_ADM = {
    laporan: function () { muatLaporan(false); },
    pesanan: function () { muatPesanan(); },
    produk: function () { muatProduk(); },
    banner: function () { muatBanner(); },
    profil: function () { muatProfil(); },
    testimoni: function () { muatTsa(); },
    pengaturan: function () { muatPengaturan(); }
  };

  function badgeStatus(s) {
    if (s === 'DP Diterima') return '<span class="badge badge-green"><i class="bi bi-check2-circle" aria-hidden="true"></i> DP Diterima</span>';
    if (s === 'Batal') return '<span class="badge badge-red"><i class="bi bi-x-circle" aria-hidden="true"></i> Batal</span>';
    return '<span class="badge badge-blue"><i class="bi bi-hourglass-split" aria-hidden="true"></i> Baru</span>';
  }
  function badgeEmail(x) {
    if (x.statusEmail === 'Terkirim') return '<span class="badge badge-green"><i class="bi bi-envelope-check" aria-hidden="true"></i> Terkirim</span>';
    if (x.emailMacet) return '<span class="badge badge-red"><i class="bi bi-envelope-exclamation" aria-hidden="true"></i> ' + (x.statusEmail === 'Gagal' ? 'Gagal' : 'Tertunda') + '</span>';
    return '<span class="badge badge-gray"><i class="bi bi-envelope" aria-hidden="true"></i> Proses</span>';
  }
  function badgeTampil(s) {
    return s === 'Tampil' ? '<span class="badge badge-green"><i class="bi bi-eye" aria-hidden="true"></i> Tampil</span>'
      : '<span class="badge badge-gray"><i class="bi bi-eye-slash" aria-hidden="true"></i> Disembunyikan</span>';
  }
  function kpiSederhana(label, nilai, sub, ikon) {
    return '<div class="kpi"><div class="kpi-lbl"><span>' + esc(label) + '</span><i class="bi ' + ikon + '" aria-hidden="true"></i></div>' +
      '<div class="kpi-val">' + esc(nilai) + '</div><div class="kpi-sub">' + esc(sub) + '</div></div>';
  }
  function htmlPager(hal, jml, total, aksi) {
    const tombol = function (n, label, aria, aktif, mati) {
      return '<button type="button" data-aksi="' + aksi + '" data-hal="' + n + '"' + (aktif ? ' class="aktif" aria-current="page"' : '') + (mati ? ' disabled' : '') + ' aria-label="' + esc(aria) + '">' + label + '</button>';
    };
    const isi = [tombol(hal - 1, '<i class="bi bi-chevron-left" aria-hidden="true"></i>', 'Halaman sebelumnya', false, hal <= 1)];
    for (let i = Math.max(1, hal - 2); i <= Math.min(jml, hal + 2); i++) isi.push(tombol(i, String(i), 'Halaman ' + i, i === hal, false));
    isi.push(tombol(hal + 1, '<i class="bi bi-chevron-right" aria-hidden="true"></i>', 'Halaman berikutnya', false, hal >= jml));
    return '<span class="xs muted">Halaman ' + hal + ' dari ' + jml + ' · ' + total + ' data</span><div class="pager-tombol">' + isi.join('') + '</div>';
  }
  function setFotoKotak(idKotak, url, ikon) {
    const k = byId(idKotak);
    k.classList.remove('img-gagal');
    k.innerHTML = (url ? '<img src="' + esc(url) + '" alt="Pratinjau foto">' : '') + '<i class="bi ' + ikon + ' pimg-ph" aria-hidden="true"></i>';
  }

  // ============================================================
  // 13. ADMIN — LAPORAN
  // ============================================================
  function kunciLaporan() {
    const p = ADM.periode;
    return 'lap_' + p.jenis + (p.jenis === 'rentang' ? '_' + p.dari + '_' + p.sampai : '');
  }
  function aturTombolPeriode() {
    const aktif = ADM.periodeUI || ADM.periode.jenis;
    $$('#adm-laporan [data-periode]').forEach(function (b) {
      const a = b.getAttribute('data-periode') === aktif;
      b.classList.toggle('aktif', a);
      b.setAttribute('aria-pressed', a ? 'true' : 'false');
    });
    byId('lapRentang').hidden = aktif !== 'rentang';
  }
  function muatLaporan(segarkan) {
    aturTombolPeriode();
    if (segarkan) delete ADM.cache[kunciLaporan()];
    muatAdm(kunciLaporan(), 'adminLaporan', [ADM.periode, !!segarkan], renderLaporan);
  }
  function teksUbah(u) {
    if (u === null || u === undefined) return '<span class="kpi-ubah tetap">Belum ada pembanding</span>';
    if (u === 0) return '<span class="kpi-ubah tetap"><i class="bi bi-dash" aria-hidden="true"></i> Sama dengan periode lalu</span>';
    const naik = u > 0;
    return '<span class="kpi-ubah ' + (naik ? 'naik' : 'turun') + '"><i class="bi ' + (naik ? 'bi-arrow-up-right' : 'bi-arrow-down-right') + '" aria-hidden="true"></i> ' + (naik ? '+' : '−') + desimal(Math.abs(u)) + '% vs periode lalu</span>';
  }
  function kpiLaporan(label, nilai, ubah, ikon, sub) {
    return '<div class="kpi"><div class="kpi-lbl"><span>' + esc(label) + '</span><i class="bi ' + ikon + '" aria-hidden="true"></i></div>' +
      '<div class="kpi-val">' + esc(nilai) + '</div>' + (sub ? '<div class="kpi-sub">' + esc(sub) + '</div>' : teksUbah(ubah)) + '</div>';
  }
  function rankList(list, kosong) {
    if (!list.length) return '<li class="small muted">' + esc(kosong) + '</li>';
    return list.map(function (x, i) {
      return '<li><span class="rank-no">#' + (i + 1) + '</span><div class="rank-isi"><div class="between"><strong>' + esc(x.nama) + '</strong>' +
        '<span class="xs mono nowrap">' + x.pcs + ' pcs · ' + esc(singkatRp(x.nilai)) + '</span></div>' +
        '<div class="bar" role="img" aria-label="' + esc(desimal(x.persen)) + '% dari total pcs"><span style="width:' + Math.min(100, Math.max(0, Number(x.persen) || 0)) + '%"></span></div>' +
        '<span class="xs muted">' + esc(desimal(x.persen)) + '% dari total pcs</span></div></li>';
    }).join('');
  }
  function barisPsnRingkas(x) {
    return '<tr><td class="mono nowrap"><strong>' + esc(x.id) + '</strong></td><td class="small nowrap">' + esc(x.tanggal) + '</td>' +
      '<td><strong>' + esc(x.nama) + '</strong>' + (x.instansi ? '<span class="xs muted d-block">' + esc(x.instansi) + '</span>' : '') + '</td>' +
      '<td class="small">' + esc(x.ringkasItem) + '</td><td class="r mono nowrap">' + rupiah(x.total) + '</td><td>' + badgeStatus(x.status) + '</td>' +
      '<td><button type="button" class="btn btn-outline btn-sm" data-aksi="detailPesanan" data-id="' + esc(x.id) + '">Lihat nota</button></td></tr>';
  }
  function renderLaporan(d) {
    if (!d) {
      byId('lapKpi').innerHTML = skeletonKpi(5);
      byId('lapTerbaru').innerHTML = skeletonBaris(7, 3);
      return;
    }
    byId('lapLabel').textContent = d.label;
    const k = d.kartu;
    byId('lapKpi').innerHTML =
      kpiLaporan('Total penjualan', rupiah(k.total.nilai), k.total.ubah, 'bi-cash-stack') +
      kpiLaporan('Jumlah pesanan', k.jumlah.nilai + ' pesanan', k.jumlah.ubah, 'bi-receipt') +
      kpiLaporan('DP diterima', rupiah(k.dpDiterima.nilai), k.dpDiterima.ubah, 'bi-wallet2') +
      kpiLaporan('Menunggu DP', k.menungguJumlah.nilai + ' pesanan', null, 'bi-hourglass-split', rupiah(k.menungguNilai.nilai) + ' belum DP') +
      kpiLaporan('Rata-rata nilai pesanan', rupiah(k.rataRata.nilai), k.rataRata.ubah, 'bi-bar-chart');
    byId('lapTerlaris').innerHTML = rankList(d.terlaris, 'Belum ada penjualan pada periode ini.');
    byId('lapKurang').innerHTML = rankList(d.kurangLaku, 'Belum ada produk yang tampil.');
    byId('lapCatatan').innerHTML = d.catatan.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');
    byId('lapTerbaru').innerHTML = d.terbaru.length ? d.terbaru.map(barisPsnRingkas).join('') : '<tr><td colspan="7" class="kosong-sel">Belum ada pesanan.</td></tr>';
    gambarGrafik(d.tren, d.jenis);
  }

  let janjiChart = null;
  function muatChartJs() {
    if (window.Chart) return Promise.resolve();
    if (janjiChart) return janjiChart;
    janjiChart = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';
      s.onload = function () { resolve(); };
      s.onerror = function () { janjiChart = null; reject(new Error('Grafik gagal dimuat.')); };
      document.head.appendChild(s);
    });
    return janjiChart;
  }
  async function gambarGrafik(tren, jenis) {
    try { await muatChartJs(); } catch (e) { byId('grafikKet').textContent = 'Grafik gagal dimuat. Periksa koneksi internet lalu klik Segarkan Data.'; return; }
    if (ADM.menu !== 'laporan' || byId('vAdmin').hidden) return;
    const ctx = byId('grafikTren');
    if (ADM.chart) { ADM.chart.destroy(); ADM.chart = null; }
    ADM.chart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: tren.label,
        datasets: [
          { type: 'bar', label: 'Penjualan (Rp)', data: tren.penjualan, backgroundColor: 'rgba(28, 25, 23, 0.85)', borderRadius: 6, yAxisID: 'y', order: 2 },
          { type: 'line', label: 'Jumlah pesanan', data: tren.pesanan, borderColor: '#8C6B3E', backgroundColor: '#8C6B3E', borderWidth: 2, tension: 0.3, pointRadius: 3, yAxisID: 'y1', order: 1 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: GERAK_MINIM ? false : { duration: 250 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', align: 'end', labels: { boxWidth: 12, color: '#1C1917', font: { family: 'Hanken Grotesk' } } },
          tooltip: { callbacks: { label: function (c) { return c.dataset.yAxisID === 'y' ? ' Penjualan: ' + rupiah(c.parsed.y) : ' Pesanan: ' + c.parsed.y; } } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { color: '#716A65', callback: function (v) { return singkatRp(v); } }, grid: { color: '#F1EDE7' } },
          y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { precision: 0, color: '#716A65' } },
          x: { grid: { display: false }, ticks: { color: '#716A65', maxRotation: 0, autoSkip: true } }
        }
      }
    });
    const satuan = jenis === 'hari' ? 'per jam' : (tren.label.length > 0 && /^\d/.test(tren.label[0]) ? 'per hari' : 'per bulan');
    byId('grafikKet').textContent = 'Batang gelap: penjualan (Rp). Garis bronze: jumlah pesanan. Dikelompokkan ' + satuan + '.';
  }

  // ============================================================
  // 14. ADMIN — PESANAN
  // ============================================================
  function kunciPesanan() { return 'psn_' + JSON.stringify(ADM.psn); }
  function muatPesanan() { muatAdm(kunciPesanan(), 'adminPesanan', [ADM.psn], renderPesanan); }
  function barisPesananAdm(x) {
    const wa = waCustomer(x);
    return '<tr data-aksi="detailPesanan" data-id="' + esc(x.id) + '">' +
      '<td class="mono nowrap"><strong>' + esc(x.id) + '</strong></td><td class="small" style="min-width:96px">' + esc(x.tanggal) + '</td>' +
      '<td><strong>' + esc(x.nama) + '</strong>' + (x.instansi ? '<span class="xs muted d-block">' + esc(x.instansi) + '</span>' : '') + '</td>' +
      '<td class="nowrap">' + (wa ? '<a class="link-wa" href="' + esc(wa) + '" target="_blank" rel="noopener" aria-label="Chat WhatsApp ' + esc(x.nama) + '"><i class="bi bi-whatsapp" aria-hidden="true"></i> ' + esc(formatWa(x.noWa)) + '</a>' : esc(x.noWa)) + '</td>' +
      '<td class="small" style="min-width:150px">' + esc(x.ringkasItem) + '</td>' +
      '<td class="r mono nowrap">' + rupiah(x.total) + '</td><td class="r mono nowrap hijau">' + rupiah(x.dp) + '</td>' +
      '<td>' + badgeStatus(x.status) + '</td><td>' + badgeEmail(x) + '</td>' +
      '<td><button type="button" class="btn btn-outline btn-sm" data-aksi="detailPesanan" data-id="' + esc(x.id) + '">Detail</button></td></tr>';
  }
  function renderPesanan(d) {
    if (!d) {
      byId('psnKpi').innerHTML = skeletonKpi(3);
      byId('psnBody').innerHTML = skeletonBaris(10, 6);
      byId('psnPager').innerHTML = '';
      return;
    }
    const r = d.ringkasan;
    byId('psnKpi').innerHTML =
      kpiSederhana('Total pesanan', r.total + ' pesanan', d.label, 'bi-receipt') +
      kpiSederhana('Menunggu DP', r.menunggu + ' pesanan', rupiah(r.nilaiMenunggu) + ' belum DP', 'bi-hourglass-split') +
      kpiSederhana('Email nota gagal', r.emailGagal + ' pesanan', r.emailGagal ? 'Buka detail untuk kirim ulang' : 'Semua email terkirim', 'bi-envelope-exclamation');
    byId('psnBody').innerHTML = d.baris.length ? d.baris.map(barisPesananAdm).join('') : '<tr><td colspan="10" class="kosong-sel">Tidak ada pesanan untuk filter ini.</td></tr>';
    byId('psnPager').innerHTML = htmlPager(d.halaman, d.jumlahHalaman, d.total, 'psnHal');
  }
  function aturFilterPesananUI() {
    byId('psnCari').value = ADM.psn.cari;
    byId('psnStatus').value = ADM.psn.status;
    byId('psnPeriode').value = ADM.psn.periode;
    byId('psnRentang').hidden = ADM.psn.periode !== 'rentang';
    byId('psnDari').value = ADM.psn.dari;
    byId('psnSampai').value = ADM.psn.sampai;
  }

  function htmlDetailPesanan(d) {
    const n = d.nota;
    const wa = waCustomer({ id: n.id, nama: n.nama, total: n.total, dp: n.dp, noWa: n.noWa });
    return '<div class="detail-atas">' +
      '<div class="detail-status"><label for="dStatus">Status DP</label><select id="dStatus" class="inp inp-sm">' +
      STATUS_PESANAN.map(function (s) { return '<option value="' + esc(s) + '"' + (s === d.status ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
      '</select><button type="button" class="btn btn-primary btn-sm" id="btnStatus" data-aksi="simpanStatus" data-id="' + esc(n.id) + '">Simpan status</button>' +
      '<span class="xs muted">Diubah: ' + esc(d.statusDiubah || '—') + '</span></div>' +
      '<div class="detail-aksi">' + (wa ? '<a class="btn btn-wa btn-sm" href="' + esc(wa) + '" target="_blank" rel="noopener"><i class="bi bi-whatsapp" aria-hidden="true"></i> Chat WA customer</a>' : '') +
      '<button type="button" class="btn btn-outline btn-sm" id="btnUnduhAdm" data-aksi="unduhNotaAdm" data-id="' + esc(n.id) + '"><i class="bi bi-download" aria-hidden="true"></i> <span>Unduh PDF</span></button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-aksi="cetakNotaAdm"><i class="bi bi-printer" aria-hidden="true"></i> Cetak</button></div></div>' +
      (d.emailMacet ? '<div class="alert alert-err"><i class="bi bi-envelope-exclamation" aria-hidden="true"></i><div><p><strong>Email nota ' + (d.statusEmail === 'Gagal' ? 'gagal terkirim' : 'belum terkirim') + '.</strong> ' + esc(d.infoEmail) + '</p>' +
        '<button type="button" class="btn btn-outline btn-sm mt-8" id="btnKirimUlang" data-aksi="kirimUlangEmail" data-id="' + esc(n.id) + '"><i class="bi bi-send" aria-hidden="true"></i> <span>Kirim ulang email</span></button></div></div>'
        : '<p class="xs muted" style="margin-bottom:12px"><i class="bi bi-envelope-check" aria-hidden="true"></i> Email nota ke admin: ' + esc(d.statusEmail || '—') + '</p>') +
      '<div id="detailNota">' + htmlNota(n) + '</div>';
  }
  async function bukaDetailPesanan(id) {
    bukaModal('Detail Pesanan ' + id, '<div class="memuat-blok"><span class="spin" aria-hidden="true"></span> Memuat detail pesanan…</div>', 'besar');
    try {
      const res = await adminPanggil('adminDetailPesanan', id);
      if (byId('modal').hidden) return;
      if (!res.success) { isiModal('<div class="alert alert-err"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i><p>' + esc(res.message) + '</p></div>'); return; }
      ADM.detail = res.data;
      isiModal(htmlDetailPesanan(res.data));
    } catch (e) {
      if (!e.sesiHabis) isiModal('<div class="alert alert-err"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i><p>' + esc(pesanGagal(e)) + '</p></div>');
    }
  }
  async function simpanStatusPesanan(el) {
    const id = el.getAttribute('data-id');
    const status = byId('dStatus').value;
    if (ADM.detail && ADM.detail.status === status) { toast('Status tidak berubah.', 'info'); return; }
    if (status === 'Batal') {
      const ya = await konfirmasi('Batalkan pesanan ' + id + '? Pesanan berstatus Batal tidak dihitung di laporan. Status bisa dikembalikan ke Baru bila perlu.', { judul: 'Batalkan pesanan', ya: 'Ya, batalkan' });
      if (!ya) return;
    } else if (ADM.detail && ADM.detail.status === 'Batal') {
      const ya = await konfirmasi('Kembalikan pesanan ' + id + ' dari Batal menjadi ' + status + '?', { judul: 'Ubah status', ya: 'Ya, ubah', bahaya: false });
      if (!ya) return;
    }
    const btn = byId('btnStatus');
    setTombolProses(btn, true, 'Menyimpan…');
    try {
      const res = await adminPanggil('adminUbahStatusPesanan', id, status);
      if (!res.success) { toast(res.message, 'err'); return; }
      if (ADM.detail) { ADM.detail.status = status; ADM.detail.statusDiubah = res.data.statusDiubah; }
      toast(res.message, 'ok');
      hapusCacheAdm('psn_');
      hapusCacheAdm('lap_');
      if (ADM.menu === 'pesanan') muatPesanan();
      if (ADM.menu === 'laporan') muatLaporan(false);
      if (!byId('modal').hidden && ADM.detail) isiModal(htmlDetailPesanan(ADM.detail));
    } catch (e) {
      if (!e.sesiHabis) toast(pesanGagal(e), 'err');
    } finally {
      setTombolProses(byId('btnStatus'), false);
    }
  }
  async function unduhNotaAdmin(el) {
    const id = el.getAttribute('data-id');
    setTombolProses(el, true, 'Menyiapkan…');
    try {
      const res = await adminPanggil('adminUnduhNota', id);
      if (!res.success) { toast(res.message, 'err'); return; }
      unduhPdf(res.data.base64, res.data.nama);
    } catch (e) {
      if (!e.sesiHabis) toast(pesanGagal(e), 'err');
    } finally {
      setTombolProses(el, false);
    }
  }
  async function kirimUlangEmail(el) {
    const id = el.getAttribute('data-id');
    setTombolProses(el, true, 'Mengirim…');
    try {
      const res = await adminPanggil('adminKirimUlangEmail', id);
      if (!res.success) { toast(res.message, 'err'); return; }
      toast(res.message, 'ok');
      hapusCacheAdm('psn_');
      if (ADM.menu === 'pesanan') muatPesanan();
      bukaDetailPesanan(id);
    } catch (e) {
      if (!e.sesiHabis) toast(pesanGagal(e), 'err');
    } finally {
      if (document.body.contains(el)) setTombolProses(el, false);
    }
  }

  // ============================================================
  // 15. ADMIN — PRODUK & KATEGORI
  // ============================================================
  function muatProduk() { muatAdm('produk', 'adminProduk', [], renderProdukAdm); }
  function isiSelectKategori() {
    const opsi = ADM.kategori.map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + '</option>'; }).join('');
    const f = byId('prdKat');
    f.innerHTML = '<option value="">Semua kategori</option>' + opsi;
    f.value = ADM.prd.kat;
    if (f.value !== ADM.prd.kat) ADM.prd.kat = '';
    const sel = byId('pfKategori');
    const v = sel.value;
    sel.innerHTML = '<option value="">— Pilih kategori —</option>' + opsi;
    sel.value = v;
  }
  function barisProdukAdm(p) {
    const foto = gambar(p.idFoto, 120);
    return '<tr><td><div class="thumb" data-img-box>' + (foto ? '<img src="' + esc(foto) + '" alt="" loading="lazy">' : '') + '<i class="bi bi-image pimg-ph" aria-hidden="true"></i></div></td>' +
      '<td><strong>' + esc(p.judul) + '</strong><span class="xs mono muted d-block">' + esc(p.id) + '</span></td>' +
      '<td class="small">' + esc(p.kategori) + '</td><td class="r mono nowrap">' + rupiah(p.harga) + '</td><td>' + badgeTampil(p.status) + '</td>' +
      '<td class="nowrap"><button type="button" class="btn btn-outline btn-sm" data-aksi="editProduk" data-id="' + esc(p.id) + '" aria-label="Ubah ' + esc(p.judul) + '"><i class="bi bi-pencil" aria-hidden="true"></i></button> ' +
      '<button type="button" class="btn btn-outline btn-sm btn-bahaya" data-aksi="hapusProduk" data-id="' + esc(p.id) + '" aria-label="Hapus ' + esc(p.judul) + '"><i class="bi bi-trash3" aria-hidden="true"></i></button></td></tr>';
  }
  function renderProdukAdm(d) {
    if (!d) {
      byId('prdKpi').innerHTML = skeletonKpi(3);
      byId('prdBody').innerHTML = skeletonBaris(6, 5);
      return;
    }
    ADM.kategori = d.kategori || [];
    isiSelectKategori();
    const semua = d.produk || [];
    const tampil = semua.filter(function (p) { return p.status === 'Tampil'; }).length;
    const harga = semua.map(function (p) { return p.harga; });
    byId('prdKpi').innerHTML =
      kpiSederhana('Total produk', semua.length + ' produk', tampil + ' tampil · ' + (semua.length - tampil) + ' disembunyikan', 'bi-box-seam') +
      kpiSederhana('Rentang harga', harga.length ? rupiah(Math.min.apply(null, harga)) + ' – ' + rupiah(Math.max.apply(null, harga)) : '—', 'Harga per pcs', 'bi-tag') +
      kpiSederhana('Kategori', ADM.kategori.length + ' kategori', ADM.kategori.slice(0, 3).join(', ') + (ADM.kategori.length > 3 ? ', …' : ''), 'bi-tags');
    const f = ADM.prd;
    const daftar = semua.filter(function (p) {
      return (!f.cari || p.judul.toLowerCase().indexOf(f.cari) >= 0 || p.id.toLowerCase().indexOf(f.cari) >= 0) &&
        (!f.kat || p.kategori === f.kat) && (!f.status || p.status === f.status);
    });
    byId('prdBody').innerHTML = daftar.length ? daftar.map(barisProdukAdm).join('')
      : '<tr><td colspan="6" class="kosong-sel">' + (semua.length ? 'Tidak ada produk untuk filter ini.' : 'Belum ada produk. Klik “Tambah Produk”.') + '</td></tr>';
  }
  function hitungKet() { byId('pfKetHitung').textContent = byId('pfKet').value.length + '/500'; }
  function produkBaru() {
    ADM.prd.edit = null;
    ADM.prd.fotoBaru = null;
    ADM.prd.idFotoBaru = '';
    byId('formProduk').reset();
    byId('pfKode').value = '';
    byId('prdFormJudul').innerHTML = '<i class="bi bi-plus-square" aria-hidden="true"></i> Tambah Produk';
    setFotoKotak('pfFotoPrev', '', 'bi-image');
    ['pfJudul', 'pfKategori', 'pfHarga', 'pfKet'].forEach(function (id) { setErr(id, ''); });
    byId('e-pfFoto').textContent = '';
    sembunyikan('errProduk');
    hitungKet();
  }
  function editProduk(id) {
    const d = ADM.cache.produk;
    const p = d && d.produk.filter(function (x) { return x.id === id; })[0];
    if (!p) { toast('Produk tidak ditemukan. Klik Segarkan.', 'err'); return; }
    produkBaru();
    ADM.prd.edit = p;
    byId('pfKode').value = p.id;
    byId('pfJudul').value = p.judul;
    byId('pfKategori').value = p.kategori;
    byId('pfHarga').value = String(p.harga);
    byId('pfKet').value = p.keterangan;
    $$('input[name="pfStatus"]').forEach(function (r) { r.checked = r.value === p.status; });
    setFotoKotak('pfFotoPrev', gambar(p.idFoto, 300), 'bi-image');
    byId('prdFormJudul').innerHTML = '<i class="bi bi-pencil-square" aria-hidden="true"></i> Ubah Produk';
    hitungKet();
    if (window.innerWidth < 1180) byId('formProduk').scrollIntoView({ behavior: GERAK_MINIM ? 'auto' : 'smooth', block: 'start' });
    byId('pfJudul').focus({ preventScroll: true });
  }
  async function simpanProduk(e) {
    e.preventDefault();
    const judul = byId('pfJudul').value.trim();
    const kategori = byId('pfKategori').value;
    const hargaS = byId('pfHarga').value.trim().replace(/\./g, '');
    const ket = byId('pfKet').value.trim();
    const pilih = $('input[name="pfStatus"]:checked');
    const status = pilih ? pilih.value : 'Tampil';
    const err = {
      pfJudul: judul ? '' : 'Judul produk wajib diisi.',
      pfKategori: kategori ? '' : 'Pilih kategori.',
      pfHarga: !/^\d+$/.test(hargaS) ? 'Harga harus angka bulat, contoh 35000.' : ((Number(hargaS) < 1 || Number(hargaS) > 100000000) ? 'Harga harus 1–100.000.000.' : ''),
      pfKet: ket ? '' : 'Keterangan wajib diisi.'
    };
    Object.keys(err).forEach(function (k) { setErr(k, err[k]); });
    const edit = ADM.prd.edit;
    const adaFoto = !!ADM.prd.fotoBaru || !!ADM.prd.idFotoBaru || !!(edit && edit.idFoto);
    byId('e-pfFoto').textContent = adaFoto ? '' : 'Foto produk wajib diunggah.';
    if (Object.keys(err).some(function (k) { return err[k]; }) || !adaFoto) { fokusSalah('#formProduk'); return; }
    const btn = byId('btnSimpanProduk');
    setTombolProses(btn, true, 'Menyimpan…');
    sembunyikan('errProduk');
    try {
      let idFoto = edit ? edit.idFoto : '';
      if (ADM.prd.fotoBaru && !ADM.prd.idFotoBaru) {
        setTombolProses(btn, true, 'Mengunggah foto…');
        const up = await adminPanggil('adminUnggahGambar', 'produk', ADM.prd.fotoBaru.base64, ADM.prd.fotoBaru.mime);
        if (!up.success) throw errPengguna(up.message);
        ADM.prd.idFotoBaru = up.data.id;
      }
      if (ADM.prd.idFotoBaru) idFoto = ADM.prd.idFotoBaru;
      setTombolProses(btn, true, 'Menyimpan…');
      const res = await adminPanggil('adminSimpanProduk', { id: edit ? edit.id : '', judul: judul, kategori: kategori, harga: Number(hargaS), keterangan: ket, status: status, idFoto: idFoto });
      if (!res.success) { tampilAlert('errProduk', res.message); return; }
      toast(res.message, 'ok');
      S.publikKotor = true;
      produkBaru();
      muatProduk();
    } catch (er) {
      if (!er.sesiHabis) tampilAlert('errProduk', pesanDari(er));
    } finally {
      setTombolProses(btn, false);
    }
  }
  async function hapusProduk(id) {
    const d = ADM.cache.produk;
    const p = d && d.produk.filter(function (x) { return x.id === id; })[0];
    const nama = p ? p.judul : id;
    const ya = await konfirmasi('Hapus produk “' + nama + '” secara permanen? Baris di Spreadsheet dihapus dan fotonya dipindah ke Sampah Drive. Pesanan lama tidak terpengaruh. Bila hanya ingin berhenti menjual sementara, pilih status “Disembunyikan”.', { judul: 'Hapus produk', ya: 'Hapus permanen' });
    if (!ya) return;
    try {
      const res = await adminPanggil('adminHapusProduk', id);
      if (!res.success) { toast(res.message, 'err'); return; }
      toast(res.message, 'ok');
      if (ADM.prd.edit && ADM.prd.edit.id === id) produkBaru();
      S.publikKotor = true;
      muatProduk();
    } catch (e) {
      if (!e.sesiHabis) toast(pesanGagal(e), 'err');
    }
  }

  function barisKat(nilai, lama) {
    return '<div class="kat-baris"' + (lama !== null ? ' data-lama="' + esc(lama) + '"' : '') + '>' +
      '<input class="inp" maxlength="40" value="' + esc(nilai) + '" aria-label="Nama kategori">' +
      '<button type="button" class="ikon-btn hapus" data-aksi="katHapus" aria-label="Hapus kategori"><i class="bi bi-trash3" aria-hidden="true"></i></button></div>';
  }
  function bukaKelolaKategori() {
    const kat = ADM.kategori || [];
    bukaModal('Kelola Kategori Produk',
      '<p class="small muted">Ubah nama, hapus, atau tambah kategori. Mengubah nama ikut mengubah kategori produk terkait. Kategori yang masih dipakai produk tidak bisa dihapus.</p>' +
      '<div id="katDaftar" class="mt-16">' + kat.map(function (k) { return barisKat(k, k); }).join('') + '</div>' +
      '<button type="button" class="btn btn-outline btn-sm" data-aksi="katTambah"><i class="bi bi-plus-lg" aria-hidden="true"></i> Tambah kategori</button>' +
      '<div id="errKat" class="alert alert-err mt-16" hidden role="alert"></div>' +
      '<div class="row-end"><button type="button" class="btn btn-ghost" data-aksi="tutupModal">Batal</button><button type="button" class="btn btn-primary" id="btnKatSimpan" data-aksi="katSimpan"><i class="bi bi-save" aria-hidden="true"></i> <span>Simpan Kategori</span></button></div>');
  }
  async function simpanKategori() {
    const daftar = [];
    const ganti = {};
    let ganda = false;
    $$('#katDaftar .kat-baris').forEach(function (row) {
      const v = row.querySelector('input').value.trim();
      const lama = row.getAttribute('data-lama');
      if (!v) return;
      if (daftar.indexOf(v) >= 0) ganda = true; else daftar.push(v);
      if (lama !== null && lama !== v) ganti[lama] = v;
    });
    if (!daftar.length) { tampilAlert('errKat', 'Minimal harus ada 1 kategori.'); return; }
    if (ganda) { tampilAlert('errKat', 'Ada nama kategori yang sama. Gunakan nama yang berbeda.'); return; }
    const btn = byId('btnKatSimpan');
    setTombolProses(btn, true, 'Menyimpan…');
    try {
      const res = await adminPanggil('adminSimpanKategori', daftar, ganti);
      if (!res.success) { tampilAlert('errKat', res.message); return; }
      ADM.kategori = res.data.kategori;
      tutupModal();
      toast(res.message, 'ok');
      S.publikKotor = true;
      delete ADM.cache.produk;
      muatProduk();
    } catch (e) {
      if (!e.sesiHabis) tampilAlert('errKat', pesanGagal(e));
    } finally {
      if (byId('btnKatSimpan')) setTombolProses(byId('btnKatSimpan'), false);
    }
  }

  // ============================================================
  // 16. ADMIN — BANNER
  // ============================================================
  function muatBanner() {
    muatAdm('banner', 'adminBanner', [], function (d) {
      if (!d) {
        if (!ADM.bnr.slides.length) byId('bnrSlot').innerHTML = '<div class="card panel"><div class="skeleton" style="height:200px"></div></div>';
        return;
      }
      if (ADM.bnr.kotor) return;
      ADM.bnr.slides = d.map(function (x) { return Object.assign({}, x); });
      ADM.bnr.fotoBaru = {};
      renderSlotBanner();
      renderPreviewBanner();
    });
  }
  function fieldBnr(i, k, label, nilai, maks, wajib, ph) {
    const id = 'bn' + k + i;
    return '<div class="field"><label for="' + id + '">' + esc(label) + (wajib ? ' <span class="req">wajib</span>' : '') + '</label>' +
      '<input id="' + id + '" class="inp" maxlength="' + maks + '" value="' + esc(nilai) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') +
      ' data-input="bnr" data-slot="' + i + '" data-k="' + k + '"></div>';
  }
  function renderSlotBanner() {
    byId('bnrSlot').innerHTML = ADM.bnr.slides.map(function (s, i) {
      const n = i + 1;
      const f = ADM.bnr.fotoBaru[i];
      const prev = f ? f.url : gambar(s.idGambar, 600);
      const adaVideo = f ? !!f.video : idValid(s.idVideo);
      const media = (f && f.video)
        ? '<video src="' + esc(f.video.url) + '" muted loop autoplay playsinline aria-label="Video slide ' + n + '"></video>'
        : (prev ? '<img src="' + esc(prev) + '" alt="Gambar slide ' + n + '">' : '');
      const tujuan = s.jenisTautan === 'URL'
        ? '<input id="bntautan' + i + '" class="inp" maxlength="500" value="' + esc(s.tautan) + '" placeholder="https://…" data-input="bnr" data-slot="' + i + '" data-k="tautan">'
        : '<select id="bntautan' + i + '" class="inp" data-input="bnr" data-slot="' + i + '" data-k="tautan">' + HALAMAN_OPSI.map(function (h) {
          return '<option value="' + h[0] + '"' + (s.tautan === h[0] ? ' selected' : '') + '>' + h[1] + '</option>';
        }).join('') + '</select>';
      return '<div class="card panel slot">' +
        '<div class="panel-head"><h2 class="h4"><span class="nomor">' + dua(n) + '</span> Slide ' + n +
          (f ? ' <span class="badge badge-blue">' + (f.video ? 'Video baru' : 'Gambar baru') + '</span>' : (adaVideo ? ' <span class="badge badge-green"><i class="bi bi-camera-video" aria-hidden="true"></i> Video</span>' : '')) + '</h2>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-aksi="bnrLihat" data-slot="' + i + '"><i class="bi bi-eye" aria-hidden="true"></i> Pratinjau</button></div>' +
        '<div class="slot-grid"><div><div class="slot-img" data-img-box>' + media + '<i class="bi bi-image pimg-ph" aria-hidden="true"></i></div>' +
        '<button type="button" class="btn btn-outline btn-sm btn-block mt-8" data-aksi="pilihFile" data-target="bnFile' + i + '"><i class="bi bi-upload" aria-hidden="true"></i> Ganti gambar/video</button>' +
        (adaVideo ? '<button type="button" class="btn btn-ghost btn-sm btn-block mt-8" data-aksi="bnrHapusVideo" data-slot="' + i + '"><i class="bi bi-trash3" aria-hidden="true"></i> Hapus video</button>' : '') +
        '<p class="xs muted mt-8">Video MP4 tanpa suara, maks. ' + VIDEO_MAKS_DETIK + ' detik &amp; ' + VIDEO_MAKS_MB + ' MB.</p>' +
        '<input type="file" id="bnFile' + i + '" class="bn-file" data-slot="' + i + '" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" hidden></div>' +
        '<div>' + fieldBnr(i, 'judul', 'Judul', s.judul, 80, true) + fieldBnr(i, 'subjudul', 'Subjudul', s.subjudul, 160, false) +
        fieldBnr(i, 'teksTombol', 'Teks tombol (kosong = tanpa tombol)', s.teksTombol, 30, false, 'Contoh: Lihat Produk') +
        '<div class="g2 g-tight"><div class="field"><label for="bnjenisTautan' + i + '">Jenis tautan</label><select id="bnjenisTautan' + i + '" class="inp" data-input="bnr" data-slot="' + i + '" data-k="jenisTautan">' +
        '<option value="Halaman"' + (s.jenisTautan !== 'URL' ? ' selected' : '') + '>Halaman website</option><option value="URL"' + (s.jenisTautan === 'URL' ? ' selected' : '') + '>URL luar (tab baru)</option></select></div>' +
        '<div class="field"><label for="bntautan' + i + '">Tujuan tombol</label>' + tujuan + '</div></div></div></div></div>';
    }).join('');
  }
  function renderPreviewBanner() {
    const i = ADM.bnr.idx;
    const s = ADM.bnr.slides[i];
    if (!s) { byId('bnrPreview').innerHTML = ''; return; }
    const f = ADM.bnr.fotoBaru[i];
    byId('bnrPreview').innerHTML = '<div class="banner-track">' + htmlSlide(s, 0, 3, f ? f.url : '', f ? (f.video ? f.video.url : '') : undefined) + '</div>';
    const v = byId('bnrPreview').querySelector('video');
    if (v) {
      siapkanSumberVideo(v, function () {
        if (!v.isConnected) return;
        v.muted = true; v.preload = 'auto';
        const p = v.play(); if (p && p.catch) p.catch(function () {});
      });
    }
    byId('bnrPrevKet').textContent = 'Slide ' + (i + 1) + ' dari 3';
  }
  async function simpanBanner() {
    const slides = ADM.bnr.slides;
    if (slides.length !== 3) return;
    sembunyikan('errBanner');
    for (let i = 0; i < 3; i++) {
      const s = slides[i];
      if (!String(s.judul || '').trim()) { tampilAlert('errBanner', 'Slide ' + (i + 1) + ': judul wajib diisi.'); byId('bnjudul' + i).focus(); return; }
      if (s.jenisTautan === 'URL' && !/^https:\/\/\S+$/.test(String(s.tautan || '').trim())) { tampilAlert('errBanner', 'Slide ' + (i + 1) + ': URL tautan harus diawali https://'); byId('bntautan' + i).focus(); return; }
    }
    const btn = byId('btnSimpanBanner');
    setTombolProses(btn, true, 'Menyimpan…');
    try {
      for (let i = 0; i < 3; i++) {
        const f = ADM.bnr.fotoBaru[i];
        if (f && f.video && !f.video.id) {
          setTombolProses(btn, true, 'Mengunggah video ' + (i + 1) + '…');
          const upv = await adminPanggil('adminUnggahVideo', 'banner', f.video.base64, f.video.mime);
          if (!upv.success) throw errPengguna('Slide ' + (i + 1) + ': ' + upv.message);
          f.video.id = upv.data.id;
        }
        if (f && !f.id) {
          setTombolProses(btn, true, 'Mengunggah ' + (f.video ? 'sampul video ' : 'gambar ') + (i + 1) + '…');
          const up = await adminPanggil('adminUnggahGambar', 'banner', f.base64, f.mime);
          if (!up.success) throw errPengguna('Slide ' + (i + 1) + ': ' + up.message);
          f.id = up.data.id;
        }
        if (f && f.id) slides[i].idGambar = f.id;
        if (f) slides[i].idVideo = f.video ? f.video.id : '';
      }
      setTombolProses(btn, true, 'Menyimpan…');
      const res = await adminPanggil('adminSimpanBanner', slides.map(function (s) {
        return { judul: s.judul, subjudul: s.subjudul, idGambar: s.idGambar, idVideo: s.idVideo || '', teksTombol: s.teksTombol, jenisTautan: s.jenisTautan, tautan: s.tautan };
      }));
      if (!res.success) { tampilAlert('errBanner', res.message); return; }
      ADM.bnr.kotor = false;
      ADM.bnr.fotoBaru = {};
      ADM.cache.banner = res.data;
      ADM.bnr.slides = res.data.map(function (x) { return Object.assign({}, x); });
      renderSlotBanner();
      renderPreviewBanner();
      S.publikKotor = true;
      toast(res.message, 'ok');
    } catch (er) {
      if (!er.sesiHabis) tampilAlert('errBanner', pesanDari(er));
    } finally {
      setTombolProses(btn, false);
    }
  }

  // ============================================================
  // 17. ADMIN — PROFIL, VISI & MISI
  // ============================================================
  function muatProfil() {
    muatAdm('pengaturan', 'adminPengaturan', [], function (d) {
      if (!d || ADM.prf.kotor) return;
      isiFormProfil(d);
    });
  }
  function isiFormProfil(p) {
    byId('prfNama').value = p.nama_usaha || '';
    byId('prfSlogan').value = p.slogan || '';
    byId('prfTahun').value = p.tahun_berdiri || '';
    byId('prfTentang').value = p.tentang_kami || '';
    byId('prfVisi').value = p.visi || '';
    ADM.prf.idFoto = p.id_foto_tentang || '';
    ADM.prf.fotoBaru = null;
    ADM.prf.idFotoBaru = '';
    ADM.prf.idLogo = p.id_logo || '';
    ADM.prf.logoBaru = null;
    ADM.prf.idLogoBaru = '';
    byId('e-prfLogo').textContent = '';
    ADM.prf.misi = (p.misi && p.misi.length ? p.misi : ['']).slice(0, 5);
    ADM.prf.stat = (p.statistik || []).map(function (x) { return { label: x.label, nilai: x.nilai }; });
    ADM.prf.pilar = (p.pilar || []).slice(0, 4).map(function (x) { return { judul: x.judul, penjelasan: x.penjelasan }; });
    while (ADM.prf.pilar.length < 4) ADM.prf.pilar.push({ judul: '', penjelasan: '' });
    renderMisiEditor();
    renderStatEditor();
    renderPilarEditor();
    tampilFotoPrf();
    tampilLogoPrf();
    hitungPrfTentang();
    previewProfil();
    sembunyikan('errProfil');
  }
  function renderMisiEditor() {
    const m = ADM.prf.misi;
    byId('prfMisi').innerHTML = m.map(function (x, i) {
      return '<div class="misi-edit"><span class="nomor">' + dua(i + 1) + '</span>' +
        '<input class="inp" maxlength="200" value="' + esc(x) + '" data-input="prfMisi" data-i="' + i + '" aria-label="Misi ' + (i + 1) + '">' +
        '<button type="button" class="ikon-btn" data-aksi="naikMisi" data-i="' + i + '" aria-label="Naikkan misi ' + (i + 1) + '"' + (i === 0 ? ' disabled' : '') + '><i class="bi bi-arrow-up" aria-hidden="true"></i></button>' +
        '<button type="button" class="ikon-btn hapus" data-aksi="hapusMisi" data-i="' + i + '" aria-label="Hapus misi ' + (i + 1) + '"' + (m.length <= 1 ? ' disabled' : '') + '><i class="bi bi-trash3" aria-hidden="true"></i></button></div>';
    }).join('');
    byId('btnTambahMisi').disabled = m.length >= 5;
  }
  function renderStatEditor() {
    const st = ADM.prf.stat;
    byId('prfStat').innerHTML = st.map(function (x, i) {
      return '<div class="stat-edit"><input class="inp" maxlength="40" value="' + esc(x.label) + '" placeholder="Label, contoh: Klien B2B" data-input="prfStat" data-i="' + i + '" data-k="label" aria-label="Label statistik ' + (i + 1) + '">' +
        '<input class="inp" maxlength="20" value="' + esc(x.nilai) + '" placeholder="Nilai, contoh: 500+" data-input="prfStat" data-i="' + i + '" data-k="nilai" aria-label="Nilai statistik ' + (i + 1) + '">' +
        '<button type="button" class="ikon-btn hapus" data-aksi="hapusStat" data-i="' + i + '" aria-label="Hapus statistik ' + (i + 1) + '"><i class="bi bi-trash3" aria-hidden="true"></i></button></div>';
    }).join('');
    byId('btnTambahStat').disabled = st.length >= 3;
  }
  function renderPilarEditor() {
    byId('prfPilar').innerHTML = ADM.prf.pilar.map(function (x, i) {
      return '<div class="pilar-edit"><span class="nomor">P' + (i + 1) + '</span>' +
        '<div class="field mt-8"><label for="pilJ' + i + '">Judul pilar ' + (i + 1) + ' <span class="req">wajib</span></label><input id="pilJ' + i + '" class="inp" maxlength="40" value="' + esc(x.judul) + '" data-input="prfPilar" data-i="' + i + '" data-k="judul"></div>' +
        '<div class="field" style="margin-bottom:0"><label for="pilP' + i + '">Penjelasan singkat</label><textarea id="pilP' + i + '" class="inp" rows="2" maxlength="160" data-input="prfPilar" data-i="' + i + '" data-k="penjelasan">' + esc(x.penjelasan) + '</textarea></div></div>';
    }).join('');
  }
  function tampilFotoPrf() {
    setFotoKotak('prfFotoPrev', ADM.prf.fotoBaru ? ADM.prf.fotoBaru.url : gambar(ADM.prf.idFoto, 400), 'bi-building');
  }
  function urlLogoPrf() { return ADM.prf.logoBaru ? ADM.prf.logoBaru.url : gambar(ADM.prf.idLogo, 200); }
  function tampilLogoPrf() { setFotoKotak('prfLogoPrev', urlLogoPrf(), 'bi-image'); }
  function hitungPrfTentang() { byId('prfTentangHitung').textContent = byId('prfTentang').value.length + '/3000'; }
  function previewProfil() {
    const nama = byId('prfNama').value.trim() || 'Nama usaha';
    const slogan = byId('prfSlogan').value.trim();
    const tahun = byId('prfTahun').value.trim();
    const visi = byId('prfVisi').value.trim();
    const foto = ADM.prf.fotoBaru ? ADM.prf.fotoBaru.url : gambar(ADM.prf.idFoto, 600);
    const misi = ADM.prf.misi.map(function (x) { return x.trim(); }).filter(Boolean);
    byId('prfPreview').innerHTML =
      (foto ? '<img src="' + esc(foto) + '" alt="Pratinjau foto workshop">' : '<div class="foto-ph"><i class="bi bi-building" aria-hidden="true"></i><span class="xs">Belum ada foto workshop</span></div>') +
      '<div class="prf-logo-baris">' + htmlLogo('', urlLogoPrf()) + '<div><span class="lbl">' + esc(tahun ? 'Berdiri sejak ' + tahun : 'Tentang kami') + '</span><h3 class="h3">' + esc(nama) + '</h3>' + (slogan ? '<p class="small muted">' + esc(slogan) + '</p>' : '') + '</div></div>' +
      '<div class="card" style="padding:14px"><span class="lbl">Visi</span><p class="small mt-8">' + esc(visi || '—') + '</p></div>' +
      '<div class="card-green" style="padding:14px"><span class="lbl lbl-green">Misi</span><ol class="misi-list">' +
      (misi.length ? misi.map(function (m, i) { return '<li><span class="nomor">' + dua(i + 1) + '</span><span class="small">' + esc(m) + '</span></li>'; }).join('') : '<li class="small muted">Belum ada misi.</li>') + '</ol></div>' +
      '<div><span class="lbl">4 Pilar</span><ul class="stack-sm mt-8" style="list-style:none">' + ADM.prf.pilar.map(function (p) {
        return '<li class="small"><strong>' + esc(p.judul || '—') + '</strong>' + (p.penjelasan ? ' — ' + esc(p.penjelasan) : '') + '</li>';
      }).join('') + '</ul></div>';
  }
  async function simpanProfil() {
    const data = {
      nama_usaha: byId('prfNama').value.trim(),
      slogan: byId('prfSlogan').value.trim(),
      tahun_berdiri: byId('prfTahun').value.trim(),
      tentang_kami: byId('prfTentang').value.trim(),
      visi: byId('prfVisi').value.trim(),
      misi: ADM.prf.misi.map(function (x) { return x.trim(); }).filter(Boolean),
      statistik: ADM.prf.stat.map(function (x) { return { label: x.label.trim(), nilai: x.nilai.trim() }; }).filter(function (x) { return x.label || x.nilai; }),
      pilar: ADM.prf.pilar.map(function (x) { return { judul: x.judul.trim(), penjelasan: x.penjelasan.trim() }; })
    };
    let pesan = '';
    if (!data.nama_usaha) pesan = 'Nama usaha wajib diisi.';
    else if (data.tahun_berdiri && !/^\d{4}$/.test(data.tahun_berdiri)) pesan = 'Tahun berdiri harus 4 angka, contoh 2018.';
    else if (!data.tentang_kami) pesan = 'Teks tentang kami wajib diisi.';
    else if (!data.visi) pesan = 'Visi wajib diisi.';
    else if (!data.misi.length) pesan = 'Isi minimal 1 butir misi.';
    else if (data.statistik.some(function (x) { return !x.label || !x.nilai; })) pesan = 'Setiap statistik wajib berisi label dan nilai.';
    else if (data.pilar.some(function (x) { return !x.judul; })) pesan = 'Judul keempat pilar wajib diisi.';
    if (pesan) { tampilAlert('errProfil', pesan); byId('errProfil').scrollIntoView({ block: 'center' }); return; }
    const btn = byId('btnSimpanProfil');
    setTombolProses(btn, true, 'Menyimpan…');
    sembunyikan('errProfil');
    try {
      if (ADM.prf.fotoBaru && !ADM.prf.idFotoBaru) {
        setTombolProses(btn, true, 'Mengunggah foto…');
        const up = await adminPanggil('adminUnggahGambar', 'profil', ADM.prf.fotoBaru.base64, ADM.prf.fotoBaru.mime);
        if (!up.success) throw errPengguna(up.message);
        ADM.prf.idFotoBaru = up.data.id;
      }
      data.id_foto_tentang = ADM.prf.idFotoBaru || ADM.prf.idFoto;
      if (ADM.prf.logoBaru && !ADM.prf.idLogoBaru) {
        setTombolProses(btn, true, 'Mengunggah logo…');
        const upLogo = await adminPanggil('adminUnggahGambar', 'logo', ADM.prf.logoBaru.base64, ADM.prf.logoBaru.mime);
        if (!upLogo.success) throw errPengguna(upLogo.message);
        ADM.prf.idLogoBaru = upLogo.data.id;
      }
      data.id_logo = ADM.prf.idLogoBaru || ADM.prf.idLogo;
      setTombolProses(btn, true, 'Menyimpan…');
      const res = await adminPanggil('adminSimpanPengaturan', data);
      if (!res.success) { tampilAlert('errProfil', res.message); return; }
      ADM.cache.pengaturan = res.data;
      ADM.prf.kotor = false;
      isiFormProfil(res.data);
      byId('admNama').textContent = res.data.nama_usaha;
      if (S.data) { S.data.pengaturan.id_logo = res.data.id_logo || ''; pasangLogo(); }
      S.publikKotor = true;
      toast(res.message, 'ok');
    } catch (er) {
      if (!er.sesiHabis) tampilAlert('errProfil', pesanDari(er));
    } finally {
      setTombolProses(btn, false);
    }
  }

  // ============================================================
  // 18. ADMIN — TESTIMONI
  // ============================================================
  function kunciTsa() { return 'tsa_' + ADM.tsa.cari + '_' + ADM.tsa.halaman; }
  function isiDatalistProduk() {
    const judul = {};
    (S.data.produk || []).forEach(function (p) { judul[p.judul] = true; });
    const d = ADM.cache.produk;
    if (d) d.produk.forEach(function (p) { judul[p.judul] = true; });
    byId('dlProduk').innerHTML = Object.keys(judul).map(function (j) { return '<option value="' + esc(j) + '"></option>'; }).join('');
  }
  function aturOpsiTsa() {
    const a = ADM.tsa.opsi === 'A';
    byId('tsaTabA').classList.toggle('aktif', a);
    byId('tsaTabB').classList.toggle('aktif', !a);
    byId('tsaTabA').setAttribute('aria-pressed', a ? 'true' : 'false');
    byId('tsaTabB').setAttribute('aria-pressed', a ? 'false' : 'true');
    byId('tsaOpsiA').hidden = !a;
    byId('tsaWa').readOnly = !!ADM.tsa.idPesanan;
  }
  function muatTsa() {
    isiDatalistProduk();
    aturOpsiTsa();
    byId('tsaCari').value = ADM.tsa.cari;
    muatAdm(kunciTsa(), 'adminTestimoni', [{ cari: ADM.tsa.cari, halaman: ADM.tsa.halaman }], renderTsa);
  }
  function barisTsa(x) {
    const foto = gambar(x.idFoto, 120);
    const id = esc(x.id);
    return '<tr><td>' + (foto ? '<img class="tava" src="' + esc(foto) + '" alt="" loading="lazy" width="48" height="48" data-inisial="' + esc(inisial(x.nama)) + '">' : '<span class="tava tava-inisial" aria-hidden="true">' + esc(inisial(x.nama)) + '</span>') + '</td>' +
      '<td><strong>' + esc(x.nama) + '</strong>' + (x.instansi ? '<span class="xs muted d-block">' + esc(x.instansi) + '</span>' : '') +
      '<span class="xs mono muted d-block"><i class="bi bi-whatsapp" aria-hidden="true"></i> ' + esc(x.noWa ? formatWa(x.noWa) : '—') + '</span></td>' +
      '<td class="tsa-isi"><p class="small clamp2" id="tsaTeks-' + id + '">' + esc(x.isi) + '</p>' +
      (x.isi.length > 90 ? '<button type="button" class="link-btn" data-aksi="tsaPenuh" data-id="' + id + '" aria-expanded="false">Lihat penuh</button>' : '') +
      '<span class="xs muted d-block">' + esc(x.tanggal) + '</span></td>' +
      '<td class="small">' + esc(x.produk || '—') + (x.idPesanan ? '<span class="xs mono d-block">' + esc(x.idPesanan) + '</span>' : '') + '</td>' +
      '<td>' + (x.idPesanan ? '<span class="badge badge-green">Dari pesanan</span>' : '<span class="badge badge-gray">' + esc(x.sumber) + '</span>') + '</td>' +
      '<td>' + badgeTampil(x.status) + '</td>' +
      '<td class="nowrap"><button type="button" class="btn btn-outline btn-sm" data-aksi="tsaEdit" data-id="' + id + '" aria-label="Ubah testimoni ' + esc(x.nama) + '"><i class="bi bi-pencil" aria-hidden="true"></i></button> ' +
      '<button type="button" class="btn btn-outline btn-sm" data-aksi="tsaToggle" data-id="' + id + '" aria-label="' + (x.status === 'Tampil' ? 'Sembunyikan' : 'Tampilkan') + ' testimoni ' + esc(x.nama) + '"><i class="bi ' + (x.status === 'Tampil' ? 'bi-eye-slash' : 'bi-eye') + '" aria-hidden="true"></i></button> ' +
      '<button type="button" class="btn btn-outline btn-sm btn-bahaya" data-aksi="tsaHapus" data-id="' + id + '" aria-label="Hapus testimoni ' + esc(x.nama) + '"><i class="bi bi-trash3" aria-hidden="true"></i></button></td></tr>';
  }
  function renderTsa(d) {
    if (!d) {
      byId('tsaKpi').innerHTML = skeletonKpi(3);
      byId('tsaBody').innerHTML = skeletonBaris(7, 4);
      byId('tsaPager').innerHTML = '';
      return;
    }
    ADM.tsa.baris = d.baris;
    const r = d.ringkasan;
    byId('tsaKpi').innerHTML =
      kpiSederhana('Total testimoni', r.total + ' ulasan', 'Semua sumber', 'bi-chat-square-quote') +
      kpiSederhana('Tampil di website', r.tampil + ' ulasan', 'Terlihat pengunjung', 'bi-eye') +
      kpiSederhana('Disembunyikan', r.disembunyikan + ' ulasan', 'Tidak terlihat publik', 'bi-eye-slash');
    byId('tsaBody').innerHTML = d.baris.length ? d.baris.map(barisTsa).join('')
      : '<tr><td colspan="7" class="kosong-sel">' + (ADM.tsa.cari ? 'Tidak ada testimoni yang cocok.' : 'Belum ada testimoni.') + '</td></tr>';
    byId('tsaPager').innerHTML = htmlPager(d.halaman, d.jumlahHalaman, d.total, 'tsaHal');
  }
  function hitungTsaIsi() { byId('tsaIsiHitung').textContent = byId('tsaIsi').value.length + '/500'; }
  function tampilTerpilih(idPesanan) {
    const t = byId('tsaTerpilih');
    if (!idPesanan) { t.hidden = true; t.innerHTML = ''; return; }
    t.hidden = false;
    t.innerHTML = '<span class="badge badge-green"><i class="bi bi-patch-check-fill" aria-hidden="true"></i> Pemesan Terverifikasi</span> Terhubung ke pesanan <strong class="mono">' + esc(idPesanan) + '</strong> · <button type="button" class="link-btn" data-aksi="tsaLepasPsn">Lepas hubungan</button>';
  }
  function resetTsa() {
    ADM.tsa.edit = null;
    ADM.tsa.idPesanan = '';
    ADM.tsa.idFoto = '';
    ADM.tsa.fotoBaru = null;
    ADM.tsa.idFotoBaru = '';
    byId('formTsa').reset();
    byId('tsaHasil').innerHTML = '';
    tampilTerpilih('');
    byId('tsaJudul').innerHTML = '<i class="bi bi-plus-square" aria-hidden="true"></i> Tambah Testimoni';
    setFotoKotak('tsaFotoPrev', '', 'bi-person');
    ['tsaNama', 'tsaWa', 'tsaIsi'].forEach(function (id) { setErr(id, ''); });
    sembunyikan('errTsa');
    hitungTsaIsi();
    ADM.tsa.opsi = 'A';
    aturOpsiTsa();
  }
  async function cariPesananTsa() {
    const q = byId('tsaCariPsn').value.trim();
    const box = byId('tsaHasil');
    if (q.length < 2) { box.innerHTML = ''; return; }
    box.innerHTML = '<p class="xs muted"><span class="spin" aria-hidden="true"></span> Mencari…</p>';
    ADM.tsa.seqCari += 1;
    const seq = ADM.tsa.seqCari;
    try {
      const res = await adminPanggil('adminCariPesananUntukTestimoni', q);
      if (seq !== ADM.tsa.seqCari) return;
      if (!res.success) { box.innerHTML = '<p class="err">' + esc(res.message) + '</p>'; return; }
      ADM.tsa.hasil = res.data;
      box.innerHTML = res.data.length ? res.data.map(function (x, i) {
        return '<button type="button" data-aksi="tsaPilihPsn" data-i="' + i + '"><span><strong class="mono">' + esc(x.id) + '</strong> — ' + esc(x.nama) + (x.instansi ? ' (' + esc(x.instansi) + ')' : '') +
          '<span class="xs muted d-block">' + esc(x.produk) + '</span></span><span class="xs muted nowrap">' + esc(x.tanggal) + '</span></button>';
      }).join('') : '<p class="xs muted">Tidak ada pesanan yang cocok.</p>';
    } catch (e) {
      if (!e.sesiHabis && seq === ADM.tsa.seqCari) box.innerHTML = '<p class="err">' + esc(pesanGagal(e)) + '</p>';
    }
  }
  function cariBarisTsa(id) { return ADM.tsa.baris.filter(function (x) { return x.id === id; })[0] || null; }
  function editTsa(id) {
    const x = cariBarisTsa(id);
    if (!x) return;
    resetTsa();
    ADM.tsa.edit = x;
    ADM.tsa.idPesanan = x.idPesanan;
    ADM.tsa.idFoto = x.idFoto;
    ADM.tsa.opsi = x.idPesanan ? 'A' : 'B';
    byId('tsaNama').value = x.nama;
    byId('tsaInstansi').value = x.instansi;
    byId('tsaWa').value = x.noWa;
    byId('tsaProduk').value = x.produk;
    byId('tsaIsi').value = x.isi;
    $$('input[name="tsaStatus"]').forEach(function (r) { r.checked = r.value === x.status; });
    setFotoKotak('tsaFotoPrev', gambar(x.idFoto, 200), 'bi-person');
    tampilTerpilih(x.idPesanan);
    byId('tsaJudul').innerHTML = '<i class="bi bi-pencil-square" aria-hidden="true"></i> Ubah Testimoni';
    hitungTsaIsi();
    aturOpsiTsa();
    byId('formTsa').scrollIntoView({ behavior: GERAK_MINIM ? 'auto' : 'smooth', block: 'start' });
    byId('tsaNama').focus({ preventScroll: true });
  }
  async function simpanTsa(e) {
    e.preventDefault();
    const nama = byId('tsaNama').value.trim();
    const wa = byId('tsaWa').value.trim();
    const isi = byId('tsaIsi').value.trim();
    const err = {
      tsaNama: nama ? '' : 'Nama wajib diisi.',
      tsaWa: wa && !normalWa(wa) ? 'Nomor WhatsApp tidak valid. Contoh: 081234567890.' : '',
      tsaIsi: !isi ? 'Isi testimoni wajib diisi.' : (isi.length < 10 ? 'Isi testimoni minimal 10 karakter.' : '')
    };
    Object.keys(err).forEach(function (k) { setErr(k, err[k]); });
    if (err.tsaNama || err.tsaWa || err.tsaIsi) { fokusSalah('#formTsa'); return; }
    const pilih = $('input[name="tsaStatus"]:checked');
    const btn = byId('btnSimpanTsa');
    setTombolProses(btn, true, 'Menyimpan…');
    sembunyikan('errTsa');
    try {
      let idFoto = ADM.tsa.idFoto;
      if (ADM.tsa.fotoBaru && !ADM.tsa.idFotoBaru) {
        setTombolProses(btn, true, 'Mengunggah foto…');
        const up = await adminPanggil('adminUnggahGambar', 'testimoni', ADM.tsa.fotoBaru.base64, ADM.tsa.fotoBaru.mime);
        if (!up.success) throw errPengguna(up.message);
        ADM.tsa.idFotoBaru = up.data.id;
      }
      if (ADM.tsa.idFotoBaru) idFoto = ADM.tsa.idFotoBaru;
      setTombolProses(btn, true, 'Menyimpan…');
      const res = await adminPanggil('adminSimpanTestimoni', {
        id: ADM.tsa.edit ? ADM.tsa.edit.id : '',
        nama: nama,
        instansi: byId('tsaInstansi').value.trim(),
        noWa: wa,
        produk: byId('tsaProduk').value.trim(),
        idPesanan: ADM.tsa.idPesanan,
        idFoto: idFoto,
        isi: isi,
        status: pilih ? pilih.value : 'Tampil'
      });
      if (!res.success) { tampilAlert('errTsa', res.message); return; }
      toast(res.message, 'ok');
      resetTsa();
      hapusCacheAdm('tsa_');
      muatTsa();
      S.publikKotor = true;
      S.testi.dimuat = false;
      S.testiSemua.dimuat = false;
    } catch (er) {
      if (!er.sesiHabis) tampilAlert('errTsa', pesanDari(er));
    } finally {
      setTombolProses(btn, false);
    }
  }
  async function toggleTsa(id) {
    const x = cariBarisTsa(id);
    if (!x) return;
    const baru = x.status === 'Tampil' ? 'Disembunyikan' : 'Tampil';
    try {
      const res = await adminPanggil('adminUbahStatusTestimoni', id, baru);
      if (!res.success) { toast(res.message, 'err'); return; }
      toast(res.message, 'ok');
      hapusCacheAdm('tsa_');
      muatTsa();
      S.publikKotor = true;
      S.testi.dimuat = false;
      S.testiSemua.dimuat = false;
    } catch (e) {
      if (!e.sesiHabis) toast(pesanGagal(e), 'err');
    }
  }
  async function hapusTsa(id) {
    const x = cariBarisTsa(id);
    const ya = await konfirmasi('Hapus testimoni dari ' + (x ? x.nama : 'pelanggan ini') + ' secara permanen? Fotonya ikut dipindah ke Sampah Drive. Bila hanya ingin menyembunyikan, gunakan tombol mata.', { judul: 'Hapus testimoni', ya: 'Hapus permanen' });
    if (!ya) return;
    try {
      const res = await adminPanggil('adminHapusTestimoni', id);
      if (!res.success) { toast(res.message, 'err'); return; }
      toast(res.message, 'ok');
      if (ADM.tsa.edit && ADM.tsa.edit.id === id) resetTsa();
      hapusCacheAdm('tsa_');
      muatTsa();
      S.publikKotor = true;
      S.testi.dimuat = false;
      S.testiSemua.dimuat = false;
    } catch (e) {
      if (!e.sesiHabis) toast(pesanGagal(e), 'err');
    }
  }

  // ============================================================
  // 19. ADMIN — PENGATURAN
  // ============================================================
  function muatPengaturan() {
    byId('setUser').value = ADM.username;
    muatAdm('pengaturan', 'adminPengaturan', [], function (d) {
      if (!d || ADM.kontakKotor) return;
      isiFormKontak(d);
    });
    if (ADM.cache.cek) renderCek(ADM.cache.cek); else jalankanCekSistem();
  }
  function isiFormKontak(p) {
    byId('setWa').value = p.no_wa_admin || '';
    byId('setJam').value = p.jam_operasional || '';
    byId('setAlamat').value = p.alamat || '';
    byId('setLinkMap').value = p.link_google_map || '';
    byId('setEmbedMap').value = p.embed_google_map || '';
    previewPeta();
  }
  function srcEmbed(v) {
    v = String(v || '').trim();
    const m = /src="([^"]+)"/.exec(v);
    if (m) v = m[1].replace(/&amp;/g, '&');
    return v;
  }
  function previewPeta() {
    const embed = srcEmbed(byId('setEmbedMap').value);
    const alamat = byId('setAlamat').value.trim();
    const url = urlEmbedPeta({ embed_google_map: embed, alamat: alamat });
    byId('setPeta').innerHTML = url
      ? '<iframe src="' + esc(url) + '" title="Pratinjau peta" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>'
      : '<div class="foto-ph"><i class="bi bi-map" aria-hidden="true"></i><span class="xs">Isi alamat untuk melihat pratinjau peta.</span></div>';
    pasangLink(byId('setUjiMap'), urlLinkPeta({ link_google_map: byId('setLinkMap').value.trim(), alamat: alamat }));
  }
  async function simpanKontak(e) {
    e.preventDefault();
    const wa = byId('setWa').value.trim();
    const alamat = byId('setAlamat').value.trim();
    const link = byId('setLinkMap').value.trim();
    const embed = srcEmbed(byId('setEmbedMap').value);
    let pesan = '';
    if (!normalWa(wa)) pesan = 'Nomor WhatsApp admin tidak valid. Contoh: 081234567890.';
    else if (!alamat) pesan = 'Alamat workshop wajib diisi.';
    else if (link && !/^https:\/\/\S+$/.test(link)) pesan = 'Link Google Maps harus diawali https://';
    else if (embed && embed.indexOf('https://www.google.com/maps/embed') !== 0) pesan = 'Embed peta harus dari Google Maps → Bagikan → Sematkan peta (diawali https://www.google.com/maps/embed).';
    if (pesan) { tampilAlert('errKontak', pesan); return; }
    const btn = byId('btnKontak');
    setTombolProses(btn, true, 'Menyimpan…');
    sembunyikan('errKontak');
    try {
      const res = await adminPanggil('adminSimpanPengaturan', { no_wa_admin: wa, jam_operasional: byId('setJam').value.trim(), alamat: alamat, link_google_map: link, embed_google_map: embed });
      if (!res.success) { tampilAlert('errKontak', res.message); return; }
      ADM.cache.pengaturan = res.data;
      ADM.kontakKotor = false;
      isiFormKontak(res.data);
      S.publikKotor = true;
      delete ADM.cache.cek;
      toast(res.message, 'ok');
    } catch (er) {
      if (!er.sesiHabis) tampilAlert('errKontak', pesanGagal(er));
    } finally {
      setTombolProses(btn, false);
    }
  }
  async function gantiSandi(e) {
    e.preventDefault();
    const lama = byId('setLama').value;
    const baru = byId('setBaru').value;
    const ulang = byId('setUlang').value;
    let pesan = '';
    if (!lama) pesan = 'Isi password lama.';
    else if (baru.length < 12 || !/[A-Za-z]/.test(baru) || !/\d/.test(baru)) pesan = 'Password baru minimal 12 karakter dan wajib berisi huruf dan angka.';
    else if (baru === lama) pesan = 'Password baru harus berbeda dari password lama.';
    else if (baru !== ulang) pesan = 'Ulangi password baru dengan tepat.';
    if (pesan) { tampilAlert('errSandi', pesan); return; }
    const btn = byId('btnSandi');
    setTombolProses(btn, true, 'Menyimpan…');
    sembunyikan('errSandi');
    try {
      const res = await adminPanggil('adminGantiPassword', lama, baru);
      if (!res.success) { tampilAlert('errSandi', res.message); return; }
      byId('formSandi').reset();
      byId('setUser').value = ADM.username;
      ADM.wajibGanti = false;
      byId('admPeringatan').hidden = true;
      toast(res.message, 'ok');
    } catch (er) {
      if (!er.sesiHabis) tampilAlert('errSandi', pesanGagal(er));
    } finally {
      setTombolProses(btn, false);
    }
  }
  async function jalankanCekSistem() {
    const btn = byId('btnCekSistem');
    setTombolProses(btn, true, 'Memeriksa…');
    if (!ADM.cache.cek) byId('setCek').innerHTML = '<div class="memuat-blok"><span class="spin" aria-hidden="true"></span> Memeriksa sistem…</div>';
    try {
      const res = await adminPanggil('adminCekSistem');
      if (res.success) { ADM.cache.cek = res.data; renderCek(res.data); }
      else toast(res.message, 'err');
    } catch (e) {
      if (!e.sesiHabis) toast(pesanGagal(e), 'err');
    } finally {
      setTombolProses(btn, false);
    }
  }
  function itemCek(ok, judul, info, peringatan) {
    const ikon = ok ? 'bi-check-circle-fill' : (peringatan ? 'bi-exclamation-triangle-fill' : 'bi-x-octagon-fill');
    return '<li><i class="bi ' + ikon + '" aria-hidden="true"></i><div><strong>' + esc(judul) + '</strong><span class="xs muted d-block">' + (ok ? '' : '<span class="sr-only">Perlu perhatian: </span>') + esc(info) + '</span></div></li>';
  }
  function renderCek(d) {
    const daftar = d.cek.map(function (c) { return itemCek(c.ok, c.nama, c.info); }).join('') +
      itemCek(d.kuotaEmail !== null && d.kuotaEmail > 0, 'Sisa kuota email hari ini', d.kuotaEmail === null ? 'Tidak dapat dibaca' : d.kuotaEmail + ' email', d.kuotaEmail === null) +
      itemCek(d.adminEmailAda, 'Email penerima nota (ADMIN_EMAIL)', d.adminEmailAda ? 'Sudah diisi (alamat tidak ditampilkan)' : 'Belum diisi — nota PDF tidak akan terkirim');
    const belum = d.belumDiisi.length
      ? '<div class="alert alert-err mt-16"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i><div><p><strong>Data usaha masih berisi contoh atau kosong:</strong> ' + esc(d.belumDiisi.map(function (k) { return LABEL_KUNCI[k] || k; }).join(', ')) + '.</p><p class="small">Lengkapi di menu Profil &amp; Visi Misi dan Pengaturan sebelum link website dibagikan.</p></div></div>'
      : '<div class="alert alert-ok mt-16"><i class="bi bi-check2-circle" aria-hidden="true"></i><p>Data usaha sudah terisi.</p></div>';
    const log = d.log.length
      ? '<div class="tbl-wrap mt-8"><table class="tbl"><thead><tr><th>Waktu</th><th>Jenis</th><th>Rujukan</th><th>Pesan</th></tr></thead><tbody>' + d.log.map(function (l) {
        return '<tr><td class="small nowrap">' + esc(l.waktu) + '</td><td><span class="badge ' + (l.jenis === 'ERROR' || l.jenis.indexOf('GAGAL') >= 0 ? 'badge-red' : 'badge-gray') + '">' + esc(l.jenis) + '</span></td><td class="small mono">' + esc(l.rujukan) + '</td><td class="small">' + esc(l.pesan) + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<p class="xs muted mt-8">Belum ada catatan log.</p>';
    byId('setCek').innerHTML = '<ul class="cek-list">' + daftar + '</ul>' + belum + '<h3 class="h4 mt-24">10 catatan log terakhir</h3>' + log + '<p class="xs muted mt-8 mono">Versi aplikasi ' + esc(d.versi) + '</p>';
  }

  // ============================================================
  // 20. MODAL & KONFIRMASI
  // ============================================================
  let fokusSebelumModal = null;
  let fokusSebelumKonfirm = null;
  let selesaikanKonfirm = null;

  function bukaModal(judul, isi, ukuran) {
    fokusSebelumModal = document.activeElement;
    byId('modalJudul').textContent = judul;
    byId('modalIsi').innerHTML = isi;
    byId('modalKotak').className = 'modal' + (ukuran === 'besar' ? ' modal-besar' : '');
    byId('modal').hidden = false;
    document.body.classList.add('modal-terbuka');
    setTimeout(function () { const t = $('#modalKotak [data-aksi="tutupModal"]'); if (t) t.focus(); }, 30);
  }
  function isiModal(html) { byId('modalIsi').innerHTML = html; }
  function tutupModal() {
    const m = byId('modal');
    if (m.hidden) return;
    m.hidden = true;
    byId('modalIsi').innerHTML = '';
    ADM.detail = null;
    document.body.classList.remove('modal-terbuka');
    if (fokusSebelumModal && fokusSebelumModal.focus && document.body.contains(fokusSebelumModal)) fokusSebelumModal.focus();
  }
  function konfirmasi(pesan, opsi) {
    opsi = opsi || {};
    return new Promise(function (resolve) {
      if (selesaikanKonfirm) selesaikanKonfirm(false);
      selesaikanKonfirm = resolve;
      fokusSebelumKonfirm = document.activeElement;
      byId('konfirmJudul').textContent = opsi.judul || 'Konfirmasi';
      byId('konfirmPesan').textContent = pesan;
      const ya = byId('konfirmYa');
      ya.textContent = opsi.ya || 'Ya, lanjutkan';
      ya.className = 'btn ' + (opsi.bahaya === false ? 'btn-primary' : 'btn-danger');
      byId('konfirm').hidden = false;
      setTimeout(function () { byId('konfirmTidak').focus(); }, 30);
    });
  }
  function tutupKonfirm(hasil) {
    const k = byId('konfirm');
    if (k.hidden && !selesaikanKonfirm) return;
    k.hidden = true;
    const r = selesaikanKonfirm;
    selesaikanKonfirm = null;
    if (fokusSebelumKonfirm && fokusSebelumKonfirm.focus && document.body.contains(fokusSebelumKonfirm)) fokusSebelumKonfirm.focus();
    if (r) r(hasil);
  }
  function jebakFokus(e, wadah) {
    const daftar = $$('button:not([disabled]), [href], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', wadah)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!daftar.length) return;
    const awal = daftar[0];
    const akhir = daftar[daftar.length - 1];
    if (e.shiftKey && document.activeElement === awal) { e.preventDefault(); akhir.focus(); }
    else if (!e.shiftKey && document.activeElement === akhir) { e.preventDefault(); awal.focus(); }
    else if (!wadah.contains(document.activeElement)) { e.preventDefault(); awal.focus(); }
  }

  // ============================================================
  // 21. AKSI (event delegation: data-aksi)
  // ============================================================
  const AKSI = {
    menuMobile: function () {
      const nav = byId('navMobile');
      nav.hidden = !nav.hidden;
      byId('btnBurger').setAttribute('aria-expanded', nav.hidden ? 'false' : 'true');
    },
    bukaAdmin: function () { tutupMenuMobile(); bukaAdmin(); },
    bannerPrev: function () { keSlide(BNR.idx - 1); aturBanner(BNR.aktif); },
    bannerNext: function () { keSlide(BNR.idx + 1); aturBanner(BNR.aktif); },
    pilihKategori: function (el) { S.kategori = el.getAttribute('data-kat'); renderKatalog(); },
    qtyKurang: function (el) { ubahQtyProduk(el.getAttribute('data-id'), -1); },
    qtyTambah: function (el) { ubahQtyProduk(el.getAttribute('data-id'), 1); },
    masukKeranjang: function (el) { masukKeranjang(el.getAttribute('data-id')); },
    cKurang: function (el) { ubahQtyKeranjang(el.getAttribute('data-id'), -1); },
    cTambah: function (el) { ubahQtyKeranjang(el.getAttribute('data-id'), 1); },
    hapusItem: function (el) {
      const id = el.getAttribute('data-id');
      const p = S.produkMap[id];
      S.keranjang = S.keranjang.filter(function (x) { return x.id !== id; });
      delete S.cartErr[id];
      simpanKeranjang();
      renderKeranjang();
      toast((p ? p.judul : 'Produk') + ' dihapus dari keranjang.', 'info');
    },
    unduhNota: function () { if (S.pdf && S.nota) unduhPdf(S.pdf, 'Nota ' + S.nota.id + '.pdf'); },
    cetakNota: function () { cetakElemen($('#notaKertas .nota-paper')); },
    pilihFile: function (el) {
      const inp = byId(el.getAttribute('data-target'));
      if (inp) { inp.value = ''; inp.click(); }
    },
    hapusFotoTesti: function () { hapusFotoTesti(); },
    muatTesti: function () { muatTesti(false); },
    lihatSandi: function (el) {
      const inp = byId(el.getAttribute('data-target'));
      if (!inp) return;
      const tampil = inp.type === 'password';
      inp.type = tampil ? 'text' : 'password';
      el.setAttribute('aria-pressed', tampil ? 'true' : 'false');
      el.innerHTML = tampil ? '<i class="bi bi-eye-slash" aria-hidden="true"></i> Sembunyikan' : '<i class="bi bi-eye" aria-hidden="true"></i> Tampilkan';
    },
    admMenu: function () { byId('admSide').classList.toggle('buka'); },
    lihatPublik: function () { buka('beranda'); },
    logout: function () {
      const token = ADM.token;
      if (token) panggil('logoutAdmin', token).catch(function () { /* abaikan */ });
      hapusSesiAdmin();
      buka('beranda');
      toast('Anda telah keluar dari panel admin.', 'info');
    },
    pilihPeriode: function (el) {
      const p = el.getAttribute('data-periode');
      ADM.periodeUI = p;
      if (p === 'rentang') {
        aturTombolPeriode();
        if (!byId('lapDari').value) { byId('lapDari').value = awalBulanIni(); byId('lapSampai').value = hariIni(); }
        byId('lapDari').focus();
        return;
      }
      ADM.periode = { jenis: p };
      muatLaporan(false);
    },
    terapkanRentang: function () {
      const d = byId('lapDari').value;
      const s = byId('lapSampai').value;
      if (!d || !s) { toast('Pilih tanggal awal dan tanggal akhir.', 'err'); return; }
      if (d > s) { toast('Tanggal akhir harus sama dengan atau setelah tanggal awal.', 'err'); return; }
      ADM.periode = { jenis: 'rentang', dari: d, sampai: s };
      muatLaporan(false);
    },
    segarkanLaporan: function () { muatLaporan(true); },
    segarkanPesanan: function () { hapusCacheAdm('psn_'); muatPesanan(); },
    terapkanPsnRentang: function () {
      const d = byId('psnDari').value;
      const s = byId('psnSampai').value;
      if (!d || !s) { toast('Pilih tanggal awal dan tanggal akhir.', 'err'); return; }
      if (d > s) { toast('Tanggal akhir harus sama dengan atau setelah tanggal awal.', 'err'); return; }
      ADM.psn.periode = 'rentang';
      ADM.psn.dari = d;
      ADM.psn.sampai = s;
      ADM.psn.halaman = 1;
      muatPesanan();
    },
    resetPesanan: function () {
      ADM.psn = { cari: '', status: '', periode: 'bulan', dari: '', sampai: '', halaman: 1 };
      aturFilterPesananUI();
      muatPesanan();
    },
    psnHal: function (el) { ADM.psn.halaman = Number(el.getAttribute('data-hal')) || 1; muatPesanan(); },
    detailPesanan: function (el) { bukaDetailPesanan(el.getAttribute('data-id')); },
    simpanStatus: function (el) { simpanStatusPesanan(el); },
    unduhNotaAdm: function (el) { unduhNotaAdmin(el); },
    cetakNotaAdm: function () { cetakElemen($('#detailNota .nota-paper')); },
    kirimUlangEmail: function (el) { kirimUlangEmail(el); },
    produkBaru: function () { produkBaru(); byId('pfJudul').focus(); },
    editProduk: function (el) { editProduk(el.getAttribute('data-id')); },
    hapusProduk: function (el) { hapusProduk(el.getAttribute('data-id')); },
    kelolaKategori: function () { bukaKelolaKategori(); },
    katTambah: function () {
      const box = byId('katDaftar');
      box.insertAdjacentHTML('beforeend', barisKat('', null));
      const inp = box.lastElementChild.querySelector('input');
      if (inp) inp.focus();
    },
    katHapus: function (el) { const row = el.closest('.kat-baris'); if (row) row.parentNode.removeChild(row); },
    katSimpan: function () { simpanKategori(); },
    simpanBanner: function () { simpanBanner(); },
    bnrHapusVideo: function (el) {
      const i = Number(el.getAttribute('data-slot')) || 0;
      const f = ADM.bnr.fotoBaru[i];
      if (f && f.video) delete ADM.bnr.fotoBaru[i];
      else if (ADM.bnr.slides[i]) ADM.bnr.slides[i].idVideo = '';
      ADM.bnr.kotor = true;
      ADM.bnr.idx = i;
      renderSlotBanner();
      renderPreviewBanner();
    },
    bnrLihat: function (el) { ADM.bnr.idx = Number(el.getAttribute('data-slot')) || 0; renderPreviewBanner(); },
    bnrPrevSlide: function () { ADM.bnr.idx = (ADM.bnr.idx + 2) % 3; renderPreviewBanner(); },
    bnrNextSlide: function () { ADM.bnr.idx = (ADM.bnr.idx + 1) % 3; renderPreviewBanner(); },
    simpanProfil: function () { simpanProfil(); },
    tambahMisi: function () {
      if (ADM.prf.misi.length >= 5) return;
      ADM.prf.misi.push('');
      ADM.prf.kotor = true;
      renderMisiEditor();
      const inp = $$('#prfMisi input').pop();
      if (inp) inp.focus();
    },
    hapusMisi: function (el) {
      if (ADM.prf.misi.length <= 1) return;
      ADM.prf.misi.splice(Number(el.getAttribute('data-i')), 1);
      ADM.prf.kotor = true;
      renderMisiEditor();
      previewProfil();
    },
    naikMisi: function (el) {
      const i = Number(el.getAttribute('data-i'));
      if (i < 1) return;
      const m = ADM.prf.misi;
      const t = m[i - 1];
      m[i - 1] = m[i];
      m[i] = t;
      ADM.prf.kotor = true;
      renderMisiEditor();
      previewProfil();
    },
    tambahStat: function () {
      if (ADM.prf.stat.length >= 3) return;
      ADM.prf.stat.push({ label: '', nilai: '' });
      ADM.prf.kotor = true;
      renderStatEditor();
      const inp = $$('#prfStat input')[ADM.prf.stat.length * 2 - 2];
      if (inp) inp.focus();
    },
    hapusStat: function (el) {
      ADM.prf.stat.splice(Number(el.getAttribute('data-i')), 1);
      ADM.prf.kotor = true;
      renderStatEditor();
    },
    hapusLogoPrf: function () {
      ADM.prf.idLogo = '';
      ADM.prf.logoBaru = null;
      ADM.prf.idLogoBaru = '';
      ADM.prf.kotor = true;
      byId('e-prfLogo').textContent = '';
      tampilLogoPrf();
      previewProfil();
    },
    hapusFotoPrf: function () {
      ADM.prf.idFoto = '';
      ADM.prf.fotoBaru = null;
      ADM.prf.idFotoBaru = '';
      ADM.prf.kotor = true;
      tampilFotoPrf();
      previewProfil();
    },
    tsaOpsi: function (el) {
      ADM.tsa.opsi = el.getAttribute('data-opsi') === 'B' ? 'B' : 'A';
      if (ADM.tsa.opsi === 'B' && !ADM.tsa.edit) { ADM.tsa.idPesanan = ''; tampilTerpilih(''); }
      aturOpsiTsa();
    },
    tsaPilihPsn: function (el) {
      const x = ADM.tsa.hasil[Number(el.getAttribute('data-i'))];
      if (!x) return;
      ADM.tsa.idPesanan = x.id;
      byId('tsaNama').value = x.nama;
      byId('tsaInstansi').value = x.instansi;
      byId('tsaWa').value = x.noWa;
      byId('tsaProduk').value = (x.produk || '').split(', ')[0] || '';
      byId('tsaHasil').innerHTML = '';
      byId('tsaCariPsn').value = '';
      tampilTerpilih(x.id);
      aturOpsiTsa();
      byId('tsaIsi').focus();
    },
    tsaLepasPsn: function () { ADM.tsa.idPesanan = ''; tampilTerpilih(''); aturOpsiTsa(); },
    hapusFotoTsa: function () {
      ADM.tsa.idFoto = '';
      ADM.tsa.fotoBaru = null;
      ADM.tsa.idFotoBaru = '';
      setFotoKotak('tsaFotoPrev', '', 'bi-person');
    },
    resetTsa: function () { resetTsa(); },
    tsaEdit: function (el) { editTsa(el.getAttribute('data-id')); },
    tsaToggle: function (el) { toggleTsa(el.getAttribute('data-id')); },
    tsaHapus: function (el) { hapusTsa(el.getAttribute('data-id')); },
    tsaPenuh: function (el) {
      const p = byId('tsaTeks-' + el.getAttribute('data-id'));
      if (!p) return;
      const buka = p.classList.contains('clamp2');
      p.classList.toggle('clamp2', !buka);
      el.setAttribute('aria-expanded', buka ? 'true' : 'false');
      el.textContent = buka ? 'Ringkas' : 'Lihat penuh';
    },
    tsaHal: function (el) { ADM.tsa.halaman = Number(el.getAttribute('data-hal')) || 1; muatTsa(); },
    segarkanTestiAdm: function () { hapusCacheAdm('tsa_'); muatTsa(); },
    cekSistem: function () { jalankanCekSistem(); },
    tutupModal: function () { tutupModal(); },
    ulangInit: function () { init(); }
  };

  /** Handler 'input' untuk elemen yang dirender dinamis (data-input). */
  const INPUT = {
    qtyProduk: function (el) {
      const id = el.getAttribute('data-id');
      S.qty[id] = el.value;
      tampilErrQty(id, cekJumlah(el.value));
    },
    qtyKeranjang: function (el) { setJumlahKeranjang(el.getAttribute('data-id'), el.value); },
    bnr: function (el) {
      const i = Number(el.getAttribute('data-slot'));
      const k = el.getAttribute('data-k');
      const s = ADM.bnr.slides[i];
      if (!s) return;
      s[k] = el.value;
      ADM.bnr.kotor = true;
      ADM.bnr.idx = i;
      if (k === 'jenisTautan') {
        s.tautan = s.jenisTautan === 'URL' ? '' : 'produk';
        renderSlotBanner();
        const f = byId('bnjenisTautan' + i);
        if (f) f.focus();
      }
      renderPreviewBanner();
    },
    prfMisi: function (el) { ADM.prf.misi[Number(el.getAttribute('data-i'))] = el.value; ADM.prf.kotor = true; previewProfil(); },
    prfStat: function (el) {
      const x = ADM.prf.stat[Number(el.getAttribute('data-i'))];
      if (x) { x[el.getAttribute('data-k')] = el.value; ADM.prf.kotor = true; }
    },
    prfPilar: function (el) {
      const x = ADM.prf.pilar[Number(el.getAttribute('data-i'))];
      if (x) { x[el.getAttribute('data-k')] = el.value; ADM.prf.kotor = true; previewProfil(); }
    }
  };

  // ============================================================
  // 22. PEMASANGAN EVENT
  // ============================================================
  function pasangPendengar() {
    document.addEventListener('click', function (e) {
      const link = e.target.closest('a[href]');
      if (link && !link.hasAttribute('data-go') && !link.hasAttribute('data-aksi')) return;
      const go = e.target.closest('[data-go]');
      if (go) { e.preventDefault(); buka(go.getAttribute('data-go')); return; }
      const adm = e.target.closest('[data-adm]');
      if (adm) { e.preventDefault(); bukaMenuAdmin(adm.getAttribute('data-adm')); return; }
      const a = e.target.closest('[data-aksi]');
      if (a && AKSI[a.getAttribute('data-aksi')] && !a.disabled) { e.preventDefault(); AKSI[a.getAttribute('data-aksi')](a, e); }
    });

    document.addEventListener('input', function (e) {
      const t = e.target;
      const k = t && t.getAttribute && t.getAttribute('data-input');
      if (k && INPUT[k]) INPUT[k](t, e);
    });

    document.addEventListener('change', function (e) {
      const t = e.target;
      if (t && t.classList && t.classList.contains('bn-file') && t.files && t.files[0]) {
        const i = Number(t.getAttribute('data-slot'));
        const file = t.files[0];
        t.value = '';
        pilihMediaBanner(file).then(function (h) {
          if (!h) return;
          ADM.bnr.fotoBaru[i] = h;
          ADM.bnr.kotor = true;
          ADM.bnr.idx = i;
          renderSlotBanner();
          renderPreviewBanner();
        });
      }
    });

    document.addEventListener('keydown', function (e) {
      const konfirm = byId('konfirm');
      const modal = byId('modal');
      const aktif = !konfirm.hidden ? konfirm : (!modal.hidden ? modal : null);
      if (e.key === 'Escape') {
        if (aktif === konfirm) tutupKonfirm(false);
        else if (aktif) tutupModal();
        else { tutupMenuMobile(); byId('admSide').classList.remove('buka'); }
        return;
      }
      if (e.key === 'Tab' && aktif) jebakFokus(e, aktif);
    });

    document.addEventListener('playing', function (e) {
      const t = e.target;
      if (t && t.classList && t.classList.contains('slide-video')) t.classList.add('siap');
    }, true);
    document.addEventListener('error', function (e) {
      const t = e.target;
      if (t && t.tagName === 'VIDEO') { t.classList.add('gagal'); return; }
      if (!t || t.tagName !== 'IMG') return;
      if (t.classList.contains('brand-logo-img')) {
        const m = document.createElement('span');
        m.className = t.className.replace('brand-logo-img', '').trim();
        m.setAttribute('aria-hidden', 'true');
        m.textContent = 'M';
        if (t.parentNode) t.parentNode.replaceChild(m, t);
        return;
      }
      if (t.classList.contains('tava')) {
        const span = document.createElement('span');
        span.className = 'tava tava-inisial';
        span.setAttribute('aria-hidden', 'true');
        span.textContent = t.getAttribute('data-inisial') || '?';
        if (t.parentNode) t.parentNode.replaceChild(span, t);
        return;
      }
      const kotak = t.closest('[data-img-box]');
      if (!kotak) return;
      if (kotak.id === 'tentangFoto') {
        kotak.innerHTML = '<div class="foto-ph"><i class="bi bi-building" aria-hidden="true"></i><span class="xs">Foto belum dapat ditampilkan</span></div>';
      } else {
        kotak.classList.add('img-gagal');
      }
    }, true);

    byId('modal').addEventListener('click', function (e) { if (e.target === byId('modal')) tutupModal(); });
    byId('konfirm').addEventListener('click', function (e) { if (e.target === byId('konfirm')) tutupKonfirm(false); });
    byId('konfirmYa').addEventListener('click', function () { tutupKonfirm(true); });
    byId('konfirmTidak').addEventListener('click', function () { tutupKonfirm(false); });

    // Banner: berhenti saat kursor/fokus di dalam dan saat tab tidak aktif.
    const banner = byId('banner');
    banner.addEventListener('mouseenter', function () { BNR.hover = true; aturBanner(BNR.aktif); });
    banner.addEventListener('mouseleave', function () { BNR.hover = false; aturBanner(BNR.aktif); });
    banner.addEventListener('focusin', function () { BNR.hover = true; aturBanner(BNR.aktif); });
    banner.addEventListener('focusout', function (e) { if (!banner.contains(e.relatedTarget)) { BNR.hover = false; aturBanner(BNR.aktif); } });
    document.addEventListener('visibilitychange', function () { aturBanner(BNR.aktif); });
    // Banner di HP (panah disembunyikan): geser jari ke kiri/kanan untuk pindah slide.
    let sentuhX = null;
    let sentuhY = 0;
    banner.addEventListener('touchstart', function (e) { const t = e.changedTouches[0]; sentuhX = t.clientX; sentuhY = t.clientY; }, { passive: true });
    banner.addEventListener('touchend', function (e) {
      if (sentuhX === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sentuhX;
      const dy = t.clientY - sentuhY;
      sentuhX = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      keSlide(BNR.idx + (dx < 0 ? 1 : -1));
      aturBanner(BNR.aktif);
    }, { passive: true });

    // Katalog
    byId('urutProduk').addEventListener('change', function () { S.urut = byId('urutProduk').value; renderKatalog(); });

    // Biodata
    const fb = byId('formBiodata');
    fb.addEventListener('submit', kirimPesanan);
    fb.addEventListener('input', function () { validasiBio(false); });
    fb.addEventListener('focusout', function (e) {
      const k = e.target.getAttribute && e.target.getAttribute('data-bio');
      if (k) { S.bio.sentuh[k] = true; validasiBio(false); }
    });

    // Testimonial publik
    const ft = byId('formTesti');
    ft.addEventListener('submit', kirimTesti);
    ft.addEventListener('input', function () { validasiTesti(false); });
    ft.addEventListener('focusout', function (e) {
      const id = e.target.id;
      if (id === 'tNama' || id === 'tWa' || id === 'tIsi') { S.tSentuh[id] = true; validasiTesti(false); }
    });
    byId('tIsi').addEventListener('input', hitungIsiTesti);
    byId('tFoto').addEventListener('change', function (e) { const f = e.target.files && e.target.files[0]; if (f) prosesFotoTesti(f); });
    const drop = byId('tDrop');
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('seret'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('seret'); }); });
    drop.addEventListener('drop', function (e) { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) prosesFotoTesti(f); });

    // Login
    byId('formLogin').addEventListener('submit', kirimLogin);

    // Admin: pesanan
    byId('psnCari').addEventListener('input', debounce(function () { ADM.psn.cari = byId('psnCari').value.trim(); ADM.psn.halaman = 1; muatPesanan(); }, 400));
    byId('psnStatus').addEventListener('change', function () { ADM.psn.status = byId('psnStatus').value; ADM.psn.halaman = 1; muatPesanan(); });
    byId('psnPeriode').addEventListener('change', function () {
      const v = byId('psnPeriode').value;
      byId('psnRentang').hidden = v !== 'rentang';
      if (v === 'rentang') {
        if (!byId('psnDari').value) { byId('psnDari').value = awalBulanIni(); byId('psnSampai').value = hariIni(); }
        byId('psnDari').focus();
        return;
      }
      ADM.psn.periode = v;
      ADM.psn.halaman = 1;
      muatPesanan();
    });

    // Admin: produk
    byId('prdCari').addEventListener('input', debounce(function () { ADM.prd.cari = byId('prdCari').value.trim().toLowerCase(); if (ADM.cache.produk) renderProdukAdm(ADM.cache.produk); }, 200));
    byId('prdKat').addEventListener('change', function () { ADM.prd.kat = byId('prdKat').value; if (ADM.cache.produk) renderProdukAdm(ADM.cache.produk); });
    byId('prdStatus').addEventListener('change', function () { ADM.prd.status = byId('prdStatus').value; if (ADM.cache.produk) renderProdukAdm(ADM.cache.produk); });
    byId('formProduk').addEventListener('submit', simpanProduk);
    byId('pfKet').addEventListener('input', hitungKet);
    byId('pfHarga').addEventListener('input', function () { const el = byId('pfHarga'); const v = el.value.replace(/[^\d]/g, ''); if (v !== el.value) el.value = v; });
    byId('pfFoto').addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      pilihGambar(f, 1280, 'e-pfFoto').then(function (h) {
        if (!h) return;
        ADM.prd.fotoBaru = h;
        ADM.prd.idFotoBaru = '';
        setFotoKotak('pfFotoPrev', h.url, 'bi-image');
        byId('e-pfFoto').textContent = '';
      });
    });

    // Admin: profil
    const fp = byId('formProfil');
    fp.addEventListener('submit', function (e) { e.preventDefault(); simpanProfil(); });
    fp.addEventListener('input', function () { ADM.prf.kotor = true; hitungPrfTentang(); previewProfil(); });
    byId('prfTahun').addEventListener('input', function () { const el = byId('prfTahun'); const v = el.value.replace(/[^\d]/g, ''); if (v !== el.value) el.value = v; });
    byId('prfFoto').addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      pilihGambar(f, 1280, null).then(function (h) {
        if (!h) return;
        ADM.prf.fotoBaru = h;
        ADM.prf.idFotoBaru = '';
        ADM.prf.kotor = true;
        tampilFotoPrf();
        previewProfil();
      });
    });
    byId('prfLogo').addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      pilihGambar(f, 512, 'e-prfLogo', { transparan: true }).then(function (h) {
        if (!h) return;
        ADM.prf.logoBaru = h;
        ADM.prf.idLogoBaru = '';
        ADM.prf.kotor = true;
        tampilLogoPrf();
        previewProfil();
      });
    });

    // Admin: testimoni
    byId('formTsa').addEventListener('submit', simpanTsa);
    byId('tsaIsi').addEventListener('input', hitungTsaIsi);
    byId('tsaCariPsn').addEventListener('input', debounce(cariPesananTsa, 400));
    byId('tsaCari').addEventListener('input', debounce(function () { ADM.tsa.cari = byId('tsaCari').value.trim(); ADM.tsa.halaman = 1; muatTsa(); }, 400));
    byId('tsaFoto').addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      pilihGambar(f, 1280, null).then(function (h) {
        if (!h) return;
        ADM.tsa.fotoBaru = h;
        ADM.tsa.idFotoBaru = '';
        setFotoKotak('tsaFotoPrev', h.url, 'bi-person');
      });
    });

    // Admin: pengaturan
    byId('formSandi').addEventListener('submit', gantiSandi);
    const fk = byId('formKontak');
    fk.addEventListener('submit', simpanKontak);
    fk.addEventListener('input', function () { ADM.kontakKotor = true; });
    const previewTunda = debounce(previewPeta, 600);
    ['setAlamat', 'setEmbedMap', 'setLinkMap'].forEach(function (id) { byId(id).addEventListener('input', previewTunda); });
  }

  // ============================================================
  // 23. INISIALISASI
  // ============================================================
  function lanjutInit(data) {
    pasangData(data);
    muatKeranjang();
    renderShell();
    rekonsiliasiKeranjang();
    const notaSesi = bacaSesi('mmx_nota');
    if (notaSesi) {
      try {
        const n = JSON.parse(notaSesi);
        S.nota = n.nota || null;
        S.pdf = n.pdf || null;
      } catch (e) { S.nota = null; }
    }
    hitungIsiTesti();
    const rute = bacaSesi('mmx_rute') || 'beranda';
    if (rute === 'admin' && bacaSesi('mmx_token')) {
      buka('beranda');
      bukaAdmin();
    } else {
      buka(rute === 'admin' ? 'beranda' : rute);
    }
    S.sudahInit = true;
    tampilPemuat(false);
  }

  function gagalInit(pesan) {
    byId('pemuat').innerHTML = '<div class="alert alert-err" style="max-width:520px"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i><div><p>' + esc(pesan) + '</p>' +
      '<button type="button" class="btn btn-primary btn-sm mt-8" data-aksi="ulangInit">Coba lagi</button></div></div>';
  }

  let pendengarTerpasang = false;
  function init() {
    if (!pendengarTerpasang) { pasangPendengar(); pendengarTerpasang = true; }
    // Kunjungan ulang: tampil instan dari salinan lokal, lalu diperbarui di latar.
    const simpanan = bacaDataPublik();
    if (simpanan) {
      S.dataTeks = simpanan.teks;
      lanjutInit(simpanan.data);
      segarkanPublik();
      return;
    }
    tampilPemuat(true, 'Memuat website…');
    byId('pemuat').innerHTML = '<span class="spin spin-lg" aria-hidden="true"></span><p id="pemuatTeks">Memuat website…</p>';
    panggil('getDataPublik').then(function (res) {
      if (!res.success) { gagalInit(res.message); return; }
      S.dataTeks = JSON.stringify(res.data);
      simpanDataPublik(S.dataTeks);
      lanjutInit(res.data);
    }).catch(function (e) { gagalInit(pesanDari(e)); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
