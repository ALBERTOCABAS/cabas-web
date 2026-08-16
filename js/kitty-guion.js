// ============================================================
// kitty-guion.js — GUIÓN DECLARATIVO de Kitty (web + Telegram)
// ------------------------------------------------------------
// UNA sola definición de los flujos. La usan el widget de la web y el
// Worker de Telegram. REGLA DE ORO: aquí NO hay textos "a pelo"; cada
// paso apunta a un id de kitty-textos.js. Las funciones solo calculan
// NÚMEROS/valores para los huecos {..} de los textos.
//
// PRINCIPIO DE CAPTACIÓN: los DATOS DE CONTACTO (consentimiento + nombre
// + teléfono) se piden ANTES que los datos del inmueble. Un teléfono sin
// dirección sirve; una dirección sin teléfono, no. Por eso en "valorar"
// el subflujo pedirContacto va al principio, y los datos del piso al final.
// (En los flujos con CÁLCULO, primero se entrega el resultado —que es el
//  valor— y luego se pide el contacto; no se recoge dirección.)
//
// ---- MENSAJE ----  { texto, valores? }   texto = id (o selector {segun,casos});
//   valores = función(a[,r]) con los valores para los huecos {..}.
// ---- TIPOS DE PASO ----
//   decir, chips, texto, sub, calc,
//   pedirContacto  (macro: consentimiento RGPD + nombre + teléfono; si NO → termina)
//   entregarLead   (macro: guarda el lead + avisa a Alberto + confirmación)
//   Dentro de subflujos: lista, guardarLead (acción), handoff (mensaje + botones).
// ---- TARJETA ----  { titulo, lineas:[ {etiqueta, emoji, valor} ], total:{...}, avisos, disc }
//   valor = función(r)→string (número ya formateado) ó mensaje {texto,valores}.
//   La CARA de la tarjeta la pone cada canal: la web, su tarjeta HTML; Telegram,
//   texto nativo (negritas + emojis), con la CUOTA/total arriba y destacada.
// ---- RAMAS ----  opción de chips con saltarA salta a ese id. '@fin'/'@menu' especiales.
// ---- ENTRADA ---- 'dinero' | 'numero' | 'decimal' | 'tel' | 'texto'
// ============================================================
(function (raiz) {
  'use strict';

  var _eur  = function (n) { return (typeof eur  === 'function') ? eur(n)  : String(n); };
  var _eur2 = function (n) { return (typeof eur2 === 'function') ? eur2(n) : String(n); };
  var _cuota = function (c, p, t) { return (typeof coreCuota === 'function') ? coreCuota(c, p, t) : 0; };

  function nombreCCAA(slug) {
    var D = raiz.DATOS_CCAA || (typeof DATOS_CCAA !== 'undefined' ? DATOS_CCAA : null);
    return (D && D[slug]) ? D[slug].nombre : slug;
  }
  function primerNombre(s) { return String(s || '').trim().split(' ')[0]; }
  // Porcentaje con 1 decimal y coma (p. ej. 3.86 -> "3,9"). Solo NÚMERO, sin texto.
  function pc(x) { return Number(x || 0).toFixed(1).replace('.', ','); }
  // Fecha de hoy (para la fecha de venta en el cálculo del neto del vendedor).
  function hoyISO() { return new Date().toISOString().slice(0, 10); }

  // Página de reservas de Google Calendar (llamada de 30 min con Cabas).
  // Único sitio donde vive el enlace; los 3 canales lo usan igual. Si algún
  // día cambia la agenda, se cambia SOLO aquí.
  var AGENDA_URL = 'https://calendar.app.google/hDaAQhrxYR7k1Xaj7';

  // Aviso de edad (hipoteca). Devuelve QUÉ texto y VALORES; piezas = frases
  // completas adicionales que el runner añade en orden.
  function avisoEdad(edad, plazo, capital, tin) {
    var plazoMax = Math.max(0, 75 - edad);
    if (plazo > plazoMax) {
      var piezas = [];
      if (plazoMax >= 5) piezas.push({ texto: 'hipoteca.aviso_edad_supera_cuota', valores: { plazoMax: plazoMax, cuotaMax: _eur2(_cuota(capital, plazoMax, tin)) } });
      piezas.push({ texto: 'hipoteca.aviso_edad_cierre' });
      return { t: 'ambar', texto: 'hipoteca.aviso_edad_supera', valores: { edad: edad, plazo: plazo, plazoMax: plazoMax }, piezas: piezas };
    }
    return { t: 'verde', texto: 'hipoteca.aviso_edad_ok', valores: { edad: edad, plazo: plazo } };
  }

  // Resumen INTERNO (español, para Cabas) del lead de "Busco vivienda".
  // Se inserta como {resumen} en buscar.lead_resumen (los leads no se traducen).
  function resumenBuscar(a) {
    var zonas = { chamberi: 'Chamberí', chamartin: 'Chamartín', malasana: 'Malasaña/Centro' };
    var tipos = { obranueva: 'Obra nueva', piso: 'Piso', casa: 'Casa/Chalet', edificio: 'Edificio', local: 'Local/Oficina', garaje: 'Garaje' };
    var plantas = { igual: 'indiferente', nobajo: 'sin bajo/sótano', nobajo1: 'sin bajo/sótano ni 1º', atico: 'ático/última planta' };
    var L = [];
    L.push(a.op === 'comprar' ? '🔑 BUSCA COMPRAR' : '🏠 BUSCA ALQUILAR');
    L.push('Zona: ' + (a['zona#sel'] === 'otra' ? a.zona : (zonas[a.zona] || a.zona || '—')));
    L.push('Tipo: ' + (tipos[a.tipo] || a.tipo || '—'));
    L.push('Presupuesto: ' + _eur(a.presupuesto) + (a.op === 'alquilar' ? '/mes' : ''));
    if (a.habitaciones) L.push('Habitaciones: ' + (a.habitaciones === 'igual' ? 'indiferente' : a.habitaciones));
    if (a.banos) L.push('Baños: ' + (a.banos === 'igual' ? 'indiferente' : a.banos));
    if (a['planta#sel']) L.push('Planta: ' + (a['planta#sel'] === '__desde' ? ('desde la ' + a.planta + 'ª') : (plantas[a['planta#sel']] || '—')));
    if (a.ascensor !== undefined) L.push('Ascensor: ' + (a.ascensor ? 'indispensable' : 'no imprescindible'));
    if (a.exterior) L.push('Exterior/interior: ' + a.exterior);
    if (a.vende === true) {
      L.push('⚠️ NECESITA VENDER PARA COMPRAR — ' + (a.vende_estado === 'siventa' ? 'ya a la venta' : 'todavía no a la venta'));
      if (a.vende_donde) L.push('   Inmueble a vender: ' + a.vende_donde);
      if (a['vende_enlace#sel'] === '__link' && a.vende_enlace) L.push('   Enlace: ' + a.vende_enlace);
    }
    L.push('Consentimiento: ' + (a.consent_red === true ? 'RED COMPLETA (Redpiso · DCREDIT · FAI)' : 'SOLO equipo Cabas'));
    return L.join('\n');
  }

  var GUION = {

    // ============================================================
    // MENÚ principal. Cada opción arranca su flujo (irAFlujo). El saludo
    // largo (saludo1/saludo2) lo pone el runner en /start; al volver de un
    // flujo solo se muestra "elige".
    // ============================================================
    menu: {
      id: 'menu',
      pasos: [
        { id: 'op', tipo: 'chips', texto: 'menu.elige', guardar: 'op',
          opciones: [
            { texto: 'menu.m_valorar',   valor: 'valorar',   irAFlujo: 'valorar' },
            { texto: 'menu.m_herencia',  valor: 'herencia',  irAFlujo: 'herencia' },
            { texto: 'menu.m_vender',    valor: 'vender',    irAFlujo: 'vender' },
            { texto: 'menu.m_comprar',   valor: 'comprar',   irAFlujo: 'comprar' },
            { texto: 'menu.m_buscar',    valor: 'buscar',    irAFlujo: 'buscar' },
            { texto: 'menu.m_hipoteca',  valor: 'hipoteca',  irAFlujo: 'hipoteca' },
            { texto: 'menu.m_capacidad', valor: 'capacidad', irAFlujo: 'capacidad' },
            { texto: 'menu.m_inversion', valor: 'inversion', irAFlujo: 'inversion' },
            { texto: 'menu.m_agenda',    valor: 'agenda',    irAFlujo: 'agenda' },
            { texto: 'menu.m_contacto',  valor: 'contacto',  irAFlujo: 'contacto_directo' }
          ] }
      ]
    },

    // "Hablar con Alberto" directo: solo captación (sin cálculo).
    contacto_directo: {
      id: 'contacto_directo',
      pasos: [
        { id: 'ped', tipo: 'pedirContacto' },
        { id: 'ent', tipo: 'entregarLead',
          resumen:  { texto: 'contacto_directo.lead_resumen' },
          contexto: { texto: 'contacto_directo.lead_contexto' } }
      ]
    },

    // Agendar una llamada: enlace a la página de reservas de Google Calendar.
    // NO pide contacto aquí (el formulario de Google recoge nombre + teléfono
    // y crea el evento en la agenda de Cabas). Tras el enlace, "¿algo más?".
    agenda: {
      id: 'agenda',
      pasos: [
        { id: 'msg', tipo: 'decir', texto: 'agenda.mensaje', valores: function () { return { url: AGENDA_URL }; } },
        { id: 'mas', tipo: 'chips', texto: 'lead.algo_mas', guardar: 'quiere_mas',
          opciones: [
            { texto: 'lead.algo_si', valor: true, saltarA: '@menu' },
            { texto: 'lead.algo_no', valor: false, irAFlujo: 'despedir' }
          ] }
      ]
    },

    // ============================================================
    // FLUJO: Busco vivienda (comprar/alquilar) — CUALIFICA y deriva.
    // NO enseña la cartera. Consentimiento reforzado (compartir con la red:
    // Redpiso · DCREDIT · FAI) con alternativa "solo equipo Cabas".
    // Ramas por tipo (criterios solo residencial) y sub-flujo "vender para comprar".
    // ============================================================
    buscar: {
      id: 'buscar',
      pasos: [
        { id: 'op', tipo: 'chips', texto: 'buscar.op_preg', guardar: 'op',
          opciones: [
            { texto: 'buscar.op_comprar', valor: 'comprar' },
            { texto: 'buscar.op_alquilar', valor: 'alquilar' }
          ] },
        { id: 'zona', tipo: 'chips', texto: 'buscar.zona_preg', guardar: 'zona',
          opciones: [
            { texto: 'buscar.zona_chamberi',  valor: 'chamberi' },
            { texto: 'buscar.zona_chamartin', valor: 'chamartin' },
            { texto: 'buscar.zona_malasana',  valor: 'malasana' },
            { texto: 'buscar.zona_otra', valor: 'otra', pedir: { entrada: 'texto', validador: 'texto', placeholder: 'buscar.zona_otra_ph' } }
          ] },

        // --- Sub-flujo "vender para comprar" (solo COMPRAR) ---
        { id: 'cond_vende', tipo: 'condicion', segun: 'op', casos: { alquilar: 'tipo_route' } },
        { id: 'vende', tipo: 'chips', texto: 'buscar.vende_preg', guardar: 'vende',
          opciones: [
            { texto: 'comun.si', valor: true },
            { texto: 'comun.no', valor: false, saltarA: 'tipo_route' }
          ] },
        { id: 'vende_estado', tipo: 'chips', texto: 'buscar.vende_estado_preg', guardar: 'vende_estado',
          opciones: [
            { texto: 'buscar.vende_ya',    valor: 'siventa' },
            { texto: 'buscar.vende_noaun', valor: 'noaun' }
          ] },
        { id: 'vende_donde', tipo: 'texto', texto: 'buscar.vende_donde_preg', placeholder: 'buscar.vende_donde_ph', entrada: 'texto', validador: 'texto', guardar: 'vende_donde' },
        { id: 'cond_enlace', tipo: 'condicion', segun: 'vende_estado', casos: { noaun: 'tipo_route' } },
        { id: 'vende_enlace', tipo: 'chips', texto: 'buscar.vende_enlace_preg', guardar: 'vende_enlace',
          opciones: [
            { texto: 'buscar.vende_enlace_si', valor: '__link', pedir: { entrada: 'texto', validador: 'texto', placeholder: 'buscar.vende_enlace_ph' } },
            { texto: 'buscar.vende_enlace_no', valor: 'no' }
          ] },

        // --- Tipo (opciones distintas comprar/alquilar) ---
        { id: 'tipo_route', tipo: 'condicion', segun: 'op', casos: { alquilar: 'tipo_alq' } },
        { id: 'tipo_compra', tipo: 'chips', texto: 'buscar.tipo_preg', guardar: 'tipo', saltarA: 'presupuesto',
          opciones: [
            { texto: 'buscar.tipo_obranueva', valor: 'obranueva' },
            { texto: 'buscar.tipo_piso',      valor: 'piso' },
            { texto: 'buscar.tipo_casa',      valor: 'casa' },
            { texto: 'buscar.tipo_edificio',  valor: 'edificio' },
            { texto: 'buscar.tipo_local',     valor: 'local' },
            { texto: 'buscar.tipo_garaje',    valor: 'garaje' }
          ] },
        { id: 'tipo_alq', tipo: 'chips', texto: 'buscar.tipo_preg', guardar: 'tipo',
          opciones: [
            { texto: 'buscar.tipo_piso',   valor: 'piso' },
            { texto: 'buscar.tipo_casa',   valor: 'casa' },
            { texto: 'buscar.tipo_local',  valor: 'local' },
            { texto: 'buscar.tipo_garaje', valor: 'garaje' }
          ] },

        { id: 'presupuesto', tipo: 'texto', entrada: 'dinero', validador: 'money', guardar: 'presupuesto',
          texto: { segun: 'op', casos: { comprar: 'buscar.presu_compra', alquilar: 'buscar.presu_alq' } }, placeholder: 'buscar.presu_ph' },

        // --- Criterios (solo residencial: obra nueva / piso / casa) ---
        { id: 'cond_resid', tipo: 'condicion', segun: 'tipo', casos: { edificio: 'consent', local: 'consent', garaje: 'consent' } },
        { id: 'habitaciones', tipo: 'chips', texto: 'buscar.hab_preg', guardar: 'habitaciones',
          opciones: [ { texto: 'buscar.n1', valor: '1' }, { texto: 'buscar.n2', valor: '2' }, { texto: 'buscar.n3', valor: '3' }, { texto: 'buscar.n4mas', valor: '4+' }, { texto: 'buscar.igual', valor: 'igual' } ] },
        { id: 'banos', tipo: 'chips', texto: 'buscar.banos_preg', guardar: 'banos',
          opciones: [ { texto: 'buscar.n1', valor: '1' }, { texto: 'buscar.n2', valor: '2' }, { texto: 'buscar.n3mas', valor: '3+' }, { texto: 'buscar.igual', valor: 'igual' } ] },
        { id: 'planta', tipo: 'chips', texto: 'buscar.planta_preg', guardar: 'planta',
          opciones: [
            { texto: 'buscar.planta_igual',   valor: 'igual' },
            { texto: 'buscar.planta_nobajo',  valor: 'nobajo' },
            { texto: 'buscar.planta_nobajo1', valor: 'nobajo1' },
            { texto: 'buscar.planta_atico',   valor: 'atico' },
            { texto: 'buscar.planta_desde', valor: '__desde', pedir: { entrada: 'numero', validador: 'anios', placeholder: 'buscar.planta_desde_ph' } }
          ] },
        { id: 'cond_asc', tipo: 'condicion', segun: 'tipo', casos: { obranueva: 'cond_ext', casa: 'cond_ext' } },
        { id: 'ascensor', tipo: 'chips', texto: 'buscar.asc_preg', guardar: 'ascensor',
          opciones: [ { texto: 'buscar.asc_si', valor: true }, { texto: 'buscar.asc_no', valor: false } ] },
        { id: 'cond_ext', tipo: 'condicion', segun: 'tipo', casos: { casa: 'consent' } },
        { id: 'exterior', tipo: 'chips', texto: 'buscar.ext_preg', guardar: 'exterior',
          opciones: [ { texto: 'buscar.ext_ext', valor: 'exterior' }, { texto: 'buscar.ext_int', valor: 'interior' }, { texto: 'buscar.ext_dep', valor: 'depende' } ] },

        // --- Consentimiento reforzado (+ alternativa solo Cabas) ---
        { id: 'consent', tipo: 'chips', texto: 'buscar.consent_preg', enlace: 'buscar.consent_link', guardar: 'consent_red',
          opciones: [
            { texto: 'buscar.consent_si', valor: true, saltarA: 'nombre' },
            { texto: 'buscar.consent_no', valor: false }
          ] },
        { id: 'consent_solo', tipo: 'chips', texto: 'buscar.consent_solo_preg', guardar: 'consent_solo',
          opciones: [
            { texto: 'buscar.consent_solo_si', valor: true },
            { texto: 'buscar.consent_solo_no', valor: false, irAFlujo: 'despedir' }
          ] },
        { id: 'nombre', tipo: 'texto', texto: 'lead.nombre_preg', placeholder: 'lead.nombre_ph', entrada: 'texto', validador: 'nombre', guardar: 'nombre' },
        { id: 'tel', tipo: 'texto', texto: 'lead.tel_preg', placeholder: 'lead.tel_ph', entrada: 'tel', validador: 'tel', guardar: 'tel',
          valores: function (a) { return { nombre: primerNombre(a.nombre) }; } },
        { id: 'entrega', tipo: 'entregarLead',
          resumen:  { texto: 'buscar.lead_resumen', valores: function (a) { return { resumen: resumenBuscar(a) }; } },
          contexto: { texto: 'buscar.lead_contexto' } }
      ]
    },

    // Despedida reutilizable: mensaje de cierre + web + compartir, y CIERRA
    // la conversación (no reaparece el menú; el usuario escribe "Hola" para volver).
    despedir: {
      id: 'despedir',
      pasos: [
        { id: 'fin', tipo: 'despedir', texto: 'lead.despedida' }
      ]
    },

    // ============================================================
    // FLUJO: Valorar un inmueble  (CONTACTO primero, inmueble al final)
    // ============================================================
    valorar: {
      id: 'valorar',
      pasos: [
        { id: 'intro',    tipo: 'decir', texto: 'valorar.intro' },

        // 1º) Consentimiento + nombre + teléfono. Si NO acepta, termina aquí
        //     (con la salida amable) y NO se le piden datos del inmueble.
        { id: 'contacto', tipo: 'pedirContacto' },

        // 2º) Ahora sí, los datos del inmueble.
        { id: 'cuantos', tipo: 'chips', texto: 'valorar.cuantos_preg', guardar: 'cuantos',
          opciones: [
            { texto: 'valorar.opt_uno',    valor: 'uno' },
            { texto: 'valorar.opt_varios', valor: 'varios', saltarA: 'varios_dir' }
          ] },
        { id: 'uno_ccaa', tipo: 'sub',   sub: 'elegirCCAA', texto: 'valorar.ccaa_preg', guardar: 'ccaa' },
        { id: 'uno_dir',  tipo: 'texto', texto: 'valorar.dir_preg', placeholder: 'valorar.dir_ph',
          entrada: 'texto', validador: 'texto', guardar: 'dir', saltarA: 'entrega' },
        { id: 'varios_dir', tipo: 'texto', texto: 'valorar.varios_preg', placeholder: 'valorar.varios_ph',
          entrada: 'texto', validador: 'texto', guardar: 'dir' },

        // 3º) Entrega del lead (ya tenemos teléfono + inmueble).
        { id: 'entrega', tipo: 'entregarLead',
          resumen:  { texto: { segun: 'cuantos', casos: { uno: 'valorar.lead_resumen_uno',  varios: 'valorar.lead_resumen_varios' } },
                      valores: function (a) { return { ccaa: nombreCCAA(a.ccaa), dir: a.dir }; } },
          contexto: { texto: { segun: 'cuantos', casos: { uno: 'valorar.lead_contexto_uno', varios: 'valorar.lead_contexto_varios' } },
                      valores: function (a) { return { ccaa: nombreCCAA(a.ccaa), dir: a.dir }; } } }
      ]
    },

    // ============================================================
    // FLUJO: Simular hipoteca  (primero el resultado, luego el contacto)
    // ============================================================
    hipoteca: {
      id: 'hipoteca',
      pasos: [
        { id: 'intro',   tipo: 'decir', texto: 'hipoteca.intro' },
        { id: 'capital', tipo: 'texto', texto: 'hipoteca.capital_preg', placeholder: 'hipoteca.capital_ph',
          entrada: 'dinero', validador: 'money', guardar: 'capital' },
        { id: 'plazo',   tipo: 'chips', texto: 'hipoteca.plazo_preg', guardar: 'plazo',
          opciones: [
            { texto: 'comun.plazo_20a', valor: 20 },
            { texto: 'comun.plazo_25a', valor: 25 },
            { texto: 'comun.plazo_30a', valor: 30 },
            { texto: 'comun.otro', valor: '__otro', pedir: { entrada: 'numero', validador: 'anios', placeholder: 'comun.anios_ph' } }
          ] },
        { id: 'tin',     tipo: 'texto', texto: 'hipoteca.tin_preg', placeholder: 'hipoteca.tin_ph',
          entrada: 'decimal', validador: 'tin', guardar: 'tin' },
        { id: 'tit',     tipo: 'sub',   sub: 'titularesEdades', guardar: 'te' },
        { id: 'ingresos', tipo: 'texto', texto: 'hipoteca.ingresos_preg', placeholder: 'hipoteca.ingresos_ph',
          entrada: 'dinero', validador: 'money', guardar: 'ingresos' },
        { id: 'deudas', tipo: 'chips', texto: 'comun.deudas_preg', guardar: 'deudaMes',
          opciones: [
            { texto: 'comun.no', valor: 0 },
            { texto: 'comun.si', valor: '__si', pedir: { entrada: 'dinero', validador: 'money', placeholder: 'comun.deudas_monto_preg' } }
          ] },

        { id: 'resultado', tipo: 'calc',
          calcular: function (a) {
            var capital = a.capital, plazo = a.plazo, tin = a.tin, edad = a.te.edadRef;
            var ingresos = a.ingresos || 0, deudaMes = a.deudaMes || 0;
            var cuota = _cuota(capital, plazo, tin);
            var totalPagado = cuota * plazo * 12;
            // Tasa de esfuerzo: (cuota nueva + otras deudas) / ingresos. El banco cuenta toda la deuda.
            var esfuerzo = ingresos > 0 ? ((cuota + deudaMes) / ingresos) * 100 : null;
            return { capital: capital, plazo: plazo, tin: tin, edad: edad,
                     cuota: cuota, totalPagado: totalPagado, intereses: totalPagado - capital,
                     ingresos: ingresos, deudaMes: deudaMes, esfuerzo: esfuerzo };
          },
          tarjeta: {
            titulo: 'hipoteca.card_titulo',
            // "total" (la cuota) el runner de Telegram la pinta ARRIBA y destacada.
            total: { etiqueta: 'hipoteca.l_cuota', emoji: '💰', valor: function (r) { return _eur2(r.cuota); } },
            lineas: [
              { etiqueta: 'hipoteca.l_importe',   emoji: '📋', valor: function (r) { return _eur(r.capital); } },
              { etiqueta: 'hipoteca.l_plazo',     emoji: '📅', valor: { texto: 'comun.v_anios', valores: function (r) { return { n: r.plazo }; } } },
              { etiqueta: 'hipoteca.l_interes',   emoji: '📈', valor: { texto: 'comun.v_pct',   valores: function (r) { return { n: String(r.tin).replace('.', ',') }; } } },
              { etiqueta: 'hipoteca.l_titular',   emoji: '👤', valor: { texto: 'comun.v_anios', valores: function (r) { return { n: r.edad }; } } },
              { etiqueta: 'hipoteca.l_intereses', emoji: '💸', valor: function (r) { return _eur2(r.intereses); } },
              { etiqueta: 'hipoteca.l_total_dev', emoji: '🧾', valor: function (r) { return _eur(r.totalPagado); } }
            ],
            avisos: function (r) {
              var A = [ avisoEdad(r.edad, r.plazo, r.capital, r.tin) ];
              if (r.esfuerzo != null) {
                var t = r.esfuerzo <= 30 ? 'verde' : (r.esfuerzo <= 35 ? 'ambar' : 'rojo');
                var k = r.esfuerzo <= 30 ? 'hipoteca.aviso_esf_ok' : (r.esfuerzo <= 35 ? 'hipoteca.aviso_esf_justa' : 'hipoteca.aviso_esf_alta');
                var av = { t: t, texto: k, valores: { esf: r.esfuerzo.toFixed(1).replace('.', ',') } };
                // Si hay otras deudas, aclara que el % es cuota + deudas sobre ingresos.
                if (r.deudaMes > 0) av.piezas = [{ texto: 'hipoteca.aviso_esf_detalle', valores: { cuota: _eur2(r.cuota), deuda: _eur2(r.deudaMes), total: _eur2(r.cuota + r.deudaMes) } }];
                A.push(av);
              }
              return A;
            },
            disc: 'hipoteca.disc'
          } },

        // Tras el resultado, se ofrece contacto (y solo entonces se pide RGPD).
        { id: 'oc', tipo: 'chips', texto: 'contacto.pregunta', guardar: 'quiere',
          opciones: [
            { texto: 'contacto.chip_lead', valor: 'lead' },
            { texto: 'contacto.chip_menu', valor: 'menu', saltarA: '@menu' }, { texto: 'contacto.chip_nada', valor: 'nada', irAFlujo: 'despedir' }
          ] },
        { id: 'ped', tipo: 'pedirContacto' },
        { id: 'entrega', tipo: 'entregarLead',
          resumen:  { texto: 'hipoteca.lead_resumen',
                      valores: function (a) { var r = a.__r || {}; return { capital: _eur(a.capital), plazo: a.plazo, tin: a.tin, edad: a.te.edadRef, cuota: _eur2(r.cuota) }; } },
          contexto: { texto: 'hipoteca.lead_contexto' } }
      ]
    },

    // ============================================================
    // FLUJO: Herencia  (informativo + lead; puede saltar a "vender")
    //   Novedad de patrón: una opción de chips puede llevar "irAFlujo",
    //   que arranca otro flujo completo (aquí: la calculadora de venta).
    // ============================================================
    herencia: {
      id: 'herencia',
      pasos: [
        { id: 'punto', tipo: 'chips', texto: 'herencia.intro', guardar: 'punto',
          opciones: [
            { texto: 'herencia.opt_nuevo',       valor: 'nuevo' },
            { texto: 'herencia.opt_coherederos', valor: 'coherederos' },
            { texto: 'herencia.opt_vender',      valor: 'vender', saltarA: 'vender_q' },
            { texto: 'herencia.opt_info',        valor: 'info' }
          ] },
        // Respuesta para nuevo / coherederos / info, y directo a captar contacto.
        { id: 'resp_info', tipo: 'decir', saltarA: 'lead_ped',
          texto: { segun: 'punto', casos: { nuevo: 'herencia.resp_nuevo', coherederos: 'herencia.resp_coherederos', info: 'herencia.resp_info' } } },
        // Rama "vender lo heredado": calcular (salta a Vender) u hablar (sigue a lead).
        { id: 'vender_q', tipo: 'chips', texto: 'herencia.resp_vender', guardar: 'via',
          opciones: [
            { texto: 'herencia.vender_calc',   valor: 'calc', irAFlujo: 'vender' },
            { texto: 'herencia.vender_hablar', valor: 'hablar' }
          ] },
        { id: 'lead_ped', tipo: 'pedirContacto' },
        { id: 'lead_ent', tipo: 'entregarLead',
          resumen:  { texto: 'herencia.lead_resumen', valores: function (a) { return { situacion: a.punto }; } },
          contexto: { texto: 'herencia.lead_contexto' } }
      ]
    },

    // ============================================================
    // FLUJO: Hasta qué precio puedo comprar (capacidad)
    //   Flujo de cálculo: pide datos → resultado → contacto.
    // ============================================================
    capacidad: {
      id: 'capacidad',
      pasos: [
        { id: 'intro',    tipo: 'decir', texto: 'capacidad.intro' },
        { id: 'ccaa',     tipo: 'sub',   sub: 'elegirCCAA', texto: 'capacidad.ccaa_preg', guardar: 'ccaa' },
        { id: 'tit',      tipo: 'sub',   sub: 'titularesEdades', guardar: 'te' },
        { id: 'ahorro',   tipo: 'texto', texto: 'capacidad.ahorro_preg', placeholder: 'capacidad.ahorro_ph', entrada: 'dinero', validador: 'money', guardar: 'ahorro' },
        { id: 'ingresos', tipo: 'texto', texto: 'capacidad.ingresos_preg', placeholder: 'capacidad.ingresos_ph', entrada: 'dinero', validador: 'money', guardar: 'ingresos' },
        { id: 'tin',      tipo: 'texto', texto: 'capacidad.tin_preg', placeholder: 'hipoteca.tin_ph', entrada: 'decimal', validador: 'tin', guardar: 'tin' },
        { id: 'deudas',   tipo: 'chips', texto: 'comun.deudas_preg', guardar: 'deudaMes',
          opciones: [
            { texto: 'comun.no', valor: 0 },
            { texto: 'comun.si', valor: '__si', pedir: { entrada: 'dinero', validador: 'money', placeholder: 'comun.deudas_monto_preg' } }
          ] },

        { id: 'resultado', tipo: 'calc',
          calcular: function (a) { return coreCapacidadCompra({ ccaaSlug: a.ccaa, edadRef: a.te.edadRef, ahorro: a.ahorro, ingresos: a.ingresos, tin: a.tin, deudaMes: a.deudaMes }); },
          tarjeta: {
            titulo: 'capacidad.card_titulo',
            total: { etiqueta: 'capacidad.l_precio_max', emoji: '💰', valor: function (r) { return _eur(r.maxPrecio); } },
            lineas: [
              { etiqueta: 'capacidad.l_ingresos',  emoji: '💶', valor: { texto: 'comun.v_mes', valores: function (r) { return { v: _eur(r.ingresos) }; } } },
              { etiqueta: 'capacidad.l_ahorro',    emoji: '🏦', valor: function (r) { return _eur(r.ahorro); } },
              { etiqueta: 'capacidad.l_plazo_max', emoji: '📅', valor: { texto: 'comun.v_anios', valores: function (r) { return { n: r.plazoMax }; } } },
              { etiqueta: 'capacidad.l_hip_max',   emoji: '📈', valor: function (r) { return _eur(r.maxHipotecaIngresos); } },
              { etiqueta: 'capacidad.l_cuota',     emoji: '💸', valor: { texto: 'comun.v_mes', valores: function (r) { return { v: _eur2(r.cuota) }; } } }
            ],
            avisos: function (r) {
              var A = [ { t: 'verde', texto: 'capacidad.aviso_max', valores: { maxPrecio: _eur(r.maxPrecio), ccaa: r.ccaaNombre } } ];
              A.push(r.limita === 'ahorro' ? { t: 'ambar', texto: 'capacidad.aviso_limita_ahorro' } : { t: 'ambar', texto: 'capacidad.aviso_limita_ingresos' });
              if (r.edadRef) A.push({ t: 'ambar', texto: 'capacidad.aviso_plazo', valores: { plazoMax: r.plazoMax } });
              return A;
            },
            disc: 'capacidad.disc'
          } },

        { id: 'oc', tipo: 'chips', texto: 'contacto.pregunta', guardar: 'quiere',
          opciones: [
            { texto: 'contacto.chip_lead', valor: 'lead' },
            { texto: 'contacto.chip_menu', valor: 'menu', saltarA: '@menu' }, { texto: 'contacto.chip_nada', valor: 'nada', irAFlujo: 'despedir' }
          ] },
        { id: 'ped', tipo: 'pedirContacto' },
        { id: 'entrega', tipo: 'entregarLead',
          resumen:  { texto: 'capacidad.lead_resumen',
                      valores: function (a) { var r = a.__r || {}; return { ccaa: r.ccaaNombre, ingresos: _eur(a.ingresos), ahorro: _eur(a.ahorro), edad: a.te.edadRef, hipMax: _eur(r.maxHipotecaIngresos), precioMax: _eur(r.maxPrecio) }; } },
          contexto: { texto: 'capacidad.lead_contexto', valores: function (a) { var r = a.__r || {}; return { ccaa: r.ccaaNombre }; } } }
      ]
    },

    // ============================================================
    // FLUJO: Cuánto cuesta comprar
    //   Novedades de patrón: subflujo "honorarios" (con base) y líneas de
    //   tarjeta con "si" (aparecen solo si aplican). Etiqueta del impuesto =
    //   función (la calcula el motor: ITP vs IVA+AJD).
    //   Avisos: vienen del motor (calc-core), ya en español (ver nota).
    // ============================================================
    comprar: {
      id: 'comprar',
      pasos: [
        { id: 'intro',    tipo: 'decir', texto: 'comprar.intro' },
        { id: 'precio',   tipo: 'texto', texto: 'comprar.precio_preg', placeholder: 'comprar.precio_ph', entrada: 'dinero', validador: 'money', guardar: 'precio' },
        { id: 'hon',      tipo: 'sub',   sub: 'honorarios', texto: 'comprar.hon_preg', base: function (a) { return a.precio; }, guardar: 'honorarios' },
        { id: 'ccaa',     tipo: 'sub',   sub: 'elegirCCAA', texto: 'comprar.ccaa_preg', guardar: 'ccaa' },
        { id: 'viv',      tipo: 'chips', texto: 'comprar.viv_preg', guardar: 'tipoViv',
          opciones: [ { texto: 'comun.viv_usada', valor: 'usada' }, { texto: 'comun.viv_nueva', valor: 'nueva' } ] },
        { id: 'hip',      tipo: 'chips', texto: 'comprar.hip_preg', guardar: 'conHip',
          opciones: [ { texto: 'comun.con_hipoteca', valor: true }, { texto: 'comun.al_contado', valor: false, saltarA: 'calc' } ] },
        { id: 'ahorro',   tipo: 'texto', texto: 'comprar.ahorro_preg', placeholder: 'comprar.ahorro_ph', entrada: 'dinero', validador: 'money', guardar: 'ahorro' },
        { id: 'plazo',    tipo: 'chips', texto: 'comprar.plazo_preg', guardar: 'plazo',
          opciones: [ { texto: 'comun.n_20', valor: 20 }, { texto: 'comun.n_25', valor: 25 }, { texto: 'comun.n_30', valor: 30 },
                      { texto: 'comun.otro', valor: '__otro', pedir: { entrada: 'numero', validador: 'anios', placeholder: 'comun.anios_ph' } } ] },
        { id: 'tin',      tipo: 'texto', texto: 'comprar.tin_preg', placeholder: 'comprar.tin_ph', entrada: 'decimal', validador: 'tin', guardar: 'tin' },
        { id: 'ingresos', tipo: 'texto', texto: 'comprar.ingresos_preg', placeholder: 'comprar.ingresos_ph', entrada: 'dinero', validador: 'money', guardar: 'ingresos' },
        { id: 'deudas',   tipo: 'chips', texto: 'comun.deudas_preg', guardar: 'deudaMes',
          opciones: [
            { texto: 'comun.no', valor: 0 },
            { texto: 'comun.si', valor: '__si', pedir: { entrada: 'dinero', validador: 'money', placeholder: 'comun.deudas_monto_preg' } }
          ] },
        { id: 'tit',      tipo: 'sub',   sub: 'titularesEdades', guardar: 'te' },
        { id: 'calc', tipo: 'calc',
          calcular: function (a) {
            return coreCompra({ precio: a.precio, tipoViv: a.tipoViv, ccaaSlug: a.ccaa, conHipoteca: !!a.conHip,
              ahorro: a.ahorro || 0, plazo: a.plazo || 0, tin: a.tin || 0, ingresos: a.ingresos || 0, deudaMes: a.deudaMes || 0,
              edadRef: (a.te && a.te.edadRef) || null, honorarios: a.honorarios || 0 });
          },
          tarjeta: {
            titulo: 'comprar.card_titulo',
            total: { etiqueta: 'comprar.l_total', emoji: '💰', valor: function (r) { return _eur(r.costeTotal); } },
            lineas: [
              { etiqueta: 'comprar.l_precio',   emoji: '🏠', valor: function (r) { return _eur(r.precio); } },
              { etiqueta: function (r) { return r.impLabel; }, emoji: '🧾', valor: function (r) { return _eur2(r.impuestos); } },
              { etiqueta: 'comprar.l_notaria',  emoji: '📝', valor: function (r) { return _eur2(r.gastos.notaria); } },
              { etiqueta: 'comprar.l_registro', emoji: '📚', valor: function (r) { return _eur2(r.gastos.registro); } },
              { etiqueta: 'comprar.l_gestoria', emoji: '🗂️', valor: function (r) { return _eur2(r.gastos.gestoria); } },
              { etiqueta: 'comprar.l_tasacion', emoji: '📐', valor: function (r) { return _eur2(r.gastos.tasacion); }, si: function (a) { return !!a.conHip; } },
              { etiqueta: { segun: 'conHip', casos: { 'true': 'comprar.l_honorarios_hip', 'false': 'comprar.l_honorarios' } }, emoji: '🤝', valor: function (r) { return _eur2(r.honorarios); }, si: function (a, r) { return r.honorarios > 0; } },
              { etiqueta: 'comprar.l_hipoteca', emoji: '🏦', valor: function (r) { return _eur(r.hipoteca); }, si: function (a) { return !!a.conHip; } },
              { etiqueta: 'comprar.l_cuota',    emoji: '💸', valor: { texto: 'comun.v_mes', valores: function (r) { return { v: _eur2(r.cuota) }; } }, si: function (a) { return !!a.conHip; } },
              { etiqueta: 'comprar.l_ltv',      emoji: '📊', valor: { texto: 'comun.v_pct', valores: function (r) { return { n: r.ltv.toFixed(0) }; } }, si: function (a) { return !!a.conHip; } }
            ],
            avisos: function (r) { return r.avisos || []; },
            disc: 'comprar.disc'
          } },
        { id: 'oc', tipo: 'chips', texto: 'contacto.pregunta', guardar: 'quiere',
          opciones: [ { texto: 'contacto.chip_lead', valor: 'lead' }, { texto: 'contacto.chip_menu', valor: 'menu', saltarA: '@menu' }, { texto: 'contacto.chip_nada', valor: 'nada', irAFlujo: 'despedir' } ] },
        { id: 'ped', tipo: 'pedirContacto' },
        { id: 'entrega', tipo: 'entregarLead',
          resumen:  { texto: { segun: 'conHip', casos: { 'true': 'comprar.lead_resumen_hip', 'false': 'comprar.lead_resumen_contado' } },
                      valores: function (a) { var r = a.__r || {}; return { precio: _eur(a.precio), ccaa: r.ccaaNombre, tipoViv: a.tipoViv, hon: _eur2(r.honorarios || 0), coste: _eur(r.costeTotal), hipoteca: _eur(r.hipoteca), cuota: _eur2(r.cuota), ltv: (r.ltv || 0).toFixed(0), edad: (a.te && a.te.edadRef) || '' }; } },
          contexto: { texto: 'comprar.lead_contexto', valores: function (a) { var r = a.__r || {}; return { precio: _eur(a.precio), ccaa: r.ccaaNombre }; } } }
      ]
    },

    // ============================================================
    // FLUJO: Lo que me queda si vendo
    //   Novedad de patrón: paso "bucle" (adquisiciones, hasta 3), con salida
    //   "Calcular ya con estas" en cada vuelta. Con UNA sola adquisición ya
    //   se calcula. Etiqueta de plusvalía y valores "Exenta/—" condicionales.
    //   Avisos: vienen del motor (calc-core).
    // ============================================================
    vender: {
      id: 'vender',
      pasos: [
        { id: 'intro', tipo: 'decir', texto: 'vender.intro' },
        { id: 'venta', tipo: 'texto', texto: 'vender.venta_preg', placeholder: 'vender.venta_ph', entrada: 'dinero', validador: 'money', guardar: 'venta' },
        { id: 'fventa', tipo: 'texto', texto: 'vender.fventa_preg', placeholder: 'vender.fventa_ph', entrada: 'fecha', validador: 'fecha', guardar: 'fventa' },
        { id: 'adq_intro', tipo: 'decir', texto: 'vender.adq_intro' },
        { id: 'modo', tipo: 'chips', texto: 'vender.modo_preg', guardar: 'modo',
          opciones: [ { texto: 'vender.modo_una', valor: 'una' }, { texto: 'vender.modo_varias', valor: 'varias', saltarA: 'varias_intro' } ] },
        // rama: UNA adquisición (3 datos → resultado)
        { id: 'una_valor', tipo: 'texto', texto: 'vender.una_valor_preg', placeholder: 'vender.una_valor_ph', entrada: 'dinero', validador: 'money', guardar: 'una_valor' },
        { id: 'una_fecha', tipo: 'texto', texto: 'vender.fecha_adq_preg', placeholder: 'vender.fecha_ph', entrada: 'fecha', validador: 'fecha', guardar: 'una_fecha' },
        { id: 'una_gastos',tipo: 'texto', texto: 'vender.una_gastos_preg', placeholder: 'vender.una_gastos_ph', entrada: 'dinero', validador: 'money0', guardar: 'una_gastos', saltarA: 'gventa' },
        // rama: VARIAS adquisiciones (bucle)
        { id: 'varias_intro', tipo: 'decir', texto: 'vender.varias_intro' },
        { id: 'bucle', tipo: 'bucle', guardar: 'adquisiciones', max: 3,
          itemPasos: [
            { id: 'v', tipo: 'texto', texto: 'vender.adq_valor_preg', placeholder: 'vender.adq_valor_ph', entrada: 'dinero', validador: 'money', guardar: 'valor' },
            { id: 'a', tipo: 'texto', texto: 'vender.adq_fecha_preg', placeholder: 'vender.fecha_ph', entrada: 'fecha', validador: 'fecha', guardar: 'fecha' },
            { id: 'g', tipo: 'texto', texto: 'vender.adq_gastos_preg', placeholder: 'vender.adq_gastos_ph', entrada: 'dinero', validador: 'money0', guardar: 'gastos' },
            { id: 'p', tipo: 'texto', texto: 'vender.adq_pct_preg', placeholder: 'vender.adq_pct_ph', entrada: 'numero', validador: 'pct', guardar: 'pct' }
          ],
          item: function (it) { return { valor: it.valor, gastos: it.gastos, fecha: it.fecha, pct: it.pct }; },
          continuar: { texto: 'vender.mas_preg', mas: 'vender.mas_si', fin: 'vender.mas_no' } },
        // convergen ambas ramas
        { id: 'gventa', tipo: 'texto', texto: 'vender.gventa_preg', placeholder: 'vender.gventa_ph', entrada: 'dinero', validador: 'money0', guardar: 'gventa' },
        { id: 'habitual', tipo: 'chips', texto: 'vender.habitual_preg', guardar: 'habitual',
          opciones: [ { texto: 'comun.si', valor: true }, { texto: 'comun.no', valor: false, saltarA: 'afinar' } ] },
        { id: 'm65', tipo: 'chips', texto: 'vender.m65_preg', guardar: 'mayor65',
          opciones: [ { texto: 'vender.m65_si', valor: true, saltarA: 'afinar' }, { texto: 'comun.no', valor: false } ] },
        { id: 'reinv', tipo: 'chips', texto: 'vender.reinv_preg', guardar: 'reinv',
          opciones: [ { texto: 'vender.reinv_si', valor: true }, { texto: 'comun.no', valor: false } ] },
        { id: 'afinar', tipo: 'chips', texto: 'vender.afinar_preg', guardar: 'afinar',
          opciones: [ { texto: 'vender.afinar_si', valor: true }, { texto: 'vender.afinar_no', valor: false, saltarA: 'calc' } ] },
        { id: 'vc_total', tipo: 'texto', texto: 'vender.vc_total_preg', placeholder: 'vender.vc_total_ph', entrada: 'dinero', validador: 'money', guardar: 'vcTotal' },
        { id: 'vc_suelo', tipo: 'texto', texto: 'vender.vc_suelo_preg', placeholder: 'vender.vc_suelo_ph', entrada: 'dinero', validador: 'money', guardar: 'vcSuelo' },
        { id: 'afinar_ccaa', tipo: 'sub', sub: 'elegirCCAA', texto: 'vender.ccaa_preg', guardar: 'ccaa' },
        { id: 'calc', tipo: 'calc',
          calcular: function (a) {
            var adq = (a.adquisiciones && a.adquisiciones.length) ? a.adquisiciones
                    : [ { valor: a.una_valor, gastos: a.una_gastos, fecha: a.una_fecha, pct: 100 } ];
            return coreNetoVendedor({ venta: a.venta, gVenta: a.gventa || 0, vcTotal: a.vcTotal || 0, vcSuelo: a.vcSuelo || 0,
              fVenta: a.fventa || hoyISO(), ccaaSlug: a.ccaa || 'madrid', mayor65: !!a.mayor65, reinv: !!a.reinv, adquisiciones: adq });
          },
          tarjeta: {
            titulo: 'vender.card_titulo',
            total: { etiqueta: 'vender.l_neto', emoji: '💰', valor: function (r) { return _eur(r.neto); } },
            lineas: [
              { etiqueta: 'vender.l_venta',        emoji: '🏷️', valor: function (r) { return _eur(r.venta); } },
              { etiqueta: 'vender.l_gastos_venta', emoji: '🧾', valor: function (r, a) { return a.gventa ? '− ' + _eur2(a.gventa) : _eur(0); } },
              { etiqueta: 'vender.l_adquisicion',  emoji: '📉', valor: function (r) { return '− ' + _eur(r.totalAdquisicion); } },
              { etiqueta: { segun: 'afinar', casos: { 'true': 'vender.l_plusvalia', 'false': 'vender.l_plusvalia_no' } }, emoji: '🏛️',
                valor: function (r, a) { return r.plusvalia ? '− ' + _eur2(r.plusvalia) : (a.afinar ? _eur(0) : '—'); } },
              { etiqueta: 'vender.l_ganancia', emoji: '📈', valor: function (r) { return r.exenta ? { texto: 'vender.val_exenta' } : _eur2(r.ganancia); } },
              { etiqueta: 'vender.l_irpf',     emoji: '💸', valor: function (r) { return r.exenta ? { texto: 'vender.val_exento' } : (r.irpf ? '− ' + _eur2(r.irpf) : _eur(0)); } }
            ],
            avisos: function (r) { return r.avisos || []; },
            disc: 'vender.disc'
          } },
        { id: 'oc', tipo: 'chips', texto: 'contacto.pregunta', guardar: 'quiere',
          opciones: [ { texto: 'contacto.chip_lead', valor: 'lead' }, { texto: 'contacto.chip_menu', valor: 'menu', saltarA: '@menu' }, { texto: 'contacto.chip_nada', valor: 'nada', irAFlujo: 'despedir' } ] },
        { id: 'ped', tipo: 'pedirContacto' },
        { id: 'entrega', tipo: 'entregarLead',
          resumen:  { texto: 'vender.lead_resumen',
                      valores: function (a) { var r = a.__r || {}; var adq = (a.adquisiciones && a.adquisiciones.length > 1) ? (a.adquisiciones.length + ' veces (' + _eur(r.totalAdquisicion) + ')') : _eur(r.totalAdquisicion);
                        return { venta: _eur(a.venta), adq: adq, gventa: _eur(a.gventa || 0), plusvalia: _eur2(r.plusvalia || 0), irpf: (r.exenta ? 'exento' : _eur2(r.irpf || 0)), neto: _eur(r.neto) }; } },
          contexto: { texto: 'vender.lead_contexto' } }
      ]
    },

    // ============================================================
    // FLUJO: Rentabilidad de inversión (alquiler / flipping)
    //   Novedad de patrón: paso "condicion" (bifurca por el modo elegido) y
    //   dos ramas con su propia tarjeta. Reutiliza el subflujo "honorarios"
    //   (dos veces en flipping: compra y venta).
    //   Avisos: vienen del motor (calc-core).
    // ============================================================
    inversion: {
      id: 'inversion',
      pasos: [
        { id: 'modo', tipo: 'chips', texto: 'inversion.intro', guardar: 'modo',
          opciones: [ { texto: 'inversion.modo_alquiler', valor: 'alquiler' }, { texto: 'inversion.modo_flipping', valor: 'flipping' } ] },
        { id: 'precio',  tipo: 'texto', texto: 'inversion.precio_preg', placeholder: 'inversion.precio_ph', entrada: 'dinero', validador: 'money', guardar: 'precio' },
        { id: 'viv',     tipo: 'chips', texto: 'inversion.viv_preg', guardar: 'tipoViv',
          opciones: [ { texto: 'comun.viv_usada', valor: 'usada' }, { texto: 'comun.viv_nueva', valor: 'nueva' } ] },
        { id: 'ccaa',    tipo: 'sub',   sub: 'elegirCCAA', texto: 'inversion.ccaa_preg', guardar: 'ccaa' },
        { id: 'hon',     tipo: 'sub',   sub: 'honorarios', texto: 'inversion.hon_compra_preg', base: function (a) { return a.precio; }, guardar: 'honorariosCompra' },
        { id: 'reforma', tipo: 'texto', texto: 'inversion.reforma_preg', placeholder: 'inversion.reforma_ph', entrada: 'dinero', validador: 'money0', guardar: 'reforma' },
        { id: 'bif', tipo: 'condicion', segun: 'modo', casos: { flipping: 'fl_meses' } },   // sino: sigue con alquiler

        // ---- ALQUILER ----
        { id: 'al_renta',  tipo: 'texto', texto: 'inversion.renta_preg', placeholder: 'inversion.renta_ph', entrada: 'dinero', validador: 'money', guardar: 'rentaMes' },
        { id: 'al_gastos', tipo: 'texto', texto: 'inversion.gastos_preg', placeholder: 'inversion.gastos_ph', entrada: 'dinero', validador: 'money0', guardar: 'gastosAnuales' },
        { id: 'al_hip',    tipo: 'chips', texto: 'inversion.hip_preg', guardar: 'conHip',
          opciones: [ { texto: 'comun.con_hipoteca', valor: true }, { texto: 'comun.al_contado', valor: false, saltarA: 'al_calc' } ] },
        { id: 'al_entrada',tipo: 'texto', texto: 'inversion.entrada_preg', placeholder: 'inversion.entrada_ph', entrada: 'dinero', validador: 'money', guardar: 'entrada' },
        { id: 'al_plazo',  tipo: 'chips', texto: 'inversion.plazo_preg', guardar: 'plazo',
          opciones: [ { texto: 'comun.n_20', valor: 20 }, { texto: 'comun.n_25', valor: 25 }, { texto: 'comun.n_30', valor: 30 },
                      { texto: 'comun.otro', valor: '__otro', pedir: { entrada: 'numero', validador: 'anios', placeholder: 'comun.anios_ph' } } ] },
        { id: 'al_tin',    tipo: 'texto', texto: 'inversion.tin_preg', placeholder: 'inversion.tin_ph', entrada: 'decimal', validador: 'tin', guardar: 'tin' },
        { id: 'al_calc', tipo: 'calc', saltarA: 'oc',
          calcular: function (a) {
            return coreInversionAlquiler({ precio: a.precio, tipoViv: a.tipoViv, ccaaSlug: a.ccaa, reforma: a.reforma || 0, honorariosCompra: a.honorariosCompra || 0,
              rentaMes: a.rentaMes, vacanciaPct: 5, ibi: a.gastosAnuales || 0, comunidadMes: 0, seguro: 0, mantenimientoPct: 0, gestionPct: 0,
              conHipoteca: !!a.conHip, entrada: a.entrada || 0, tin: a.tin || 0, plazo: a.plazo || 0 });
          },
          tarjeta: {
            titulo: 'inversion.card_titulo_alq',
            total: { etiqueta: 'inversion.l_rentneta', emoji: '💰', valor: { texto: 'comun.v_pct', valores: function (r) { return { n: pc(r.rentNeta) }; } } },
            lineas: [
              { etiqueta: 'inversion.l_inversion', emoji: '🏦', valor: function (r) { return _eur(r.inversionTotal); } },
              { etiqueta: 'inversion.l_noi',       emoji: '💶', valor: function (r) { return _eur(r.noi); } },
              { etiqueta: 'inversion.l_rentbruta', emoji: '📊', valor: { texto: 'comun.v_pct', valores: function (r) { return { n: pc(r.rentBruta) }; } } },
              { etiqueta: 'inversion.l_cuota_hip', emoji: '💸', valor: { texto: 'comun.v_mes', valores: function (r) { return { v: _eur2(r.cuotaMes) }; } }, si: function (a) { return !!a.conHip; } },
              { etiqueta: 'inversion.l_flujo',     emoji: '📈', valor: { texto: 'comun.v_mes', valores: function (r) { return { v: _eur2(r.cashFlowMes) }; } }, si: function (a) { return !!a.conHip; } },
              { etiqueta: 'inversion.l_coc',       emoji: '🎯', valor: { texto: 'comun.v_pct', valores: function (r) { return { n: pc(r.cashOnCash) }; } }, si: function (a) { return !!a.conHip; } }
            ],
            avisos: function (r) { return r.avisos || []; },
            disc: 'inversion.disc_alq'
          } },

        // ---- FLIPPING ----
        { id: 'fl_meses',    tipo: 'texto', texto: 'inversion.meses_preg', placeholder: 'inversion.meses_ph', entrada: 'numero', validador: 'anios', guardar: 'meses' },
        { id: 'fl_tenencia', tipo: 'texto', texto: 'inversion.tenencia_preg', placeholder: 'inversion.tenencia_ph', entrada: 'dinero', validador: 'money0', guardar: 'tenencia' },
        { id: 'fl_venta',    tipo: 'texto', texto: 'inversion.venta_preg', placeholder: 'inversion.venta_ph', entrada: 'dinero', validador: 'money', guardar: 'precioVenta' },
        { id: 'fl_hon',      tipo: 'sub',   sub: 'honorarios', texto: 'inversion.hon_venta_preg', base: function (a) { return a.precioVenta; }, guardar: 'honorariosVenta' },
        { id: 'fl_hip',      tipo: 'chips', texto: 'inversion.hip_preg', guardar: 'conHip',
          opciones: [ { texto: 'comun.con_hipoteca', valor: true }, { texto: 'comun.al_contado', valor: false, saltarA: 'fl_calc' } ] },
        { id: 'fl_entrada',  tipo: 'texto', texto: 'inversion.entrada_preg', placeholder: 'inversion.entrada_ph_fl', entrada: 'dinero', validador: 'money', guardar: 'entrada' },
        { id: 'fl_tin',      tipo: 'texto', texto: 'inversion.tin_preg_fl', placeholder: 'inversion.tin_ph_fl', entrada: 'decimal', validador: 'tin', guardar: 'tin' },
        { id: 'fl_gfin',     tipo: 'texto', texto: 'inversion.gfin_preg', placeholder: 'inversion.gfin_ph', entrada: 'dinero', validador: 'money0', guardar: 'gfin' },
        { id: 'fl_calc', tipo: 'calc',
          calcular: function (a) {
            return coreInversionFlipping({ precioCompra: a.precio, tipoViv: a.tipoViv, ccaaSlug: a.ccaa, reforma: a.reforma || 0, honorariosCompra: a.honorariosCompra || 0,
              meses: a.meses, gastosTenenciaMes: a.tenencia || 0, precioVenta: a.precioVenta, honorariosVenta: a.honorariosVenta || 0, otrosGastosVenta: 0,
              conHipoteca: !!a.conHip, entrada: a.entrada || 0, tin: a.tin || 0, gastosFinancierosFijos: a.gfin || 0 });
          },
          tarjeta: {
            titulo: 'inversion.card_titulo_fl',
            total: { etiqueta: 'inversion.l_beneficio', emoji: '💰', valor: function (r) { return _eur(r.beneficio); } },
            lineas: [
              { etiqueta: 'inversion.l_inversion', emoji: '🏦', valor: function (r) { return _eur(r.inversionTotal); } },
              { etiqueta: 'inversion.l_venta_fl',  emoji: '🏷️', valor: function (r) { return _eur(r.precioVenta); } },
              { etiqueta: 'inversion.l_roi',       emoji: '🎯', valor: { texto: 'comun.v_pct', valores: function (r) { return { n: pc(r.roi) }; } } },
              { etiqueta: 'inversion.l_margen',    emoji: '📊', valor: { texto: 'comun.v_pct', valores: function (r) { return { n: pc(r.margen) }; } } },
              { etiqueta: 'inversion.l_roi_anual', emoji: '📈', valor: { texto: 'comun.v_pct', valores: function (r) { return { n: pc(r.roiAnualizado) }; } } }
            ],
            avisos: function (r) { return r.avisos || []; },
            disc: 'inversion.disc_fl'
          } },

        // ---- común ----
        { id: 'oc', tipo: 'chips', texto: 'contacto.pregunta', guardar: 'quiere',
          opciones: [ { texto: 'contacto.chip_lead', valor: 'lead' }, { texto: 'contacto.chip_menu', valor: 'menu', saltarA: '@menu' }, { texto: 'contacto.chip_nada', valor: 'nada', irAFlujo: 'despedir' } ] },
        { id: 'ped', tipo: 'pedirContacto' },
        { id: 'entrega', tipo: 'entregarLead',
          resumen:  { texto: function (a) { return a.modo === 'flipping' ? 'inversion.lead_resumen_fl' : (a.conHip ? 'inversion.lead_resumen_alq_hip' : 'inversion.lead_resumen_alq_contado'); },
                      valores: function (a) { var r = a.__r || {}; return { precio: _eur(a.precio), ccaa: r.ccaaNombre, renta: _eur2(a.rentaMes || 0), rentneta: pc(r.rentNeta || 0), coc: pc(r.cashOnCash || 0), flujo: _eur2(r.cashFlowMes || 0), reforma: _eur(a.reforma || 0), venta: _eur(a.precioVenta || 0), beneficio: _eur(r.beneficio || 0), roi: pc(r.roi || 0), margen: pc(r.margen || 0) }; } },
          contexto: { texto: { segun: 'modo', casos: { alquiler: 'inversion.lead_contexto_alq', flipping: 'inversion.lead_contexto_fl' } },
                      valores: function (a) { var r = a.__r || {}; return { precio: _eur(a.precio), ccaa: r.ccaaNombre }; } } }
      ]
    }

  };

  // ============================================================
  // SUBFLUJOS COMPARTIDOS
  //   lista        opciones desde un DATO (comunidades).
  //   guardarLead  ACCIÓN del runner: Telegram → D1 + aviso; web → Web3Forms.
  //   handoff      mensaje + botones (WhatsApp/llamar) + nota opcional.
  //   Saltos: '@fin' termina el subflujo · '@menu' vuelve al menú.
  // ============================================================
  var SUBFLUJOS = {

    elegirCCAA: {
      id: 'elegirCCAA',
      // El botón guarda la ELECCIÓN ('madrid' o '__otra') en "sel"; si es
      // "otra", la LISTA guarda la comunidad real en "ccaa". computa devuelve
      // la comunidad final (así el botón no pisa la casilla de la lista).
      computa: function (loc) { return loc.sel === 'madrid' ? 'madrid' : loc.ccaa; },
      pasos: [
        { id: 'q', tipo: 'chips', texto: '@pregunta', guardar: 'sel',
          opciones: [
            { texto: 'comun.ccaa_madrid', valor: 'madrid', saltarA: '@fin' },
            { texto: 'comun.ccaa_otra',   valor: '__otra' }
          ] },
        { id: 'lista', tipo: 'lista', texto: 'comun.ccaa_elige_lista', fuente: 'CCAA', boton: 'comun.ccaa_elegir', guardar: 'ccaa' }
      ]
    },

    titularesEdades: {
      id: 'titularesEdades', devuelve: 'te',
      pasos: [
        { id: 'nd', tipo: 'chips', texto: 'titulares.una_o_dos', guardar: 'dos',
          opciones: [
            { texto: 'titulares.opt_una', valor: false },
            { texto: 'titulares.opt_dos', valor: true }
          ] },
        { id: 'edad', tipo: 'texto', guardar: 'edadRef', entrada: 'numero', validador: 'edad',
          texto: { segun: 'dos', casos: { 'false': 'titulares.edad_una', 'true': 'titulares.edad_dos' } },
          placeholder: 'titulares.edad_ph' }
      ]
    },

    // Consentimiento RGPD + nombre + teléfono. Si NO acepta: salida amable y
    // el runner DETIENE el flujo (a.consiente === false).
    pedirContacto: {
      id: 'pedirContacto',
      pasos: [
        { id: 'consent', tipo: 'chips', texto: 'lead.consent_texto', enlace: 'lead.consent_link', guardar: 'consiente',
          opciones: [
            { texto: 'lead.consent_si', valor: true },
            { texto: 'lead.consent_no', valor: false, saltarA: 'no_consent' }
          ] },
        { id: 'nombre', tipo: 'texto', texto: 'lead.nombre_preg', placeholder: 'lead.nombre_ph', entrada: 'texto', validador: 'nombre', guardar: 'nombre' },
        { id: 'tel',    tipo: 'texto', texto: 'lead.tel_preg', placeholder: 'lead.tel_ph', entrada: 'tel', validador: 'tel', guardar: 'tel',
          valores: function (a) { return { nombre: primerNombre(a.nombre) }; }, saltarA: '@fin' },
        // Rama NO acepta:
        { id: 'no_consent', tipo: 'handoff', texto: 'lead.no_consent', botones: ['whatsapp', 'llamar'] },
        { id: 'algo_mas', tipo: 'chips', texto: 'lead.algo_mas', guardar: 'mas_nc',
          opciones: [
            { texto: 'lead.algo_si', valor: true, saltarA: '@menu' },
            { texto: 'lead.algo_no', valor: false, irAFlujo: 'despedir' }
          ] }
      ]
    },

    // Guarda el lead, avisa a Alberto y confirma con plazo de contacto.
    entregarLead: {
      id: 'entregarLead',
      pasos: [
        { id: 'guardar',  tipo: 'guardarLead' },   // acción (D1 + aviso; web: Web3Forms)
        { id: 'confirma', tipo: 'handoff', texto: 'lead.confirmacion',
          valores: function (a) { return { nombre: primerNombre(a.nombre) }; },
          botones: ['whatsapp', 'llamar'], nota: 'lead.privacidad_nota', notaEnlace: 'lead.privacidad_link' },
        { id: 'algo_mas', tipo: 'chips', texto: 'lead.algo_mas', guardar: 'quiere_mas',
          opciones: [
            { texto: 'lead.algo_si', valor: true, saltarA: '@menu' },
            { texto: 'lead.algo_no', valor: false, irAFlujo: 'despedir' }
          ] }
      ]
    },

    // Honorarios de intermediación (no / fijo / % + IVA). Devuelve el IMPORTE.
    // El paso que lo invoca pasa "texto" (la intro) y "base" (función a→precio).
    // Sus respuestas viven en un espacio LOCAL, así que puede llamarse varias
    // veces en un flujo (p. ej. compra y venta en flipping) sin pisarse.
    honorarios: {
      id: 'honorarios',
      pasos: [
        { id: 'q', tipo: 'chips', texto: '@pregunta', guardar: 'hMode',
          opciones: [
            { texto: 'honorarios.no',   valor: 'no',   saltarA: '@fin' },
            { texto: 'honorarios.fijo', valor: 'fijo' },
            { texto: 'honorarios.pct',  valor: 'pct',  saltarA: 'pct_q' }
          ] },
        { id: 'fijo_q', tipo: 'texto', texto: 'honorarios.fijo_preg', placeholder: 'honorarios.fijo_ph', entrada: 'dinero', validador: 'money', guardar: 'hFijo', saltarA: '@fin' },
        { id: 'pct_q',  tipo: 'texto', texto: 'honorarios.pct_preg', placeholder: 'honorarios.pct_ph', entrada: 'decimal', validador: 'pct', guardar: 'hPct' },
        { id: 'iva_q',  tipo: 'chips', texto: 'honorarios.iva_preg', guardar: 'hIva',
          opciones: [ { texto: 'honorarios.iva_si', valor: true }, { texto: 'honorarios.iva_no', valor: false } ] }
      ],
      // Importe final a partir de las respuestas locales + la base (precio).
      computa: function (loc, base) {
        if (loc.hMode === 'fijo') return loc.hFijo || 0;
        if (loc.hMode === 'pct') {
          var b = (base || 0) * (parseFloat(String(loc.hPct).replace(',', '.')) / 100);
          return loc.hIva ? b : b * 1.21;
        }
        return 0;
      }
    }

  };

  var API = { GUION: GUION, SUBFLUJOS: SUBFLUJOS, nombreCCAA: nombreCCAA, avisoEdad: avisoEdad, primerNombre: primerNombre };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else { raiz.GUION = GUION; raiz.SUBFLUJOS = SUBFLUJOS; raiz.KITTY_GUION = API; }

})(typeof globalThis !== 'undefined' ? globalThis : this);
