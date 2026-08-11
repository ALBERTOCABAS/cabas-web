#!/usr/bin/env node
// ============================================================
// CABAS REALTOR — Generador de "Informes de Mercado"
// ------------------------------------------------------------
// Un solo comando cada mes:   node informes-mercado/build.mjs
//
// Qué hace:
//  1) LEE la carpeta de Google Drive sincronizada y COPIA a ./data/ los CSV
//     de los 3 patrones que aún no estén (solo LEE Drive, solo ESCRIBE repo →
//     evita el error "Resource deadlock avoided" de escribir en Drive).
//  2) Lee TODOS los CSV commiteados en ./data/ (esa es la fuente de la verdad;
//     la web publicada NO lee de Drive nunca).
//  3) Regenera informes-mercado/index.html con TABLAS HTML reales (indexables)
//     + la serie de meses embebida para los gráficos (SVG, sin librerías).
//  4) Regenera /sitemap.xml con la fecha del mes más reciente.
//
// Gráficos: se muestran solo con >= 3 meses; con menos, tabla + aviso discreto.
// La serie se construye sola conforme añadas CSV de meses siguientes.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));       // …/cabas-web/informes-mercado
const REPO      = path.resolve(__dirname, '..');                      // …/cabas-web
const DATA_DIR  = path.join(__dirname, 'data');
const OUT_HTML  = path.join(__dirname, 'index.html');
const OUT_SITEMAP = path.join(REPO, 'sitemap.xml');

// Origen en Drive (solo lectura). Si algún día cambia la ruta, se edita aquí.
const DRIVE = '/Users/albertocabas/Library/CloudStorage/GoogleDrive-cabasrealtor@gmail.com/Mi unidad/Informes de mercado (WhatsApp-Telegram)';

const BASE_URL = 'https://www.cabas.es';

// ---------- patrones de los 3 tipos de CSV ----------
const RE = {
  madrid: /^datos_madrid_[a-zñáéíóú]+_\d{4}\.csv$/i,
  espana: /^datos_espana_[a-zñáéíóú]+_\d{4}\.csv$/i,
  zonas:  /^datos_(?!madrid_|espana_)[a-zñáéíóú]+_\d{4}\.csv$/i,
};
const esDato    = f => RE.madrid.test(f) || RE.espana.test(f) || RE.zonas.test(f);
const familiaDe = f => RE.madrid.test(f) ? 'madrid' : RE.espana.test(f) ? 'espana' : 'zonas';

// ---------- meses ----------
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio',
               'agosto','septiembre','octubre','noviembre','diciembre'];
const sinAcentos = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function mesInfo(mesStr) {                       // "julio 2026" -> {key, label, iso}
  const partes = String(mesStr).trim().toLowerCase().split(/\s+/);
  const idx = MESES.indexOf(sinAcentos(partes[0]));
  const anio = parseInt(partes[1], 10) || 0;
  return { key: anio * 12 + (idx < 0 ? 0 : idx), idx, anio,
           label: mesStr.trim(),
           iso: `${anio}-${String((idx < 0 ? 0 : idx) + 1).padStart(2, '0')}-01` };
}

// ---------- CSV ----------
function parseCSV(texto) {
  const lineas = texto.replace(/\r/g, '').split('\n').filter(l => l.trim().length);
  if (!lineas.length) return [];
  const cab = lineas[0].split(',').map(s => s.trim());
  return lineas.slice(1).map(l => {
    const celdas = l.split(',');
    const o = {};
    cab.forEach((h, i) => { o[h] = (celdas[i] || '').trim(); });
    return o;
  });
}

// ============================================================
// 1) Copiar de Drive los CSV que falten (Drive solo lectura)
// ============================================================
fs.mkdirSync(DATA_DIR, { recursive: true });
const copiados = [];
let driveOk = true;
try {
  for (const f of fs.readdirSync(DRIVE).filter(esDato)) {
    const dest = path.join(DATA_DIR, f);
    if (!fs.existsSync(dest)) { fs.copyFileSync(path.join(DRIVE, f), dest); copiados.push(f); }
  }
} catch (e) {
  driveOk = false;   // Drive no montado / sin permiso: seguimos con lo ya commiteado
}

// ============================================================
// 2) Leer TODOS los CSV commiteados (fuente de la verdad)
// ============================================================
const locales = fs.readdirSync(DATA_DIR).filter(esDato);
if (!locales.length) {
  console.error('✗ No hay CSV en informes-mercado/data/. ¿Está montado Drive? Nada que generar.');
  process.exit(1);
}

const filas = { zonas: [], madrid: [], espana: [] };
for (const f of locales) {
  const fam = familiaDe(f);
  for (const r of parseCSV(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))) filas[fam].push(r);
}

// meses disponibles (global, ordenados)
const mesesSet = new Map();
for (const fam of ['zonas', 'madrid', 'espana'])
  for (const r of filas[fam]) { const m = mesInfo(r.mes); mesesSet.set(m.key, m); }
const meses = [...mesesSet.values()].sort((a, b) => a.key - b.key);
const mesUltimo = meses[meses.length - 1];
const N_MESES = meses.length;

// Bloque "En contexto" — editable en informes-mercado/contraste.md (formato
// tolerante: líneas "titular:", "lectura:" y datos "tipo | etiqueta | valor | fuente").
function parseContraste(txt) {
  const c = { titular: '', lectura: '', puntos: [] };
  for (const raw of txt.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const low = line.toLowerCase();
    if (low.startsWith('titular:')) c.titular = line.slice(line.indexOf(':') + 1).trim();
    else if (low.startsWith('lectura:')) c.lectura = line.slice(line.indexOf(':') + 1).trim();
    else if (line.includes('|')) {
      const p = line.split('|').map(s => s.trim());
      if (p.length >= 4 && p[1]) c.puntos.push({ tipo: p[0].toLowerCase(), etiqueta: p[1], valor: p[2], fuente: p[3] });
    }
  }
  return c;
}
let CONTRASTE = null;
try { CONTRASTE = parseContraste(fs.readFileSync(path.join(__dirname, 'contraste.md'), 'utf8')); } catch (e) { CONTRASTE = null; }

