// ============================================================
// CABAS REALTOR — datos compartidos
// Usado por comprar.html (calc-hipoteca.js), vender.html
// (calc-vendedor.js), informe-compra.html (informe-logic.js) y el
// chatbot (cabas-chatbot.js), todos a través de js/calc-core.js.
// Un único sitio donde actualizar impuestos, coeficientes y
// oficinas — evita que la web y el bot den números o datos de
// contacto distintos.
//
// >>> ESTE ES EL ÚNICO ARCHIVO QUE HAY QUE TOCAR CUANDO CAMBIE
//     LA FISCALIDAD. La skill "actualizar-fiscalidad" edita aquí.
//
// REVISAR ANUALMENTE:
//   · DATOS_CCAA        → tipos ITP y AJD por comunidad
//   · PLUSVALIA_CCAA    → tipo de gravamen IIVTNU por comunidad
//   · COEF_IIVTNU       → coeficientes máximos estatales (RDL 8/2023)
//   · TRAMOS_IRPF       → tramos de la base del ahorro
// ============================================================

// ITP (vivienda usada): número = tipo fijo (%); función = escala progresiva
// POR TRAMOS (marginal: cada parte del precio tributa a su tipo).
// AJD (obra nueva, IVA + AJD): siempre número, tipo general (%)
//
// TIPOS GENERALES verificados 2025-2026. Con escala por tramos: Aragón,
// Asturias, Illes Balears, Castilla y León (8% hasta 250k, 10% resto),
// Cataluña, C. Valenciana y Extremadura. Murcia 7,75% (rebaja Ley 3/2025).
//
// ⚠️ ADVERTENCIA LEGAL: son los tipos GENERALES. NO se aplican los tipos
// REDUCIDOS (jóvenes, familia numerosa, VPO, discapacidad, vivienda habitual
// por debajo de cierto valor, zonas despobladas…), que bajan mucho el ITP
// según el perfil del comprador. Es una ESTIMACIÓN ORIENTATIVA, no
// asesoramiento fiscal: confírmalo siempre con un profesional.
const DATOS_CCAA = {
  andalucia:          { nombre: 'Andalucía',            itp: 7,    ajd: 1.2 },
  aragon:             { nombre: 'Aragón', ajd: 1.5,
    itp: (precio) => tramosProgresivos(precio, [[400000, 8], [450000, 8.5], [500000, 9], [750000, 9.5], [Infinity, 10]]) },
  asturias:           { nombre: 'Asturias', ajd: 1.2,
    itp: (precio) => tramosProgresivos(precio, [[300000, 8], [500000, 9], [Infinity, 10]]) },
  baleares:           { nombre: 'Illes Balears', ajd: 1.5,
    itp: (precio) => tramosProgresivos(precio, [[400000, 8], [600000, 9], [1000000, 10], [2000000, 12], [Infinity, 13]]) },
  canarias:           { nombre: 'Canarias',                itp: 6.5,  ajd: 1.0 },
  cantabria:          { nombre: 'Cantabria',                itp: 9,    ajd: 1.5 },
  castillayleon:      { nombre: 'Castilla y León', ajd: 1.5,
    itp: (precio) => tramosProgresivos(precio, [[250000, 8], [Infinity, 10]]) },
  castillalamancha:   { nombre: 'Castilla-La Mancha',       itp: 9,    ajd: 1.25 },
  cataluna:           { nombre: 'Cataluña', ajd: 1.5,
    itp: (precio) => tramosProgresivos(precio, [[600000, 10], [900000, 11], [1500000, 12], [Infinity, 13]]) },
  valencia:           { nombre: 'Comunitat Valenciana', ajd: 1.4,
    itp: (precio) => tramosProgresivos(precio, [[1000000, 9], [Infinity, 11]]) },
  extremadura:        { nombre: 'Extremadura', ajd: 1.5,
    itp: (precio) => tramosProgresivos(precio, [[360000, 8], [600000, 10], [Infinity, 11]]) },
  galicia:            { nombre: 'Galicia',                  itp: 8,    ajd: 1.5 },
  madrid:             { nombre: 'Comunidad de Madrid',      itp: 6,    ajd: 0.75 },
  murcia:             { nombre: 'Región de Murcia',         itp: 7.75, ajd: 1.5 },
  navarra:            { nombre: 'Navarra',                  itp: 6,    ajd: 0.5 },
  paisvasco:          { nombre: 'País Vasco',                itp: 4,    ajd: 0 },
  larioja:            { nombre: 'La Rioja',                  itp: 7,    ajd: 1.5 },
  ceuta:              { nombre: 'Ceuta',                     itp: 6,    ajd: 0.5 },
  melilla:            { nombre: 'Melilla',                   itp: 6,    ajd: 0.5 }
};

