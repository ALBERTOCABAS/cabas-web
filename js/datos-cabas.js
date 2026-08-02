// ============================================================
// CABAS REALTOR — datos compartidos
// Usado por comprar.html (calc-hipoteca.js) e informe-compra.html
// (informe-logic.js). Un único sitio donde actualizar impuestos
// y oficinas — evita que las dos herramientas den números o datos
// de contacto distintos.
// REVISAR ANUALMENTE: tipos impositivos por CCAA.
// ============================================================

// ITP (vivienda usada): número = tipo fijo (%); función = escala progresiva
// AJD (obra nueva, IVA + AJD): siempre número, tipo general (%)
// Fuentes: boletines oficiales autonómicos 2025-2026. Tipos generales;
// existen reducidos por edad, familia numerosa, discapacidad, VPO o
// zona rural en la mayoría de comunidades que esta simulación no aplica.
const DATOS_CCAA = {
  andalucia:          { nombre: 'Andalucía',            itp: 7,    ajd: 1.2 },
  aragon:             { nombre: 'Aragón',                itp: 8,    ajd: 1.5 },
  asturias:           { nombre: 'Asturias',               itp: 8,    ajd: 1.2 },
  baleares:           { nombre: 'Illes Balears',          itp: 8,    ajd: 1.5 },
  canarias:           { nombre: 'Canarias',                itp: 6.5,  ajd: 1.0 },
  cantabria:          { nombre: 'Cantabria',                itp: 9,    ajd: 1.5 },
  castillayleon:      { nombre: 'Castilla y León',          itp: 8,    ajd: 1.5 },
  castillalamancha:   { nombre: 'Castilla-La Mancha',       itp: 9,    ajd: 1.25 },
  cataluna:           { nombre: 'Cataluña', ajd: 1.5,
    itp: (precio) => tramosProgresivos(precio, [[600000, 10], [900000, 11], [1500000, 12], [Infinity, 13]]) },
  valencia:           { nombre: 'Comunitat Valenciana', ajd: 1.4,
    itp: (precio) => tramosProgresivos(precio, [[1000000, 9], [Infinity, 11]]) },
  extremadura:        { nombre: 'Extremadura',             itp: 8,    ajd: 1.5 },
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