// ============================================================
// Utilidades de presentación
// ============================================================
const ACENTO = {
  'Chamberi': 'Chamberí', 'Chamartin': 'Chamartín',
  'Malasana-Universidad': 'Malasaña-Universidad',
  'Nuevos Ministerios-Rios Rosas': 'Nuevos Ministerios-Ríos Rosas',
  'Bernabeu-Hispanoamerica': 'Bernabéu-Hispanoamérica',
  'Ciudad Jardin': 'Ciudad Jardín', 'Nueva Espana': 'Nueva España',
};
const bonito = s => ACENTO[s] || s;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const miles = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const eurM2 = v => { const n = parseInt(String(v).replace(/[^\d]/g, ''), 10); return isNaN(n) ? '—' : miles(n) + ' €'; };
// Margen medio de negociación entre precio publicado y precio final de venta:
// 6,2% (media nacional, Cátedra Grupo Tecnocasa–UPF, vía idealista, feb. 2026).
// El "€/m² Est. Venta" es el publicado menos ese margen (estimación orientativa).
const MARGEN = 0.062;
const eurM2Est = v => { const n = parseInt(String(v).replace(/[^\d]/g, ''), 10); return isNaN(n) ? '—' : miles(Math.round(n * (1 - MARGEN))) + ' €'; };

// variación -> celda con color + flecha (no solo color, por accesibilidad)
function varCell(str) {
  const s = String(str || '').trim();
  if (!s || s === '—') return '<td class="neu">—</td>';
  const num = parseFloat(s.replace(',', '.').replace('%', ''));
  let cls = 'neu', flecha = '';
  if (/^-/.test(s) && num !== 0) { cls = 'neg'; flecha = '▼ '; }
  else if (/^\+/.test(s) && num !== 0) { cls = 'pos'; flecha = '▲ '; }
  return `<td class="${cls}">${flecha}${esc(s)}</td>`;
}
// distancia al máximo (informativa, tono neutro; con el máximo en el title)
function distCell(r) {
  const s = String(r.dist_max || '').trim();
  const ref = r.max_historico ? `Máx: ${eurM2(r.max_historico)}${r.fecha_max ? ' (' + esc(r.fecha_max) + ')' : ''}` : '';
  const txt = (!s || s === '0.0%') ? 'En máximo' : esc(s);
  return `<td class="dist" title="${ref}">${txt}</td>`;
}
function filaTabla(r, esPadre, sep) {
  const thCls = esPadre ? '' : (sep ? '' : ' class="hijo"');
  const trCls = esPadre ? 'padre' : (sep ? 'sep' : '');
  const th = `<th scope="row"${thCls}>${esc(bonito(r.ambito))}</th>`;
  return `<tr class="${trCls}">${th}`
       + `<td class="precio est">${eurM2Est(r.precio_m2)}/m²</td>`
       + `<td class="precio pub">${eurM2(r.precio_m2)}/m²</td>`
       + varCell(r.var_mensual) + varCell(r.var_trimestral) + varCell(r.var_anual) + distCell(r) + '</tr>';
}
const THEAD = `<thead><tr><th scope="col">Ámbito</th>`
            + `<th scope="col">€/m² Est. Venta</th><th scope="col">€/m² Publicado</th>`
            + `<th scope="col">Mensual</th><th scope="col">Trim.</th><th scope="col">Anual</th>`
            + `<th scope="col">Dist. máx.</th></tr></thead>`;
const tablaEnvuelta = (cap, cuerpo, id) =>
  `<div class="im-card"${id ? ` id="${id}"` : ''}><table class="im"><caption class="im-cap">${esc(cap)}</caption>${THEAD}<tbody>${cuerpo}</tbody></table></div>`;
// Botón de descarga POR TABLA: clona ESA tarjeta a la hoja del PDF.
const botonPDF = (cardId, titulo, sub) => `<p class="im-pdf"><button type="button" class="im-pdf-btn" data-card="${cardId}" data-titulo="${esc(titulo)}" data-sub="${esc(sub)}">⬇ Descargar en PDF</button></p>`;
const bloque = (id, cap, cuerpo, titulo, sub) => tablaEnvuelta(cap, cuerpo, id) + botonPDF(id, titulo, sub);

// Bloque destacado "En contexto" (NO es una tabla; estilo propio). Distingue
// visualmente precio de OFERTA (idealista) de OPERACIÓN CERRADA (INE).
function bloqueContraste(c) {
  if (!c || !c.titular || !c.puntos.length) return '';
  const tag = t => t === 'cerrada'
    ? '<span class="im-c-tag cerrada">Operación cerrada</span>'
    : '<span class="im-c-tag oferta">Precio de oferta</span>';
  const puntos = c.puntos.map(p => `<div class="im-c-punto ${p.tipo === 'cerrada' ? 'cerrada' : 'oferta'}">`
    + tag(p.tipo)
    + `<div class="im-c-dato">${esc(p.valor)}</div>`
    + `<div class="im-c-etq">${esc(p.etiqueta)}</div>`
    + `<div class="im-c-fte">${esc(p.fuente)}</div></div>`).join('');
  return `<aside class="im-contraste" aria-label="El mercado en contexto">`
    + `<span class="im-c-eyebrow">En contexto · ${esc(mesUltimo.label)}</span>`
    + `<h2 class="im-c-titular">${esc(c.titular)}</h2>`
    + `<div class="im-c-grid">${puntos}</div>`
    + (c.lectura ? `<p class="im-c-lectura"><b>Lectura:</b> ${esc(c.lectura)}</p>` : '')
    + `<p class="im-c-nota">No se comparan en la misma tabla: <b>idealista</b> mide <b>precio de oferta</b> (lo que se pide) y el <b>INE</b> mide <b>operaciones cerradas</b> (lo que se firma). Son magnitudes distintas.</p>`
    + `</aside>`;
}

// ---------- filas del mes más reciente por familia ----------
const delUltimoMes = fam => filas[fam].filter(r => mesInfo(r.mes).key === mesUltimo.key);

