// ============================================================
// Calculadora del Neto del Vendedor — Madrid capital (v2)
// Soporta hasta 3 adquisiciones (compra/herencia en varias veces),
// cada una con su valor, gastos, fecha y % de propiedad.
// 1) Plusvalía municipal (IIVTNU) por tramo — gasto deducible en IRPF.
// 2) IRPF sobre la ganancia total en la base del ahorro.
// REVISAR ANUALMENTE: coeficientes IIVTNU y tramos IRPF.
// ============================================================

const COEF_IIVTNU = {
  0: 0.15, 1: 0.15, 2: 0.14, 3: 0.15, 4: 0.17, 5: 0.18, 6: 0.19,
  7: 0.18, 8: 0.15, 9: 0.12, 10: 0.10, 11: 0.09, 12: 0.09, 13: 0.09,
  14: 0.09, 15: 0.10, 16: 0.13, 17: 0.17, 18: 0.23, 19: 0.31, 20: 0.45
};
const TIPO_IIVTNU_MADRID = 0.29;
const TRAMOS_IRPF = [
  { hasta: 6000, tipo: 0.19 }, { hasta: 50000, tipo: 0.21 },
  { hasta: 200000, tipo: 0.23 }, { hasta: 300000, tipo: 0.27 },
  { hasta: Infinity, tipo: 0.30 }
];
const MAX_TRAMOS = 3;

// ---------- UI de adquisiciones ----------
const contAdq = document.getElementById('v-adquisiciones');
const btnAdd = document.getElementById('v-add-tramo');
let nTramos = 0;

function plantillaTramo(i) {
  const fs = document.createElement('fieldset');
  fs.className = 'tramo';
  fs.dataset.i = i;
  fs.innerHTML = `
    <legend>Adquisición ${i}</legend>
    ${i > 1 ? '<button type="button" class="quitar" aria-label="Quitar esta adquisición">Quitar ✕</button>' : ''}
    <div class="fila-2">
      <div class="campo">
        <label for="v-compra-${i}">Valor de adquisición (€)</label>
        <input type="number" id="v-compra-${i}" min="0" step="1000" placeholder="200000">
        <small>Precio de compra o, si es heredada, valor declarado en la herencia.</small>
      </div>
      <div class="campo">
        <label for="v-gastos-compra-${i}">Gastos de esa adquisición (€)</label>
        <input type="number" id="v-gastos-compra-${i}" min="0" step="500" placeholder="0">
        <small>Impuestos, notaría y registro que pagaste.</small>
      </div>
    </div>
    <div class="fila-2">
      <div class="campo">
        <label for="v-fecha-compra-${i}">Fecha de adquisición ${i}</label>
        <input type="date" id="v-fecha-compra-${i}">
        <small>Pincha en el campo para abrir el calendario.</small>
      </div>
      <div class="campo">
        <label for="v-pct-${i}">% de la propiedad adquirido</label>
        <input type="number" id="v-pct-${i}" min="1" max="100" step="1" value="100">
        <small>Si adquiriste toda la vivienda de una vez, deja 100.</small>
      </div>
    </div>`;
  const q = fs.querySelector('.quitar');
  if (q) q.addEventListener('click', () => { fs.remove(); nTramos--; renumerar(); });
  return fs;
}

function renumerar() {
  const tramos = contAdq.querySelectorAll('.tramo');
  btnAdd.style.display = tramos.length >= MAX_TRAMOS ? 'none' : 'block';
}

function addTramo() {
  if (nTramos >= MAX_TRAMOS) return;
  nTramos++;
  // buscar el primer índice libre
  let i = 1;
  while (document.getElementById('v-compra-' + i)) i++;
  contAdq.appendChild(plantillaTramo(i));
  // reparto orientativo del % al añadir tramos
  if (nTramos === 2) {
    const p1 = document.getElementById('v-pct-1');
    if (p1 && p1.value === '100') { p1.value = 50; document.getElementById('v-pct-' + i).value = 50; }
  }
  renumerar();
}
btnAdd.addEventListener('click', addTramo);
addTramo(); // primer tramo siempre presente

// ---------- Cálculo ----------
function aniosCompletos(f1, f2) {
  const d1 = new Date(f1), d2 = new Date(f2);
  let a = d2.getFullYear() - d1.getFullYear();
  const m = d2.getMonth() - d1.getMonth();
  if (m < 0 || (m === 0 && d2.getDate() < d1.getDate())) a--;
  return Math.max(0, a);
}

function calcIRPF(g) {
  if (g <= 0) return 0;
  let r = g, c = 0, p = 0;
  for (const t of TRAMOS_IRPF) {
    const x = Math.min(r, t.hasta - p);
    if (x <= 0) break;
    c += x * t.tipo; r -= x; p = t.hasta;
  }
  return c;
}

