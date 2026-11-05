/* ============================================================
   WEBSITE MIXMAX SOUVENIR — Bentuk, shader, dan adegan partikel 3D
   Dipakai bersama oleh cover.html dan js/latar3d.js.
   File yang sama juga berjalan sebagai Web Worker, supaya menghitung
   30.000 titik per bentuk tidak pernah membuat halaman macet.
   Bentuk: 0 lampu, 1 kotak, 2 handuk, 3 mug, 4 tumbler, 5 hati, 6 tulisan.
   ============================================================ */
(function (root) {
  var N = 30000, JUMLAH = 7, TEKS = JUMLAH - 1;
  var rnd = Math.random, TAU = Math.PI * 2;

  /* ---------- Bentuk: N titik, satu titik = [x, y, z, glow]; glow 1 = menyala sendiri ---------- */
  function pack(pts){
    for (var i = 0; i < pts.length; i++) pts[i][4] = pts[i][1] + (rnd() - 0.5) * 0.25;
    pts.sort(function(a, b){ return a[4] - b[4]; });   // sorted by height so morphs stay coherent
    var pos = new Float32Array(N * 3), glow = new Float32Array(N);
    for (var j = 0; j < N; j++){
      pos[j*3] = pts[j][0]; pos[j*3+1] = pts[j][1]; pos[j*3+2] = pts[j][2];
      glow[j] = pts[j][3] || 0;
    }
    return {pos: pos, glow: glow};
  }
  // turn a shape so its best side faces the camera when it comes to rest
  function yaw(pts, a){
    var c = Math.cos(a), s = Math.sin(a);
    for (var i = 0; i < pts.length; i++){
      var x = pts[i][0], z = pts[i][2];
      pts[i][0] = x*c + z*s; pts[i][2] = -x*s + z*c;
    }
    return pts;
  }
  function ring(r, y){ var a = rnd()*TAU; return [Math.cos(a)*r, y, Math.sin(a)*r]; }

  function makeBulb(){
    var pts = [], cy = 0.55, GR = 1.15, cut = -0.75, neckR = Math.sqrt(GR*GR - cut*cut);
    var fil = [[-0.28, 0.22], [-0.14, 0.62], [0, 0.36], [0.14, 0.62], [0.28, 0.22]];
    function seg(ax, ay, bx, by, th, glow){
      var t = rnd();
      return [ax + (bx-ax)*t + (rnd()-.5)*th, ay + (by-ay)*t + (rnd()-.5)*th, (rnd()-.5)*th, glow];
    }
    while (pts.length < N){
      var k = rnd(), p;
      if (k < 0.5){                       // glass globe, open at the neck
        var u = rnd()*2 - 1;
        if (u*GR < cut) continue;
        var th = rnd()*TAU, r = Math.sqrt(1 - u*u)*GR;
        p = [Math.cos(th)*r, cy + u*GR, Math.sin(th)*r, 0];
      } else if (k < 0.59){               // neck tapering into the base
        var t = rnd(), s = t*t*(3 - 2*t);
        p = ring(neckR + (0.52 - neckR)*s, (cy + cut) + t*(-0.85 - (cy + cut)));
      } else if (k < 0.75){               // screw thread
        var yb = -0.85 - rnd()*0.7;
        p = ring(0.5 + 0.05*Math.abs(Math.sin(yb*Math.PI*7)), yb);
      } else if (k < 0.79){               // bottom cap and contact
        var tc = rnd();
        p = ring(0.5 - tc*0.34, -1.55 - tc*0.22);
      } else if (k < 0.87){               // glowing filament
        var si = Math.floor(rnd()*4);
        p = seg(fil[si][0], fil[si][1], fil[si+1][0], fil[si+1][1], 0.06, 1);
      } else if (k < 0.9){                // support wires
        var sx = rnd() < 0.5 ? -0.28 : 0.28;
        p = seg(sx, -0.75, sx, 0.22, 0.04, 0);
      } else {                            // idea rays
        var ri = Math.floor(rnd()*7), ang = (20 + ri*(140/6)) * Math.PI/180;
        var rr = 1.45 + rnd()*0.5, w = (rnd() - .5)*0.08;
        p = [Math.cos(ang)*rr - Math.sin(ang)*w, cy + Math.sin(ang)*rr + Math.cos(ang)*w, (rnd() - .5)*0.08, 1];
      }
      pts.push(p);
    }
    var S = 0.88, mid = 0.36;
    for (var i = 0; i < pts.length; i++){ pts[i][0] *= S; pts[i][1] = (pts[i][1] - mid)*S; pts[i][2] *= S; }
    return pts;
  }

  function facePoint(n, s, h){
    var p = [(rnd()*2-1)*h, (rnd()*2-1)*h, (rnd()*2-1)*h];
    p[n] = s*h;
    return p;
  }
  function makeBox(){
    var h = 1.2, pts = [], drop = -0.25;
    while (pts.length < N){
      var k = rnd(), p, s = rnd() < 0.5 ? -1 : 1;
      if (k < 0.1){
        var a = rnd()*TAU, v = rnd()*TAU, R = 0.42, r = 0.08 + rnd()*0.03;
        p = [s*0.42 + (R + r*Math.cos(v))*Math.cos(a), h + 0.3 + (R + r*Math.cos(v))*Math.sin(a)*0.62, r*Math.sin(v)];
      } else if (k < 0.3){
        if (rnd() < 0.5){ var n1 = rnd() < 0.5 ? 1 : 2; p = facePoint(n1, s, h); p[0] = (rnd()*2-1)*0.17; p[n1] += s*0.045; }
        else { var n2 = rnd() < 0.5 ? 1 : 0; p = facePoint(n2, s, h); p[2] = (rnd()*2-1)*0.17; p[n2] += s*0.045; }
      } else {
        p = facePoint(Math.floor(rnd()*3), s, h);
      }
      p[1] += drop;
      pts.push(p);
    }
    return pts;
  }

  function makeTowel(){
    var pts = [], rodY = 1.12, hw = 1.05, rr = 0.2, frontBot = -1.22, backBot = -0.45;
    function wave(x, y){
      var fade = Math.max(0, Math.min(1, (rodY - y) / 0.6));
      return (0.06*Math.sin(x*3.2 + y*1.3) + 0.03*Math.sin(x*7.0 - y*2.0)) * fade;
    }
    while (pts.length < N){
      var k = rnd(), x = (rnd()*2 - 1)*hw, p, y;
      if (k < 0.47){                      // front panel
        y = rodY - rnd()*(rodY - frontBot);
        p = [x, y, rr + wave(x, y)];
      } else if (k < 0.66){               // shorter back panel
        y = rodY - rnd()*(rodY - backBot);
        p = [x, y, -rr - wave(x, y)*0.8];
      } else if (k < 0.76){               // fold over the rod
        var a = rnd()*Math.PI;
        p = [x, rodY + Math.sin(a)*rr, Math.cos(a)*rr];
      } else if (k < 0.85){               // woven border band, slightly raised
        y = frontBot + 0.2 + rnd()*0.16;
        p = [x, y, rr + wave(x, y) + 0.045];
      } else if (k < 0.92){               // fringe
        var fx = Math.round(x/0.07)*0.07;
        p = [fx + (rnd() - .5)*0.02, frontBot - rnd()*0.22, rr + wave(fx, frontBot) + (rnd() - .5)*0.02];
      } else if (rnd() < 0.25){           // rod knobs
        var side = rnd() < 0.5 ? -1 : 1, u = rnd()*2 - 1, th = rnd()*TAU, r = Math.sqrt(1 - u*u)*0.11;
        p = [side*1.52 + Math.cos(th)*r, rodY + u*0.11, Math.sin(th)*r];
      } else {                            // rod
        var t2 = rnd()*TAU;
        p = [(rnd()*2 - 1)*1.45, rodY + Math.cos(t2)*0.05, Math.sin(t2)*0.05];
      }
      pts.push(p);
    }
    return pts;
  }

  function makeMug(){
    var R = 1.0, H = 1.12, shift = -0.28, pts = [];
    while (pts.length < N){
      var k = rnd(), a = rnd()*TAU, p;
      if (k < 0.56) p = [Math.cos(a)*R, (rnd()*2-1)*H, Math.sin(a)*R];
      else if (k < 0.68) p = [Math.cos(a)*R*0.9, H - rnd()*0.95, Math.sin(a)*R*0.9];
      else if (k < 0.74){ var rr = 0.9 + rnd()*0.1; p = [Math.cos(a)*rr, H, Math.sin(a)*rr]; }
      else if (k < 0.82){ var rb = Math.sqrt(rnd())*R; p = [Math.cos(a)*rb, -H, Math.sin(a)*rb]; }
      else {
        var u = (rnd()*2-1)*1.45, v = rnd()*TAU, MR = 0.55, mr = 0.12, cx = R - 0.05;
        p = [cx + (MR + mr*Math.cos(v))*Math.cos(u), (MR + mr*Math.cos(v))*Math.sin(u), mr*Math.sin(v)];
      }
      p[0] += shift;
      pts.push(p);
    }
    return pts;
  }

  function makeTumbler(){
    var pts = [], yb = -1.35, yt = 1.0, rb = 0.64, rt = 0.82, lidR = rt + 0.05, lidH = 0.28, drop = -0.3;
    function rAt(y){ return rb + (rt - rb)*(y - yb)/(yt - yb); }
    while (pts.length < N){
      var k = rnd(), a = rnd()*TAU, p, y;
      if (k < 0.58){                      // tapered body
        y = yb + rnd()*(yt - yb);
        p = [Math.cos(a)*rAt(y), y, Math.sin(a)*rAt(y)];
      } else if (k < 0.63){               // raised grip band
        y = -0.15 + rnd()*0.22;
        p = [Math.cos(a)*(rAt(y) + 0.035), y, Math.sin(a)*(rAt(y) + 0.035)];
      } else if (k < 0.67){               // base
        var r0 = Math.sqrt(rnd())*rb;
        p = [Math.cos(a)*r0, yb, Math.sin(a)*r0];
      } else if (k < 0.81){               // lid wall
        y = yt + rnd()*lidH;
        p = [Math.cos(a)*lidR, y, Math.sin(a)*lidR];
      } else if (k < 0.91){               // domed lid top
        var rt2 = Math.sqrt(rnd())*lidR, q = rt2/lidR;
        p = [Math.cos(a)*rt2, yt + lidH + 0.07*(1 - q*q), Math.sin(a)*rt2];
      } else {                            // straw
        var t = rnd(), th = rnd()*TAU;
        p = [0.22 + 0.2*t + Math.cos(th)*0.065, yt + lidH + 0.02 + t*0.68, Math.sin(th)*0.065];
      }
      p[1] += drop;
      pts.push(p);
    }
    return pts;
  }

  function makeHeart(){            // the implicit heart (x²+y²-1)³ - x²y³ <= 0, filled evenly and domed, so no seam shows
    var sc = 1.5, pts = [];
    while (pts.length < N){
      var x = (rnd()*2 - 1)*1.2, y = rnd()*2.4 - 1.15, a = x*x + y*y - 1, f = a*a*a - x*x*y*y*y;
      if (f > 0) continue;
      var z = (rnd() < 0.5 ? -1 : 1) * 0.42 * Math.pow(-f, 0.3);
      pts.push([x*sc, (y - 0.1)*sc, z*sc]);
    }
    return pts;
  }

  var TEXT_FONT = '"Hanken Grotesk",system-ui,Arial,sans-serif';
  function textCandidates(){       // pixels of the brand name drawn in the brand font; needs the page, so it stays on the main thread
    var W = 1400, H = 640, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d', {willReadFrequently: true});
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#000';
    // both lines set to the same width, so SOUVENIR sits as a justified second line
    function fit(txt){
      g.font = '700 200px ' + TEXT_FONT;
      var s = 200 * (W*0.92) / g.measureText(txt).width;
      g.font = '700 ' + s + 'px ' + TEXT_FONT;
      var m = g.measureText(txt);
      return {size: s, cap: m.actualBoundingBoxAscent || s*0.72};
    }
    var l1 = fit('MIXMAX'), l2 = fit('SOUVENIR'), gap = l1.size*0.2;
    var top = (H - (l1.cap + gap + l2.cap)) / 2;
    g.font = '700 ' + l1.size + 'px ' + TEXT_FONT;
    g.fillText('MIXMAX', W/2, top + l1.cap);
    g.font = '700 ' + l2.size + 'px ' + TEXT_FONT;
    g.fillText('SOUVENIR', W/2, top + l1.cap + gap + l2.cap);
    var d = g.getImageData(0, 0, W, H).data, cand = [];
    for (var y = 0; y < H; y += 2) for (var x = 0; x < W; x += 2) if (d[(y*W + x)*4 + 3] > 140) cand.push(x, y);
    return new Int16Array(cand);
  }
  function textPoints(cand){
    var W = 1400, H = 640, sc = 4.3 / W, pts = [];
    while (pts.length < N){
      var j = Math.floor(rnd()*cand.length/2)*2;
      pts.push([(cand[j] - W/2 + rnd()*2)*sc, -(cand[j+1] - H/2 + rnd()*2)*sc, (rnd()-0.5)*0.12]);
    }
    return pts;
  }

  var RESEP = [
    function () { return yaw(makeBox(), 0.6); },
    function () { return yaw(makeTowel(), -0.25); },
    function () { return yaw(makeMug(), -0.45); },
    function () { return makeTumbler(); },
    function () { return makeHeart(); }
  ];

  /* ---------- Berjalan sebagai Web Worker: hitung bentuk lalu kirim ke halaman ---------- */
  if (typeof document === 'undefined') {
    var kirim = function (k, s) { root.postMessage({ k: k, pos: s.pos, glow: s.glow }, [s.pos.buffer, s.glow.buffer]); };
    root.onmessage = function (e) {
      if (e.data.lampu === undefined) { kirim(TEKS, pack(textPoints(e.data))); return; }
      if (e.data.lampu) kirim(0, pack(makeBulb()));
      RESEP.forEach(function (f, i) { kirim(i + 1, pack(f())); });
    };
    return;
  }

  function buatLampu() { return pack(makeBulb()); }

  /**
   * Bentuk datang satu per satu lewat onBentuk(k, bentuk), dari worker atau, bila tidak ada, dari halaman ini.
   * opsi.lampu: lampu ikut dihitung di worker (cover membuatnya sendiri untuk gambar pertama).
   */
  function muatBentuk(onBentuk, opsi) {
    var ada = {}, worker = null, cand = null, lampu = !!(opsi && opsi.lampu);
    function terima(k, s) { ada[k] = true; onBentuk(k, s); }
    function diSini() {
      if (worker) { worker.terminate(); worker = null; }
      if (lampu && !ada[0]) terima(0, buatLampu());
      RESEP.forEach(function (f, i) { if (!ada[i + 1]) terima(i + 1, pack(f())); });
      if (cand) terima(TEKS, pack(textPoints(cand)));
    }
    try {
      worker = new Worker('js/bentuk3d.js');
      worker.onmessage = function (e) {
        terima(e.data.k, e.data);
        if (e.data.k === TEKS) { worker.terminate(); worker = null; }
      };
      worker.onerror = diSini;
      worker.postMessage({ lampu: lampu });
    } catch (e) { worker = null; diSini(); }
    function teks() {
      var c = textCandidates();
      if (!c.length) return;
      cand = c;
      if (worker) worker.postMessage(c);
      else terima(TEKS, pack(textPoints(c)));
    }
    if (document.fonts && document.fonts.load) {
      var selesai = false, sekali = function () { if (!selesai) { selesai = true; teks(); } };
      document.fonts.load('700 120px "Hanken Grotesk"').then(sekali, sekali);
      setTimeout(sekali, 3000);
    } else teks();
  }

  /**
   * Bila gambar tersendat, resolusi diturunkan selangkah demi selangkah. Mengembalikan fungsi yang dipanggil tiap frame.
   * batasMs: jeda rata-rata antar-frame yang dianggap tersendat.
   */
  function penjagaMulus(ambil, pasang, batasMs) {
    var lewati = 30, n = 0, jumlah = 0, coba = null, aktif = true;
    return function (ms) {
      if (!aktif || ms > 200) return;            // di atas 200 ms berarti pindah tab, bukan frame lambat
      if (lewati > 0) { lewati--; return; }
      jumlah += ms;
      if (++n < 45) return;
      var rata = jumlah / n;
      n = 0; jumlah = 0;
      if (coba && rata > coba.ms * 0.9) {        // tidak membaik (misalnya mode hemat baterai 30 fps): batalkan dan berhenti
        pasang(coba.dpr);
        aktif = false;
        return;
      }
      coba = null;
      if (rata > batasMs && ambil() > 1) {
        coba = { dpr: ambil(), ms: rata };
        lewati = 20;
        pasang(Math.max(1, ambil() - 0.35));
      }
    };
  }

  /* ---------- Shader titik ---------- */
  var VERTEX = [
    'attribute vec3 aTo; attribute float aRand; attribute float aGlow0; attribute float aGlow1; attribute float aTint;',
    'uniform float uProg, uTime, uScale, uSize, uMotion, uMouseOn, uBurst, uPush, uReach;',
    'uniform vec2 uMouse; uniform vec3 uRip;',
    'varying float vDepth; varying float vTone; varying float vGlow; varying float vTint; varying float vHue; varying float vSize; varying float vNear;',
    'void main(){',
    '  float d = aRand * 0.35;',
    '  float p = smoothstep(d, d + 0.65, uProg);',
    '  vec3 pos = mix(position, aTo, p);',
    '  float glow = mix(aGlow0, aGlow1, p);',
    '  float burst = sin(p * 3.14159265) * uBurst;',
    '  pos += normalize(pos + vec3(0.0001)) * burst * (0.25 + aRand * 0.8);',
    '  pos.y += burst * (aRand - 0.5) * 0.6;',
    '  float t = uTime * uMotion;',
    '  pos += vec3(sin(t*0.7 + aRand*43.0), cos(t*0.6 + aRand*29.0), sin(t*0.5 + aRand*17.0)) * 0.022;',
    '  vec4 world = modelMatrix * vec4(pos, 1.0);',
    '  vec2 dm = world.xy - uMouse;',
    '  float near = smoothstep(uReach, 0.0, length(dm)) * uMouseOn;',
    '  world.xy += normalize(dm + vec2(0.0001)) * near * uPush;',
    '  if (uRip.z > 0.0) {',                       // riak yang melebar dari titik klik
    '    vec2 dr = world.xy - uRip.xy;',
    '    float gap = (length(dr) - uRip.z * 4.0) * 2.5;',
    '    float wave = exp(-gap * gap) * (1.0 - clamp(uRip.z / 1.4, 0.0, 1.0));',
    '    world.xy += normalize(dr + vec2(0.0001)) * wave * 0.5;',
    '    near = max(near, wave);',
    '  }',
    '  vec4 mv = viewMatrix * world;',
    '  gl_Position = projectionMatrix * mv;',
    '  if (glow > 0.001) {',
    '    vec4 mv2 = mv; mv2.z = min(mv2.z + 2.6 * glow, -0.2);',
    '    vec4 c2 = projectionMatrix * mv2;',
    '    gl_Position.z = c2.z / c2.w * gl_Position.w;',
    '  }',
    '  gl_PointSize = max(2.0, uSize * uScale * (0.65 + aRand * 0.7) * (1.0 + 0.25 * glow + 0.6 * near) / -mv.z);',
    '  vDepth = -mv.z; vTone = aRand; vGlow = glow; vSize = gl_PointSize; vNear = near;',
    '  vTint = aTint + (aRand - 0.5) * 0.18 + 0.05 * sin(t*0.5 + world.y*1.2);',   // kilau pelan yang melintasi gradasi
    '  vHue = aTint + aRand * 0.05 + t * 0.035;',
    '}'
  ].join('\n');
  var FRAGMENT = [
    'uniform vec3 uFog, uWarm, uInk, uBronze, uGold; uniform float uFogNear, uFogFar, uPulse, uSoft, uRainbow;',
    'varying float vDepth; varying float vTone; varying float vGlow; varying float vTint; varying float vHue; varying float vSize; varying float vNear;',
    'vec3 pelangi(float h){',
    '  vec3 p = abs(fract(vec3(h) + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);',
    '  return mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), 0.85) * 0.9;',
    '}',
    'void main(){',
    '  vec2 c = gl_PointCoord * 2.0 - 1.0;',
    '  float r2 = dot(c, c); if (r2 > 1.0) discard;',
    '  float g = clamp(vTint, 0.0, 1.0);',           // gradasi merek: espresso di bawah, bronze, champagne di atas
    '  vec3 col = g < 0.5 ? mix(uInk, uBronze, g * 2.0) : mix(uBronze, uGold, (g - 0.5) * 2.0);',
    '  col = mix(col, pelangi(fract(vHue)), max(uRainbow, vNear));',
    '  col *= 0.94 + vTone * 0.12;',
    '  col = mix(col, uWarm * uPulse, vGlow);',
    '  float fog = smoothstep(uFogNear, uFogFar, vDepth) * (1.0 - 0.75 * vGlow);',
    '  float edge = clamp((1.0 - sqrt(r2)) * vSize * 0.5, 0.0, 1.0);',   // tepi lembut satu piksel, dihaluskan alphaToCoverage
    '  gl_FragColor = vec4(mix(col, uFog, max(fog * 0.82, uSoft * (1.0 - vNear))), edge);',
    '}'
  ].join('\n');

  function angkaAcak(n, lo, hi, THREE) {
    var a = new Float32Array(n);
    for (var i = 0; i < n; i++) a[i] = lo + rnd() * (hi - lo);
    return new THREE.BufferAttribute(a, 1);
  }

  /**
   * Adegan partikel lengkap: objek, cahaya lampu, dua cincin, debu, dan reaksi kursor.
   * opsi: pelangi, diam (gerak minimal), kuat (pakai GPU terkuat), lembut, lembutCincin,
   *       dorong, jangkau (reaksi kursor), riak (gelombang saat klik), cahaya (terang lampu),
   *       tintMaks (batas atas gradasi warna merek; default 1 = sampai champagne).
   */
  function buatAdegan(kanvas, opsi) {
    var THREE = root.THREE, diam = !!opsi.diam, tanH = Math.tan(19 * Math.PI / 180);
    var renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: true, alpha: false, powerPreference: opsi.kuat ? 'high-performance' : 'default' });
    renderer.setClearColor(0xFDF9F3, 1);
    var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80), group = new THREE.Group();
    scene.add(group);

    var bersama = {
      uTime: { value: 0 }, uScale: { value: 1 }, uMotion: { value: diam ? 0 : 1 }, uPulse: { value: 1 },
      uMouse: { value: new THREE.Vector2(99, 99) }, uMouseOn: { value: 0 }, uRip: { value: new THREE.Vector3(0, 0, 0) },
      uPush: { value: opsi.dorong }, uReach: { value: opsi.jangkau }, uRainbow: { value: opsi.pelangi ? 1 : 0 },
      uFogNear: { value: 6 }, uFogFar: { value: 12 }, uFog: { value: new THREE.Color('#FDF9F3') }, uWarm: { value: new THREE.Color('#E0A93B') },
      uInk: { value: new THREE.Color('#292524') }, uBronze: { value: new THREE.Color('#8C6B3E') }, uGold: { value: new THREE.Color('#C5A880') }
    };
    function bahan(ukuran, ledak, lembut) {
      return new THREE.ShaderMaterial({
        vertexShader: VERTEX, fragmentShader: FRAGMENT, alphaToCoverage: true,
        uniforms: Object.assign({ uProg: { value: 0 }, uSize: { value: ukuran }, uBurst: { value: ledak }, uSoft: { value: lembut } }, bersama)
      });
    }

    var geo = new THREE.BufferGeometry();
    ['aGlow0', 'aGlow1'].forEach(function (a) { geo.setAttribute(a, new THREE.BufferAttribute(new Float32Array(N), 1)); });
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('aTo', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('aRand', angkaAcak(N, 0, 1, THREE));
    // warna menurut peringkat tinggi: bentuk terurut dari bawah ke atas, jadi indeks i selalu titik terendah ke-i
    var tint = new Float32Array(N);
    for (var ti = 0; ti < N; ti++) tint[ti] = ti / N * (opsi.tintMaks || 1);
    geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
    var mat = bahan(0.028, 0.7, opsi.lembut);
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    group.add(points);

    // cahaya hangat di dalam bola lampu
    var hc = document.createElement('canvas');
    hc.width = hc.height = 128;
    var hg = hc.getContext('2d'), grad = hg.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,196,90,0.9)');
    grad.addColorStop(0.35, 'rgba(255,184,70,0.35)');
    grad.addColorStop(1, 'rgba(255,184,70,0)');
    hg.fillStyle = grad;
    hg.fillRect(0, 0, 128, 128);
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(hc), transparent: true, depthTest: false, depthWrite: false, opacity: 0 }));
    halo.position.set(0, 0.08, 0);
    halo.scale.set(3.4, 3.4, 1);
    group.add(halo);

    // dua cincin halus di bawah objek
    var cincinPos = [], cincinTint = [];
    [1.75, 2.2].forEach(function (r) {
      var cnt = Math.round(N * 0.016 * r);
      for (var i = 0; i < cnt; i++) {
        var a = rnd() * TAU, rr = r + (rnd() - 0.5) * 0.03;
        cincinPos.push(Math.cos(a) * rr, (rnd() - 0.5) * 0.01, Math.sin(a) * rr);
        cincinTint.push(opsi.pelangi ? a / TAU : 0.5);
      }
    });
    var cincinArr = new Float32Array(cincinPos), cincinN = cincinArr.length / 3;
    var cincinGeo = new THREE.BufferGeometry();
    cincinGeo.setAttribute('position', new THREE.BufferAttribute(cincinArr, 3));
    cincinGeo.setAttribute('aTo', new THREE.BufferAttribute(cincinArr, 3));
    cincinGeo.setAttribute('aRand', angkaAcak(cincinN, 0, 0.6, THREE));
    cincinGeo.setAttribute('aGlow0', new THREE.BufferAttribute(new Float32Array(cincinN), 1));
    cincinGeo.setAttribute('aGlow1', new THREE.BufferAttribute(new Float32Array(cincinN), 1));
    cincinGeo.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(cincinTint), 1));
    var rings = new THREE.Points(cincinGeo, bahan(0.018, 0, opsi.lembutCincin));
    rings.frustumCulled = false;
    scene.add(rings);

    // bintik bronze yang melayang
    var DEBU = Math.min(innerWidth, innerHeight) < 700 ? 70 : 140, debuArr = new Float32Array(DEBU * 3);
    for (var i = 0; i < DEBU; i++) { debuArr[i * 3] = (rnd() * 2 - 1) * 9; debuArr[i * 3 + 1] = (rnd() * 2 - 1) * 6; debuArr[i * 3 + 2] = -6 + rnd() * 10; }
    var debuGeo = new THREE.BufferGeometry();
    debuGeo.setAttribute('position', new THREE.BufferAttribute(debuArr, 3));
    debuGeo.setAttribute('aRand', angkaAcak(DEBU, 0, 1, THREE));
    var debu = new THREE.Points(debuGeo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: bersama.uTime, uScale: bersama.uScale, uMotion: bersama.uMotion },
      vertexShader: [
        'attribute float aRand; uniform float uTime, uScale, uMotion; varying float vA;',
        'void main(){',
        '  vec3 p = position; float t = uTime * uMotion;',
        '  p.y = mod(p.y - t*(0.12 + aRand*0.25) + 6.0, 12.0) - 6.0;',
        '  p.x += sin(t*0.4 + aRand*20.0) * 0.3;',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  gl_Position = projectionMatrix * mv;',
        '  gl_PointSize = (0.012 + aRand*0.018) * uScale / -mv.z;',
        '  vA = 0.12 + aRand*0.2;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying float vA;',
        'void main(){ vec2 c = gl_PointCoord*2.0-1.0; float r = dot(c,c); if (r > 1.0) discard;',
        '  gl_FragColor = vec4(0.773, 0.659, 0.502, vA * (1.0 - r)); }'
      ].join('\n')
    }));
    debu.frustumCulled = false;
    scene.add(debu);

    /* ---------- Kursor: butir terdekat menghindar dan berubah warna; klik membuat riak ---------- */
    var W = 1, H = 1, ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    var hit = new THREE.Vector3(), ndc = new THREE.Vector2(), kursorT = new THREE.Vector2(99, 99), kursorOn = 0, umurRiak = -1;
    function keDunia(e) {
      ndc.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(plane, hit);
    }
    window.addEventListener('pointermove', function (e) {
      if (!keDunia(e)) return;
      if (kursorOn === 0) bersama.uMouse.value.set(hit.x, hit.y);
      kursorT.set(hit.x, hit.y);
      kursorOn = 1;
    }, { passive: true });
    if (opsi.riak) window.addEventListener('pointerdown', function (e) {
      if (!keDunia(e)) return;
      bersama.uRip.value.set(hit.x, hit.y, 0.001);
      umurRiak = 0.001;
    }, { passive: true });
    var lepas = function () { kursorOn = 0; };
    document.addEventListener('pointerleave', lepas);
    window.addEventListener('pointercancel', lepas);
    window.addEventListener('blur', lepas);
    window.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') lepas(); });

    return {
      group: group, rings: rings, tanH: tanH,
      pasang: function (a, b) {            // pasangan bentuk: a saat prog 0, b saat prog 1
        var at = geo.attributes;
        at.position.array.set(a.pos); at.aTo.array.set(b.pos);
        at.aGlow0.array.set(a.glow); at.aGlow1.array.set(b.glow);
        at.position.needsUpdate = at.aTo.needsUpdate = at.aGlow0.needsUpdate = at.aGlow1.needsUpdate = true;
      },
      ukur: function (w, h, dpr, jarak) {
        W = w; H = h;
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.position.set(0, jarak * 0.07, jarak);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        bersama.uScale.value = (h * dpr) / (2 * tanH);
        bersama.uFogNear.value = jarak - 1.6;
        bersama.uFogFar.value = jarak + 3.6;
      },
      tempatkan: function (x, y, miringCincin) {
        group.position.set(x, y, 0);
        rings.position.set(x, y - 2.15, 0);
        rings.rotation.x = miringCincin;
      },
      perbarui: function (dt, waktu, prog, lampu) {
        mat.uniforms.uProg.value = prog;
        bersama.uTime.value = waktu;
        var denyut = diam ? 1 : 0.95 + 0.07 * Math.sin(waktu * 2.1);
        bersama.uPulse.value = denyut;
        halo.material.opacity = lampu * opsi.cahaya * denyut;
        bersama.uMouseOn.value += (kursorOn - bersama.uMouseOn.value) * (1 - Math.exp(-dt * 5));
        bersama.uMouse.value.lerp(kursorT, 1 - Math.exp(-dt * 10));
        if (umurRiak > 0) {
          umurRiak += dt;
          bersama.uRip.value.z = umurRiak;
          if (umurRiak > 1.4) { umurRiak = -1; bersama.uRip.value.z = 0; }
        }
        rings.rotation.y = diam ? 0 : waktu * 0.05;
      },
      gambar: function () { renderer.render(scene, camera); }
    };
  }

  root.MMX3D = { JUMLAH: JUMLAH, buatLampu: buatLampu, muatBentuk: muatBentuk, penjagaMulus: penjagaMulus, buatAdegan: buatAdegan };
})(self);