// ============================================================
// Serie histórica (para los gráficos): { ambito: [{k,mes,precio}] }
// ============================================================
function serieDe(fam, filtro) {
  const out = {};
  for (const r of filas[fam]) {
    if (filtro && !filtro(r)) continue;
    const amb = bonito(r.ambito);
    const precio = parseInt(String(r.precio_m2).replace(/[^\d]/g, ''), 10);
    if (isNaN(precio)) continue;
    (out[amb] = out[amb] || []).push({ k: mesInfo(r.mes).key, mes: r.mes, precio });
  }
  for (const amb in out) out[amb].sort((a, b) => a.k - b.k);
  return out;
}
const SERIES = {
  zonas:  serieDe('zonas'),
  madrid: serieDe('madrid'),
  espana: serieDe('espana', r => r.tipo !== 'provincia'),   // sin la Madrid "provincia" duplicada
};

// ============================================================
// Bloque de cada sección (tabla(s) + gráfico o aviso)
// ============================================================
// Gráfico solo con >= 3 meses; con menos, nada (ni aviso): solo la tabla.
const grafico = (fam, etiqueta) => N_MESES >= 3
  ? `<figure class="im-graf"><figcaption>Evolución del precio (€/m²) · <label>ámbito: <select data-graf="${fam}"></select></label></figcaption><div class="im-svg" id="svg-${fam}"></div></figure>`
  : '';

// --- ZONAS DE MIS OFICINAS: 2 bloques, cada uno con su propio botón de PDF ---
//   1) Chamberí + Malasaña-Universidad (Malasaña como fila destacada al final)
//   2) Chamartín aparte
const ultZonas = delUltimoMes('zonas');
const filasZona = z => ultZonas.filter(r => r.zona === z);
const cuerpoDistrito = fs => { const p = fs.find(r => r.tipo === 'distrito') || fs[0]; return filaTabla(p, true) + fs.filter(r => r !== p).map(r => filaTabla(r, false)).join(''); };

const cuerpoCham = cuerpoDistrito(filasZona('Chamberi'))
  + filasZona('Malasana-Universidad').map(r => filaTabla(r, false, true)).join('');
let htmlZonas = `<h3 class="im-zona">Chamberí y Malasaña</h3>`
  + bloque('card-cham', 'Chamberí y Malasaña-Universidad', cuerpoCham, 'Chamberí y Malasaña', 'Chamberí y Malasaña-Universidad · barrio a barrio');
htmlZonas += `<h3 class="im-zona">Chamartín</h3>`
  + bloque('card-chamartin', 'Chamartín', cuerpoDistrito(filasZona('Chamartin')), 'Chamartín', 'Distrito de Chamartín · barrio a barrio');

// --- MADRID: municipio + 21 distritos ---
const ultMadrid = delUltimoMes('madrid');
const mPadre = ultMadrid.find(r => r.tipo === 'municipio');
const mHijos = ultMadrid.filter(r => r.tipo !== 'municipio');
const htmlMadrid = bloque('card-madrid', 'Madrid capital y distritos',
  (mPadre ? filaTabla(mPadre, true) : '') + mHijos.map(r => filaTabla(r, false)).join(''),
  'Madrid por distritos', 'Madrid capital y sus 21 distritos');

// --- ESPAÑA: nacional + comunidades (sin provincia) ---
const ultEspana = delUltimoMes('espana').filter(r => r.tipo !== 'provincia');
const ePadre = ultEspana.find(r => r.tipo === 'nacional');
const eHijos = ultEspana.filter(r => r.tipo !== 'nacional');
const htmlEspana = bloque('card-espana', 'España y comunidades autónomas',
  (ePadre ? filaTabla(ePadre, true) : '') + eHijos.map(r => filaTabla(r, false)).join(''),
  'España por comunidades', 'Nacional y comunidades autónomas');

// ============================================================
// Nav y footer (rutas ABSOLUTAS desde la raíz → válidas en subcarpeta)
// ============================================================
const NAV = `<nav class="nav" aria-label="Navegación principal">
  <div class="nav-inner">
    <a class="nav-logo" href="/index.html">
      <img src="/assets/logo-c.png" alt="Cabas Realtor">
      <span translate="no" class="notranslate">CABAS</span>
    </a>
    <button class="nav-toggle" aria-expanded="false" aria-label="Abrir menú">☰</button>
    <ul class="nav-links">
      <li><a href="/index.html">Inicio</a></li>
      <li><a href="/herencias.html">Herencias</a></li>
      <li><a href="/vender.html">Vender</a></li>
      <li><a href="/comprar.html">Comprar</a></li>
      <li><a href="/inversion.html">Inversión</a></li>
      <li><a href="/valoracion.html">Valoración</a></li>
      <li><a href="/informes-mercado/" aria-current="page">Informes</a></li>
      <li><a href="/quien-soy.html">Quién soy</a></li>
      <li><a href="/oficinas.html">Oficinas</a></li>
      <li class="idioma"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm7.9 9h-3a15.6 15.6 0 0 0-1.2-5.3A8 8 0 0 1 19.9 11zM12 4c.9 1.2 1.7 3.3 1.9 7h-3.8c.2-3.7 1-5.8 1.9-7zM4.1 13h3c.1 1.9.5 3.7 1.2 5.3A8 8 0 0 1 4.1 13zm3-2h-3a8 8 0 0 1 4.2-5.3A15.6 15.6 0 0 0 7.1 11zm4.9 9c-.9-1.2-1.7-3.3-1.9-7h3.8c-.2 3.7-1 5.8-1.9 7zm3.7-1.7c.7-1.6 1.1-3.4 1.2-5.3h3a8 8 0 0 1-4.2 5.3z"/></svg><select id="selector-idioma" aria-label="Idioma / Language"><option value="">ES</option><option value="ca">CA</option><option value="en">EN</option><option value="fr">FR</option><option value="de">DE</option><option value="it">IT</option><option value="pt">PT</option><option value="zh-CN">中文</option><option value="ar">AR</option></select></li>
      <li><a class="nav-cta" href="/contacto.html">Contacto</a></li>
    </ul>
  </div>
</nav>`;

