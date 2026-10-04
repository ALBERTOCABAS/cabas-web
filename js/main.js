// CABAS REALTOR — utilidades compartidas

// Menú móvil
const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');
if (toggle && links) {
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
}

// Animación de aparición al hacer scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// Formato de moneda (compartido por las calculadoras)
// Separador de miles SIEMPRE (el formato es-ES nativo no lo pone en cifras de 4 dígitos)
function _miles(entero) {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function eur(n) {
  const neg = n < 0 ? '−' : '';
  return neg + _miles(String(Math.round(Math.abs(n)))) + '\u00A0€';
}
function eur2(n) {
  const neg = n < 0 ? '−' : '';
  const abs = Math.abs(n).toFixed(2);
  const [ent, dec] = abs.split('.');
  return neg + _miles(ent) + ',' + dec + '\u00A0€';
}
function num(id) {
  const v = parseFloat(document.getElementById(id)?.value);
  return isNaN(v) ? 0 : v;
}

// Imprimir/descargar el informe de marca (comprar.html e informe-compra.html):
// oculta el resto de la página y deja solo la hoja marcada con
// class="hoja-imprimible-wrap" — ver css/informe.css
function imprimirInforme() {
  document.body.classList.add('modo-impresion-informe');
  window.print();
}
window.addEventListener('afterprint', () => document.body.classList.remove('modo-impresion-informe'));

// ---------- Descargar el informe como PDF REAL (Fase 2) ----------
// La web NO lleva librería de PDF: manda el HTML de la hoja (con CSS absolutos a
// cabas.es) al Worker, que lo rinde con Browser Rendering de Cloudflare y lo
// devuelve como archivo. Si falla o tarda más de 10 s, cae a window.print() sin
// que el cliente note nada raro. El "secreto" viaja en el navegador (es una web
// pública): la protección real del endpoint es el origen cabas.es + 30 PDF/hora.
const PDF_ENDPOINT = 'https://cabas-bot.alberto-f06.workers.dev/pdf';
const PDF_SECRET = 'pdf_5568000b47a6be28cac05f869713ff8b984d6ecd56038680';
function _docImprimible() {
  const wrap = document.querySelector('.hoja-imprimible-wrap');
  const hojas = wrap ? wrap.innerHTML
    : [].map.call(document.querySelectorAll('#pantalla-informe .hoja'), h => h.outerHTML).join('\n');
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">'
    + '<base href="https://www.cabas.es/">'
    + '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">'
    + '<link rel="stylesheet" href="https://www.cabas.es/css/style.css">'
    + '<link rel="stylesheet" href="https://www.cabas.es/css/informe.css">'
    + '<style>html,body{background:#fff;margin:0}</style></head>'
    + '<body class="modo-impresion-informe"><div class="hoja-imprimible-wrap">' + hojas + '</div></body></html>';
}
function _descargaBlob(blob, nombre) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u; a.download = nombre + '.pdf';
  a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  // iOS Safari a veces ignora download y abre el PDF: abrirlo también va bien.
  setTimeout(() => URL.revokeObjectURL(u), 8000);
}
function descargarInforme(nombreArchivo, fallback) {
  fallback = fallback || imprimirInforme;
  const nombre = (String(nombreArchivo || 'Informe Cabas').replace(/[^\w .\-]/g, '').trim()) || 'Informe Cabas';
  let doc;
  try { doc = _docImprimible(); } catch (e) { fallback(); return; }
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 10000);
  fetch(PDF_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-PDF-Secret': PDF_SECRET },
    body: JSON.stringify({ html: doc, filename: nombre }),
    signal: ctrl.signal
  }).then(r => { clearTimeout(to); if (!r.ok) throw new Error('status ' + r.status); return r.blob(); })
    .then(blob => {
      if (!blob || blob.type !== 'application/pdf' || blob.size < 1000) throw new Error('no pdf');
      _descargaBlob(blob, nombre);
    })
    .catch(() => { clearTimeout(to); fallback(); });
}
window.descargarInforme = descargarInforme;
