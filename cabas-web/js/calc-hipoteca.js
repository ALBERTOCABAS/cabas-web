// ============================================================
// Simulador de compra — Madrid
// Gastos: ITP 6% (usada) | IVA 10% + AJD 0,75% (obra nueva)
// Cuota: sistema francés. LTV máx. habitual: 80%.
// Tasa de esfuerzo: semáforo 30–35% (criterio bancario habitual).
// REVISAR ANUALMENTE: tipos impositivos y estimaciones de gastos.
// ============================================================

function gastosFijos(precio) {
  // Estimaciones habituales escaladas por precio
  const notaria = Math.min(1100, Math.max(650, precio * 0.0022));
  const registro = Math.min(650, Math.max(400, precio * 0.0013));
  const gestoria = 400;
  const tasacion = 350;
  return { notaria, registro, gestoria, tasacion };
}

document.getElementById('h-calcular').addEventListener('click', () => {
  const precio = num('h-precio');
  const ahorro = num('h-ahorro');
  const tipoViv = document.getElementById('h-tipo-vivienda').value;
  const plazo = num('h-plazo');
  const tin = num('h-tin');
  const ingresos = num('h-ingresos');

  if (!precio || !plazo || !tin) { alert('Necesito al menos el precio, el plazo y el tipo de interés.'); return; }

  // 1) Impuestos y gastos
  let impuestos, impLabel;
  if (tipoViv === 'nueva') {
    const iva = precio * 0.10;
    const ajd = precio * 0.0075;
    impuestos = iva + ajd;
    impLabel = 'IVA 10% + AJD 0,75%';
  } else {
    impuestos = precio * 0.06;
    impLabel = 'ITP 6% (Comunidad de Madrid)';
  }
  const g = gastosFijos(precio);
  const gastosTotales = impuestos + g.notaria + g.registro + g.gestoria + g.tasacion;
  const costeTotal = precio + gastosTotales;

  // 2) Hipoteca necesaria (el ahorro cubre primero los gastos, luego la entrada)
  const hipoteca = Math.max(0, costeTotal - ahorro);
  const ltv = precio > 0 ? (hipoteca / precio) * 100 : 0;

  // 3) Cuota — sistema francés
  const i = tin / 100 / 12;
  const n = plazo * 12;
  const cuota = i > 0 ? hipoteca * i / (1 - Math.pow(1 + i, -n)) : hipoteca / n;

  // 4) Avisos
  const avisos = [];
  if (ahorro < gastosTotales) {
    avisos.push({ t: 'rojo', txt: `Tu ahorro (${eur(ahorro)}) no cubre ni los gastos de la compra (${eur(gastosTotales)}). Ningún banco financia el 100% más gastos salvo excepciones — hay que replantear la operación.` });
  } else if (ltv > 80) {
    const ahorroNecesario = costeTotal - precio * 0.80;
    avisos.push({ t: 'ambar', txt: `Necesitarías financiar el ${ltv.toFixed(0)}% del precio. Los bancos financian normalmente hasta el 80%: para esta compra el ahorro recomendado es de ${eur(ahorroNecesario)} (entrada del 20% + gastos).` });
  } else {
    avisos.push({ t: 'verde', txt: `Financiación del ${ltv.toFixed(0)}% — dentro del límite habitual del 80%. Operación viable a priori.` });
  }

  // 5) Tasa de esfuerzo
  const linEsf = document.getElementById('h-r-esfuerzo-linea');
  if (ingresos > 0 && cuota > 0) {
    const esf = (cuota / ingresos) * 100;
    let color, txt;
    if (esf <= 30) { color = 'var(--verde)'; txt = 'Cómoda: por debajo del 30% de tus ingresos, el rango que los bancos consideran saludable.'; }
    else if (esf <= 35) { color = 'var(--ambar)'; txt = 'Justa: entre el 30% y el 35%. Los bancos la aceptan, pero con poco margen para imprevistos.'; }
    else { color = 'var(--rojo)'; txt = 'Excesiva: por encima del 35% la mayoría de bancos no aprueban la operación. Habría que bajar precio, alargar plazo o aportar más ahorro.'; }
    document.getElementById('h-r-esfuerzo').innerHTML = `<span class="semaforo" style="background:${color}"></span>${esf.toFixed(1)}%`;
    linEsf.style.display = 'flex';
    avisos.push({ t: esf <= 30 ? 'verde' : esf <= 35 ? 'ambar' : 'rojo', txt: 'Tasa de esfuerzo — ' + txt });
  } else {
    linEsf.style.display = 'none';
  }

  // 6) Pintar resultados
  document.getElementById('h-r-precio').textContent = eur(precio);
  document.getElementById('h-r-imp-label').textContent = impLabel;
  document.getElementById('h-r-imp').textContent = eur2(impuestos);
  document.getElementById('h-r-notaria').textContent = eur2(g.notaria);
  document.getElementById('h-r-registro').textContent = eur2(g.registro);
  document.getElementById('h-r-gestoria').textContent = eur2(g.gestoria);
  document.getElementById('h-r-tasacion').textContent = eur2(g.tasacion);
  document.getElementById('h-r-total').textContent = eur(costeTotal);
  document.getElementById('h-r-hipoteca').textContent = eur(hipoteca);
  document.getElementById('h-r-ltv').textContent = ltv.toFixed(1) + '%';
  document.getElementById('h-r-cuota').textContent = eur2(cuota) + ' /mes';

  const cont = document.getElementById('h-avisos');
  cont.innerHTML = '';
  avisos.forEach(a => {
    const d = document.createElement('div');
    d.className = 'aviso' + (a.t === 'rojo' ? ' aviso-rojo' : a.t === 'verde' ? ' aviso-verde' : '');
    d.textContent = a.txt;
    cont.appendChild(d);
  });

  document.getElementById('h-lead-resumen').value =
    `Precio ${eur(precio)} | Ahorro ${eur(ahorro)} | ${tipoViv} | Hipoteca ${eur(hipoteca)} | Cuota ${eur2(cuota)}/mes | LTV ${ltv.toFixed(0)}%`;

  const res = document.getElementById('h-resultado');
  res.classList.add('visible');
  res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
