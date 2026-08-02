// ============================================================
// Simulador de compra — válido para toda España
// Gastos: ITP (usada) | IVA 10% + AJD (obra nueva) — ambos varían por CCAA
// Cuota: sistema francés. LTV máx. habitual: 80%.
// Tasa de esfuerzo: semáforo 30–35% (criterio bancario habitual).
// La tabla fiscal por CCAA y las oficinas viven en js/datos-cabas.js
// (compartido con informe-compra.html) — no dupliques datos aquí.
// ============================================================

function gastosFijos(precio, incluyeTasacion) {
  // Estimaciones habituales escaladas por precio
  const notaria = Math.min(1100, Math.max(650, precio * 0.0022));
  const registro = Math.min(650, Math.max(400, precio * 0.0013));
  const gestoria = 400;
  // Tasación: en España suele moverse entre 200-500€ para vivienda estándar
  // y algo más en inmuebles grandes o singulares (fuente: sociedades de
  // tasación homologadas BdE, 2026). Solo es necesaria si hay hipoteca.
  const tasacion = incluyeTasacion ? Math.min(700, Math.max(250, precio * 0.0014)) : 0;
  return { notaria, registro, gestoria, tasacion };
}

// Honorarios de intermediación a cargo del comprador (no siempre existen).
// Pueden pactarse como importe fijo, o como % sobre el precio — en cuyo caso
// puede llevar el IVA (21%) ya incluido o aparte.
function calcularHonorarios(precio) {
  if (!document.getElementById('h-honorarios-check').checked) return 0;
  const tipo = document.getElementById('h-honorarios-tipo').value;
  if (tipo === 'fijo') return num('h-honorarios-importe');
  const base = precio * (num('h-honorarios-pct') / 100);
  const ivaIncluido = document.getElementById('h-honorarios-iva-incluido').checked;
  return ivaIncluido ? base : base * 1.21;
}

// ---------- Mostrar/ocultar campos según las opciones elegidas ----------
const financiaSel = document.getElementById('h-financia');
function actualizarFinancia() {
  const modo = financiaSel.value; // 'si' | 'no' | 'comparador'
  const conHipoteca = modo === 'si';
  const esComparador = modo === 'comparador';

  document.getElementById('h-campo-plazo').style.display = conHipoteca ? '' : 'none';
  document.getElementById('h-fila-financiacion').style.display = conHipoteca ? '' : 'none';
  // Al contado o en modo comparador no hace falta preguntar el ahorro
  document.getElementById('h-campo-ahorro').style.display = conHipoteca ? '' : 'none';
  // En modo comparador los honorarios se configuran en la siguiente pantalla
  document.getElementById('h-bloque-honorarios').style.display = esComparador ? 'none' : '';
  document.getElementById('h-nota-comparador').style.display = esComparador ? '' : 'none';
  document.getElementById('h-descargar-pdf').style.display = esComparador ? 'none' : '';

  const btn = document.getElementById('h-calcular');
  btn.textContent = esComparador ? 'Ir al comparador de escenarios →' : 'Simular mi compra';
}
financiaSel.addEventListener('change', actualizarFinancia);
actualizarFinancia();

const honorariosCheck = document.getElementById('h-honorarios-check');
const honorariosTipoSel = document.getElementById('h-honorarios-tipo');
function actualizarHonorariosUI() {
  document.getElementById('h-honorarios-detalle').style.display = honorariosCheck.checked ? '' : 'none';
  const esPct = honorariosTipoSel.value === 'porcentaje';
  document.getElementById('h-honorarios-fijo-campo').style.display = esPct ? 'none' : '';
  document.getElementById('h-honorarios-pct-campo').style.display = esPct ? '' : 'none';
  document.getElementById('h-honorarios-iva-campo').style.display = esPct ? '' : 'none';
}
honorariosCheck.addEventListener('change', actualizarHonorariosUI);
honorariosTipoSel.addEventListener('change', actualizarHonorariosUI);
actualizarHonorariosUI();

