// ============================================================
// Calculadora del Neto del Vendedor — válida para toda España (v3)
// Soporta hasta 3 adquisiciones (compra/herencia en varias veces),
// cada una con su valor, gastos, fecha y % de propiedad.
// 1) Plusvalía municipal (IIVTNU) por tramo — gasto deducible en IRPF.
//    Los coeficientes son los máximos estatales (RDL 8/2023), aplicables
//    en toda España salvo que el ayuntamiento tenga aprobados otros
//    inferiores. El TIPO (0-30%) lo fija cada ayuntamiento; usamos el
//    estimado de la capital de la CCAA elegida (tabla PLUSVALIA_CCAA en
//    js/datos-cabas.js) — no hay campo manual para no complicar el flujo.
// 2) IRPF sobre la ganancia total en la base del ahorro (tramos estatales,
//    iguales en toda España).
// ============================================================
// NOTA: COEF_IIVTNU y TRAMOS_IRPF viven ahora en js/datos-cabas.js
// (fuente única de datos fiscales, compartida con el chatbot). No los
// redeclares aquí. REVISARLOS ANUALMENTE en datos-cabas.js.

const MAX_TRAMOS = 3;

const ccaaSel = document.getElementById('v-ccaa');

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
  const oficinaSlug = document.getElementById('v-oficina').value;
  if (!oficinaSlug) { alert('Selecciona primero tu oficina Cabas Realtor — es obligatorio para poder generar el informe.'); return; }
  const venta = num('v-venta');
  const gVenta = num('v-gastos-venta');
  const vcTotal = num('v-vc-total');
  const vcSuelo = num('v-vc-suelo');
  const fVenta = document.getElementById('v-fecha-venta').value;
  const mayor65 = document.getElementById('v-mayor65').checked;
  const reinv = document.getElementById('v-reinversion').checked;
  const tipoIIVTNUpct = PLUSVALIA_CCAA[ccaaSel.value] ?? 30; // estimado según la capital de la comunidad
  const tipoIIVTNU = Math.min(30, Math.max(0, tipoIIVTNUpct)) / 100;

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
    const baseObjetiva = vcSuelo * share * (COEF_IIVTNU[a] ?? 0.40);
    const baseReal = gananciaTramo * (vcSuelo / vcTotal);
    plusvalia += Math.max(0, Math.min(baseObjetiva, baseReal)) * tipoIIVTNU;
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
  document.getElementById('r-plusvalia-label').textContent = `Plusvalía municipal (IIVTNU, tipo ${(tipoIIVTNU * 100).toFixed(1).replace(/\.0$/, '')}%)`;
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

  // Guardamos el cálculo completo — lo usa el botón "Descargar informe en PDF"
  ultimoCalculoVenta = {
    oficinaSlug, venta, gVenta, tramos, totalAdquisicion, ccaaSlug: ccaaSel.value,
    tipoIIVTNUpct: tipoIIVTNU * 100, plusvalia, ganancia: Math.max(0, exenta ? 0 : ganancia),
    irpf, neto, exenta, mayor65, reinv, avisos
  };
  document.getElementById('v-descargar-pdf').disabled = false;

  const res = document.getElementById('v-resultado');
  res.classList.add('visible');
  res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// ---------- Descargar informe en PDF ----------
let ultimoCalculoVenta = null;
document.getElementById('v-descargar-pdf').addEventListener('click', () => {
  if (!ultimoCalculoVenta) { alert('Primero pulsa "Calcular mi neto" para hacer la simulación.'); return; }
  const c = ultimoCalculoVenta;
  const oficina = OFICINAS[c.oficinaSlug];
  const nombreCliente = document.getElementById('v-lead-nombre').value.trim();
  const ccaaNombre = (DATOS_CCAA[c.ccaaSlug] || DATOS_CCAA.madrid).nombre;

  document.getElementById('pdfv-ccaa').textContent = `Vivienda en ${ccaaNombre}`;
  document.getElementById('pdfv-fecha').textContent = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  document.getElementById('pdfv-para').textContent = nombreCliente ? `Documento para ${nombreCliente}` : 'Documento para cliente';

  document.getElementById('pdfv-venta').textContent = eur(c.venta);
  document.getElementById('pdfv-plusvalia').textContent = eur2(c.plusvalia);
  document.getElementById('pdfv-plusvalia-cap').textContent = `IIVTNU, tipo ${c.tipoIIVTNUpct.toFixed(1).replace(/\.0$/, '').replace('.', ',')}%`;
  document.getElementById('pdfv-irpf').textContent = c.exenta ? 'Exento' : eur2(c.irpf);
  document.getElementById('pdfv-neto').textContent = eur(c.neto);

  const filas = [
    ['Precio de venta', eur(c.venta)],
    ['Gastos de la venta', eur2(c.gVenta)],
    ['Valor de adquisición (total)', eur2(c.totalAdquisicion)],
    [`Plusvalía municipal (IIVTNU, tipo ${c.tipoIIVTNUpct.toFixed(1).replace(/\.0$/, '').replace('.', ',')}%)`, eur2(c.plusvalia)],
    ['Ganancia patrimonial a efectos de IRPF', eur2(c.ganancia)],
    [c.exenta ? 'IRPF (exento)' : 'IRPF sobre la ganancia', c.exenta ? eur(0) : eur2(c.irpf)],
    ['Neto estimado', eur(c.neto)]
  ];
  document.getElementById('pdfv-tabla-body').innerHTML = filas.map(([label, val], i) =>
    `<tr${i === filas.length - 1 ? ' class="recomendada"' : ''}><td>${label}</td><td class="num">${val}</td></tr>`
  ).join('');

  const avisosBox = document.getElementById('pdfv-avisos-box');
  const avisosTexto = (c.avisos || []).map(a => a.txt).join(' ');
  if (avisosTexto) {
    avisosBox.style.display = '';
    document.getElementById('pdfv-avisos-texto').textContent = avisosTexto;
  } else {
    avisosBox.style.display = 'none';
  }

  document.getElementById('pdfv-hipotesis').innerHTML =
    `<strong>Hipótesis del cálculo:</strong> Vivienda en ${ccaaNombre}. Plusvalía municipal calculada con los coeficientes máximos estatales (RDL 8/2023) y un tipo de gravamen del ${c.tipoIIVTNUpct.toFixed(1).replace(/\.0$/, '').replace('.', ',')}% (estimado para la capital de la comunidad). ` +
    `IRPF calculado sobre la base del ahorro estatal (19-30%), igual en toda España. ${c.mayor65 ? 'Ganancia exenta por mayor de 65 años en vivienda habitual.' : c.reinv ? 'Exención por reinversión en vivienda habitual aplicada.' : ''}`;

  document.getElementById('pdfv-oficina-nombre').textContent = oficina.nombre;
  document.getElementById('pdfv-oficina-contacto').textContent = `${oficina.direccion} · ${oficina.telefono} · ${oficina.email}`;

  imprimirInforme();
});
