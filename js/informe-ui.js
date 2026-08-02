// ============================================================
// Interfaz del generador de informes — conecta el formulario con
// el motor de cálculo (informe-logic.js) y pinta el documento.
// ============================================================
function _miles(entero){ return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function eur(n){ const neg = n<0?'−':''; return neg+_miles(String(Math.round(Math.abs(n))))+'\u00A0€'; }
function eur2(n){ const neg=n<0?'−':''; const abs=Math.abs(n).toFixed(2); const [ent,dec]=abs.split('.'); return neg+_miles(ent)+','+dec+'\u00A0€'; }
function pct1(n){ return n.toFixed(1).replace('.', ','); }
function num(id){ const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? 0 : v; }
function recogerSerie(prefijo){
  return ['1','2','3'].map(n => num(prefijo+n)).filter(v => v > 0);
}

// ---------- Toggle honorarios ----------
const honCheck = document.getElementById('f-hon-check');
const honTipo = document.getElementById('f-hon-tipo');
function actualizarHonorariosUI(){
  document.getElementById('f-hon-detalle').style.display = honCheck.checked ? '' : 'none';
  const esPct = honTipo.value === 'porcentaje';
  document.getElementById('f-hon-fijo-campo').style.display = esPct ? 'none' : '';
  document.getElementById('f-hon-pct-campo').style.display = esPct ? '' : 'none';
  document.getElementById('f-hon-iva-campo').style.display = esPct ? '' : 'none';
}
honCheck.addEventListener('change', actualizarHonorariosUI);
honTipo.addEventListener('change', actualizarHonorariosUI);
actualizarHonorariosUI();

// ---------- Precarga desde comprar.html (enlace "Ir al comparador") ----------
(function precargarDesdeURL() {
  const p = new URLSearchParams(location.search);
  if (!p.has('precio') && !p.has('ccaa') && !p.has('oficina')) return;
  if (p.get('oficina')) document.getElementById('f-oficina').value = p.get('oficina');
  if (p.get('precio')) document.getElementById('f-precio').value = p.get('precio');
  if (p.get('ccaa')) document.getElementById('f-ccaa').value = p.get('ccaa');
  if (p.get('tipo')) document.getElementById('f-tipo').value = p.get('tipo');
  const aviso = document.getElementById('f-avisos');
  aviso.innerHTML = '<div class="aviso aviso-verde">Datos precargados desde el simulador. Añade abajo las aportaciones, tipos de interés y plazos que quieras comparar.</div>';
})();

// ---------- Lectura profesional (bullets automáticos) ----------
function generarLectura(r, ctx) {
  const { ingresos, aportaciones, tins, plazos } = ctx;
  const bullets = [];
  const todas = r.todas;

  if (ingresos > 0) {
    const dentro = todas.filter(f => f.esfuerzo <= 30).length;
    const total = todas.length;
    if (dentro === total) bullets.push(`Los ${total} escenario${total > 1 ? 's' : ''} quedan por debajo del 30% de esfuerzo mensual.`);
    else if (dentro === 0) bullets.push(`Ningún escenario baja del 30% de esfuerzo mensual — conviene revisar precio, plazo o aportación.`);
    else bullets.push(`${dentro} de ${total} escenarios quedan por debajo del 30% de esfuerzo mensual.`);
  }

  if (aportaciones.length > 1) {
    const minAp = Math.min(...aportaciones), maxAp = Math.max(...aportaciones);
    const fMin = todas.find(f => f.aportacion === minAp);
    const fMax = todas.find(f => f.aportacion === maxAp);
    if (fMin) bullets.push(`Con ${eur(minAp)} se financia el ${pct1(fMin.ltv)}% del precio${fMin.ltv > 80 ? ', por encima del límite habitual del 80%' : fMin.ltv > 75 ? ': prácticamente el límite habitual del 80%' : ''}.`);
    if (fMax) bullets.push(`Con ${eur(maxAp)} la financiación ${fMax.ltv < fMin.ltv ? 'baja al' : 'queda en el'} ${pct1(fMax.ltv)}%${fMax.ltv <= 80 ? ' y la operación gana margen de seguridad.' : '.'}`);
  }

  if (plazos.length > 1) {
    const minPl = Math.min(...plazos), maxPl = Math.max(...plazos);
    const refAp = r.recomendado.aportacion, refTin = r.recomendado.tin;
    const gCorto = r.grupos.find(g => g.plazo === minPl)?.filas.find(f => f.aportacion === refAp && f.tin === refTin);
    const gLargo = r.grupos.find(g => g.plazo === maxPl)?.filas.find(f => f.aportacion === refAp && f.tin === refTin);
    if (gCorto && gLargo) {
      const diferenciaIntereses = gLargo.interesesTotales - gCorto.interesesTotales;
      bullets.push(`A ${minPl} años la cuota es ${eur2(gCorto.cuota)}/mes frente a ${eur2(gLargo.cuota)}/mes a ${maxPl} años — pero ${eur(Math.round(diferenciaIntereses))} menos de intereses totales eligiendo el plazo corto.`);
    }
  }

  if (r.honorarios > 0) bullets.push(`Incluye ${eur2(r.honorarios)} de honorarios de intermediación a cargo del comprador, que el banco no financia.`);

  return bullets;
}

// ---------- Generar informe ----------
document.getElementById('f-generar').addEventListener('click', () => {
  const oficinaSlug = document.getElementById('f-oficina').value;
  const precio = num('f-precio');
  const ccaaSlug = document.getElementById('f-ccaa').value;
  const tipoViv = document.getElementById('f-tipo').value;
  const cliente = document.getElementById('f-cliente').value.trim();
  const ingresos = num('f-ingresos');

  const honorariosCfg = honCheck.checked ? {
    activo: true, tipo: honTipo.value,
    importe: num('f-hon-importe'), pct: num('f-hon-pct'),
    ivaIncluido: document.getElementById('f-hon-iva').checked
  } : null;

  let aportaciones = recogerSerie('f-ap');
  let tins = recogerSerie('f-tin');
  let plazos = recogerSerie('f-pl');
  if (!plazos.length) plazos = [30];

  const avisosDiv = document.getElementById('f-avisos');
  avisosDiv.innerHTML = '';
  if (!oficinaSlug) {
    avisosDiv.innerHTML = '<div class="aviso aviso-rojo">Selecciona tu oficina Cabas Realtor — es obligatorio, sus datos aparecen en el pie del informe.</div>';
    return;
  }
  if (!precio || !aportaciones.length || !tins.length) {
    avisosDiv.innerHTML = '<div class="aviso aviso-rojo">Necesito al menos el precio, una aportación y un tipo de interés para poder simular.</div>';
    return;
  }

  const r = generarEscenarios({ precio, ccaaSlug, tipoViv, ingresos, honorariosCfg, aportaciones, tins, plazos });
  const efecto = efectoAportarMas(r, aportaciones, tins);

  // ---- Cabecera ----
  document.getElementById('i-subtitulo').textContent = plazos.length > 1
    ? `Comparativa de financiación a ${plazos.join(', ')} años`
    : `Comparativa de financiación a ${plazos[0]} años`;
  document.getElementById('i-vivienda').textContent = `Vivienda ${tipoViv === 'nueva' ? 'de obra nueva' : 'usada'} · ${r.gastos.ccaaNombre}`;
  document.getElementById('i-fecha').textContent = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  document.getElementById('i-para').textContent = cliente ? `Documento para ${cliente}` : 'Documento para cliente';

  // ---- Datos de partida ----
  document.getElementById('i-precio').textContent = eur(precio);
  document.getElementById('i-gastos').textContent = eur(r.gastos.total);
  document.getElementById('i-gastos-cap').textContent = 'Impuestos y gastos de la operación';
  document.getElementById('i-costetotal').textContent = eur(r.costeTotal);
  if (ingresos > 0) {
    document.getElementById('i-ingresos-label').textContent = 'Ingresos del hogar';
    document.getElementById('i-ingresos').textContent = eur(ingresos);
  } else {
    document.getElementById('i-ingresos-label').textContent = 'Esfuerzo mensual';
    document.getElementById('i-ingresos').textContent = 'No indicado';
  }

  // ---- Tablas por plazo ----
  const contTablas = document.getElementById('i-tablas');
  contTablas.innerHTML = '';
  r.grupos.forEach(g => {
    const div = document.createElement('div');
    div.className = 'i-tabla-grupo';
    const conEsfuerzo = ingresos > 0;
    let filasHtml = '';
    g.filas.forEach(f => {
      const esRecomendada = f.aportacion === r.recomendado.aportacion && f.tin === r.recomendado.tin && f.plazo === r.recomendado.plazo;
      filasHtml += `<tr${esRecomendada ? ' class="recomendada"' : ''}>
        <td class="aportacion">${eur(f.aportacion)}</td>
        <td class="centro">${f.tin}%</td>
        <td class="num">${eur(f.hipoteca)}</td>
        <td class="centro">${pct1(f.ltv)}%</td>
        <td class="num">${eur2(f.cuota)}</td>
        ${conEsfuerzo ? `<td class="centro">${pct1(f.esfuerzo)}%</td>` : ''}
        <td class="num">${eur(Math.round(f.interesesTotales))}</td>
      </tr>`;
    });
    div.innerHTML = `
      <div class="i-tabla-cab">
        <span class="plazo-label">Plazo: ${g.plazo} años</span>
        <span class="tin-label">${g.plazo * 12} cuotas mensuales</span>
      </div>
      <table class="i-tabla">
        <thead><tr>
          <th>Aportación</th><th class="centro">TIN</th><th class="num">Hipoteca</th><th class="centro">% Financiado (LTV)</th>
          <th class="num">Cuota / mes</th>${conEsfuerzo ? '<th class="centro">Esfuerzo</th>' : ''}<th class="num">Intereses totales</th>
        </tr></thead>
        <tbody>${filasHtml}</tbody>
      </table>`;
    contTablas.appendChild(div);
  });
  document.getElementById('i-tabla-nota').textContent =
    'La fila resaltada es el escenario recomendado: el mejor equilibrio entre esfuerzo mensual y financiación dentro del límite habitual del 80%. LTV = porcentaje del precio de la vivienda que cubre la hipoteca; el resto lo aporta el comprador.';

  // ---- Lectura profesional ----
  const lectura = generarLectura(r, { ingresos, aportaciones, tins, plazos });
  document.getElementById('i-lectura').innerHTML = lectura.map(t => `<li>${t}</li>`).join('');

  // ---- Escenario equilibrado ----
  const rec = r.recomendado;
  document.getElementById('i-eq-cuota').textContent = eur2(rec.cuota);
  document.getElementById('i-eq-aportacion').textContent = eur(rec.aportacion);
  document.getElementById('i-eq-detalle').textContent = `${rec.tin}% / ${rec.plazo} años`;
  const filaEsf = document.getElementById('i-eq-esfuerzo-fila');
  if (rec.esfuerzo !== null) { filaEsf.style.display = ''; document.getElementById('i-eq-esfuerzo').textContent = pct1(rec.esfuerzo) + '%'; }
  else { filaEsf.style.display = 'none'; }

  // ---- Efecto de aportar más ----
  const efectoBox = document.getElementById('i-efecto-box');
  if (efecto && Object.keys(efecto.porTin).length) {
    const partes = Object.entries(efecto.porTin).map(([tin, d]) => `${eur2(d.ahorro)} al ${tin}%`);
    document.getElementById('i-efecto-texto').textContent =
      ` Con ${eur(efecto.diferencia)} más de aportación (de ${eur(efecto.min)} a ${eur(efecto.max)}, a ${efecto.plazo} años): ahorro mensual de ${partes.join(' y ')} en la cuota, y menor coste financiero durante toda la vida del préstamo.`;
    efectoBox.style.display = '';
  } else {
    efectoBox.style.display = 'none';
  }

  // ---- Hipótesis del cálculo ----
  document.getElementById('i-hipotesis').innerHTML =
    `<strong style="color:#1A1712">Hipótesis del cálculo:</strong> Vivienda ${tipoViv === 'nueva' ? 'de obra nueva' : 'usada'} en ${r.gastos.ccaaNombre}. ` +
    `Gastos estimados: ${r.gastos.impLabel} (${eur2(r.gastos.impuestos)}), notaría ${eur2(r.gastos.notaria)}, registro ${eur2(r.gastos.registro)}, gestoría ${eur2(r.gastos.gestoria)} y tasación ${eur2(r.gastos.tasacion)}` +
    (r.honorarios > 0 ? `, honorarios de intermediación ${eur2(r.honorarios)}` : '') +
    `. Sistema francés, cuotas constantes y TIN sin comisiones, seguros ni productos vinculados.`;

  // ---- Pie de página: datos de la oficina seleccionada ----
  const oficina = OFICINAS[oficinaSlug];
  document.getElementById('i-footer-oficina').textContent = oficina.nombre;
  document.getElementById('i-footer-contacto').textContent = `${oficina.direccion} · ${oficina.telefono} · ${oficina.email}`;

  // ---- Cambiar de pantalla ----
  document.getElementById('pantalla-form').style.display = 'none';
  document.getElementById('pantalla-informe').style.display = 'block';
  window.scrollTo(0, 0);
});

document.getElementById('btn-editar').addEventListener('click', () => {
  document.getElementById('pantalla-informe').style.display = 'none';
  document.getElementById('pantalla-form').style.display = 'block';
  window.scrollTo(0, 0);
});

document.getElementById('btn-pdf').addEventListener('click', () => window.print());
