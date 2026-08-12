// ============================================================
// kitty-runner.js — MOTOR ÚNICO de conversación de Kitty.
// El MISMO cerebro para el widget de la WEB, Telegram y WhatsApp.
// Rejuega el guión (kitty-guion.js) turno a turno; el estado es solo las
// respuestas acumuladas (JSON). PURO: no toca red ni DOM.
//
// Dependencias (deben estar cargadas antes):
//   · navegador  → <script> kitty-textos.js, kitty-guion.js, calc-core.js
//   · Node/bot   → se resuelven con require desde esta misma carpeta.
// Expone:  navegador → window.KITTY_RUNNER   ·   Node → module.exports
// ============================================================
(function (raiz) {
  'use strict';
  // ---- dependencias: globales del navegador O require en Node ----
  var _req = (typeof require !== 'undefined') ? require : null;
  var _g = raiz.KITTY_GUION || (_req && _req('./kitty-guion.js'));
  var TEXTOS = raiz.TEXTOS || (_req && _req('./kitty-textos.js').TEXTOS);
  var GUION = _g.GUION, SUBFLUJOS = _g.SUBFLUJOS, nombreCCAA = _g.nombreCCAA, avisoEdad = _g.avisoEdad, primerNombre = _g.primerNombre;


// ---------- texto ----------
function tx(id) { const p = String(id).split('.'); let o = TEXTOS; for (const k of p) o = o && o[k]; return (o && o.es) || ('??' + id); }
function fill(s, v) { return String(s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null) ? v[k] : m); }
function idDe(texto, scope, preg) {
  if (typeof texto === 'function') return texto(scope);
  if (typeof texto === 'string') return texto === '@pregunta' ? preg : texto;
  return texto.casos[String(scope[texto.segun])];
}
function render(texto, scope, preg, paso, extra) {
  let s = fill(tx(idDe(texto, scope, preg)), Object.assign({}, extra || {}, (paso && paso.valores) ? paso.valores(scope) : {}));
  if (paso && paso.enlace) s = fill(s, { enlace: tx(paso.enlace) });
  return s;
}

// ---------- rutas de acceso a respuestas ----------
function getPath(o, p) { let c = o; for (const k of p) { if (c == null) return undefined; c = c[k]; } return c; }
function hasPath(o, p) { let c = o; for (const k of p) { if (c == null || typeof c !== 'object' || !(k in c)) return false; c = c[k]; } return true; }
function setPath(o, p, v) { let c = o; for (let i = 0; i < p.length - 1; i++) { if (c[p[i]] == null) c[p[i]] = {}; c = c[p[i]]; } c[p[p.length - 1]] = v; }
function ensure(o, p) { let c = o; for (const k of p) { if (c[k] == null) c[k] = {}; c = c[k]; } return c; }

// ---------- tarjeta (formato nativo Telegram) ----------
function etiqueta(et, r, scope) { if (typeof et === 'function') return et(r, scope); if (et && et.casos) return tx(et.casos[String(scope[et.segun])]); return tx(et); }
function valor(vv, r, scope) { const res = (typeof vv === 'function') ? vv(r, scope) : vv; if (res && res.texto) return fill(tx(res.texto), res.valores ? res.valores(r) : {}); return res; }
function renderTarjeta(card, r, scope) {
  const L = [card.total.emoji + ' <b>' + etiqueta(card.total.etiqueta, r, scope) + ': ' + valor(card.total.valor, r, scope) + '</b>', ''];
  for (const l of card.lineas) { if (l.si && !l.si(scope, r)) continue; L.push(l.emoji + ' ' + etiqueta(l.etiqueta, r, scope) + ': ' + valor(l.valor, r, scope)); }
  const avs = card.avisos ? (card.avisos(r) || []) : [];
  if (avs.length) L.push('');
  for (const av of avs) {
    const e = av.t === 'verde' ? '✅' : (av.t === 'ambar' ? '⚠️' : '🔴');
    L.push(e + ' ' + (av.texto ? (fill(tx(av.texto), av.valores || {}) + (av.piezas || []).map(p => ' ' + fill(tx(p.texto), p.valores)).join('')) : (av.txt || '')));
  }
  L.push('', '<i>' + tx(card.disc) + '</i>');
  return L.join('\n');
}
// Versión ESTRUCTURADA de la tarjeta (mismos valores) para que el widget
// web la pinte con su diseño de "ficha". Los bots (Telegram/WhatsApp) usan
// el texto plano de arriba e IGNORAN este campo.
function estructuraTarjeta(card, r, scope) {
  const lineas = [];
  for (const l of card.lineas) { if (l.si && !l.si(scope, r)) continue; lineas.push({ emoji: l.emoji, etiqueta: etiqueta(l.etiqueta, r, scope), valor: valor(l.valor, r, scope) }); }
  const avs = (card.avisos ? (card.avisos(r) || []) : []).map(av => ({
    t: av.t || '',
    txt: av.texto ? (fill(tx(av.texto), av.valores || {}) + (av.piezas || []).map(p => ' ' + fill(tx(p.texto), p.valores)).join('')) : (av.txt || '')
  }));
  return { total: { emoji: card.total.emoji, etiqueta: etiqueta(card.total.etiqueta, r, scope), valor: valor(card.total.valor, r, scope) }, lineas: lineas, avisos: avs, disc: tx(card.disc) };
}

// ============================================================
// simular(flowId, a, meta) → rejuega y devuelve mensajes fijos + la
// pregunta pendiente (si la hay) + leads/eventos.
// ============================================================
function simular(flowId, a, meta) {
  meta = meta || {};
  const out = { fixed: [], pregunta: null, stopped: false, done: false, menu: false, cerrar: false, jumpFlow: null, pushRuta: null, leads: [], eventos: [] };

  function walk(pasos, scopePath, ctx) {
    const scope = ensure(a, scopePath);
    let i = 0;
    while (i < pasos.length) {
      if (out.stopped) return;
      const p = pasos[i]; let jump = null;

      if (p.tipo === 'decir') {
        out.fixed.push({ texto: render(p.texto, scope, ctx.preg, p, ctx.i != null ? { i: ctx.i } : null) });

      } else if (p.tipo === 'despedir') {
        // Mensaje de despedida y CIERRA la conversación (no vuelve al menú).
        out.fixed.push({ texto: render(p.texto, scope, ctx.preg, p, ctx.i != null ? { i: ctx.i } : null) });
        out.cerrar = true; out.stopped = true; return;

      } else if (p.tipo === 'chips') {
        const selP = scopePath.concat(p.guardar + '#sel');
        const valP = scopePath.concat(p.guardar);
        if (!hasPath(a, selP)) {
          out.pregunta = { tipo: 'chips', texto: render(p.texto, scope, ctx.preg, p), opciones: p.opciones,
            pend: { kind: 'chips', path: selP, valPath: valP, opciones: opcMeta(p.opciones) } };
          out.stopped = true; return;
        }
        const sel = getPath(a, selP);
        const op = p.opciones.find(o => o.valor === sel) || p.opciones[0];
        if (op.irAFlujo) { out.jumpFlow = op.irAFlujo; out.pushRuta = (flowId !== 'menu') ? flowId : null; out.stopped = true; return; }
        if (op.pedir) {
          if (!hasPath(a, valP)) {
            out.pregunta = { tipo: 'texto', texto: tx(op.pedir.placeholder ? op.pedir.placeholder : p.texto),
              pend: { kind: 'texto', path: valP, entrada: op.pedir.entrada, validador: op.pedir.validador } };
            out.stopped = true; return;
          }
        } else if (!hasPath(a, valP)) { setPath(a, valP, sel); }
        if (op.saltarA) jump = op.saltarA;

      } else if (p.tipo === 'texto') {
        const path = scopePath.concat(p.guardar);
        if (!hasPath(a, path)) {
          out.pregunta = { tipo: 'texto', texto: render(p.texto, scope, ctx.preg, p, ctx.i != null ? { i: ctx.i } : null),
            pend: { kind: 'texto', path, entrada: p.entrada, validador: p.validador } };
          out.stopped = true; return;
        }
        if (p.saltarA) jump = p.saltarA;

      } else if (p.tipo === 'sub') {
        const subScope = scopePath.concat('@' + p.id);
        const sub = SUBFLUJOS[p.sub];
        walk(sub.pasos, subScope, { preg: p.texto });
        if (out.stopped) return;
        const loc = ensure(a, subScope);
        const base = p.base ? p.base(scope) : undefined;
        scope[p.guardar] = sub.computa ? sub.computa(loc, base) : ((sub.devuelve && loc[sub.devuelve] !== undefined) ? loc[sub.devuelve] : loc);

      } else if (p.tipo === 'lista') {
        const path = scopePath.concat(p.guardar);
        if (!hasPath(a, path)) {
          out.pregunta = { tipo: 'lista', texto: render(p.texto || '@pregunta', scope, ctx.preg, p), botonLabel: tx(p.boton), pend: { kind: 'lista', path } };
          out.stopped = true; return;
        }

      } else if (p.tipo === 'condicion') {
        const tg = p.casos[String(scope[p.segun])]; if (tg) jump = tg;

      } else if (p.tipo === 'bucle') {
        const st = ensure(a, scopePath.concat('#' + p.id));
        if (!st.iters) st.iters = [];
        let it = 1;
        while (true) {
          const itemPath = scopePath.concat('#' + p.id, 'iters', String(it - 1));
          walk(p.itemPasos, itemPath, { i: it });
          if (out.stopped) return;
          if (it >= p.max) break;
          const csP = scopePath.concat('#' + p.id, 'contsel', String(it));
          if (!hasPath(a, csP)) {
            out.pregunta = { tipo: 'chips', texto: tx(p.continuar.texto),
              opciones: [{ texto: p.continuar.mas, valor: 'mas' }, { texto: p.continuar.fin, valor: 'fin' }],
              pend: { kind: 'chips', path: csP, bucleCont: true, opciones: [{ valor: 'mas' }, { valor: 'fin' }] } };
            out.stopped = true; return;
          }
          if (getPath(a, csP) === 'fin') break;
          it++;
        }
        scope[p.guardar] = st.iters.map(x => p.item(x));

      } else if (p.tipo === 'calc') {
        const r = p.calcular(scope); scope.__r = r;
        out.eventos.push({ evento: 'resultado_visto', flow: flowId });
        out.fixed.push({ texto: renderTarjeta(p.tarjeta, r, scope), card: estructuraTarjeta(p.tarjeta, r, scope) });
        if (p.saltarA) jump = p.saltarA;

      } else if (p.tipo === 'pedirContacto') {
        walk(SUBFLUJOS.pedirContacto.pasos, scopePath, {});   // MISMO scope del flujo
        if (out.stopped) return;
        if (scope.consiente === false) { out.done = true; out.stopped = true; return; }

      } else if (p.tipo === 'entregarLead') {
        walk(SUBFLUJOS.entregarLead.pasos, scopePath, { lead: { resumen: p.resumen, contexto: p.contexto } });
        if (out.stopped) return;

      } else if (p.tipo === 'guardarLead') {
        // Idempotente: en el modelo de "replay" este paso se re-recorre en cada
        // turno. Si tras el lead hay una pregunta (p. ej. "¿algo más?"), sin este
        // guard se reenviaría el lead duplicado. La marca vive en el estado raíz
        // y se limpia sola al volver al menú (estado.a = {}).
        if (!a.__leadSent) {
          const lead = ctx.lead;
          let resumen = fill(tx(idDe(lead.resumen.texto, scope)), lead.resumen.valores ? lead.resumen.valores(scope, scope.__r) : {});
          if (meta.ruta && meta.ruta.length) resumen = meta.ruta.map(f => tx('rutas.' + f)).join(' → ') + ' → ' + resumen;
          const contexto = fill(tx(idDe(lead.contexto.texto, scope)), lead.contexto.valores ? lead.contexto.valores(scope, scope.__r) : {});
          out.leads.push({ nombre: scope.nombre, tel: scope.tel, resumen, contexto, flow: flowId, ruta: (meta.ruta || []).slice(), origin: meta.origin || null });
          out.eventos.push({ evento: 'lead', flow: flowId });
          a.__leadSent = true;
        }

      } else if (p.tipo === 'handoff') {
        let ht = render(p.texto, scope, ctx.preg, p);
        if (p.nota) ht += '\n\n' + tx(p.nota);   // nota (con enlace de privacidad) va DENTRO del mensaje
        out.fixed.push({ texto: ht, handoff: p.botones });
        if (p.saltarA) jump = p.saltarA;
      }

      if (jump == null && p.saltarA && ['chips', 'texto', 'calc', 'handoff'].indexOf(p.tipo) < 0) jump = p.saltarA;
      if (jump) {
        if (jump === '@fin') return;
        if (jump === '@menu') { out.menu = true; return; }
        const idx = pasos.findIndex(x => x.id === jump); if (idx >= 0) { i = idx; continue; }
      }
      i++;
    }
  }

  walk(GUION[flowId].pasos, [], {});
  if (!out.pregunta && !out.jumpFlow && !out.menu) out.done = true;
  return out;
}
function opcMeta(op) { return op.map(o => ({ valor: o.valor, saltarA: o.saltarA, irAFlujo: o.irAFlujo, pedir: o.pedir })); }

// ============================================================
// Validadores (mismas reglas que la web)
// ============================================================
const soloDig = s => String(s || '').replace(/[^\d]/g, '');   // para teléfono: deja solo dígitos
// Números en formato español: el PUNTO separa miles y la COMA es el decimal.
// Antes se quitaba todo salvo dígitos, así que "26.489,00" se leía como
// 2.648.900 (×100) y disparaba la plusvalía. Ahora: fuera los puntos de miles,
// la coma pasa a punto decimal. "26.489,00"->26489 · "200.000"->200000 · "1.850,50"->1850,5
const parseNum = s => {
  const t = String(s || '').replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
};
const telOk = s => { const d = soloDig(s); const t = d.length === 11 && d.startsWith('34') ? d.slice(2) : d; return /^[6-9]\d{8}$/.test(t); };
// Fecha en formato español DÍA/MES/AÑO (admite / - . como separador) o la
// palabra "hoy"/"ahora". Devuelve ISO (AAAA-MM-DD) o null si no es válida.
// La fecha EXACTA importa: la plusvalía por años no es igual comprando el
// 1 de enero que el 31 de diciembre.
function fechaISO(s) {
  const t = String(s || '').trim().toLowerCase();
  if (t === 'hoy' || t === 'ahora' || t === 'ya') return new Date().toISOString().slice(0, 10);
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return null;
  let d = +m[1], mo = +m[2], y = +m[3];
  if (y < 100) y += 2000;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null; // descarta 31/02, etc.
  if (y < 1900 || y > 2100) return null;
  return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
const VALIDADORES = {
  money: s => parseNum(s) > 0 ? null : 'Escribe una cantidad válida (solo números).',
  money0: s => /\d/.test(s) ? null : 'Escribe una cantidad (pon 0 si no hubo).',
  tel: s => telOk(s) ? null : 'Ese teléfono no parece correcto. Escribe 9 dígitos (ej. 612 345 678).',
  nombre: s => String(s).trim().length >= 2 ? null : 'Dime tu nombre, por favor.',
  texto: s => String(s).trim().length >= 3 ? null : 'Necesito un poco más de detalle.',
  anio: s => { const n = parseNum(s); return (n > 1950 && n <= 2026) ? null : 'Escribe un año válido, ej. 2011.'; },
  anios: s => parseNum(s) > 0 ? null : 'Indica los años.',
  fecha: s => fechaISO(s) ? null : 'Escribe la fecha como día/mes/año, ej. 30/09/2022 (o "hoy").',
  pct: s => { const n = parseFloat(String(s).replace(',', '.')); return (n > 0 && n <= 100) ? null : 'Indica un porcentaje entre 1 y 100.'; },
  tin: s => { const n = parseFloat(String(s).replace(',', '.')); return (!isNaN(n) && n >= 0 && n < 20) ? null : 'Escribe un tipo, ej. 3'; },
  edad: s => { const n = parseNum(s); return (n >= 18 && n <= 90) ? null : 'Escribe una edad válida (18-90).'; }
};
function parsear(entrada, texto) {
  if (entrada === 'dinero' || entrada === 'numero') return parseNum(texto);
  if (entrada === 'decimal') return parseFloat(String(texto).replace(',', '.'));
  if (entrada === 'fecha') return fechaISO(texto) || '';
  return String(texto).trim();
}

// ============================================================
// API pública
// ============================================================
function crearEstado(origin) { return { flow: null, a: {}, sent: 0, eventSent: 0, pending: null, ruta: [], origin: origin || null, turno: 0 }; }

function iniciar(estado) {
  estado.flow = 'menu'; estado.a = {}; estado.sent = 0; estado.pending = null; estado.ruta = [];
  const salidas = [{ texto: tx('menu.saludo1') }, { texto: tx('menu.saludo2') }];
  const eventos = [{ evento: 'inicio', origin: estado.origin }];
  bucleSimular(estado, salidas, [], eventos);
  return { salidas, estado, leads: [], eventos };
}

function entrada(estado, inp) {
  if (!estado.flow) return iniciar(estado);
  const salidas = [], leads = [], eventos = [];
  if (estado.pending) {
    const err = aplicar(estado, inp);
    if (err === 'stale') return { salidas: [], estado, leads, eventos, stale: true };
    if (err) { salidas.push({ texto: '⚠️ ' + err }); reemitirPregunta(estado, salidas); return { salidas, estado, leads, eventos }; }
  }
  bucleSimular(estado, salidas, leads, eventos);
  return { salidas, estado, leads, eventos };
}

function bucleSimular(estado, salidas, leads, eventos) {
  let guard = 0;
  while (guard++ < 80) {
    const r = simular(estado.flow, estado.a, { ruta: estado.ruta, origin: estado.origin });
    for (let i = estado.sent; i < r.fixed.length; i++) salidas.push(r.fixed[i]);
    estado.sent = r.fixed.length;
    for (const l of r.leads) leads.push(l);
    // Eventos: solo los NUEVOS de este segmento (no re-registrar al rejugar).
    for (let i = (estado.eventSent || 0); i < r.eventos.length; i++) eventos.push(r.eventos[i]);
    estado.eventSent = r.eventos.length;
    if (r.cerrar) { estado.flow = null; estado.pending = null; estado.a = {}; estado.sent = 0; estado.eventSent = 0; estado.ruta = []; return; }
    if (r.pregunta) { estado.turno++; salidas.push(prepararPregunta(r.pregunta, estado.turno)); estado.pending = Object.assign({ turno: estado.turno }, r.pregunta.pend); return; }
    estado.pending = null;
    if (r.jumpFlow) { if (r.pushRuta) estado.ruta = estado.ruta.concat([r.pushRuta]); eventos.push({ evento: 'flujo', flow: r.jumpFlow }); estado.flow = r.jumpFlow; estado.a = {}; estado.sent = 0; estado.eventSent = 0; continue; }
    estado.flow = 'menu'; estado.a = {}; estado.sent = 0; estado.eventSent = 0; estado.ruta = []; continue;
  }
}

// Convierte la pregunta en un mensaje con teclado (data = "turno:idx")
function prepararPregunta(pr, turno) {
  if (pr.tipo === 'chips') return { texto: pr.texto, teclado: pr.opciones.map((o, i) => [{ label: tx(o.texto), data: turno + ':' + i }]) };
  if (pr.tipo === 'lista') return { texto: pr.texto, listaCCAA: true, botonLabel: pr.botonLabel, turno };
  return { texto: pr.texto };   // texto libre
}
function reemitirPregunta(estado, salidas) {
  // re-simula solo para reconstruir la pregunta actual (sin reenviar fijos)
  const r = simular(estado.flow, estado.a, { ruta: estado.ruta, origin: estado.origin });
  if (r.pregunta) salidas.push(prepararPregunta(r.pregunta, estado.turno));
}

function aplicar(estado, inp) {
  const pend = estado.pending;
  if (pend.kind === 'chips') {
    if (inp.tipo !== 'boton') { return 'Toca uno de los botones 👇'; }
    if (inp.turno !== pend.turno) return 'stale';
    const op = pend.opciones[inp.idx]; if (!op) return 'stale';
    setPath(estado.a, pend.path, op.valor);
    if (!op.pedir && !pend.bucleCont) setPath(estado.a, pend.valPath || pend.path, op.valor);
    return null;
  }
  if (pend.kind === 'texto') {
    if (inp.tipo !== 'texto') return 'Escribe tu respuesta, por favor.';
    const bruto = String(inp.valor || '').trim();
    if (!bruto) return 'Escribe tu respuesta, por favor.';
    if (pend.validador && VALIDADORES[pend.validador]) { const m = VALIDADORES[pend.validador](bruto); if (m) return m; }
    setPath(estado.a, pend.path, parsear(pend.entrada, bruto));
    return null;
  }
  if (pend.kind === 'lista') {
    if (inp.tipo !== 'lista') return 'Elige tu comunidad en la lista 👇';
    setPath(estado.a, pend.path, inp.slug);
    return null;
  }
  return null;
}

  var API = { crearEstado: crearEstado, iniciar: iniciar, entrada: entrada, simular: simular, tx: tx, VALIDADORES: VALIDADORES };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.KITTY_RUNNER = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
