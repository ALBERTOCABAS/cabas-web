// ============================================================
// CABAS REALTOR — "Kitty", asistente y captador de leads
// ------------------------------------------------------------
// Widget flotante autocontenido. Se monta en el DOM normal (NO en
// Shadow DOM) para que el traductor de Google de la web lo traduzca
// igual que el resto de la página. Para no chocar con el CSS de la
// web, TODO va bajo el contenedor #kitty-root y sus clases llevan
// prefijo "k-".
//
// Usa el MISMO motor de cálculo que las páginas (js/calc-core.js)
// → las cifras del chat son idénticas a las de la web. Al terminar,
// prepara un WhatsApp/email a Alberto con el lead cualificado y, si
// hay CFG.leadKey, lo envía en segundo plano (Web3Forms).
//
// Requiere, cargados antes:  datos-cabas.js  →  calc-core.js
// Incluir al final de cada página:
//   <script src="js/cabas-chatbot.js" defer></script>
// ============================================================
(function () {
  'use strict';
  if (window.__cabasChatCargado) return;
  window.__cabasChatCargado = true;

  // ---------- Configuración (datos reales de Alberto) ----------
  const CFG = {
    asistente: 'Kitty',
    nombre: 'Alberto Cabas',
    telHref: '+34662669014',
    telShow: '662 669 014',
    wa: '34662669014',
    email: (typeof OFICINAS !== 'undefined' && OFICINAS.alberto) ? OFICINAS.alberto.email : 'alberto@cabas.es',
    // Aviso automático del lead por email (Web3Forms). Ver web3forms.com.
    leadEndpoint: 'https://api.web3forms.com/submit',
    leadKey: '00c2dba0-ec58-4fa8-b849-3a5839f3fd86',
    privacidadURL: 'privacidad.html'
  };

  const HOY = new Date().toISOString().slice(0, 10);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Formato ----------
  const _miles = e => e.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const eurW = n => (n < 0 ? '−' : '') + _miles(String(Math.round(Math.abs(n)))) + ' €';
  const eur2W = n => { const a = Math.abs(n).toFixed(2).split('.'); return (n < 0 ? '−' : '') + _miles(a[0]) + ',' + a[1] + ' €'; };
  if (typeof window.eur !== 'function') window.eur = eurW;
  if (typeof window.eur2 !== 'function') window.eur2 = eur2W;

  const soloDigitos = s => (s || '').replace(/[^\d]/g, '');
  const parseNum = s => { const n = parseFloat(soloDigitos(s)); return isNaN(n) ? 0 : n; };
  const telOk = s => { const d = soloDigitos(s); const t = d.length === 11 && d.startsWith('34') ? d.slice(2) : d; return /^[6-9]\d{8}$/.test(t); };

  // ============================================================
  // ESTILOS — todo bajo #kitty-root, clases con prefijo k-
  // (aislado del CSS de la web por scope + prefijo; sin Shadow DOM
  //  para que el traductor de Google pueda traducir el texto)
  // ============================================================
  const CSS = `
  #kitty-root, #kitty-root *{ box-sizing:border-box; }
  #kitty-root *{ margin:0; padding:0; }
  #kitty-root button{ font-family:inherit; border:none; background:none; cursor:pointer; color:inherit; }
  #kitty-root input, #kitty-root select{ font-family:inherit; }
  #kitty-root a{ text-decoration:none; color:inherit; }
  #kitty-root svg{ display:inline-block; vertical-align:middle; }
  #kitty-root p, #kitty-root h4, #kitty-root h5, #kitty-root form{ margin:0; }
  #kitty-root{
    --tinta:#1B1712; --tinta2:#5C5446; --crema:#F6F2E9; --sup:#FFFFFF; --sup2:#FBF8F1;
    --oro:#8A6B27; --oro-br:#B28E44; --oro-cl:#725722; --negro:#0B0A08;
    --linea:rgba(150,116,46,.30); --linea-sutil:rgba(27,23,18,.10);
    --verde:#5E7D3B; --ambar:#9A7529; --rojo:#B23B32; --wa:#25D366;
    position:fixed; right:20px; bottom:20px; z-index:2147483000;
    color:var(--tinta); font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:15px; line-height:1.5; text-align:left; font-weight:400;
  }
  #kitty-root .k-launcher{
    display:flex; align-items:center; gap:.6rem; background:var(--oro-br); color:var(--negro);
    padding:.75rem 1.15rem .75rem .85rem; border-radius:999px;
    box-shadow:0 8px 30px rgba(0,0,0,.45), 0 0 0 1px rgba(207,172,102,.5);
    font-weight:600; font-size:.95rem; letter-spacing:.01em; position:relative;
    transition:transform .18s ease, box-shadow .18s ease;
  }
  #kitty-root .k-launcher:hover{ transform:translateY(-2px); box-shadow:0 12px 34px rgba(0,0,0,.55),0 0 0 1px #CFAC66; }
  #kitty-root .k-launcher svg{ width:26px; height:26px; flex:0 0 auto; }
  #kitty-root .k-launcher .k-lb{ white-space:nowrap; }
  #kitty-root .k-pulse{ position:absolute; top:-2px; right:-2px; width:12px; height:12px; background:var(--verde); border-radius:50%; border:2px solid #fff; }
  #kitty-root .k-launcher.k-oculto{ display:none; }
  #kitty-root .k-panel{
    position:absolute; right:0; bottom:0; width:min(384px, calc(100vw - 32px));
    height:min(640px, calc(100vh - 40px));
    background:var(--crema); border:1px solid var(--linea); border-radius:16px;
    box-shadow:0 24px 70px rgba(0,0,0,.5); overflow:hidden;
    display:none; flex-direction:column; opacity:0; transform:translateY(14px) scale(.98);
    transition:opacity .22s ease, transform .22s ease;
  }
  #kitty-root .k-panel.k-abierto{ display:flex; opacity:1; transform:none; }
  #kitty-root .k-head{ display:flex; align-items:center; gap:.7rem; padding:.85rem 1rem;
    background:linear-gradient(180deg,var(--sup2),var(--crema)); border-bottom:1px solid var(--linea); }
  #kitty-root .k-ac{ width:42px; height:42px; flex:0 0 auto; border-radius:50%; display:grid; place-items:center;
    background:radial-gradient(120% 120% at 30% 20%, #fff, #F1E9D6);
    border:1.5px solid var(--oro-br); color:var(--oro); font-family:'Cormorant Garamond',Georgia,serif;
    font-weight:600; font-size:1.4rem; letter-spacing:.02em; }
  #kitty-root .k-head-txt{ flex:1; min-width:0; }
  #kitty-root .k-head-txt h4{ font-family:'Cormorant Garamond',Georgia,serif; font-weight:600; font-size:1.32rem; color:var(--tinta); line-height:1.1; }
  #kitty-root .k-head-txt p{ font-size:.73rem; color:var(--tinta2); letter-spacing:.02em; display:flex; align-items:center; gap:.35rem; }
  #kitty-root .k-dot{ width:7px; height:7px; border-radius:50%; background:var(--verde); box-shadow:0 0 0 3px rgba(94,125,59,.18); }
  #kitty-root .k-head button{ color:var(--tinta2); padding:.3rem; border-radius:6px; line-height:0; }
  #kitty-root .k-head button:hover{ color:var(--tinta); background:rgba(27,23,18,.06); }
  #kitty-root .k-head button svg{ width:19px; height:19px; }
  #kitty-root .k-msgs{ flex:1; overflow-y:auto; padding:1.1rem 1rem .5rem; display:flex; flex-direction:column; gap:.7rem;
    scrollbar-width:thin; scrollbar-color:var(--linea) transparent; }
  #kitty-root .k-msgs::-webkit-scrollbar{ width:7px; } #kitty-root .k-msgs::-webkit-scrollbar-thumb{ background:var(--linea); border-radius:4px; }
  #kitty-root .k-row{ display:flex; gap:.55rem; align-items:flex-end; max-width:100%; }
  #kitty-root .k-row.k-user{ flex-direction:row-reverse; }
  #kitty-root .k-av{ width:27px; height:27px; flex:0 0 auto; border-radius:50%; display:grid; place-items:center;
    background:#FFFDF8; border:1px solid var(--oro-br); color:var(--oro); font-family:'Cormorant Garamond',serif; font-size:.9rem; font-weight:600; }
  #kitty-root .k-row.k-user .k-av{ display:none; }
  #kitty-root .k-bubble{ padding:.6rem .8rem; border-radius:14px; font-size:.9rem; max-width:83%; word-wrap:break-word; }
  #kitty-root .k-row.k-bot .k-bubble{ background:var(--sup); border:1px solid var(--linea-sutil); border-bottom-left-radius:5px; color:var(--tinta); box-shadow:0 1px 2px rgba(27,23,18,.04); }
  #kitty-root .k-row.k-user .k-bubble{ background:var(--oro-br); color:var(--negro); border-bottom-right-radius:5px; font-weight:500; }
  #kitty-root .k-bubble b{ color:var(--oro); font-weight:600; } #kitty-root .k-row.k-user .k-bubble b{ color:var(--negro); }
  #kitty-root .k-bubble small{ display:block; margin-top:.25rem; color:var(--tinta2); font-size:.76rem; }
  #kitty-root .k-bubble a{ color:var(--oro); text-decoration:underline; }
  #kitty-root .k-typing{ display:inline-flex; gap:4px; padding:.7rem .85rem; background:var(--sup); border:1px solid var(--linea-sutil); border-radius:14px; border-bottom-left-radius:5px; }
  #kitty-root .k-typing i{ width:7px; height:7px; border-radius:50%; background:var(--tinta2); animation:kbl 1.2s infinite; }
  #kitty-root .k-typing i:nth-child(2){ animation-delay:.2s; } #kitty-root .k-typing i:nth-child(3){ animation-delay:.4s; }
  @keyframes kbl{ 0%,60%,100%{opacity:.3;transform:translateY(0)} 30%{opacity:1;transform:translateY(-3px)} }
  #kitty-root .k-chips{ display:flex; flex-wrap:wrap; gap:.45rem; padding:.15rem 0 .3rem 34px; }
  #kitty-root .k-chip{ background:var(--sup); border:1px solid var(--oro-br); color:var(--oro);
    padding:.5rem .8rem; border-radius:999px; font-size:.84rem; font-weight:600; transition:all .15s ease; }
  #kitty-root .k-chip:hover{ background:var(--oro-br); color:#fff; }
  #kitty-root .k-chip.k-ghost{ border-color:var(--linea-sutil); color:var(--tinta2); font-weight:500; }
  #kitty-root .k-chip.k-ghost:hover{ background:rgba(27,23,18,.05); color:var(--tinta); border-color:var(--tinta2); }
  #kitty-root .k-card{ background:var(--sup); border:1px solid var(--linea); border-radius:12px; padding:.85rem .9rem; max-width:100%; margin-left:34px; box-shadow:0 2px 8px rgba(27,23,18,.05); }
  #kitty-root .k-card h5{ font-family:'Cormorant Garamond',serif; font-weight:600; font-size:1.12rem; color:var(--tinta); margin-bottom:.55rem; display:flex; align-items:center; gap:.4rem; }
  #kitty-root .k-li{ display:flex; justify-content:space-between; align-items:baseline; gap:.9rem; padding:.28rem 0; font-size:.85rem; border-bottom:1px dashed var(--linea-sutil); }
  #kitty-root .k-li:last-of-type{ border-bottom:none; }
  #kitty-root .k-li .k-k{ color:var(--tinta2); min-width:0; } #kitty-root .k-li .k-v{ font-variant-numeric:tabular-nums; font-weight:600; color:var(--tinta); white-space:nowrap; flex:0 0 auto; text-align:right; }
  #kitty-root .k-li.k-total{ margin-top:.3rem; padding-top:.5rem; border-top:1px solid var(--linea); border-bottom:none; }
  #kitty-root .k-li.k-total .k-k{ color:var(--tinta); font-weight:600; }
  #kitty-root .k-li.k-total .k-v{ color:var(--oro); font-size:1.15rem; }
  #kitty-root .k-aviso{ font-size:.78rem; color:var(--tinta2); margin-top:.55rem; padding-left:.7rem; border-left:2px solid var(--linea); }
  #kitty-root .k-aviso.k-verde{ border-color:var(--verde); } #kitty-root .k-aviso.k-ambar{ border-color:var(--ambar); } #kitty-root .k-aviso.k-rojo{ border-color:var(--rojo); color:#8a2f28; }
  #kitty-root .k-disc{ font-size:.72rem; color:var(--tinta2); margin-top:.6rem; font-style:italic; }
  #kitty-root .k-acts{ display:flex; flex-direction:column; gap:.5rem; margin:.2rem 0 .4rem 34px; }
  #kitty-root .k-btn{ display:flex; align-items:center; justify-content:center; gap:.5rem; padding:.7rem 1rem; border-radius:10px; font-weight:600; font-size:.9rem; }
  #kitty-root .k-btn svg{ width:19px; height:19px; }
  #kitty-root .k-btn-wa{ background:var(--wa); color:#062e14; } #kitty-root .k-btn-wa:hover{ filter:brightness(1.05); }
  #kitty-root .k-btn-line{ background:var(--sup); border:1px solid var(--linea); color:var(--tinta); }
  #kitty-root .k-btn-line:hover{ border-color:var(--oro-br); color:var(--oro); }
  #kitty-root .k-composer{ display:none; align-items:center; gap:.5rem; padding:.7rem .8rem; border-top:1px solid var(--linea); background:var(--sup2); }
  #kitty-root .k-composer.k-on{ display:flex; }
  #kitty-root .k-composer input{ flex:1; background:var(--sup); border:1px solid var(--linea); color:var(--tinta); padding:.6rem .8rem; border-radius:9px; font-size:.9rem; outline:none; }
  #kitty-root .k-composer input::placeholder{ color:#9a9082; }
  #kitty-root .k-composer input:focus{ border-color:var(--oro-br); box-shadow:0 0 0 3px rgba(178,142,68,.14); }
  #kitty-root .k-composer button{ background:var(--oro-br); color:var(--negro); width:40px; height:40px; border-radius:9px; display:grid; place-items:center; flex:0 0 auto; }
  #kitty-root .k-composer button:hover{ background:#C69C4C; }
  #kitty-root .k-composer button svg{ width:20px; height:20px; }
  #kitty-root .k-err{ padding:0 .8rem; } #kitty-root .k-err span{ color:var(--rojo); font-size:.75rem; }
  #kitty-root .k-legal{ text-align:center; font-size:.66rem; color:var(--tinta2); padding:.4rem .8rem .5rem; }
  #kitty-root .k-legal a{ color:var(--tinta2); text-decoration:underline; }
  @media (max-width:480px){ #kitty-root{ right:14px; bottom:14px; } #kitty-root .k-panel{ width:calc(100vw - 20px); height:calc(100vh - 28px); right:-4px; bottom:-2px; } }
  @media (prefers-reduced-motion: reduce){ #kitty-root *{ animation:none!important; transition:none!important; } }
  `;

  // ============================================================
  // Montaje en el DOM normal
  // ============================================================
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'kitty-root';
  root.setAttribute('aria-live', 'polite');
  root.innerHTML = `
    <button class="k-launcher" id="k-lz" aria-label="Abrir a Kitty, el asistente de Alberto Cabas">
      <span class="k-pulse"></span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      <span class="k-lb">Habla con Kitty</span>
    </button>
    <section class="k-panel" id="k-pn" role="dialog" aria-label="Kitty, asistente de Alberto Cabas">
      <header class="k-head">
        <div class="k-ac">K</div>
        <div class="k-head-txt">
          <h4>Kitty</h4>
          <p><span class="k-dot"></span> Asistente de Alberto Cabas</p>
        </div>
        <button id="k-reset" aria-label="Empezar de nuevo" title="Empezar de nuevo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        <button id="k-min" aria-label="Minimizar" title="Minimizar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>
        </button>
      </header>
      <div class="k-msgs" id="k-msgs"></div>
      <div class="k-err" id="k-err"></div>
      <form class="k-composer" id="k-composer">
        <input id="k-inp" autocomplete="off" />
        <button type="submit" aria-label="Enviar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>
        </button>
      </form>
      <p class="k-legal">Estimaciones orientativas · no constituye asesoramiento fiscal ni financiero</p>
    </section>
  `;
  document.body.appendChild(root);

  const $ = id => root.querySelector('#' + id);
  const lz = $('k-lz'), pn = $('k-pn'), msgs = $('k-msgs'), composer = $('k-composer'), inp = $('k-inp'), errBox = $('k-err');

  let activeSubmit = null;
  composer.addEventListener('submit', e => e.preventDefault());
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      if (composer.requestSubmit) composer.requestSubmit();
      else composer.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });

  // ---------- Apertura / cierre / reinicio ----------
  let iniciado = false;
  function abrir() { pn.classList.add('k-abierto'); lz.classList.add('k-oculto'); if (!iniciado) { iniciado = true; conversacion(); } }
  function minimizar() { pn.classList.remove('k-abierto'); lz.classList.remove('k-oculto'); }
  function reiniciar() {
    if (activeSubmit) { composer.removeEventListener('submit', activeSubmit); activeSubmit = null; }
    composer.classList.remove('k-on'); errBox.innerHTML = ''; msgs.innerHTML = '';
    conversacion();
  }
  lz.addEventListener('click', abrir);
  $('k-min').addEventListener('click', minimizar);
  $('k-reset').addEventListener('click', reiniciar);

  // ============================================================
  // Helpers de conversación
  // ============================================================
  function scrollAbajo() {
    requestAnimationFrame(() => { msgs.scrollTop = msgs.scrollHeight; });
    setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 70);
  }
  const espera = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
  function nodo(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }

  function burbujaBot(html) {
    const row = nodo(`<div class="k-row k-bot"><div class="k-av">K</div><div class="k-bubble">${html}</div></div>`);
    msgs.appendChild(row); scrollAbajo(); return row;
  }
  function burbujaUser(txt) {
    const row = nodo(`<div class="k-row k-user"><div class="k-bubble"></div></div>`);
    row.querySelector('.k-bubble').textContent = txt; msgs.appendChild(row); scrollAbajo();
  }
  async function botDice(html, pausa = 650) {
    const t = nodo(`<div class="k-row k-bot"><div class="k-av">K</div><div class="k-typing"><i></i><i></i><i></i></div></div>`);
    msgs.appendChild(t); scrollAbajo();
    await espera(pausa);
    t.remove(); return burbujaBot(html);
  }
  function preguntarChips(options) {
    return new Promise(resolve => {
      const cont = nodo(`<div class="k-chips"></div>`);
      options.forEach(o => {
        const b = nodo(`<button class="k-chip${o.ghost ? ' k-ghost' : ''}"></button>`);
        b.textContent = o.label;
        b.addEventListener('click', () => { cont.remove(); burbujaUser(o.label); resolve(o.value !== undefined ? o.value : o.label); });
        cont.appendChild(b);
      });
      msgs.appendChild(cont); scrollAbajo();
    });
  }
  function preguntarTexto({ tipo = 'texto', placeholder = '', validar } = {}) {
    return new Promise(resolve => {
      composer.classList.add('k-on'); inp.value = ''; inp.placeholder = placeholder;
      inp.inputMode = (tipo === 'dinero' || tipo === 'numero') ? 'numeric' : (tipo === 'tel' ? 'tel' : 'text');
      inp.focus(); scrollAbajo();
      const onSubmit = e => {
        e.preventDefault();
        const bruto = inp.value.trim();
        if (!bruto) return;
        if (validar) { const m = validar(bruto); if (m) { errBox.innerHTML = `<span>${m}</span>`; return; } }
        let val = bruto, etiqueta = bruto;
        if (tipo === 'dinero') { val = parseNum(bruto); etiqueta = eurW(val); }
        else if (tipo === 'numero') { val = parseNum(bruto); etiqueta = String(val); }
        composer.removeEventListener('submit', onSubmit); activeSubmit = null;
        composer.classList.remove('k-on'); errBox.innerHTML = '';
        burbujaUser(etiqueta); resolve(val);
      };
      activeSubmit = onSubmit;
      composer.addEventListener('submit', onSubmit);
    });
  }

  const vMoney = s => parseNum(s) > 0 ? null : 'Escribe una cantidad válida (solo números).';
  const vMoney0 = s => /\d/.test(s) ? null : 'Escribe una cantidad (pon 0 si no hubo).';
  const vTel = s => telOk(s) ? null : 'Ese teléfono no parece correcto. Escribe 9 dígitos (ej. 612 345 678).';
  const vNombre = s => s.trim().length >= 2 ? null : 'Dime tu nombre, por favor.';
  const vTexto = s => s.trim().length >= 3 ? null : 'Necesito un poco más de detalle.';
  const vAnio = s => { const n = parseNum(s); return (n > 1950 && n <= 2026) ? null : 'Escribe un año válido, ej. 2011.'; };
  const vPct = s => { const n = parseNum(s); return (n > 0 && n <= 100) ? null : 'Indica un porcentaje entre 1 y 100.'; };
  const vTin = s => { const n = parseFloat(String(s).replace(',', '.')); return (!isNaN(n) && n >= 0 && n < 20) ? null : 'Escribe un tipo, ej. 3'; };
  const vEdad = s => { const n = parseNum(s); return (n >= 18 && n <= 90) ? null : 'Escribe una edad válida (18-90).'; };
  const vAnios = s => parseNum(s) > 0 ? null : 'Indica los años.';

  const askAnio = async (txt) => { await botDice(txt, 450); return preguntarTexto({ tipo: 'numero', placeholder: 'Ej. 2011', validar: vAnio }); };
  const askDinero0 = async (txt, ph) => { await botDice(txt, 450); return preguntarTexto({ tipo: 'dinero', placeholder: ph || 'Ej. 0', validar: vMoney0 }); };

  async function preguntarTitularesEdades() {
    await botDice('¿La compra <b>una persona o dos</b>?', 450);
    const dos = await preguntarChips([{ label: 'Una persona', value: false }, { label: 'Dos personas', value: true }]);
    await botDice(dos ? '¿Qué <b>edad</b> tiene el titular de <b>más edad</b>?' : '¿Qué <b>edad</b> tienes?', 450);
    const edad = await preguntarTexto({ tipo: 'numero', placeholder: 'Ej. 42', validar: vEdad });
    return { edadRef: edad, dos };
  }
  const aviso65 = (edadRef, plazoY, capital, tinN) => {
    const plazoMaxEdad = Math.max(0, 75 - edadRef);
    if (plazoY > plazoMaxEdad) {
      const extra = plazoMaxEdad >= 5 ? ` A ${plazoMaxEdad} años la cuota sería ${eur2W(coreCuota(capital, plazoMaxEdad, tinN))}/mes.` : '';
      return { t: 'ambar', txt: `Con ${edadRef} años, el criterio habitual "edad + plazo ≤ 75" deja un plazo máximo orientativo de ${plazoMaxEdad} años, por debajo de los ${plazoY} indicados.${extra} Varía según la entidad.` };
    }
    return { t: 'verde', txt: `Con ${edadRef} años, el plazo de ${plazoY} años entra dentro del criterio de edad habitual de las entidades.` };
  };

  // ============================================================
  // Envío del lead a Alberto en segundo plano (Web3Forms)
  // ============================================================
  function enviarLead(nombre, tel, resumen, contexto) {
    if (!CFG.leadEndpoint || !CFG.leadKey) return;
    const payload = {
      access_key: CFG.leadKey,
      subject: 'Nuevo lead desde cabas.es — ' + nombre,
      from_name: 'Kitty · cabas.es',
      nombre, telefono: tel, consulta: contexto, resumen,
      pagina: location.href, fecha: HOY
    };
    try { fetch(CFG.leadEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {}); } catch (e) {}
  }

  // ============================================================
  // Handoff final
  // ============================================================
  async function capturarLead(resumen, contexto) {
    await botDice('Genial. Para que <b>Alberto te atienda personalmente</b>, ¿cómo te llamas?', 500);
    const nombre = await preguntarTexto({ placeholder: 'Tu nombre', validar: vNombre });
    await botDice(`Encantada, ${nombre.split(' ')[0]}. ¿A qué <b>teléfono</b> te viene bien que te contacte?`, 500);
    const tel = await preguntarTexto({ tipo: 'tel', placeholder: 'Tu teléfono', validar: vTel });

    enviarLead(nombre, tel, resumen, contexto);

    const texto = `Hola Alberto, soy ${nombre}. ${contexto}` + (resumen ? `\n\n${resumen}` : '') + `\n\nMi teléfono: ${tel}. (Enviado desde Kitty · cabas.es)`;
    const waURL = `https://wa.me/${CFG.wa}?text=${encodeURIComponent(texto)}`;
    const mailURL = `mailto:${CFG.email}?subject=${encodeURIComponent('Consulta desde cabas.es — ' + nombre)}&body=${encodeURIComponent(texto)}`;

    await botDice(`Perfecto, ${nombre.split(' ')[0]}. Le paso tu consulta a Alberto${CFG.leadEndpoint && CFG.leadKey ? ' — ya le ha llegado tu aviso' : ''}. Para hablar <b>ahora mismo</b>, pulsa WhatsApp y te responde en persona.`, 700);

    const acts = nodo(`<div class="k-acts"></div>`);
    acts.appendChild(botonEnlace(waURL, 'k-btn-wa', iconoWA(), 'Enviar por WhatsApp', true));
    acts.appendChild(botonEnlace('tel:' + CFG.telHref, 'k-btn-line', iconoTel(), 'Llamar ahora (' + CFG.telShow + ')'));
    acts.appendChild(botonEnlace(mailURL, 'k-btn-line', iconoMail(), 'Enviar por email'));
    msgs.appendChild(acts); scrollAbajo();

    burbujaBot(`<small>Tus datos solo se usan para que Alberto te contacte. <a href="${CFG.privacidadURL}" target="_blank" rel="noopener">Política de privacidad</a>.</small>`);

    await espera(400);
    await botDice('¿Quieres calcular o consultar algo más?', 500);
    menuPrincipal();
  }

  function botonEnlace(href, clase, svg, txt, blank) {
    const a = nodo(`<a class="k-btn ${clase}" href="${href}"${blank ? ' target="_blank" rel="noopener"' : ''}></a>`);
    a.innerHTML = svg + `<span>${txt}</span>`; return a;
  }
  const iconoWA = () => `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.15-1.7-.85-2-.95-.26-.1-.45-.15-.64.15-.19.29-.74.94-.9 1.13-.17.19-.33.22-.62.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.04-.17-.29-.02-.45.13-.6.13-.13.3-.34.44-.51.15-.17.2-.29.3-.48.1-.19.05-.36-.02-.51-.08-.15-.64-1.55-.88-2.12-.23-.55-.47-.48-.64-.49l-.55-.01c-.19 0-.5.07-.76.36-.26.29-1 .98-1 2.38s1.02 2.76 1.17 2.95c.15.19 2.02 3.08 4.9 4.32.68.29 1.22.47 1.63.6.69.22 1.31.19 1.8.11.55-.08 1.7-.69 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.34zM12 2a10 10 0 0 0-8.6 15.06L2 22l5.06-1.33A10 10 0 1 0 12 2z"/></svg>`;
  const iconoTel = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/></svg>`;
  const iconoMail = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>`;

  // ============================================================
  // Tarjeta de resultado
  // ============================================================
  function tarjeta({ titulo, lineas, total, avisos = [], disc }) {
    const card = nodo(`<div class="k-card"></div>`);
    card.appendChild(nodo(`<h5>${titulo}</h5>`));
    lineas.forEach(([k, v]) => {
      const li = nodo(`<div class="k-li"><span class="k-k"></span><span class="k-v"></span></div>`);
      li.querySelector('.k-k').textContent = k; li.querySelector('.k-v').textContent = v; card.appendChild(li);
    });
    if (total) {
      const li = nodo(`<div class="k-li k-total"><span class="k-k"></span><span class="k-v"></span></div>`);
      li.querySelector('.k-k').textContent = total[0]; li.querySelector('.k-v').textContent = total[1]; card.appendChild(li);
    }
    avisos.forEach(a => { const d = nodo(`<div class="k-aviso k-${a.t || ''}"></div>`); d.textContent = a.txt; card.appendChild(d); });
    if (disc) { const d = nodo(`<div class="k-disc"></div>`); d.textContent = disc; card.appendChild(d); }
    msgs.appendChild(card); scrollAbajo();
  }

  // ============================================================
  // Selector de comunidad autónoma
  // ============================================================
  async function elegirCCAA(pregunta) {
    if (pregunta) await botDice(pregunta, 450);
    const r = await preguntarChips([{ label: 'Madrid', value: 'madrid' }, { label: 'Otra comunidad', value: '__otra' }]);
    if (r !== '__otra') return r;
    return new Promise(resolve => {
      const cont = nodo(`<div class="k-chips" style="padding-left:34px"></div>`);
      const sel = nodo(`<select class="k-chip"></select>`);
      sel.style.cssText = 'background:#fff;color:#8A6B27;border:1px solid #B28E44;padding:.5rem .7rem;border-radius:999px;font-size:.85rem;max-width:100%;';
      Object.keys(DATOS_CCAA).forEach(slug => { const o = document.createElement('option'); o.value = slug; o.textContent = DATOS_CCAA[slug].nombre; if (slug === 'madrid') o.selected = true; sel.appendChild(o); });
      const b = nodo(`<button class="k-chip">Elegir</button>`);
      b.addEventListener('click', () => { const slug = sel.value; cont.remove(); burbujaUser(DATOS_CCAA[slug].nombre); resolve(slug); });
      cont.appendChild(sel); cont.appendChild(b); msgs.appendChild(cont); scrollAbajo();
    });
  }

  // ============================================================
  // FLUJO: Valorar un inmueble
  // ============================================================
  async function flujoValorar() {
    await botDice('Perfecto. Alberto te prepara una <b>valoración realista</b> de tu inmueble, sin compromiso y con datos de la zona.', 650);
    await botDice('¿Es un <b>solo inmueble</b> o <b>varios</b>?', 500);
    const cuantos = await preguntarChips([{ label: 'Un solo inmueble', value: 'uno' }, { label: 'Varios inmuebles', value: 'varios' }]);
    let resumen, contexto;
    if (cuantos === 'uno') {
      const ccaa = await elegirCCAA('¿En qué <b>comunidad autónoma</b> está?');
      await botDice('¿Cuál es la <b>dirección</b>? (calle y número, o la zona)', 500);
      const dir = await preguntarTexto({ placeholder: 'Ej. C/ Bravo Murillo 23, Madrid', validar: vTexto });
      resumen = `VALORACIÓN · 1 inmueble · ${DATOS_CCAA[ccaa].nombre} · ${dir}`;
      contexto = `quiero valorar un inmueble situado en ${DATOS_CCAA[ccaa].nombre} (${dir}).`;
    } else {
      await botDice('¿<b>Dónde están</b> y cuántos son? Dime las direcciones o zonas.', 550);
      const dir = await preguntarTexto({ placeholder: 'Ej. 2 pisos: Bravo Murillo 23 (Madrid) y Toledo centro', validar: vTexto });
      resumen = `VALORACIÓN · Varios inmuebles · ${dir}`;
      contexto = `quiero valorar varios inmuebles: ${dir}.`;
    }
    await capturarLead(resumen, contexto);
  }

  // ============================================================
  // FLUJO: Herencia
  // ============================================================
  async function flujoHerencia() {
    await botDice('Gestionar una <b>herencia</b> con una vivienda de por medio es la especialidad de Alberto: valoración, acuerdo entre herederos y venta con seguridad jurídica. ¿En qué punto estás?', 750);
    const punto = await preguntarChips([
      { label: 'Acabo de heredar', value: 'nuevo' },
      { label: 'Somos varios herederos', value: 'coherederos' },
      { label: 'Quiero vender lo heredado', value: 'vender' },
      { label: 'Solo quiero información', value: 'info', ghost: true }
    ]);
    const map = {
      nuevo: 'Lo primero es tener una <b>valoración realista</b> y ordenar la documentación. Alberto te acompaña en todo el proceso, sin que tengas que pelearte con el papeleo.',
      coherederos: 'Cuando hay <b>varios herederos</b>, lo clave es un acuerdo claro y justo. Alberto media entre coherederos: más del 80% de los casos terminan en acuerdo.',
      vender: 'Si ya quieres <b>vender lo heredado</b>, te puedo estimar aquí mismo lo que te quedaría tras impuestos, o pasarte directamente con Alberto.',
      info: 'Perfecto. Alberto puede resolverte las dudas de herencia sin compromiso: plazos, impuestos (sucesiones y plusvalía) y qué conviene hacer con la vivienda.'
    };
    await botDice(map[punto], 700);
    if (punto === 'vender') {
      const q = await preguntarChips([{ label: 'Calcular lo que me quedaría', value: 'calc' }, { label: 'Hablar con Alberto', value: 'contacto' }]);
      if (q === 'calc') return flujoVender();
    }
    await capturarLead('HERENCIA · Situación: ' + punto, 'tengo una consulta sobre una herencia con una vivienda.');
  }

  // ============================================================
  // FLUJO: Lo que me queda si vendo (neto del vendedor)
  // ============================================================
  async function flujoVender() {
    await botDice('Te calculo <b>lo que te queda limpio</b> tras vender, después de impuestos.', 650);
    await botDice('¿En cuánto vas a <b>vender</b> (o esperas vender)?', 450);
    const venta = await preguntarTexto({ tipo: 'dinero', placeholder: 'Ej. 320000', validar: vMoney });

    await botDice('¿La adquiriste <b>de una vez</b>, o en <b>varias veces</b>? (por ejemplo una herencia, o comprando partes en distintos momentos)', 700);
    const modo = await preguntarChips([{ label: 'De una vez', value: 'una' }, { label: 'En varias veces', value: 'varias' }]);
    const adquisiciones = [];
    if (modo === 'una') {
      await botDice('¿Por cuánto la <b>compraste o adquiriste</b>? (si fue heredada, el valor que se declaró)', 550);
      const valor = await preguntarTexto({ tipo: 'dinero', placeholder: 'Ej. 210000', validar: vMoney });
      const anio = await askAnio('¿En qué <b>año</b> la adquiriste?');
      const gastos = await askDinero0('¿Qué <b>gastos deducibles</b> tuviste al adquirirla (impuestos, notaría, registro)? Pon 0 si no lo sabes.', 'Ej. 8000');
      adquisiciones.push({ valor, gastos, fecha: anio + '-01-01', pct: 100 });
    } else {
      await botDice('Vale, vamos una a una (hasta 3). De cada una necesito valor, año, gastos y qué % adquiriste.', 700);
      let seguir = true, i = 0;
      while (seguir && i < 3) {
        i++;
        await botDice(`<b>Adquisición ${i}</b> · ¿por cuánto valor?`, 450);
        const valor = await preguntarTexto({ tipo: 'dinero', placeholder: 'Ej. 105000', validar: vMoney });
        const anio = await askAnio(`Adquisición ${i} · ¿en qué año?`);
        const gastos = await askDinero0(`Adquisición ${i} · ¿gastos deducibles (impuestos, notaría, registro)? Pon 0 si no.`, 'Ej. 4000');
        await botDice(`Adquisición ${i} · ¿qué <b>% de la vivienda</b> adquiriste aquí? (ej. 50)`, 450);
        const pct = await preguntarTexto({ tipo: 'numero', placeholder: 'Ej. 50', validar: vPct });
        adquisiciones.push({ valor, gastos, fecha: anio + '-01-01', pct });
        if (i < 3) { const mas = await preguntarChips([{ label: 'Añadir otra', value: true }, { label: 'Ya están todas', value: false, ghost: true }]); seguir = mas; }
      }
    }

    const gVenta = await askDinero0('¿Qué <b>gastos tienes en la venta</b> (honorarios de agencia, derramas, certificados, cancelación de hipoteca…)? Pon 0 si ninguno.', 'Ej. 9000');

    await botDice('¿Es (o era) tu <b>vivienda habitual</b>?', 500);
    const habitual = await preguntarChips([{ label: 'Sí', value: true }, { label: 'No', value: false, ghost: true }]);
    let mayor65 = false, reinv = false;
    if (habitual) {
      await botDice('¿Tienes <b>más de 65 años</b>? En ese caso la ganancia está exenta de IRPF.', 550);
      const m65 = await preguntarChips([{ label: 'Sí, más de 65', value: true }, { label: 'No', value: false, ghost: true }]);
      if (m65) mayor65 = true;
      else {
        await botDice('¿Vas a <b>reinvertir</b> todo lo obtenido en otra vivienda habitual?', 550);
        reinv = await preguntarChips([{ label: 'Sí, reinvierto', value: true }, { label: 'No', value: false, ghost: true }]);
      }
    }

    await botDice('¿Quieres <b>afinar con la plusvalía municipal</b>? Necesito 2 datos que salen en el recibo del IBI.', 600);
    const afinar = await preguntarChips([{ label: 'Sí, afinar', value: true }, { label: 'No, dame la estimación', value: false, ghost: true }]);
    let vcTotal = 0, vcSuelo = 0, ccaa = 'madrid';
    if (afinar) {
      await botDice('¿<b>Valor catastral total</b> del recibo del IBI?', 450);
      vcTotal = await preguntarTexto({ tipo: 'dinero', placeholder: 'Ej. 90000', validar: vMoney });
      await botDice('¿Y el <b>valor catastral del suelo</b>? (viene desglosado en el mismo recibo)', 500);
      vcSuelo = await preguntarTexto({ tipo: 'dinero', placeholder: 'Ej. 45000', validar: vMoney });
      ccaa = await elegirCCAA('¿En qué <b>comunidad</b> está la vivienda?');
    }

    const r = coreNetoVendedor({ venta, gVenta, vcTotal, vcSuelo, fVenta: HOY, ccaaSlug: ccaa, mayor65, reinv, adquisiciones });
    tarjeta({
      titulo: '💶 Lo que te queda tras vender',
      lineas: [
        ['Precio de venta', eurW(r.venta)],
        ['Gastos de la venta', gVenta ? '− ' + eur2W(gVenta) : eurW(0)],
        ['Valor de adquisición', '− ' + eurW(r.totalAdquisicion)],
        [`Plusvalía municipal${afinar ? '' : ' (no incluida)'}`, r.plusvalia ? '− ' + eur2W(r.plusvalia) : (afinar ? eurW(0) : '—')],
        ['Ganancia (IRPF)', r.exenta ? 'Exenta' : eur2W(r.ganancia)],
        ['IRPF sobre la ganancia', r.exenta ? 'Exento' : (r.irpf ? '− ' + eur2W(r.irpf) : eurW(0))]
      ],
      total: ['Neto estimado para ti', eurW(r.neto)],
      avisos: r.avisos,
      disc: 'Plusvalía con coeficientes máximos estatales (RDL 8/2023) y tipo estimado del municipio. IRPF sobre la base del ahorro (19-30%). Estimación orientativa, no asesoramiento fiscal.'
    });
    const resumen = `VENTA · Venta ${eurW(venta)} · Adquisición ${adquisiciones.length > 1 ? adquisiciones.length + ' veces (' + eurW(r.totalAdquisicion) + ')' : eurW(r.totalAdquisicion)} · Gastos venta ${eurW(gVenta)} · Plusvalía ${eur2W(r.plusvalia)} · IRPF ${r.exenta ? 'exento' : eur2W(r.irpf)} · Neto ${eurW(r.neto)}`;
    await ofrecerContacto(resumen, 'quiero saber lo que me quedaría al vender mi vivienda.');
  }

  // ============================================================
  // FLUJO: Cuánto cuesta comprar
  // ============================================================
  async function flujoComprar() {
    await botDice('Te calculo <b>todo el coste real</b> de comprar: honorarios, impuestos, notaría, registro, gestoría… y la hipoteca si la necesitas.', 700);
    await botDice('¿Cuál es el <b>precio</b> de la vivienda?', 450);
    const precio = await preguntarTexto({ tipo: 'dinero', placeholder: 'Ej. 250000', validar: vMoney });

    const honorarios = await preguntarHonorarios(precio);

    const ccaa = await elegirCCAA('¿En qué <b>comunidad</b> está? Los impuestos cambian según la zona.');
    await botDice('¿Es vivienda <b>usada</b> o de <b>obra nueva</b>?', 450);
    const tipoViv = await preguntarChips([{ label: 'Usada (2ª mano)', value: 'usada' }, { label: 'Obra nueva', value: 'nueva' }]);
    await botDice('¿Vas a pedir <b>hipoteca</b> o comprar al contado?', 450);
    const conHip = await preguntarChips([{ label: 'Con hipoteca', value: true }, { label: 'Al contado', value: false, ghost: true }]);

    let ahorro = 0, plazoY = 0, tinN = 0, ingresos = 0, edadRef = null;
    if (conHip) {
      await botDice('¿Cuánto <b>ahorro</b> vas a aportar (entrada + gastos)?', 500);
      ahorro = await preguntarTexto({ tipo: 'dinero', placeholder: 'Ej. 70000', validar: vMoney });
      await botDice('¿A cuántos <b>años</b> la hipoteca?', 450);
      const pl = await preguntarChips([{ label: '20', value: 20 }, { label: '25', value: 25 }, { label: '30', value: 30 }, { label: 'Otro', value: '__otro' }]);
      plazoY = pl === '__otro' ? await preguntarTexto({ tipo: 'numero', placeholder: 'Años', validar: vAnios }) : pl;
      await botDice('¿Qué <b>TIN</b>? (un 3% es referencia razonable si no lo sabes)', 500);
      const tin = await preguntarTexto({ placeholder: 'Ej. 3', validar: vTin });
      tinN = parseFloat(String(tin).replace(',', '.'));
      await botDice('¿Cuáles son los <b>ingresos netos mensuales</b> del hogar?', 500);
      ingresos = await preguntarTexto({ tipo: 'dinero', placeholder: 'Ej. 3000', validar: vMoney });
      const te = await preguntarTitularesEdades();
      edadRef = te.edadRef;
    }

    const r = coreCompra({ precio, tipoViv, ccaaSlug: ccaa, conHipoteca: conHip, ahorro, plazo: plazoY, tin: tinN, ingresos, edadRef, honorarios });
    const lineas = [
      ['Precio', eurW(r.precio)],
      [r.impLabel, eur2W(r.impuestos)],
      ['Notaría (est.)', eur2W(r.gastos.notaria)],
      ['Registro (est.)', eur2W(r.gastos.registro)],
      ['Gestoría (est.)', eur2W(r.gastos.gestoria)]
    ];
    if (conHip) lineas.push(['Tasación (est.)', eur2W(r.gastos.tasacion)]);
    if (r.honorarios > 0) lineas.push([conHip ? 'Honorarios (no los financia el banco)' : 'Honorarios de intermediación', eur2W(r.honorarios)]);
    if (conHip) { lineas.push(['Hipoteca necesaria', eurW(r.hipoteca)]); lineas.push(['Cuota mensual', eur2W(r.cuota) + ' /mes']); lineas.push(['Financiación (LTV)', r.ltv.toFixed(0) + ' %']); }
    tarjeta({
      titulo: '🔑 Coste de tu compra',
      lineas,
      total: ['Coste total de la operación', eurW(r.costeTotal)],
      avisos: r.avisos,
      disc: 'Notaría, registro y gestoría son estimaciones habituales según el precio. Los honorarios de intermediación, cuando existen, los paga el comprador y el banco no los financia. No es asesoramiento fiscal.'
    });
    const resumen = `COMPRA · ${eurW(precio)} · ${r.ccaaNombre} · ${tipoViv}` + (r.honorarios > 0 ? ` · Honorarios ${eur2W(r.honorarios)}` : '') + ` · Coste total ${eurW(r.costeTotal)}` + (conHip ? ` · Hipoteca ${eurW(r.hipoteca)} · Cuota ${eur2W(r.cuota)}/mes · LTV ${r.ltv.toFixed(0)}%${edadRef ? ' · titular ' + edadRef + ' años' : ''}` : ' · al contado');
    await ofrecerContacto(resumen, `estoy mirando comprar una vivienda de ${eurW(precio)} en ${r.ccaaNombre}.`);
  }

  async function preguntarHonorarios(precio) {
    await botDice('¿Hay <b>honorarios de intermediación a tu cargo</b> como comprador? (no siempre los hay)', 650);
    const hMode = await preguntarChips([
      { label: 'No hay', value: 'no', ghost: true },
      { label: 'Sí, importe fijo', value: 'fijo' },
      { label: 'Sí, un % del precio', value: 'pct' }
    ]);
    if (hMode === 'fijo') {
      await botDice('¿Qué <b>importe</b> de honorarios?', 450);
      return preguntarTexto({ tipo: 'dinero', placeholder: 'Ej. 6000', validar: vMoney });
    }
    if (hMode === 'pct') {
      await botDice('¿Qué <b>porcentaje</b> sobre el precio? (ej. 3)', 450);
      const pct = await preguntarTexto({ placeholder: 'Ej. 3', validar: s => { const n = parseFloat(String(s).replace(',', '.')); return (n > 0 && n < 30) ? null : 'Escribe un %, ej. 3'; } });
      const base = precio * (parseFloat(String(pct).replace(',', '.')) / 100);
      await botDice('¿Ese porcentaje <b>lleva el IVA (21%) incluido</b>?', 500);
      const ivaInc = await preguntarChips([{ label: 'Sí, IVA incluido', value: true }, { label: 'No, súmalo', value: false }]);
      return ivaInc ? base : base * 1.21;
    }
    return 0;
  }

  // ============================================================
  // FLUJO: Simular hipoteca
  // ============================================================
  async function flujoHipoteca() {
    await botDice('Te calculo la <b>cuota mensual</b> al momento.', 550);
    await botDice('¿Qué <b>importe</b> de hipoteca necesitas? (o el que estés valorando)', 500);
    const capital = await preguntarTexto({ tipo: 'dinero', placeholder: 'Ej. 180000', validar: vMoney });
    await botDice('¿A cuántos <b>años</b>?', 450);
    const plazo = await preguntarChips([{ label: '20 años', value: 20 }, { label: '25 años', value: 25 }, { label: '30 años', value: 30 }, { label: 'Otro', value: '__otro' }]);
    const plazoY = plazo === '__otro' ? await preguntarTexto({ tipo: 'numero', placeholder: 'Años', validar: vAnios }) : plazo;
    await botDice('¿Qué <b>tipo de interés (TIN)</b> aplicamos? Si no lo sabes, un 3% es una referencia razonable hoy.', 550);
    const tin = await preguntarTexto({ placeholder: 'Ej. 3 (o 3,2)', validar: vTin });
    const tinN = parseFloat(String(tin).replace(',', '.'));
    const te = await preguntarTitularesEdades();
    const edadRef = te.edadRef;

    const cuota = coreCuota(capital, plazoY, tinN);
    const totalPagado = cuota * plazoY * 12;
    const intereses = totalPagado - capital;
    const avisos = [aviso65(edadRef, plazoY, capital, tinN)];
    tarjeta({
      titulo: '🏦 Tu hipoteca, estimada',
      lineas: [
        ['Importe', eurW(capital)],
        ['Plazo', plazoY + ' años'],
        ['Interés (TIN)', tinN.toString().replace('.', ',') + ' %'],
        ['Titular de más edad', edadRef + ' años'],
        ['Intereses totales', eur2W(intereses)],
        ['Total a devolver', eurW(totalPagado)]
      ],
      total: ['Cuota mensual', eur2W(cuota)],
      avisos,
      disc: 'Sistema francés, cuota constante. No incluye comisiones, seguros ni productos vinculados. Las condiciones y la edad máxima dependen de cada banco.'
    });
    const resumen = `HIPOTECA · Importe ${eurW(capital)} · ${plazoY} años · TIN ${tinN}% · Titular ${edadRef} años · Cuota ${eur2W(cuota)}/mes`;
    await ofrecerContacto(resumen, 'quiero simular una hipoteca.');
  }

  // ============================================================
  // FLUJO: ¿Hasta qué precio puedo comprar?
  // ============================================================
  async function flujoHastaPrecio() {
    await botDice('Te digo <b>hasta qué precio</b> podrías comprar según tus ingresos y ahorro. Es una estimación orientativa, <b>no vinculante</b>.', 750);
    const ccaa = await elegirCCAA('¿En qué <b>comunidad</b> quieres comprar?');
    const te = await preguntarTitularesEdades();
    await botDice('¿Cuánto <b>ahorro</b> tienes disponible (para entrada + gastos)?', 500);
    const ahorro = await preguntarTexto({ tipo: 'dinero', placeholder: 'Ej. 60000', validar: vMoney });
    await botDice('¿Cuáles son los <b>ingresos netos mensuales</b> del hogar?', 500);
    const ingresos = await preguntarTexto({ tipo: 'dinero', placeholder: 'Ej. 3000', validar: vMoney });

    const r = coreCapacidadCompra({ ccaaSlug: ccaa, edadRef: te.edadRef, ahorro, ingresos, tin: 3 });
    const avisos = [];
    avisos.push({ t: 'verde', txt: `Con estos datos podrías comprar una vivienda de hasta ~${eurW(r.maxPrecio)} en ${r.ccaaNombre}.` });
    if (r.limita === 'ahorro') avisos.push({ t: 'ambar', txt: 'El límite aquí es el ahorro (hay que cubrir la entrada del 20% + gastos). Con más ahorro subiría el precio máximo.' });
    else avisos.push({ t: 'ambar', txt: 'El límite aquí son los ingresos (cuota ≤ 35%). Con más ingresos o más plazo subiría el importe.' });
    if (te.edadRef) avisos.push({ t: 'ambar', txt: `Plazo máximo estimado por edad (edad + plazo ≤ 75): ${r.plazoMax} años.` });

    tarjeta({
      titulo: '📈 Hasta dónde puedes llegar',
      lineas: [
        ['Ingresos del hogar', eurW(r.ingresos) + ' /mes'],
        ['Ahorro disponible', eurW(r.ahorro)],
        ['Plazo máximo (por edad)', r.plazoMax + ' años'],
        ['Hipoteca máxima estimada', eurW(r.maxHipotecaIngresos)],
        ['Cuota a ese nivel', eur2W(r.cuota) + ' /mes']
      ],
      total: ['Precio máximo de compra', eurW(r.maxPrecio)],
      avisos,
      disc: 'Estimación orientativa y NO vinculante. Supone cuota ≤ 35% de ingresos, financiación hasta el 80%, TIN 3% y el criterio habitual de edad. La concesión y las condiciones reales dependen de cada banco.'
    });
    const resumen = `CAPACIDAD · ${r.ccaaNombre} · Ingresos ${eurW(ingresos)}/mes · Ahorro ${eurW(ahorro)} · Titular ${te.edadRef} años · Hipoteca máx ${eurW(r.maxHipotecaIngresos)} · Precio máx ${eurW(r.maxPrecio)}`;
    await ofrecerContacto(resumen, `quiero saber hasta qué precio de vivienda puedo llegar en ${r.ccaaNombre}.`);
  }

  // ---------- Ofrecer contacto ----------
  async function ofrecerContacto(resumen, contexto) {
    await espera(300);
    const q = await preguntarChips([{ label: '📲 Que me contacte Alberto', value: 'lead' }, { label: 'Calcular otra cosa', value: 'menu', ghost: true }]);
    if (q === 'lead') return capturarLead(resumen, contexto);
    return menuPrincipal();
  }

  // ============================================================
  // Menú principal
  // ============================================================
  async function menuPrincipal() {
    const op = await preguntarChips([
      { label: '🏡 Valorar un inmueble', value: 'valorar' },
      { label: '⚖️ Tengo una herencia', value: 'herencia' },
      { label: '💶 Lo que me queda si vendo', value: 'vender' },
      { label: '🔑 Cuánto me cuesta comprar', value: 'comprar' },
      { label: '🏦 Simular mi hipoteca', value: 'hipoteca' },
      { label: '📈 Hasta qué precio puedo comprar', value: 'capacidad' },
      { label: '📞 Hablar con Alberto', value: 'contacto', ghost: true }
    ]);
    if (op === 'valorar') return flujoValorar();
    if (op === 'herencia') return flujoHerencia();
    if (op === 'vender') return flujoVender();
    if (op === 'comprar') return flujoComprar();
    if (op === 'hipoteca') return flujoHipoteca();
    if (op === 'capacidad') return flujoHastaPrecio();
    if (op === 'contacto') return capturarLead('', 'me gustaría que me llamaras para comentar mi caso.');
  }

  async function conversacion() {
    await botDice('Hola 👋 Soy <b>Kitty</b>, el asistente de <b>Alberto Cabas</b>.', 500);
    await botDice('Puedo hacerte <b>cálculos al instante</b> —lo que te queda al vender, gastos de compra, cuota de hipoteca o hasta qué precio puedes comprar— o ponerte en contacto con Alberto para <b>valorar un inmueble</b> o <b>asesorarte sobre una herencia</b>. ¿Qué necesitas?', 900);
    menuPrincipal();
  }
})();
