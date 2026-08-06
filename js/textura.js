// ============================================================
// CABAS REALTOR — textura del fondo + retrato B&N con corbata roja
// ------------------------------------------------------------
// 1) Inyecta un canvas fijo con micro-partículas doradas muy lentas
//    (el "negro con vida"). Los brillos dorados van por CSS (body::before).
// 2) Procesa los <canvas class="retrato-rojo" data-src="..."> para
//    mostrarlos en blanco y negro dejando en rojo la corbata.
// Respeta prefers-reduced-motion.
// ============================================================
(function () {
  'use strict';

  // ---------- 1) Micro-partículas de fondo ----------
  function iniciarPolvo() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = document.createElement('canvas');
    cv.id = 'polvo-fondo';
    cv.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none';
    document.body.prepend(cv);
    const ctx = cv.getContext('2d');
    let W, H, parts;
    function init() {
      W = cv.width = innerWidth; H = cv.height = innerHeight;
      const n = Math.min(150, Math.round(W * H / 12000));
      parts = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + .7,
        a: Math.random() * .40 + .32, tw: Math.random() * .022 + .006, ph: Math.random() * 6.28,
        vx: (Math.random() - .5) * .12, vy: (Math.random() - .5) * .12
      }));
    }
    init(); addEventListener('resize', init);
    let t = 0;
    (function loop() {
      t++; ctx.clearRect(0, 0, W, H);
      ctx.shadowColor = 'rgba(207,172,102,.55)';
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        const al = p.a * (0.55 + 0.45 * Math.sin(t * p.tw + p.ph));
        ctx.shadowBlur = p.r * 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28);
        ctx.fillStyle = 'rgba(212,178,110,' + al + ')'; ctx.fill();
      }
      ctx.shadowBlur = 0;
      requestAnimationFrame(loop);
    })();
  }

  // ---------- 2) Retrato B&N con la corbata en rojo ----------
  // Uso: <canvas class="retrato-rojo" width=".." height=".."
  //        data-src="assets/foto.jpg"
  //        data-crop="sx,sy,sw"           (recorte de origen; sh se calcula)
  //        data-zona="x0,x1,y0,y1"></canvas>  (caja de la corbata, 0-1)
  function procesarRetrato(cv) {
    const ctx = cv.getContext('2d');
    const img = new Image();
    img.onload = function () {
      const crop = (cv.dataset.crop || '').split(',').map(Number);
      const zona = (cv.dataset.zona || '0.37,0.60,0.30,0.86').split(',').map(Number);
      // Umbral de detección de rojo configurable por foto: data-rojo="rmin,gbmax,ratio"
      // (por defecto pensado para corbatas de rojo brillante). data-boost sube el
      // brillo del rojo para corbatas de rojo oscuro/granate.
      const rc = (cv.dataset.rojo || '').split(',').map(Number);
      const RMIN = rc[0] || 115, GBMAX = rc[1] || 78, RATIO = rc[2] || 1.75;
      const BOOST = parseFloat(cv.dataset.boost) || 1.08;
      let sx = crop[0], sy = crop[1], sw = crop[2];
      if (!sw) { sx = 0; sy = 0; sw = img.width; }
      const sh = sw * (cv.height / cv.width);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      const d = ctx.getImageData(0, 0, cv.width, cv.height), p = d.data, W = cv.width, H = cv.height;
      for (let i = 0; i < p.length; i += 4) {
        const idx = i / 4, x = (idx % W) / W, y = ((idx / W) | 0) / H;
        const r = p[i], g = p[i + 1], b = p[i + 2];
        const esRojo = r > RMIN && r > g * RATIO && r > b * RATIO && g < GBMAX && b < GBMAX;
        const enZona = x > zona[0] && x < zona[1] && y > zona[2] && y < zona[3];
        if (esRojo && enZona) {
          p[i] = Math.min(255, r * BOOST); p[i + 1] = g * 0.85; p[i + 2] = b * 0.85;
        } else {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          const c = Math.max(0, Math.min(255, (gray - 128) * 1.12 + 128));
          p[i] = p[i + 1] = p[i + 2] = c;
        }
      }
      ctx.putImageData(d, 0, 0);
    };
    img.src = cv.dataset.src;
  }

  function init() {
    iniciarPolvo();
    document.querySelectorAll('canvas.retrato-rojo').forEach(procesarRetrato);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