// Escala progresiva por tramos de valor (como el IRPF): cada tramo tributa
// solo por la parte del precio que le corresponde. tramos = [[tope, tipo%], ...]
function tramosProgresivos(precio, tramos) {
  let cuota = 0, p = 0;
  for (const [tope, tipo] of tramos) {
    const base = Math.min(precio, tope) - p;
    if (base <= 0) break;
    cuota += base * (tipo / 100);
    p = tope;
  }
  return precio > 0 ? (cuota / precio) * 100 : 0;
}

function datosITPAJD(ccaaSlug, precio) {
  const d = DATOS_CCAA[ccaaSlug] || DATOS_CCAA.madrid;
  const itpPct = typeof d.itp === 'function' ? d.itp(precio) : d.itp;
  return { nombre: d.nombre, itpPct, ajdPct: d.ajd };
}

// ---------- Oficinas ----------
// NOTA: todas las oficinas usan alberto@cabas.es, confirmado por Alberto.
const OFICINAS = {
  alberto: {
    nombre: 'Alberto Cabas · Gerente',
    direccion: 'Calle de Bravo Murillo, 23 · 28015 Madrid',
    telefono: '662 669 014',
    telefonoHref: '+34662669014',
    email: 'alberto@cabas.es'
  },
  chamberi: {
    nombre: 'Chamberí',
    direccion: 'Calle de Bravo Murillo, 23 · 28015 Madrid',
    telefono: '918 336 958',
    telefonoHref: '+34918336958',
    email: 'alberto@cabas.es'
  },
  sanbernardo: {
    nombre: 'San Bernardo · Malasaña · Chamberí',
    direccion: 'Calle de San Bernardo, 84 · 28015 Madrid',
    telefono: '910 136 934',
    telefonoHref: '+34910136934',
    email: 'alberto@cabas.es'
  },
  almagro: {
    nombre: 'Chamberí · Almagro',
    direccion: 'Plaza de Chamberí, 9 · 28010 Madrid',
    telefono: '910 378 491',
    telefonoHref: '+34910378491',
    email: 'alberto@cabas.es'
  },
  vallehermoso: {
    nombre: 'Chamberí · Vallehermoso',
    direccion: 'Paseo de San Francisco de Sales, 8 · 28003 Madrid',
    telefono: '910 228 132',
    telefonoHref: '+34910228132',
    email: 'alberto@cabas.es'
  },
  riosrosas: {
    nombre: 'Ríos Rosas · Chamberí',
    direccion: 'Calle de Ríos Rosas, 11 · 28003 Madrid',
    telefono: '911 123 352',
    telefonoHref: '+34911123352',
    email: 'alberto@cabas.es'
  },
  chamartin: {
    nombre: 'Chamartín · Nueva España',
    direccion: 'Calle de Costa Rica, 18 · 28016 Madrid',
    telefono: '910 327 604',
    telefonoHref: '+34910327604',
    email: 'alberto@cabas.es'
  }
};