const ICON = {
  ig: '<svg viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.5.2-1.9.4-.5.2-.8.4-1.1.7-.3.3-.5.6-.7 1.1-.2.4-.3.8-.4 1.9-.1 1.2-.1 1.6-.1 4.7s0 3.5.1 4.7c.1 1.1.2 1.5.4 1.9.2.5.4.8.7 1.1.3.3.6.5 1.1.7.4.2.8.3 1.9.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.5-.2 1.9-.4.5-.2.8-.4 1.1-.7.3-.3.5-.6.7-1.1.2-.4.3-.8.4-1.9.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c-.1-1.1-.2-1.5-.4-1.9-.2-.5-.4-.8-.7-1.1-.3-.3-.6-.5-1.1-.7-.4-.2-.8-.3-1.9-.4-1.2-.1-1.6-.1-4.7-.1zm0 3.1a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zm5.2-2.9a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z"/></svg>',
  in: '<svg viewBox="0 0 24 24"><path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8.09h4.56V23H.22V8.09zM8.34 8.09h4.37v2.04h.06c.61-1.15 2.1-2.37 4.32-2.37 4.62 0 5.47 3.04 5.47 7v8.24h-4.55v-7.3c0-1.74-.03-3.98-2.43-3.98-2.43 0-2.8 1.9-2.8 3.86V23H8.34V8.09z"/></svg>',
  fb: '<svg viewBox="0 0 24 24"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"/></svg>',
  tk: '<svg viewBox="0 0 24 24"><path d="M19.6 6.7a5.6 5.6 0 0 1-3.4-3.5c-.1-.4-.2-.8-.2-1.2h-3.7v14.3a3 3 0 1 1-2.1-2.9V9.6a6.7 6.7 0 1 0 5.8 6.7V8.9a9.2 9.2 0 0 0 4.6 1.2V6.9c-.3 0-.7-.1-1-.2z"/></svg>',
  yt: '<svg viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.2C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.2c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.2A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8zM9.6 15.6V8.4L15.8 12l-6.2 3.6z"/></svg>',
};
const FOOTER = `<footer class="footer">
  <div class="footer-grid">
    <div>
      <h4>Alberto Cabas</h4>
      <p>Experto en herencias y cambios de vivienda en Madrid. Realtor desde 2010, franquiciado del grupo Redpiso.</p>
    </div>
    <div>
      <h4>Herramientas gratuitas</h4>
      <ul>
        <li><a href="/vender.html">Calcula tu neto al vender</a></li>
        <li><a href="/comprar.html">Simulador de hipoteca y gastos</a></li>
        <li><a href="/inversion.html">Rentabilidad de inversión</a></li>
        <li><a href="/valoracion.html">¿Cuánto vale mi casa?</a></li>
      </ul>
    </div>
    <div>
      <h4>Contacto</h4>
      <ul>
        <li><a href="tel:+34662669014">+34 662 669 014</a></li>
        <li><a href="mailto:alberto@cabas.es">alberto@cabas.es</a></li>
        <li>Calle Bravo Murillo 23, 28015 Madrid</li>
      </ul>
    </div>
  </div>
  <div class="footer-legal">
    <span>© Alberto Cabas Ortiz. Todos los derechos reservados.</span>
    <div class="social">
      <a href="https://www.instagram.com/cabas995" aria-label="Instagram" target="_blank" rel="noopener">${ICON.ig}</a>
      <a href="https://www.linkedin.com/in/cabas995" aria-label="LinkedIn" target="_blank" rel="noopener">${ICON.in}</a>
      <a href="https://www.facebook.com/share/1Db59MYHj7/" aria-label="Facebook" target="_blank" rel="noopener">${ICON.fb}</a>
      <a href="https://www.tiktok.com/@cabas995" aria-label="TikTok" target="_blank" rel="noopener">${ICON.tk}</a>
      <a href="https://youtube.com/@cabas995" aria-label="YouTube" target="_blank" rel="noopener">${ICON.yt}</a>
    </div>
    <span>
      <a href="/aviso-legal.html">Aviso legal</a>
      <a href="/privacidad.html">Privacidad</a>
      <a href="/cookies.html">Cookies</a>
    </span>
  </div>
</footer>`;

// ============================================================
// HTML de la página
// ============================================================
const TITULO = 'Informes de Mercado — precios de vivienda en Madrid y España | Alberto Cabas';
const DESC = `Evolución de los precios de vivienda en venta (€/m²) por distritos y barrios de Chamberí y Chamartín, los 21 distritos de Madrid y las comunidades autónomas. Actualizado a ${esc(mesUltimo.label)}. Datos de oferta publicada.`;
const URL = `${BASE_URL}/informes-mercado/`;

const ORG = {
  '@type': 'Organization', name: 'Cabas Realtor', alternateName: 'Alberto Cabas', url: BASE_URL,
  logo: `${BASE_URL}/assets/logo-c.png`,
  founder: { '@type': 'Person', name: 'Alberto Cabas Ortiz' },
  address: { '@type': 'PostalAddress', streetAddress: 'Calle Bravo Murillo 23', postalCode: '28015', addressLocality: 'Madrid', addressCountry: 'ES' },
  contactPoint: { '@type': 'ContactPoint', telephone: '+34662669014', email: 'alberto@cabas.es', contactType: 'customer service' },
};
const JSONLD = {
  '@context': 'https://schema.org', '@type': 'Dataset',
  name: 'Informes de Mercado — precios de vivienda en venta (Madrid y España)',
  description: DESC, url: URL, inLanguage: 'es',
  keywords: ['precio vivienda', 'euro por metro cuadrado', 'Madrid', 'Chamberí', 'Chamartín', 'España', 'mercado inmobiliario', 'precio de oferta'],
  creator: ORG, publisher: ORG, isAccessibleForFree: true, license: `${URL}`,
  temporalCoverage: mesUltimo.iso.slice(0, 7), dateModified: mesUltimo.iso, datePublished: mesUltimo.iso,
  spatialCoverage: [
    { '@type': 'Place', name: 'España' },
    { '@type': 'Place', name: 'Madrid, España' },
    { '@type': 'Place', name: 'Chamberí, Madrid' },
    { '@type': 'Place', name: 'Chamartín, Madrid' },
  ],
  variableMeasured: [
    { '@type': 'PropertyValue', name: 'Precio de oferta de vivienda en venta', unitText: 'EUR/m²' },
    { '@type': 'PropertyValue', name: 'Variación mensual, trimestral y anual del precio', unitText: '%' },
  ],
  measurementTechnique: 'Precios de oferta publicada agregados por ámbito (fuente: idealista).',
};