document.getElementById('h-calcular').addEventListener('click', () => {
  const oficinaSlug = document.getElementById('h-oficina').value;
  if (!oficinaSlug) { alert('Selecciona primero tu oficina Cabas Realtor — es obligatorio para poder generar el informe.'); return; }
  const precio = num('h-precio');
  const tipoViv = document.getElementById('h-tipo-vivienda').value;
  const ccaaSlug = document.getElementById('h-ccaa').value;

  if (financiaSel.value === 'comparador') {
    if (!precio) { alert('Necesito al menos el precio de la vivienda.'); return; }
    const params = new URLSearchParams({ oficina: oficinaSlug, precio, ccaa: ccaaSlug, tipo: tipoViv });
    location.href = 'informe-compra.html?' + params.toString();
    return;
  }

  const conHipoteca = financiaSel.value === 'si';
  const ahorro = conHipoteca ? num('h-ahorro') : 0;
  const plazo = num('h-plazo');
  const tin = num('h-tin');
  const ingresos = num('h-ingresos');

  if (!precio) { alert('Necesito al menos el precio de la vivienda.'); return; }
  if (conHipoteca && (!plazo || !tin)) { alert('Para calcular la hipoteca necesito el plazo y el tipo de interés. Si vas a pagar al contado, cambia "¿Vas a pedir hipoteca?" a "No".'); return; }

  // 1) Impuestos y gastos — según la Comunidad Autónoma elegida
  const datos = datosITPAJD(ccaaSlug, precio);
  let impuestos, impLabel;
  if (tipoViv === 'nueva') {
    const iva = precio * 0.10;
    const ajd = precio * (datos.ajdPct / 100);
    impuestos = iva + ajd;
    impLabel = `IVA 10% + AJD ${datos.ajdPct}% (${datos.nombre})`;
  } else {
    impuestos = precio * (datos.itpPct / 100);
    const itpTxt = datos.itpPct % 1 === 0 ? datos.itpPct : datos.itpPct.toFixed(2);
    impLabel = `ITP ${itpTxt}% (${datos.nombre})`;
  }
  const g = gastosFijos(precio, conHipoteca);
  const honorarios = calcularHonorarios(precio);
  const gastosTotales = impuestos + g.notaria + g.registro + g.gestoria + g.tasacion;
  const costeTotal = precio + gastosTotales + honorarios;

  // 2) Hipoteca necesaria — los honorarios de intermediación no los financia
  //    el banco: se descuentan primero del ahorro, y solo el resto se resta
  //    del importe financiable (precio + gastos).
  let hipoteca = 0, ltv = 0, cuota = 0;
  if (conHipoteca) {
    const ahorroFinanciable = Math.max(0, ahorro - honorarios);
    hipoteca = Math.max(0, (precio + gastosTotales) - ahorroFinanciable);
    ltv = precio > 0 ? (hipoteca / precio) * 100 : 0;
    const i = tin / 100 / 12;
    const n = plazo * 12;
    cuota = i > 0 ? hipoteca * i / (1 - Math.pow(1 + i, -n)) : (n > 0 ? hipoteca / n : 0);
  }

  // 3) Avisos — la comparación con el ahorro solo tiene sentido si hay
  //    hipoteca (para saber cuánto hay que financiar). Al contado, el
  //    resultado relevante es directamente el coste total de la operación.
  const avisos = [];
  if (conHipoteca) {
    if (honorarios > 0 && ahorro < honorarios) {
      avisos.push({ t: 'rojo', txt: `Tu ahorro (${eur(ahorro)}) no llega a cubrir los honorarios de intermediación (${eur2(honorarios)}), que el banco no financia. Hace falta ese importe antes de plantear el resto de la operación.` });
    }
    if (ahorro < gastosTotales + honorarios) {
      avisos.push({ t: 'rojo', txt: `Tu ahorro (${eur(ahorro)}) no cubre ni los gastos de la compra${honorarios ? ' más los honorarios' : ''} (${eur2(gastosTotales + honorarios)}). Ningún banco financia el 100% más gastos salvo excepciones — hay que replantear la operación.` });
    } else if (ltv > 80) {
      const ahorroNecesario = (precio + gastosTotales + honorarios) - precio * 0.80;
      avisos.push({ t: 'ambar', txt: `Necesitarías financiar el ${ltv.toFixed(0)}% del precio. Los bancos financian normalmente hasta el 80%: para esta compra el ahorro recomendado es de ${eur(ahorroNecesario)} (entrada del 20% + gastos${honorarios ? ' + honorarios' : ''}).` });
    } else {
      avisos.push({ t: 'verde', txt: `Financiación del ${ltv.toFixed(0)}% — dentro del límite habitual del 80%. Operación viable a priori.` });
    }
  }

  // 4) Tasa de esfuerzo — solo tiene sentido si hay cuota
  const linEsf = document.getElementById('h-r-esfuerzo-linea');
  if (conHipoteca && ingresos > 0 && cuota > 0) {
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

  // 5) Pintar resultados
  document.getElementById('h-r-precio').textContent = eur(precio);
  document.getElementById('h-r-imp-label').textContent = impLabel;
  document.getElementById('h-r-imp').textContent = eur2(impuestos);
  document.getElementById('h-r-notaria').textContent = eur2(g.notaria);
  document.getElementById('h-r-registro').textContent = eur2(g.registro);
  document.getElementById('h-r-gestoria').textContent = eur2(g.gestoria);

  const lineaTasacion = document.getElementById('h-linea-tasacion');
  lineaTasacion.style.display = conHipoteca ? '' : 'none';
  if (conHipoteca) document.getElementById('h-r-tasacion').textContent = eur2(g.tasacion);

  const lineaHonorarios = document.getElementById('h-linea-honorarios');
  lineaHonorarios.style.display = honorarios > 0 ? '' : 'none';
  if (honorarios > 0) {
    document.getElementById('h-r-honorarios').textContent = eur2(honorarios);
    document.getElementById('h-honorarios-sublabel').textContent = conHipoteca ? 'a tu cargo, no lo financia el banco' : '';
  }

  document.getElementById('h-r-total').textContent = eur(costeTotal);

  document.getElementById('h-linea-hipoteca').style.display = conHipoteca ? '' : 'none';
  document.getElementById('h-linea-ltv').style.display = conHipoteca ? '' : 'none';
  document.getElementById('h-linea-cuota').style.display = conHipoteca ? '' : 'none';
  if (conHipoteca) {
    document.getElementById('h-r-hipoteca').textContent = eur(hipoteca);
    document.getElementById('h-r-ltv').textContent = ltv.toFixed(1) + '%';
    document.getElementById('h-r-cuota').textContent = eur2(cuota) + ' /mes';
  }

  const cont = document.getElementById('h-avisos');
  cont.innerHTML = '';
  avisos.forEach(a => {
    const d = document.createElement('div');
    d.className = 'aviso' + (a.t === 'rojo' ? ' aviso-rojo' : a.t === 'verde' ? ' aviso-verde' : '');
    d.textContent = a.txt;
    cont.appendChild(d);
  });

  document.getElementById('h-lead-resumen').value =
    `Oficina ${OFICINAS[oficinaSlug].nombre} | Precio ${eur(precio)} | ${tipoViv} | ` +
    (conHipoteca ? `Ahorro ${eur(ahorro)} | Hipoteca ${eur(hipoteca)} | Cuota ${eur2(cuota)}/mes | LTV ${ltv.toFixed(0)}%` : `Al contado | Coste total ${eur(costeTotal)}`) +
    (honorarios > 0 ? ` | Honorarios ${eur2(honorarios)}` : '');

  // Guardamos el cálculo completo — lo usa el botón "Descargar informe en PDF"
  ultimoCalculo = {
    oficinaSlug, precio, tipoViv, ccaaNombre: datos.nombre, conHipoteca, ahorro, plazo, tin, ingresos,
    impuestos, impLabel, gastos: g, honorarios, gastosTotales, costeTotal, hipoteca, ltv, cuota
  };
  document.getElementById('h-descargar-pdf').disabled = false;

  const res = document.getElementById('h-resultado');
  res.classList.add('visible');
  res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// ---------- Descargar informe en PDF (un solo escenario) ----------
let ultimoCalculo = null;
document.getElementById('h-descargar-pdf').addEventListener('click', () => {
  if (!ultimoCalculo) { alert('Primero pulsa "Simular mi compra" para calcular tu operación.'); return; }
  const c = ultimoCalculo;
  const oficina = OFICINAS[c.oficinaSlug];
  const nombreCliente = document.getElementById('h-lead-nombre').value.trim();

  document.getElementById('pdf-subtitulo').textContent = c.conHipoteca ? `Simulación con hipoteca a ${c.plazo} años` : 'Simulación al contado';
  document.getElementById('pdf-vivienda').textContent = `Vivienda ${c.tipoViv === 'nueva' ? 'de obra nueva' : 'usada'} · ${c.ccaaNombre}`;
  document.getElementById('pdf-fecha').textContent = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  document.getElementById('pdf-para').textContent = nombreCliente ? `Documento para ${nombreCliente}` : 'Documento para cliente';

  document.getElementById('pdf-precio').textContent = eur(c.precio);
  document.getElementById('pdf-gastos').textContent = eur(c.gastosTotales + c.honorarios);
  document.getElementById('pdf-costetotal').textContent = eur(c.costeTotal);
  if (c.conHipoteca) {
    document.getElementById('pdf-cuarto-label').textContent = 'Cuota mensual';
    document.getElementById('pdf-cuarto-valor').textContent = eur2(c.cuota);
    document.getElementById('pdf-cuarto-cap').textContent = `${c.plazo} años · TIN ${c.tin}%`;
  } else {
    document.getElementById('pdf-cuarto-label').textContent = 'Forma de pago';
    document.getElementById('pdf-cuarto-valor').textContent = 'Al contado';
    document.getElementById('pdf-cuarto-cap').textContent = 'Sin financiación';
  }

  // Desglose línea a línea
  const filas = [
    [c.impLabel, eur2(c.impuestos)],
    ['Notaría (estimación)', eur2(c.gastos.notaria)],
    ['Registro de la Propiedad (estimación)', eur2(c.gastos.registro)],
    ['Gestoría (estimación)', eur2(c.gastos.gestoria)]
  ];
  if (c.conHipoteca) filas.push(['Tasación (para la hipoteca)', eur2(c.gastos.tasacion)]);
  if (c.honorarios > 0) filas.push(['Honorarios de intermediación (a tu cargo, no financiable)', eur2(c.honorarios)]);
  filas.push(['Coste total de la operación', eur(c.costeTotal)]);
  document.getElementById('pdf-tabla-body').innerHTML = filas.map(([label, val], i) =>
    `<tr${i === filas.length - 1 ? ' class="recomendada"' : ''}><td>${label}</td><td class="num">${val}</td></tr>`
  ).join('');

  const hipBox = document.getElementById('pdf-hipoteca-box');
  if (c.conHipoteca) {
    hipBox.style.display = '';
    document.getElementById('pdf-cuota-grande').textContent = eur2(c.cuota);
    document.getElementById('pdf-plazo-cap').textContent = `a ${c.plazo} años · TIN ${c.tin}%`;
    document.getElementById('pdf-hipoteca-valor').textContent = eur(c.hipoteca);
    document.getElementById('pdf-ltv-valor').textContent = c.ltv.toFixed(1).replace('.', ',') + '%';
    const esfFila = document.getElementById('pdf-esfuerzo-fila');
    if (c.ingresos > 0) {
      esfFila.style.display = '';
      document.getElementById('pdf-esfuerzo-valor').textContent = ((c.cuota / c.ingresos) * 100).toFixed(1).replace('.', ',') + '%';
    } else {
      esfFila.style.display = 'none';
    }
    const puntos = [];
    puntos.push(`Con ${eur(c.ahorro)} de ahorro se financia el ${c.ltv.toFixed(1).replace('.', ',')}% del precio${c.ltv > 80 ? ', por encima del límite habitual del 80%' : ''}.`);
    if (c.ingresos > 0) {
      const esf = (c.cuota / c.ingresos) * 100;
      puntos.push(esf <= 30 ? 'La cuota queda por debajo del 30% de los ingresos del hogar — esfuerzo cómodo.' : esf <= 35 ? 'La cuota está entre el 30% y el 35% de los ingresos — esfuerzo justo.' : 'La cuota supera el 35% de los ingresos — esfuerzo elevado, conviene revisar la operación.');
    }
    document.getElementById('pdf-lectura').innerHTML = puntos.map(p => `<li>${p}</li>`).join('');
  } else {
    hipBox.style.display = 'none';
  }

  const impLabelSinCCAA = c.impLabel.replace(` (${c.ccaaNombre})`, '');
  document.getElementById('pdf-hipotesis').innerHTML =
    `<strong>Hipótesis del cálculo:</strong> Vivienda ${c.tipoViv === 'nueva' ? 'de obra nueva' : 'usada'} en ${c.ccaaNombre}. ` +
    `Gastos estimados: ${impLabelSinCCAA} (${eur2(c.impuestos)}), notaría ${eur2(c.gastos.notaria)}, registro ${eur2(c.gastos.registro)}, gestoría ${eur2(c.gastos.gestoria)}` +
    (c.conHipoteca ? ` y tasación ${eur2(c.gastos.tasacion)}` : '') +
    (c.honorarios > 0 ? `, honorarios de intermediación ${eur2(c.honorarios)}` : '') +
    (c.conHipoteca ? `. Sistema francés, cuotas constantes y TIN sin comisiones, seguros ni productos vinculados.` : '.');

  document.getElementById('pdf-oficina-nombre').textContent = oficina.nombre;
  document.getElementById('pdf-oficina-contacto').textContent = `${oficina.direccion} · ${oficina.telefono} · ${oficina.email}`;

  document.getElementById('pdf-disclaimer').textContent = c.conHipoteca
    ? 'Simulación orientativa. La aprobación y las condiciones finales de la hipoteca dependen de la entidad, la tasación, la estabilidad de ingresos y otras deudas. No constituye oferta vinculante ni asesoramiento financiero.'
    : 'Simulación orientativa de los gastos e impuestos de la compra al contado. Los importes reales pueden variar según la gestoría, la notaría elegida y bonificaciones aplicables. No constituye asesoramiento fiscal.';

  imprimirInforme();
});
