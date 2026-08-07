// ============================================================
// CABAS REALTOR — Calculadora de INVERSIÓN (calc-inversion.js)
// Dos modos: comprar para alquilar / comprar-reformar-vender.
// Usa el motor puro de calc-core.js (coreInversionAlquiler /
// coreInversionFlipping). Solo se encarga del DOM.
// ============================================================
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const num = id => { const v = parseFloat($(id) && $(id).value); return isNaN(v) ? 0 : v; };
  const pct = x => (x).toFixed(1).replace(/\.0$/, '').replace('.', ',') + '%';

  let modo = 'alquiler';
  let ultimo = null; // { modo, res }

  // ---------- Rellenar selects de CCAA desde datos-cabas.js ----------
  function llenarCCAA(sel) {
    if (!sel || typeof DATOS_CCAA === 'undefined') return;
    Object.keys(DATOS_CCAA).forEach(slug => {
      const o = document.createElement('option');
      o.value = slug; o.textContent = DATOS_CCAA[slug].nombre;
      if (slug === 'madrid') o.selected = true;
      sel.appendChild(o);
    });
  }
  llenarCCAA($('a-ccaa')); llenarCCAA($('f-ccaa'));

  // ---------- Rellenar selector de oficina (Alberto Gerente + 6 oficinas) ----------
  (function () {
    const sel = $('inv-oficina');
    if (!sel || typeof OFICINAS === 'undefined') return;
    Object.keys(OFICINAS).forEach(slug => {
      const o = document.createElement('option');
      o.value = slug; o.textContent = OFICINAS[slug].nombre;
      if (slug === 'alberto') o.selected = true;
      sel.appendChild(o);
    });
  })();

  // ---------- Cambio de modo ----------
  function setModo(m) {
    modo = m;
    const esAlq = m === 'alquiler';
    $('modo-alquiler').classList.toggle('activo', esAlq);
    $('modo-flipping').classList.toggle('activo', !esAlq);
    $('modo-alquiler').setAttribute('aria-selected', esAlq);
    $('modo-flipping').setAttribute('aria-selected', !esAlq);
    $('form-alquiler').classList.toggle('activo', esAlq);
    $('form-flipping').classList.toggle('activo', !esAlq);
    // ocultar resultado previo al cambiar de estrategia
    $('inv-resultado').classList.remove('visible');
    $('inv-descargar-pdf').style.display = 'none';
    ultimo = null;
  }
  $('modo-alquiler').addEventListener('click', () => setModo('alquiler'));
  $('modo-flipping').addEventListener('click', () => setModo('flipping'));

  // ---------- Toggle campos de hipoteca ----------
  $('a-hipoteca').addEventListener('change', e => { $('a-hipoteca-campos').style.display = e.target.checked ? '' : 'none'; });
  $('f-hipoteca').addEventListener('change', e => { $('f-hipoteca-campos').style.display = e.target.checked ? '' : 'none'; });

  // ---------- Honorarios (fijo/% + IVA), reutilizable ----------
  // Mismo criterio que la calculadora de compra: fijo = importe final;
  // porcentaje = base × % (+ 21% IVA salvo que el IVA vaya incluido).
  function honUI(p) {
    const on = $(p + '-check').checked;
    $(p + '-detalle').style.display = on ? '' : 'none';
    const esPct = $(p + '-tipo').value === 'porcentaje';
    $(p + '-fijo-campo').style.display = esPct ? 'none' : '';
    $(p + '-pct-campo').style.display = esPct ? '' : 'none';
    $(p + '-iva-campo').style.display = esPct ? '' : 'none';
  }
  function honorarios(p, base) {
    if (!$(p + '-check').checked) return 0;
    if ($(p + '-tipo').value === 'fijo') return num(p + '-importe');
    const b = base * (num(p + '-pct') / 100);
    return $(p + '-iva').checked ? b : b * 1.21;
  }
  ['a-hon', 'fc-hon', 'fv-hon'].forEach(p => {
    $(p + '-check').addEventListener('change', () => honUI(p));
    $(p + '-tipo').addEventListener('change', () => honUI(p));
  });

  // ---------- Helpers de render ----------
  function linea(label, valor, extra) {
    return `<div class="res-linea"${extra || ''}><span>${label}</span><span>${valor}</span></div>`;
  }
  function total(label, valor) {
    return `<div class="res-total"><span>${label}</span><strong>${valor}</strong></div>`;
  }
  function avisosHTML(avisos) {
    return (avisos || []).map(a => {
      const cls = a.t === 'rojo' ? ' aviso-rojo' : a.t === 'verde' ? ' aviso-verde' : '';
      return `<div class="aviso${cls}">${a.txt}</div>`;
    }).join('');
  }

  // ---------- Cálculo + render ----------
  function calcular() {
    const box = $('inv-resultado');
    let html = '';
    if (modo === 'alquiler') {
      const r = coreInversionAlquiler({
        precio: num('a-precio'), tipoViv: $('a-tipoviv').value, ccaaSlug: $('a-ccaa').value,
        reforma: num('a-reforma'), rentaMes: num('a-renta'), vacanciaPct: num('a-vacancia'),
        ibi: num('a-ibi'), comunidadMes: num('a-comunidad'), seguro: num('a-seguro'),
        mantenimientoPct: num('a-mantenimiento'), gestionPct: num('a-gestion'),
        honorariosCompra: honorarios('a-hon', num('a-precio')),
        conHipoteca: $('a-hipoteca').checked, entrada: num('a-entrada'), tin: num('a-tin'), plazo: num('a-plazo')
      });
      html += linea('Inversión total (compra + gastos + reforma)', eur(r.inversionTotal));
      html += linea('Ingreso neto de explotación al año', eur(r.noi));
      html += linea('Rentabilidad bruta', pct(r.rentBruta));
      html += total('Rentabilidad neta', pct(r.rentNeta));
      if (r.conHipoteca) {
        html += linea('Cuota de la hipoteca (mensual)', eur2(r.cuotaMes));
        const cf = r.cashFlowMes >= 0 ? `<span style="color:var(--verde);font-weight:700">${eur2(r.cashFlowMes)}</span>` : `<span style="color:var(--rojo);font-weight:700">${eur2(r.cashFlowMes)}</span>`;
        html += linea('Flujo de caja (mensual)', cf);
        html += linea('Rentabilidad sobre tu capital (cash-on-cash)', pct(r.cashOnCash));
      }
      html += avisosHTML(r.avisos);
      ultimo = { modo, res: r };
    } else {
      const r = coreInversionFlipping({
        precioCompra: num('f-precio'), tipoViv: $('f-tipoviv').value, ccaaSlug: $('f-ccaa').value,
        reforma: num('f-reforma'), meses: num('f-meses'), gastosTenenciaMes: num('f-tenencia'),
        honorariosCompra: honorarios('fc-hon', num('f-precio')),
        precioVenta: num('f-venta'), honorariosVenta: honorarios('fv-hon', num('f-venta')), otrosGastosVenta: num('f-otros'),
        conHipoteca: $('f-hipoteca').checked, entrada: num('f-entrada'), tin: num('f-tin'), gastosFinancierosFijos: num('f-gastos-fin')
      });
      html += linea('Inversión total (compra, gastos, reforma, tenencia y venta)', eur(r.inversionTotal));
      html += linea('Precio de venta estimado', eur(r.precioVenta));
      html += total('Beneficio (antes de impuestos)', eur(r.beneficio));
      html += linea('ROI sobre tu capital aportado', pct(r.roi));
      html += linea('Margen sobre el precio de venta', pct(r.margen));
      html += linea('ROI anualizado', pct(r.roiAnualizado));
      html += avisosHTML(r.avisos);
      ultimo = { modo, res: r };
    }
    box.innerHTML = html;
    box.classList.add('visible');
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const btn = $('inv-descargar-pdf');
    btn.style.display = ''; btn.disabled = false;
    // resumen para el lead
    rellenarResumenLead();
  }
  $('inv-calcular').addEventListener('click', calcular);

  function rellenarResumenLead() {
    if (!ultimo) return;
    const r = ultimo.res;
    let s;
    if (ultimo.modo === 'alquiler') {
      s = `[ALQUILER] Inversión ${eur(r.inversionTotal)} · Renta ${eur2(num('a-renta'))}/mes · Rent. neta ${pct(r.rentNeta)}`;
      if (r.conHipoteca) s += ` · Cash flow ${eur2(r.cashFlowMes)}/mes · Cash-on-cash ${pct(r.cashOnCash)}`;
    } else {
      s = `[FLIPPING] Compra ${eur(r.precioCompra)} + reforma ${eur(r.reforma)} · Venta ${eur(r.precioVenta)} · Beneficio ${eur(r.beneficio)} · ROI ${pct(r.roi)} · Margen ${pct(r.margen)}`;
    }
    $('inv-lead-resumen').value = s;
  }

  // ---------- PDF (window.print de la hoja marcada) ----------
  function stat(n, l, v, c) { $('pdfi-s' + n + '-l').textContent = l; $('pdfi-s' + n + '-v').textContent = v; $('pdfi-s' + n + '-c').textContent = c; }
  function fila(label, val, recomendada) {
    return `<tr${recomendada ? ' class="recomendada"' : ''}><td>${label}</td><td class="num">${val}</td></tr>`;
  }

  $('inv-descargar-pdf').addEventListener('click', () => {
    if (!ultimo) { alert('Primero pulsa "Analizar la inversión".'); return; }
    const r = ultimo.res;
    const oficina = (typeof OFICINAS !== 'undefined') ? (OFICINAS[$('inv-oficina').value] || OFICINAS.alberto) : null;
    const nombreCliente = $('inv-lead-nombre').value.trim();
    $('pdfi-fecha').textContent = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    $('pdfi-para').textContent = nombreCliente ? `Documento para ${nombreCliente}` : 'Documento para cliente';
    $('pdfi-ccaa').textContent = `Vivienda en ${r.ccaaNombre}`;

    if (ultimo.modo === 'alquiler') {
      $('pdfi-titulo').textContent = 'Comprar para alquilar';
      $('pdfi-subtitulo').textContent = 'Análisis de rentabilidad del alquiler';
      stat(1, 'Inversión total', eur(r.inversionTotal), 'Compra, gastos y reforma');
      stat(2, 'Rentabilidad neta', pct(r.rentNeta), 'Sobre la inversión total');
      stat(3, r.conHipoteca ? 'Flujo de caja / mes' : 'Ingreso neto / año', r.conHipoteca ? eur2(r.cashFlowMes) : eur(r.noi), r.conHipoteca ? 'Tras pagar la hipoteca' : 'Renta menos gastos');
      stat(4, r.conHipoteca ? 'Cash-on-cash' : 'Rentabilidad bruta', pct(r.conHipoteca ? r.cashOnCash : r.rentBruta), r.conHipoteca ? 'Sobre tu capital' : 'Sobre la inversión');
      const filas = [
        ['Precio de compra', eur(r.precio)],
        [`Gastos de compra — impuestos (${r.impLabel}) + notaría, registro y gestoría`, eur2(r.gastosCompra)],
        ...(r.honorariosCompra > 0 ? [['Honorarios de intermediación (compra)', eur2(r.honorariosCompra)]] : []),
        ['Reforma / puesta a punto', eur2(r.reforma)],
        ['Renta anual bruta', eur2(r.rentaAnualBruta)],
        [`Menos vacancia/impago (${pct(r.vacanciaPct)})`, '−' + eur2(r.rentaAnualBruta - r.rentaAnualEfectiva)],
        ['Gastos anuales de explotación', '−' + eur2(r.gastosOperativos)],
        ['Ingreso neto de explotación (NOI)', eur2(r.noi)]
      ];
      if (r.conHipoteca) {
        filas.push([`Hipoteca (${r.ltv.toFixed(0)}% LTV)`, eur(r.hipoteca)]);
        filas.push(['Cuota anual de la hipoteca', '−' + eur2(r.cuotaAnual)]);
        filas.push(['Flujo de caja anual', eur2(r.cashFlowAnual)]);
      }
      filas.push(['Rentabilidad neta', pct(r.rentNeta)]);
      $('pdfi-tabla-body').innerHTML = filas.map(([l, v], i) => fila(l, v, i === filas.length - 1)).join('');
      $('pdfi-hipotesis').innerHTML = `<strong>Hipótesis:</strong> ${r.ccaaNombre}. Gastos de compra estimados (${r.impLabel} + notaría, registro y gestoría). Vacancia/impago del ${pct(r.vacanciaPct)} sobre la renta. La rentabilidad neta no descuenta el IRPF de los rendimientos del alquiler, que depende de tu declaración.`;
    } else {
      $('pdfi-titulo').textContent = 'Comprar, reformar y vender';
      $('pdfi-subtitulo').textContent = 'Análisis de la operación (flipping)';
      stat(1, 'Inversión total', eur(r.inversionTotal), 'Todos los costes');
      stat(2, 'Beneficio', eur(r.beneficio), 'Antes de impuestos');
      stat(3, 'ROI', pct(r.roi), 'Sobre tu capital');
      stat(4, 'Margen', pct(r.margen), 'Sobre el precio de venta');
      const filas = [
        ['Precio de compra', eur(r.precioCompra)],
        [`Gastos de compra — impuestos (${r.impLabel}) + notaría, registro y gestoría`, eur2(r.gastosCompra)],
        ...(r.honorariosCompra > 0 ? [['Honorarios de intermediación (compra)', eur2(r.honorariosCompra)]] : []),
        ['Reforma', eur2(r.reforma)],
        [`Gastos de tenencia (${r.meses} meses)`, eur2(r.costesTenencia)]
      ];
      if (r.conHipoteca) filas.push([`Coste financiero (intereses ${r.meses} meses)`, eur2(r.costeFinanciero)]);
      if (r.gastosFinancierosFijos > 0) filas.push(['Gastos financieros (apertura, tasación, cancelación…)', eur2(r.gastosFinancierosFijos)]);
      filas.push(['Gastos de venta (honorarios + otros)', eur2(r.gastosVenta)]);
      filas.push(['Inversión total', eur2(r.inversionTotal)]);
      filas.push(['Precio de venta', eur(r.precioVenta)]);
      filas.push(['Beneficio (antes de impuestos)', eur(r.beneficio)]);
      $('pdfi-tabla-body').innerHTML = filas.map(([l, v], i) => fila(l, v, i === filas.length - 1)).join('');
      $('pdfi-hipotesis').innerHTML = `<strong>Hipótesis:</strong> ${r.ccaaNombre}. Gastos de compra estimados (${r.impLabel} + notaría, registro y gestoría). ROI anualizado: ${pct(r.roiAnualizado)}. <strong>El beneficio es ANTES de impuestos</strong>: la tributación depende de si la operación es puntual (ganancia patrimonial en IRPF) o habitual (actividad económica / Sociedades).`;
    }
    if (oficina) {
      $('pdfi-oficina-nombre').textContent = oficina.nombre;
      $('pdfi-oficina-contacto').textContent = `${oficina.direccion} · ${oficina.telefono} · ${oficina.email}`;
    }
    if (typeof imprimirInforme === 'function') imprimirInforme(); else window.print();
  });
})();