const SVG_JS = N_MESES >= 3 ? `
<script>
(function(){
  var SERIES = JSON.parse(document.getElementById('im-series').textContent);
  var C = { oro:'#B28E44', linea:'#B28E44', punto:'#8a6b27', ejes:'rgba(120,110,90,.35)', texto:'#6b6152' };
  function dibuja(fam, ambito){
    var pts = (SERIES[fam]||{})[ambito]||[]; var box=document.getElementById('svg-'+fam); if(!box) return;
    if(pts.length<2){ box.innerHTML='<p class="serie-aviso">Aún no hay suficientes puntos para este ámbito.</p>'; return; }
    var W=680,H=240,mL=54,mR=14,mT=16,mB=34, iw=W-mL-mR, ih=H-mT-mB;
    var vs=pts.map(function(p){return p.precio;}), min=Math.min.apply(null,vs), max=Math.max.apply(null,vs);
    if(min===max){min-=50;max+=50;} var pad=(max-min)*0.12; min-=pad; max+=pad;
    var x=function(i){return mL + (pts.length===1?iw/2: i*iw/(pts.length-1));};
    var y=function(v){return mT + ih - (v-min)/(max-min)*ih;};
    var d=pts.map(function(p,i){return (i?'L':'M')+x(i).toFixed(1)+' '+y(p.precio).toFixed(1);}).join(' ');
    var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Evolución de '+ambito+'" preserveAspectRatio="xMidYMid meet">';
    for(var g=0; g<=3; g++){ var vy=mT+ih*g/3, val=max-(max-min)*g/3;
      s+='<line x1="'+mL+'" y1="'+vy+'" x2="'+(W-mR)+'" y2="'+vy+'" stroke="'+C.ejes+'" stroke-width="1"/>';
      s+='<text x="'+(mL-8)+'" y="'+(vy+4)+'" text-anchor="end" font-size="11" fill="'+C.texto+'">'+Math.round(val).toLocaleString('es-ES')+'</text>'; }
    s+='<path d="'+d+'" fill="none" stroke="'+C.linea+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    pts.forEach(function(p,i){ s+='<circle cx="'+x(i).toFixed(1)+'" cy="'+y(p.precio).toFixed(1)+'" r="3.2" fill="'+C.punto+'"/>'; });
    var paso=Math.ceil(pts.length/6);
    pts.forEach(function(p,i){ if(i%paso&&i!==pts.length-1) return;
      s+='<text x="'+x(i).toFixed(1)+'" y="'+(H-12)+'" text-anchor="middle" font-size="10" fill="'+C.texto+'">'+p.mes.replace(/ /,'\\n')+'</text>'; });
    s+='</svg>'; box.innerHTML=s;
  }
  document.querySelectorAll('select[data-graf]').forEach(function(sel){
    var fam=sel.getAttribute('data-graf'); var ambitos=Object.keys(SERIES[fam]||{});
    ambitos.forEach(function(a){ var o=document.createElement('option'); o.value=a; o.textContent=a; sel.appendChild(o); });
    sel.addEventListener('change', function(){ dibuja(fam, sel.value); });
    if(ambitos.length) dibuja(fam, ambitos[0]);
  });
})();
</script>` : '';

const HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(TITULO)}</title>
<meta name="description" content="${esc(DESC)}">
<link rel="canonical" href="${URL}">
<meta name="robots" content="index,follow">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
<link rel="stylesheet" href="/css/informe.css">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Alberto Cabas · Cabas Realtor">
<meta property="og:title" content="${esc(TITULO)}">
<meta property="og:description" content="${esc(DESC)}">
<meta property="og:url" content="${URL}">
<meta property="og:image" content="${BASE_URL}/assets/og-cabas.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(TITULO)}">
<meta name="twitter:description" content="${esc(DESC)}">
<meta name="twitter:image" content="${BASE_URL}/assets/og-cabas.jpg">
<script type="application/ld+json">${JSON.stringify(JSONLD)}</script>
<style>
  .pg-informes .im-wrap{ max-width:1120px; margin:0 auto; padding:26px 18px 70px; }
  .pg-informes .im-titulo{ font-family:var(--serif); color:var(--oro); font-size:clamp(2rem,5vw,3rem); line-height:1.08; }
  .pg-informes .im-intro{ color:var(--gris); margin-top:10px; }
  .pg-informes .im-aviso{ margin:18px 0 8px; padding:11px 14px; border:1px solid rgba(150,116,46,.30); border-radius:10px; background:var(--hueso); color:#20190a; font-size:.9rem; }
  .pg-informes .im-aviso b{ color:#8a6b27; }
  .pg-informes .im-actualizado{ color:var(--gris); font-size:.85rem; margin-top:4px; }
  /* Bloque "En contexto" — panel DORADO (franja izq. gruesa, resto fina) con
     las 3 tarjetas de dentro en claro/beige y texto oscuro. */
  .pg-informes .im-contraste{ margin:26px 0 8px; padding:22px 24px 18px; border:1px solid rgba(0,0,0,.28); border-left:6px solid #7a5d29; border-radius:16px; background:linear-gradient(160deg,#c2a256,#ac8a41); box-shadow:0 10px 30px rgba(0,0,0,.32); }
  .pg-informes .im-c-eyebrow{ text-transform:uppercase; letter-spacing:.14em; font-size:.7rem; font-weight:700; color:#4a3813; }
  .pg-informes .im-c-titular{ font-family:var(--serif); color:#1c1406; font-size:clamp(1.5rem,3.4vw,2rem); line-height:1.1; margin-top:6px; border:none; padding:0; }
  .pg-informes .im-c-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:12px; margin-top:16px; }
  .pg-informes .im-c-punto{ background:#fffdf8; border:1px solid rgba(0,0,0,.10); border-radius:12px; padding:13px 14px; box-shadow:0 3px 10px rgba(0,0,0,.14); }
  .pg-informes .im-c-tag{ display:inline-block; font-size:.62rem; font-weight:700; letter-spacing:.05em; text-transform:uppercase; padding:3px 9px; border-radius:999px; margin-bottom:9px; color:#fff; }
  .pg-informes .im-c-tag.oferta{ background:#b08e44; }
  .pg-informes .im-c-tag.cerrada{ background:#5b7089; }
  .pg-informes .im-c-dato{ font-family:var(--sans); font-size:1.45rem; font-weight:700; color:#1c1406; line-height:1.12; }
  .pg-informes .im-c-etq{ color:#5c5446; font-size:.86rem; margin-top:3px; }
  .pg-informes .im-c-fte{ color:#8a7f6b; font-size:.72rem; margin-top:7px; font-style:italic; }
  .pg-informes .im-c-lectura{ color:#1c1406; font-size:.96rem; margin-top:16px; padding-top:14px; border-top:1px solid rgba(0,0,0,.22); }
  .pg-informes .im-c-lectura b{ color:#4a3813; }
  .pg-informes .im-c-nota{ color:#3f3114; font-size:.78rem; margin-top:10px; line-height:1.5; }
  .pg-informes .im-c-nota b{ color:#1c1406; }
  /* Pestañas en CSS puro (radios ocultos): funcionan sin JS y las 3 tablas
     siguen en el HTML (indexables); solo se muestra la seleccionada. */
  .pg-informes .im-radio{ position:absolute; width:1px; height:1px; opacity:0; clip:rect(0 0 0 0); overflow:hidden; }
  .pg-informes .modo-toggle{ max-width:none; margin:24px 0 6px; }
  .pg-informes .modo-toggle label{ cursor:pointer; }
  .pg-informes .im-panel{ display:none; }
  .pg-informes #t-zonas:checked ~ #p-zonas,
  .pg-informes #t-madrid:checked ~ #p-madrid,
  .pg-informes #t-espana:checked ~ #p-espana{ display:block; }
  .pg-informes #t-zonas:checked ~ .modo-toggle label[for="t-zonas"],
  .pg-informes #t-madrid:checked ~ .modo-toggle label[for="t-madrid"],
  .pg-informes #t-espana:checked ~ .modo-toggle label[for="t-espana"]{ background:var(--oro); border-color:var(--oro); color:var(--negro-puro); }
  .pg-informes #t-zonas:checked ~ .modo-toggle label[for="t-zonas"] small,
  .pg-informes #t-madrid:checked ~ .modo-toggle label[for="t-madrid"] small,
  .pg-informes #t-espana:checked ~ .modo-toggle label[for="t-espana"] small{ color:var(--negro-puro); opacity:.85; }
  .pg-informes .im-radio:focus-visible ~ .modo-toggle{ outline:2px solid var(--oro-claro); outline-offset:3px; border-radius:10px; }
  .pg-informes .im-panel.im-seccion{ margin-top:14px; }
  .pg-informes .im-seccion{ margin-top:42px; }
  .pg-informes .im-seccion > h2{ font-family:var(--serif); color:var(--hueso); font-size:1.7rem; border-bottom:1px solid var(--linea); padding-bottom:8px; font-variant-numeric:lining-nums; font-feature-settings:'lnum' 1; }
  .pg-informes .im-seccion > .im-desc{ color:var(--gris); font-size:.9rem; margin:8px 0 4px; }
  .pg-informes .im-zona{ font-family:var(--serif); color:var(--oro-claro); font-size:1.25rem; margin:22px 0 8px; }
  .pg-informes .im-card{ background:#fffdf8; border:1px solid rgba(150,116,46,.30); border-radius:14px; margin-top:10px; overflow-x:auto; box-shadow:0 6px 20px rgba(0,0,0,.28); -webkit-overflow-scrolling:touch; }
  .pg-informes table.im{ width:100%; border-collapse:collapse; min-width:660px; font-size:.9rem; color:#20190a; }
  .pg-informes .im-cap{ text-align:left; font-weight:600; color:#8a6b27; padding:11px 12px 2px; caption-side:top; font-size:.86rem; }
  .pg-informes .im th, .pg-informes .im td{ padding:9px 12px; text-align:right; white-space:nowrap; border-bottom:1px solid rgba(150,116,46,.16); }
  .pg-informes .im thead th{ position:sticky; top:0; font-size:.72rem; text-transform:uppercase; letter-spacing:.04em; color:#8a7f6b; background:#f6efdf; font-weight:700; }
  .pg-informes .im th:first-child, .pg-informes .im td:first-child{ text-align:left; position:sticky; left:0; background:#fffdf8; z-index:1; }
  .pg-informes .im thead th:first-child{ background:#f6efdf; z-index:2; }
  .pg-informes .im tr.padre th, .pg-informes .im tr.padre td{ font-weight:700; background:#f6efdf; }
  .pg-informes .im th.hijo{ font-weight:500; padding-left:22px; color:#3f3a31; }
  .pg-informes .im tr.sep th, .pg-informes .im tr.sep td{ border-top:2px solid rgba(150,116,46,.35); font-weight:600; }
  .pg-informes .im .precio{ font-variant-numeric:tabular-nums; }
  .pg-informes .im .est{ color:#8a6b27; font-weight:700; }
  .pg-informes .im .pub{ color:#6b6152; }
  .pg-informes .im .pos{ color:#2f5d3a; font-weight:600; }
  .pg-informes .im .neg{ color:#8f2f22; font-weight:600; }
  .pg-informes .im .neu{ color:#6b6152; }
  .pg-informes .im .dist{ color:#6b6152; }
  .pg-informes .serie-aviso{ color:var(--gris); font-size:.86rem; margin:12px 2px 0; font-style:italic; }
  .pg-informes .im-graf{ background:#fffdf8; border:1px solid rgba(150,116,46,.30); border-radius:14px; margin-top:12px; padding:12px 14px; }
  .pg-informes .im-graf figcaption{ color:#6b6152; font-size:.85rem; margin-bottom:6px; }
  .pg-informes .im-graf select{ font:inherit; padding:3px 6px; border:1px solid rgba(150,116,46,.4); border-radius:7px; background:#fff; color:#20190a; }
  .pg-informes .im-svg svg{ width:100%; height:auto; }
  .pg-informes .im-fuente{ margin-top:40px; padding-top:16px; border-top:1px solid var(--linea); color:var(--gris); font-size:.82rem; line-height:1.6; }
  /* Botón "Descargar PDF" */
  .pg-informes .im-pdf{ margin:16px 0 2px; }
  .pg-informes .im-pdf-btn{ display:inline-flex; align-items:center; gap:7px; background:transparent; border:1px solid var(--oro); color:var(--oro-claro); font:inherit; font-weight:600; font-size:.86rem; padding:9px 16px; border-radius:8px; cursor:pointer; }
  .pg-informes .im-pdf-btn:hover{ background:var(--oro); color:var(--negro); }
  /* Tablas clonadas dentro de la hoja del PDF → aspecto informe (blanco, cabecera negra) */
  .pg-informes .hoja .im-card{ background:#fff; box-shadow:none; border:none; border-radius:0; overflow:visible; margin:0 0 1.1rem; }
  .pg-informes .hoja table.im{ min-width:0; font-size:.78rem; }
  .pg-informes .hoja table.im .im-cap{ color:#8a6b27; padding:2px 0 5px; }
  .pg-informes .hoja table.im thead th{ position:static; background:#000; color:#F2EFE7; }
  .pg-informes .hoja table.im th:first-child, .pg-informes .hoja table.im td:first-child{ position:static; background:transparent; }
  .pg-informes .hoja table.im thead th:first-child{ background:#000; }
  .pg-informes .hoja table.im tr.padre th, .pg-informes .hoja table.im tr.padre td{ background:#FAF8F2; }
  @media print{
    .pg-informes .hoja table.im thead th{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .pg-informes .hoja tr{ page-break-inside:avoid; }
    /* Compactar para que Madrid (22 filas) y España (20) quepan en UNA hoja A4 */
    .pg-informes .hoja .i-header{ padding:1rem 1.2rem; }
    .pg-informes .hoja .i-logo-box{ width:74px; height:74px; padding:.4rem; }
    .pg-informes .hoja .i-titulo{ font-size:1.5rem; margin:.15rem 0 .3rem; }
    .pg-informes .hoja .i-body{ padding:1.1rem 1.2rem; }
    .pg-informes .hoja table.im{ font-size:.66rem; }
    .pg-informes .hoja table.im th, .pg-informes .hoja table.im td{ padding:3px 6px; }
    .pg-informes .hoja table.im .im-cap{ font-size:.74rem; padding:1px 0 3px; }
    .pg-informes .hoja .i-hipotesis, .pg-informes .hoja .i-disclaimer{ font-size:.64rem; margin-top:.5rem; }
    .pg-informes .hoja .i-footer{ padding:.7rem 1.2rem; font-size:.7rem; }
  }
  @media(max-width:560px){ .pg-informes .im th, .pg-informes .im td{ padding:8px 10px; } .pg-informes table.im{ font-size:.84rem; } }
</style>
</head>
<body class="pg-informes">
${NAV}
<main class="im-wrap">
  <h1 class="im-titulo">Informes de Mercado</h1>
  <p class="im-intro">Evolución de los precios de vivienda <b>en venta</b> (€/m²): el detalle por barrios de las zonas donde están mis oficinas —Chamberí, Chamartín y Malasaña-Universidad—, los 21 distritos de Madrid capital y todas las comunidades autónomas.</p>
  <p class="im-aviso"><b>Fuente:</b> precios de <b>oferta publicada</b> en idealista, no de operación cerrada. El <b>€/m² Est. Venta</b> descuenta el <b>6,2 %</b> de margen medio de negociación entre precio publicado y precio final de venta (media nacional; Cátedra Grupo Tecnocasa–UPF, vía idealista, feb. 2026).</p>
  <p class="im-actualizado">Última actualización: <b>${esc(mesUltimo.label)}</b>.</p>

  ${bloqueContraste(CONTRASTE)}

  <div class="im-tabs">
    <input type="radio" name="imtab" id="t-zonas" class="im-radio" checked>
    <input type="radio" name="imtab" id="t-madrid" class="im-radio">
    <input type="radio" name="imtab" id="t-espana" class="im-radio">
    <div class="modo-toggle" aria-label="Elegir sección de datos">
      <label class="modo-btn" for="t-zonas">Zonas de mis oficinas<small>Chamberí, Chamartín y Malasaña</small></label>
      <label class="modo-btn" for="t-madrid">Madrid por distritos<small>Capital y sus 21 distritos</small></label>
      <label class="modo-btn" for="t-espana">España por comunidades<small>Nacional y autonomías</small></label>
    </div>

    <section class="im-panel im-seccion" id="p-zonas">
      <h2>Zonas donde están mis oficinas <span style="font-weight:400;color:var(--gris);font-size:1rem">— Chamberí, Chamartín y Malasaña-Universidad, barrio a barrio</span></h2>
      <p class="im-desc">Cada distrito con sus barrios.</p>
      ${htmlZonas}
      ${grafico('zonas', 'zona')}
    </section>

    <section class="im-panel im-seccion" id="p-madrid">
      <h2>Madrid <span style="font-weight:400;color:var(--gris);font-size:1rem">— capital y sus 21 distritos</span></h2>
      ${htmlMadrid}
      ${grafico('madrid', 'distrito')}
    </section>

    <section class="im-panel im-seccion" id="p-espana">
      <h2>España <span style="font-weight:400;color:var(--gris);font-size:1rem">— nacional y comunidades autónomas</span></h2>
      ${htmlEspana}
      ${grafico('espana', 'comunidad')}
    </section>
  </div>

  <p class="im-fuente">
    <b>Precios de oferta publicada en idealista, no de operación cerrada.</b> Reflejan lo que se pide, no lo que se firma. La columna <b>€/m² Est. Venta</b> es una estimación: el precio publicado menos el <b>6,2 %</b> de margen medio de negociación a nivel nacional entre precio de oferta y precio final de venta (Cátedra Grupo Tecnocasa–UPF, vía idealista, 18-02-2026). Ese margen es una media que varía según la zona, el inmueble y el momento, por lo que el precio real de cierre puede diferir. €/m² de vivienda en venta. Última actualización: ${esc(mesUltimo.label)}.
    Elaborado por Alberto Cabas Ortiz (Cabas Realtor). Uso informativo; no es una tasación ni asesoramiento de inversión.
  </p>
</main>
${FOOTER}
<!-- Hoja del PDF (oculta; se rellena al pulsar "Descargar" y se imprime con el mismo sistema que las calculadoras). -->
<div class="hoja-imprimible-wrap">
  <div class="hoja">
    <div class="i-header">
      <div class="i-logo-box"><img src="/assets/logo-c.png" alt="Cabas Realtor"></div>
      <div class="i-header-main">
        <p class="i-eyebrow">Informe de mercado</p>
        <h2 class="i-titulo" id="im-hoja-titulo">—</h2>
        <p class="i-subtitulo" id="im-hoja-sub">Precios de vivienda en venta (€/m²)</p>
        <p class="i-vivienda" id="im-hoja-mes">—</p>
      </div>
      <div class="i-fecha"><strong id="im-hoja-fecha">—</strong>cabas.es/informes-mercado</div>
    </div>
    <div class="i-body">
      <div id="im-hoja-tablas"></div>
      <p class="i-hipotesis"><strong>Precios de oferta publicada en idealista, no de operación cerrada.</strong> El «€/m² Est. Venta» descuenta el 6,2 % de margen medio de negociación entre precio publicado y precio final de venta (media nacional; Cátedra Grupo Tecnocasa–UPF, vía idealista, feb. 2026), que varía según la zona, el inmueble y el momento.</p>
      <p class="i-disclaimer">Elaborado por Alberto Cabas Ortiz (Cabas Realtor). Uso informativo; no es una tasación ni asesoramiento de inversión.</p>
    </div>
    <div class="i-footer">
      <strong>Alberto Cabas · Cabas Realtor</strong>
      <span class="contacto">662 669 014 · alberto@cabas.es · Calle Bravo Murillo 23, 28015 Madrid · cabas.es</span>
    </div>
  </div>
</div>
<a class="whatsapp" href="https://wa.me/34662669014?text=Hola%20Alberto%2C%20te%20escribo%20desde%20cabas.es" target="_blank" rel="noopener" aria-label="Escribir por WhatsApp"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg></a>
<div id="google_translate_element" style="display:none"></div>
<script type="application/json" id="im-series">${JSON.stringify(SERIES)}</script>
<script>
function googleTranslateElementInit(){new google.translate.TranslateElement({pageLanguage:'es',includedLanguages:'ca,en,fr,de,it,pt,zh-CN,ar',autoDisplay:false},'google_translate_element');}
document.getElementById('selector-idioma').addEventListener('change', function(){
  var lang=this.value;
  if(!lang){ var _h=location.hostname,_r=_h.replace(/^www\\./,'');['',_h,'.'+_h,_r,'.'+_r].forEach(function(d){document.cookie='googtrans=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT'+(d?';domain='+d:'');});location.reload();return; }
  document.cookie='googtrans=/es/'+lang+';path=/';
  document.cookie='googtrans=/es/'+lang+';path=/;domain=.'+location.hostname.replace(/^www\\./,'');
  var combo=document.querySelector('select.goog-te-combo'); if(combo){combo.value=lang;combo.dispatchEvent(new Event('change'));}else{location.reload();}
});
</script>
<script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" defer></script>
<script src="/js/main.js"></script>
<script src="/js/textura.js"></script>
<script src="/js/datos-cabas.js"></script>
<script src="/js/calc-core.js"></script>
<script>
// Descargar PDF por TABLA: clona esa tarjeta a la hoja oculta y usa el MISMO
// sistema de impresión que las calculadoras (imprimirInforme, de main.js).
(function () {
  var MES = ${JSON.stringify(mesUltimo.label)};
  function pdf(btn) {
    var card = document.getElementById(btn.getAttribute('data-card')); if (!card) return;
    document.getElementById('im-hoja-titulo').textContent = btn.getAttribute('data-titulo') || 'Informe de mercado';
    document.getElementById('im-hoja-sub').textContent = btn.getAttribute('data-sub') || '';
    document.getElementById('im-hoja-mes').textContent = 'Datos de ' + MES + ' · precios de vivienda en venta (€/m²)';
    document.getElementById('im-hoja-fecha').textContent = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    var dest = document.getElementById('im-hoja-tablas'); dest.innerHTML = '';
    dest.appendChild(card.cloneNode(true));
    if (typeof imprimirInforme === 'function') imprimirInforme(); else window.print();
  }
  document.querySelectorAll('.im-pdf-btn').forEach(function (b) {
    b.addEventListener('click', function () { pdf(b); });
  });
})();
</script>
${SVG_JS}
<script src="/js/cabas-chatbot.js" defer></script>
</body>
</html>`;

fs.writeFileSync(OUT_HTML, HTML, 'utf8');

// ============================================================
// 4) sitemap.xml (regenerado con la fecha del mes más reciente)
// ============================================================
const hoyISO = new Date().toISOString().slice(0, 10);
const PAGINAS = [
  ['/', '1.0'], ['/herencias.html', '0.8'], ['/vender.html', '0.8'], ['/comprar.html', '0.8'],
  ['/inversion.html', '0.7'], ['/valoracion.html', '0.7'], ['/informes-mercado/', '0.9'],
  ['/quien-soy.html', '0.6'], ['/oficinas.html', '0.6'], ['/contacto.html', '0.5'],
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGINAS.map(([u, p]) => `  <url><loc>${BASE_URL}${u}</loc><lastmod>${u === '/informes-mercado/' ? mesUltimo.iso : hoyISO}</lastmod><priority>${p}</priority></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(OUT_SITEMAP, sitemap, 'utf8');

// ============================================================
// Resumen
// ============================================================
console.log('── Informes de Mercado ──────────────────────────');
console.log(driveOk ? `Drive leído OK. CSV nuevos copiados: ${copiados.length ? copiados.join(', ') : 'ninguno'}`
                    : '⚠ No pude leer Drive (no montado o sin permiso). Uso solo lo commiteado.');
console.log(`CSV en data/: ${locales.length}  ·  meses en serie: ${N_MESES} (${meses.map(m => m.label).join(' → ')})`);
console.log(`Filas · zonas:${filas.zonas.length}  madrid:${filas.madrid.length}  espana:${filas.espana.length}`);
console.log(`Gráficos: ${N_MESES >= 3 ? 'SÍ (>=3 meses)' : 'aún no (aparecen con 3 meses)'}`);
console.log(`Generado: informes-mercado/index.html  +  sitemap.xml   ·  última actualización: ${mesUltimo.label}`);
console.log('─────────────────────────────────────────────────');