// ---------- Plusvalía municipal (IIVTNU) — tipo estimado por CCAA ----------
// OJO: el IIVTNU es un tributo MUNICIPAL, no autonómico — lo fija cada
// ayuntamiento (máximo legal 30%), así que dentro de una misma comunidad
// puede haber tipos distintos entre municipios. Este valor es el tipo
// verificado de la CAPITAL de cada comunidad (fuente: ordenanzas fiscales
// municipales 2026), como estimación de partida — el campo del formulario
// sigue siendo editable para quien conozca el tipo exacto de su municipio.
// Las marcadas "(estimado)" no tienen fuente verificada específica; se usa
// una media razonable — confírmalas si vas a usarlas en un caso real.
const PLUSVALIA_CCAA = {
  andalucia: 26.5,          // Sevilla
  aragon: 27,                // Zaragoza
  asturias: 26,               // Oviedo
  baleares: 30,                // Palma de Mallorca
  canarias: 24,                 // Las Palmas de Gran Canaria
  cantabria: 28,                 // Santander
  castillayleon: 21.8,            // Valladolid
  castillalamancha: 26,            // Toledo
  cataluna: 30,                     // Barcelona
  valencia: 30,                      // Valencia
  extremadura: 27,                    // estimado
  galicia: 27,                         // capitales gallegas (media)
  madrid: 29,                           // Madrid capital
  murcia: 27,                            // Murcia capital
  navarra: 27,                            // estimado (régimen foral)
  paisvasco: 25,                           // Bilbao (régimen foral)
  larioja: 25,                              // Logroño
  ceuta: 27,                                 // estimado
  melilla: 27                                 // estimado
};

// ---------- Plusvalía municipal (IIVTNU) — coeficientes por años ----------
// Coeficientes MÁXIMOS estatales del RDL 8/2023, aplicables en toda España
// salvo que el ayuntamiento apruebe otros inferiores (p. ej. Barcelona aplica
// 0,16 a los 4 años, por debajo del 0,17 estatal). Se aplican al valor
// catastral del suelo en el MÉTODO OBJETIVO. Índice = años completos de
// tenencia; el 0 es "menos de 1 año" (sí tributa desde la reforma de 2021).
// VIGENTES EN 2026: el RDL 16/2025 que los subía fue rechazado en el Congreso
// (28-01-2026), así que se mantienen los máximos de 2024 (RDL 8/2023).
// REVISAR ANUALMENTE (los actualiza la Ley de Presupuestos cada ejercicio).
const COEF_IIVTNU = {
  0: 0.14, 1: 0.15, 2: 0.15, 3: 0.15, 4: 0.17, 5: 0.18, 6: 0.20,
  7: 0.22, 8: 0.23, 9: 0.21, 10: 0.16, 11: 0.13, 12: 0.11, 13: 0.10,
  14: 0.10, 15: 0.10, 16: 0.10, 17: 0.13, 18: 0.17, 19: 0.23, 20: 0.40
};

// ---------- IRPF — tramos de la base del ahorro (ganancia patrimonial) ----
// Tipos estatales, iguales en toda España. REVISAR ANUALMENTE.
const TRAMOS_IRPF = [
  { hasta: 6000,     tipo: 0.19 },
  { hasta: 50000,    tipo: 0.21 },
  { hasta: 200000,   tipo: 0.23 },
  { hasta: 300000,   tipo: 0.27 },
  { hasta: Infinity, tipo: 0.30 }
];

// ============================================================
// Reutilización en servidor (Cloudflare Worker del bot de Telegram).
// En el NAVEGADOR esta condición es falsa (no existe "module"), así que
// este bloque se ignora por completo y la web funciona igual que siempre.
// En el servidor, permite que calc-core.js y el bot compartan EXACTAMENTE
// estos mismos datos → mismos números en la web y en Telegram.
// Mismo patrón que ya usa js/calc-core.js al final del archivo.
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DATOS_CCAA, tramosProgresivos, datosITPAJD,
    OFICINAS, PLUSVALIA_CCAA, COEF_IIVTNU, TRAMOS_IRPF
  };
}