document.getElementById('v-calcular').addEventListener('click', () => {
  const venta = num('v-venta');
  const gVenta = num('v-gastos-venta');
  const vcTotal = num('v-vc-total');
  const vcSuelo = num('v-vc-suelo');
  const fVenta = document.getElementById('v-fecha-venta').value;
  const mayor65 = document.getElementById('v-mayor65').checked;
  const reinv = document.getElementById('v-reinversion').checked;

  // Leer tramos activos
  const tramos = [];
  contAdq.querySelectorAll('.tramo').forEach(fs => {
    const i = fs.dataset.i;
    tramos.push({
      valor: num('v-compra-' + i),
      gastos: num('v-gastos-compra-' + i),
      fecha: document.getElementById('v-fecha-compra-' + i).value,
      pct: num('v-pct-' + i)
    });
  });

  const avisos = [];
  if (!venta || tramos.every(t => !t.valor)) { alert('Necesito al menos el precio de venta y el valor de una adquisición.'); return; }
  const sumaPct = tramos.reduce((s, t) => s + t.pct, 0);
  if (Math.abs(sumaPct - 100) > 0.5) {
    avisos.push({ t: 'ambar', txt: `Los porcentajes de las adquisiciones suman ${sumaPct}%, no 100%. Revisa el reparto — el cálculo usa los porcentajes tal cual.` });
  }

  // 1) Plusvalía municipal por tramo (se paga primero: deducible en IRPF)
  let plusvalia = 0;
  let faltanDatosPV = false;
  tramos.forEach(t => {
    const share = t.pct / 100;
    const gananciaTramo = venta * share - t.valor;
    if (gananciaTramo <= 0) return; // sin incremento: no sujeto
    if (!t.fecha || !fVenta || !vcTotal || !vcSuelo) { faltanDatosPV = true; return; }
    const a = Math.min(Math.max(aniosCompletos(t.fecha, fVenta), 0), 20);
    const baseObjetiva = vcSuelo * share * (COEF_IIVTNU[a] ?? 0.45);
    const baseReal = gananciaTramo * (vcSuelo / vcTotal);
    plusvalia += Math.max(0, Math.min(baseObjetiva, baseReal)) * TIPO_IIVTNU_MADRID;
  });
  if (faltanDatosPV) avisos.push({ t: 'ambar', txt: 'Faltan fechas o valores catastrales en alguna adquisición: la plusvalía municipal de ese tramo no está incluida en el resultado.' });

  // 2) IRPF sobre la ganancia total
  const totalAdquisicion = tramos.reduce((s, t) => s + t.valor + t.gastos, 0);
  const ganancia = (venta - gVenta - plusvalia) - totalAdquisicion;
  let irpf = 0, exenta = false;
  if (mayor65) { exenta = true; avisos.push({ t: 'verde', txt: 'Mayor de 65 años y vivienda habitual: la ganancia está exenta de IRPF.' }); }
  else if (reinv) { exenta = true; avisos.push({ t: 'verde', txt: 'Exención por reinversión total en vivienda habitual aplicada. Si la reinversión es parcial, la exención es proporcional — pídeme el cálculo fino.' }); }
  if (!exenta) {
    if (ganancia <= 0) avisos.push({ t: 'verde', txt: 'La operación genera pérdida patrimonial: no pagas IRPF y la pérdida es compensable en tu declaración.' });
    else irpf = calcIRPF(ganancia);
  }

  const neto = venta - gVenta - plusvalia - irpf;

  document.getElementById('r-venta').textContent = eur(venta);
  document.getElementById('r-gventa').textContent = gVenta ? '−\u00A0' + eur(gVenta) : eur(0);
  document.getElementById('r-plusvalia').textContent = plusvalia ? '−\u00A0' + eur2(plusvalia) : eur(0);
  document.getElementById('r-ganancia').textContent = eur2(Math.max(0, exenta ? 0 : ganancia));
  document.getElementById('r-irpf').textContent = irpf ? '−\u00A0' + eur2(irpf) : eur(0);
  document.getElementById('r-neto').textContent = eur(neto);

  const cont = document.getElementById('r-avisos');
  cont.innerHTML = '';
  avisos.forEach(a => {
    const d = document.createElement('div');
    d.className = 'aviso' + (a.t === 'rojo' ? ' aviso-rojo' : a.t === 'verde' ? ' aviso-verde' : '');
    d.textContent = a.txt;
    cont.appendChild(d);
  });

  document.getElementById('v-lead-resumen').value =
    `Venta ${eur(venta)} | Adquisiciones ${tramos.length} (${eur(totalAdquisicion)}) | Plusvalía ${eur2(plusvalia)} | IRPF ${eur2(irpf)} | Neto ${eur(neto)}`;

  const res = document.getElementById('v-resultado');
  res.classList.add('visible');
  res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
