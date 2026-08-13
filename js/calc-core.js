// ============================================================
// CABAS REALTOR — núcleo de cálculo compartido (calc-core.js)
// ------------------------------------------------------------
// Funciones PURAS: reciben un objeto de entrada y devuelven un
// objeto de resultado. NO tocan el DOM. Son la ÚNICA fuente de
// la verdad del cálculo: las usan tanto las páginas
// (calc-hipoteca.js / calc-vendedor.js) como el chatbot
// (cabas-chatbot.js). Así es IMPOSIBLE que la web y el bot den
// números distintos.
//
// Los datos fiscales (ITP/AJD por CCAA, tipos de plusvalía,
// coeficientes IIVTNU y tramos de IRPF) viven en js/datos-cabas.js.
// Este archivo solo contiene la MATEMÁTICA, no los tipos.
//
// Debe cargarse DESPUÉS de datos-cabas.js y ANTES de
// calc-hipoteca.js / calc-vendedor.js / cabas-chatbot.js.
// ============================================================

// ------------------------------------------------------------
// Reutilización en servidor (Worker de Telegram).
// En el NAVEGADOR, datos-cabas.js ya cargó y DATOS_CCAA existe: esta
// condición es FALSA, el bloque se ignora por completo y todo funciona
// igual que siempre (los mismos datos globales de siempre).
// En el SERVIDOR (Node / Worker) esos datos NO son globales, así que se
// cargan aquí desde datos-cabas.js y se dejan accesibles para las
// funciones de abajo. Resultado: los MISMOS números en web y Telegram.
// No se declara ninguna variable con nombre de dato (DATOS_CCAA, etc.)
// a propósito, para no chocar con los globales que ya existen en la web.
// ------------------------------------------------------------
if (typeof DATOS_CCAA === 'undefined') {
  try {
    const _datos = require('./datos-cabas.js');
    globalThis.DATOS_CCAA     = _datos.DATOS_CCAA;
    globalThis.datosITPAJD    = _datos.datosITPAJD;
    globalThis.PLUSVALIA_CCAA = _datos.PLUSVALIA_CCAA;
    globalThis.COEF_IIVTNU    = _datos.COEF_IIVTNU;
    globalThis.TRAMOS_IRPF    = _datos.TRAMOS_IRPF;
  } catch (e) { /* en el navegador nunca se llega aquí */ }
}

// ------------------------------------------------------------
// Formateadores de euros para 3 avisos (líneas de "flujo de caja" y
// "ahorro recomendado"). En la WEB ya existen —los define main.js, que
// carga ANTES que este archivo en todas las páginas—, así que esta
// condición es FALSA y no se toca nada. En el SERVIDOR no existen: se
// definen aquí con el MISMO formato exacto que main.js (espacio fijo
//   antes del €) para que los textos salgan idénticos a la web.
// Se asignan a globalThis (no se declaran con const/var) para no chocar
// con los de main.js en el navegador.
// ------------------------------------------------------------
if (typeof eur === 'undefined') {
  globalThis._miles = globalThis._miles || function (e) { return e.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  globalThis.eur = function (n) {
    var neg = n < 0 ? '−' : '';
    return neg + globalThis._miles(String(Math.round(Math.abs(n)))) + ' €';
  };
  globalThis.eur2 = function (n) {
    var neg = n < 0 ? '−' : '';
    var abs = Math.abs(n).toFixed(2).split('.');
    return neg + globalThis._miles(abs[0]) + ',' + abs[1] + ' €';
  };
}

// ---------- Utilidades de cálculo (sin DOM) ----------

// Años completos entre dos fechas (para el coeficiente de plusvalía)
function coreAniosCompletos(f1, f2) {
  const d1 = new Date(f1), d2 = new Date(f2);
  let a = d2.getFullYear() - d1.getFullYear();
  const m = d2.getMonth() - d1.getMonth();
  if (m < 0 || (m === 0 && d2.getDate() < d1.getDate())) a--;
  return Math.max(0, a);
}

// IRPF sobre la ganancia patrimonial (base del ahorro, tramos estatales)
function coreCalcIRPF(g) {
  if (g <= 0) return 0;
  let r = g, c = 0, p = 0;
  for (const t of TRAMOS_IRPF) {
    const x = Math.min(r, t.hasta - p);
    if (x <= 0) break;
    c += x * t.tipo; r -= x; p = t.hasta;
  }
  return c;
}

// Cuota mensual — sistema francés. Si el tipo es 0, reparto lineal.
function coreCuota(capital, plazoAnios, tinPct) {
  const i = tinPct / 100 / 12;
  const n = plazoAnios * 12;
  if (n <= 0) return 0;
  return i > 0 ? capital * i / (1 - Math.pow(1 + i, -n)) : capital / n;
}

// Gastos fijos de la compra (notaría, registro, gestoría, tasación)
// Estimaciones habituales escaladas por precio — idénticas a las de la web.
function coreGastosFijos(precio, incluyeTasacion) {
  const notaria = Math.min(1100, Math.max(650, precio * 0.0022));
  const registro = Math.min(650, Math.max(400, precio * 0.0013));
  const gestoria = 400;
  const tasacion = incluyeTasacion ? Math.min(700, Math.max(250, precio * 0.0014)) : 0;
  return { notaria, registro, gestoria, tasacion };
}

// ============================================================
// 1) COMPRA + HIPOTECA
// Reproduce EXACTAMENTE la matemática de calc-hipoteca.js.
// Entrada:
//   { precio, tipoViv:'usada'|'nueva', ccaaSlug,
//     conHipoteca, ahorro, plazo, tin, ingresos, edadRef, honorarios }
// Salida: desglose de gastos, coste total, hipoteca, LTV, cuota,
//   tasa de esfuerzo y avisos (semáforo verde/ámbar/rojo).
// ============================================================
const LIMITE_EDAD_BANCO_CORE = 75;

function coreCompra(inp) {
  const precio = +inp.precio || 0;
  const tipoViv = inp.tipoViv === 'nueva' ? 'nueva' : 'usada';
  const ccaaSlug = inp.ccaaSlug || 'madrid';
  const conHipoteca = !!inp.conHipoteca;
  const ahorro = conHipoteca ? (+inp.ahorro || 0) : 0;
  const plazo = +inp.plazo || 0;
  const tin = +inp.tin || 0;
  const ingresos = +inp.ingresos || 0;
  const deudaMes = +inp.deudaMes || 0;   // cuotas mensuales de otros préstamos/hipotecas (reducen capacidad)
  const edadRef = inp.edadRef ? +inp.edadRef : null;
  const honorarios = +inp.honorarios || 0;
  const plazoMaxEdad = edadRef ? Math.max(0, LIMITE_EDAD_BANCO_CORE - edadRef) : null;

  // 1) Impuestos según la CCAA
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

  // 2) Gastos fijos y coste total
  const g = coreGastosFijos(precio, conHipoteca);
  const gastosTotales = impuestos + g.notaria + g.registro + g.gestoria + g.tasacion;
  const costeTotal = precio + gastosTotales + honorarios;

  // 3) Hipoteca necesaria (los honorarios no los financia el banco)
  let hipoteca = 0, ltv = 0, cuota = 0, esfuerzo = null;
  if (conHipoteca) {
    const ahorroFinanciable = Math.max(0, ahorro - honorarios);
    hipoteca = Math.max(0, (precio + gastosTotales) - ahorroFinanciable);
    ltv = precio > 0 ? (hipoteca / precio) * 100 : 0;
    cuota = coreCuota(hipoteca, plazo, tin);
    // La tasa de esfuerzo suma las OTRAS cuotas mensuales (el banco cuenta toda la deuda).
    if (ingresos > 0 && cuota > 0) esfuerzo = ((cuota + deudaMes) / ingresos) * 100;
  }

  // 4) Avisos (mismo criterio que la web)
  const avisos = [];
  if (conHipoteca) {
    if (honorarios > 0 && ahorro < honorarios) {
      avisos.push({ t: 'rojo', txt: `Tu ahorro no cubre los honorarios de intermediación, que el banco no financia.` });
    }
    if (ahorro < gastosTotales + honorarios) {
      avisos.push({ t: 'rojo', txt: `Tu ahorro no cubre ni los gastos de la compra. Ningún banco financia el 100% + gastos salvo excepciones.` });
    } else if (ltv > 80) {
      const ahorroNecesario = (precio + gastosTotales + honorarios) - precio * 0.80;
      avisos.push({ t: 'ambar', txt: `Financiarías el ${ltv.toFixed(0)}%. Los bancos suelen llegar al 80%: el ahorro recomendado sería de ${eur(ahorroNecesario)} (20% + gastos).` });
    } else {
      avisos.push({ t: 'verde', txt: `Financiación del ${ltv.toFixed(0)}% — dentro del límite habitual del 80%. Operación viable a priori.` });
    }
    if (edadRef && plazo > plazoMaxEdad) {
      avisos.push({ t: 'ambar', txt: `Con ${edadRef} años, el criterio habitual "edad + plazo ≤ 75" deja un plazo orientativo de ${plazoMaxEdad} años, por debajo de los ${plazo} indicados. Varía según la entidad.` });
    }
    if (esfuerzo !== null) {
      if (esfuerzo <= 30) avisos.push({ t: 'verde', txt: `Tasa de esfuerzo ${esfuerzo.toFixed(1)}% — cómoda (por debajo del 30%).` });
      else if (esfuerzo <= 35) avisos.push({ t: 'ambar', txt: `Tasa de esfuerzo ${esfuerzo.toFixed(1)}% — justa (30-35%). Poco margen.` });
      else avisos.push({ t: 'rojo', txt: `Tasa de esfuerzo ${esfuerzo.toFixed(1)}% — excesiva (>35%). La mayoría de bancos no la aprueban.` });
    }
  }

  return {
    precio, tipoViv, ccaaNombre: datos.nombre, conHipoteca, ahorro, plazo, tin, ingresos, deudaMes,
    impuestos, impLabel, gastos: g, gastosTotales, honorarios, costeTotal,
    hipoteca, ltv, cuota, esfuerzo, edadRef, plazoMaxEdad, avisos
  };
}

// ============================================================
// 2) NETO DEL VENDEDOR
// Reproduce EXACTAMENTE la matemática de calc-vendedor.js.
// Entrada:
//   { venta, gVenta, vcTotal, vcSuelo, fVenta, ccaaSlug,
//     mayor65, reinv,
//     adquisiciones:[ { valor, gastos, fecha, pct }, ... ] }
// Salida: plusvalía municipal, ganancia IRPF, IRPF, neto y avisos.
// ============================================================
function coreNetoVendedor(inp) {
  const venta = +inp.venta || 0;
  const gVenta = +inp.gVenta || 0;
  const vcTotal = +inp.vcTotal || 0;
  const vcSuelo = +inp.vcSuelo || 0;
  const fVenta = inp.fVenta || '';
  const ccaaSlug = inp.ccaaSlug || 'madrid';
  const mayor65 = !!inp.mayor65;
  const reinv = !!inp.reinv;
  const adquisiciones = (inp.adquisiciones || []).map(t => ({
    valor: +t.valor || 0, gastos: +t.gastos || 0, fecha: t.fecha || '', pct: +t.pct || 0
  }));

  const tipoIIVTNUpct = (typeof PLUSVALIA_CCAA !== 'undefined' && PLUSVALIA_CCAA[ccaaSlug] != null)
    ? PLUSVALIA_CCAA[ccaaSlug] : 30;
  const tipoIIVTNU = Math.min(30, Math.max(0, tipoIIVTNUpct)) / 100;

  const avisos = [];
  const sumaPct = adquisiciones.reduce((s, t) => s + t.pct, 0);
  if (adquisiciones.length && Math.abs(sumaPct - 100) > 0.5) {
    avisos.push({ t: 'ambar', txt: `Los porcentajes de las adquisiciones suman ${sumaPct}%, no 100%. Revisa el reparto.` });
  }

  // 1) Plusvalía municipal por tramo (deducible en IRPF)
  let plusvalia = 0, faltanDatosPV = false;
  adquisiciones.forEach(t => {
    const share = t.pct / 100;
    const gananciaTramo = venta * share - t.valor;
    if (gananciaTramo <= 0) return;
    if (!t.fecha || !fVenta || !vcTotal || !vcSuelo) { faltanDatosPV = true; return; }
    const a = Math.min(Math.max(coreAniosCompletos(t.fecha, fVenta), 0), 20);
    const baseObjetiva = vcSuelo * share * (COEF_IIVTNU[a] ?? 0.40);
    const baseReal = gananciaTramo * (vcSuelo / vcTotal);
    plusvalia += Math.max(0, Math.min(baseObjetiva, baseReal)) * tipoIIVTNU;
  });
  if (faltanDatosPV) avisos.push({ t: 'ambar', txt: 'Faltan fechas o valores catastrales: la plusvalía municipal no está incluida en el resultado (el neto real sería algo menor).' });

  // 2) IRPF sobre la ganancia total
  const totalAdquisicion = adquisiciones.reduce((s, t) => s + t.valor + t.gastos, 0);
  const ganancia = (venta - gVenta - plusvalia) - totalAdquisicion;
  let irpf = 0, exenta = false;
  if (mayor65) { exenta = true; avisos.push({ t: 'verde', txt: 'Mayor de 65 años y vivienda habitual: la ganancia está exenta de IRPF.' }); }
  else if (reinv) { exenta = true; avisos.push({ t: 'verde', txt: 'Exención por reinversión total en vivienda habitual aplicada.' }); }
  if (!exenta) {
    if (ganancia <= 0) avisos.push({ t: 'verde', txt: 'La operación genera pérdida patrimonial: no pagas IRPF y es compensable en tu declaración.' });
    else irpf = coreCalcIRPF(ganancia);
  }

  const neto = venta - gVenta - plusvalia - irpf;

  return {
    venta, gVenta, ccaaSlug, tipoIIVTNUpct,
    plusvalia, faltanDatosPV, totalAdquisicion,
    ganancia: Math.max(0, exenta ? 0 : ganancia),
    irpf, exenta, mayor65, reinv, neto, avisos
  };
}

// ============================================================
// 3) CAPACIDAD DE COMPRA — "¿hasta qué precio puedo comprar?"
// A partir de ingresos, ahorro, edad y comunidad estima:
//   · plazo máximo (criterio edad + plazo ≤ 75, tope 30 años)
//   · hipoteca máxima por ingresos (cuota ≤ 35% de ingresos)
//   · precio máximo de compra, limitado por LO MENOR de:
//        - ingresos (vía LTV 80%)
//        - ahorro (debe cubrir entrada 20% + gastos de compra)
// Todo orientativo y no vinculante.
// Entrada: { ccaaSlug, edadRef, ahorro, ingresos, tin, ratioEsfuerzo, ltv, plazoTope }
// ============================================================
function coreCapacidadCompra(inp) {
  const ccaaSlug = inp.ccaaSlug || 'madrid';
  const edadRef = inp.edadRef ? +inp.edadRef : null;
  const ahorro = +inp.ahorro || 0;
  const ingresos = +inp.ingresos || 0;
  const deudaMes = +inp.deudaMes || 0;   // cuotas de otros préstamos/hipotecas → restan capacidad
  const tin = inp.tin != null ? +inp.tin : 3;
  const ratio = inp.ratioEsfuerzo || 0.35;   // tasa de esfuerzo máx. habitual
  const ltv = inp.ltv || 0.80;               // financiación máx. habitual
  const topePlazo = inp.plazoTope || 30;     // plazo máx. habitual en España

  const plazoMax = Math.max(5, Math.min(topePlazo, edadRef ? (75 - edadRef) : topePlazo));
  const i = tin / 100 / 12, n = plazoMax * 12;
  // La cuota máxima para la NUEVA hipoteca es el 35% de ingresos MENOS lo que ya pagas de otras deudas.
  const cuotaMax = Math.max(0, ratio * ingresos - deudaMes);
  const maxHipotecaIngresos = i > 0 ? cuotaMax * (1 - Math.pow(1 + i, -n)) / i : cuotaMax * n;

  // Ratio de gastos de compra estimado según la CCAA (impuesto + ~2,5% fijos)
  const guess = maxHipotecaIngresos / ltv || 200000;
  const d = datosITPAJD(ccaaSlug, guess);
  const gR = d.itpPct / 100 + 0.025;

  const precioPorIngresos = maxHipotecaIngresos / ltv;
  const precioPorAhorro = ahorro / ((1 - ltv) + gR); // ahorro = entrada (20%) + gastos
  const maxPrecio = Math.max(0, Math.min(precioPorIngresos, precioPorAhorro));
  const hipoteca = Math.min(maxHipotecaIngresos, ltv * maxPrecio);
  const cuota = i > 0 ? hipoteca * i / (1 - Math.pow(1 + i, -n)) : (n > 0 ? hipoteca / n : 0);
  const limita = precioPorAhorro < precioPorIngresos ? 'ahorro' : 'ingresos';

  return { plazoMax, maxHipotecaIngresos, maxPrecio, hipoteca, cuota, limita, gR, ccaaNombre: d.nombre, tin, edadRef, ingresos, ahorro, deudaMes };
}

// ------------------------------------------------------------
// Gastos de compra (impuestos + fijos) reutilizables por las
// calculadoras de inversión. Mismo criterio que coreCompra.
// ------------------------------------------------------------
function coreGastosCompra(precio, tipoViv, ccaaSlug, incluyeTasacion) {
  const d = datosITPAJD(ccaaSlug || 'madrid', precio);
  let impuestos, impLabel;
  if (tipoViv === 'nueva') {
    impuestos = precio * 0.10 + precio * (d.ajdPct / 100);
    impLabel = `IVA 10% + AJD ${d.ajdPct}% (${d.nombre})`;
  } else {
    const itpTxt = d.itpPct % 1 === 0 ? d.itpPct : d.itpPct.toFixed(2);
    impuestos = precio * (d.itpPct / 100);
    impLabel = `ITP ${itpTxt}% (${d.nombre})`;
  }
  const g = coreGastosFijos(precio, incluyeTasacion);
  const total = impuestos + g.notaria + g.registro + g.gestoria + g.tasacion;
  return { impuestos, impLabel, fijos: g, total, ccaaNombre: d.nombre };
}

// ============================================================
// 4) INVERSIÓN — COMPRAR PARA ALQUILAR (rentabilidad)
// Entrada:
//   { precio, tipoViv, ccaaSlug, reforma,
//     rentaMes, vacanciaPct,
//     ibi, comunidadMes, seguro, mantenimientoPct, gestionPct,
//     conHipoteca, entrada, tin, plazo }
// Salida: inversión total, rentabilidad bruta/neta, NOI, y si hay
//   hipoteca: cuota, cash flow y rentabilidad sobre el capital
//   aportado (cash-on-cash). Todo orientativo.
// ============================================================
function coreInversionAlquiler(inp) {
  const precio = +inp.precio || 0;
  const tipoViv = inp.tipoViv === 'nueva' ? 'nueva' : 'usada';
  const ccaaSlug = inp.ccaaSlug || 'madrid';
  const reforma = +inp.reforma || 0;
  const rentaMes = +inp.rentaMes || 0;
  const vacanciaPct = +inp.vacanciaPct || 0;
  const ibi = +inp.ibi || 0;
  const comunidadMes = +inp.comunidadMes || 0;
  const seguro = +inp.seguro || 0;
  const mantenimientoPct = +inp.mantenimientoPct || 0;
  const gestionPct = +inp.gestionPct || 0;
  const honorariosCompra = +inp.honorariosCompra || 0;
  const conHipoteca = !!inp.conHipoteca;
  const entrada = conHipoteca ? (+inp.entrada || 0) : 0;
  const tin = +inp.tin || 0;
  const plazo = +inp.plazo || 0;

  const gc = coreGastosCompra(precio, tipoViv, ccaaSlug, conHipoteca);
  const inversionTotal = precio + gc.total + honorariosCompra + reforma;

  const rentaAnualBruta = rentaMes * 12;
  const rentaAnualEfectiva = rentaAnualBruta * (1 - vacanciaPct / 100);
  const comunidadAnual = comunidadMes * 12;
  const mantenimiento = rentaAnualBruta * (mantenimientoPct / 100);
  const gestion = rentaAnualEfectiva * (gestionPct / 100);
  const gastosOperativos = ibi + comunidadAnual + seguro + mantenimiento + gestion;
  const noi = rentaAnualEfectiva - gastosOperativos;

  const rentBruta = inversionTotal > 0 ? (rentaAnualBruta / inversionTotal) * 100 : 0;
  const rentNeta = inversionTotal > 0 ? (noi / inversionTotal) * 100 : 0;

  let hipoteca = 0, ltv = 0, cuotaMes = 0, cuotaAnual = 0;
  let capitalAportado = inversionTotal, cashFlowAnual = noi, cashFlowMes = noi / 12, cashOnCash = rentNeta;
  if (conHipoteca) {
    hipoteca = Math.max(0, precio - entrada);
    ltv = precio > 0 ? (hipoteca / precio) * 100 : 0;
    cuotaMes = coreCuota(hipoteca, plazo, tin);
    cuotaAnual = cuotaMes * 12;
    capitalAportado = entrada + gc.total + honorariosCompra + reforma;
    cashFlowAnual = noi - cuotaAnual;
    cashFlowMes = cashFlowAnual / 12;
    cashOnCash = capitalAportado > 0 ? (cashFlowAnual / capitalAportado) * 100 : 0;
  }

  const avisos = [];
  if (rentNeta >= 5) avisos.push({ t: 'verde', txt: `Rentabilidad neta del ${rentNeta.toFixed(1)}% — buena para el mercado español (media ~4-5%).` });
  else if (rentNeta >= 3) avisos.push({ t: 'ambar', txt: `Rentabilidad neta del ${rentNeta.toFixed(1)}% — ajustada. Revisa precio de compra, renta o gastos.` });
  else if (inversionTotal > 0 && rentaMes > 0) avisos.push({ t: 'rojo', txt: `Rentabilidad neta del ${rentNeta.toFixed(1)}% — baja. La operación aporta poco por sí sola.` });
  if (conHipoteca && rentaMes > 0) {
    if (cashFlowMes >= 0) avisos.push({ t: 'verde', txt: `Flujo de caja positivo: te quedan ${eur2(cashFlowMes)} al mes después de pagar la hipoteca.` });
    else avisos.push({ t: 'rojo', txt: `Flujo de caja negativo: pones ${eur2(-cashFlowMes)} de tu bolsillo cada mes tras la hipoteca.` });
    if (cashOnCash > rentNeta && cashFlowMes >= 0) avisos.push({ t: 'verde', txt: `El apalancamiento eleva tu rentabilidad sobre el capital aportado al ${cashOnCash.toFixed(1)}% (cash-on-cash).` });
  }

  return {
    precio, tipoViv, ccaaNombre: gc.ccaaNombre, reforma, honorariosCompra,
    gastosCompra: gc.total, impLabel: gc.impLabel, impuestos: gc.impuestos, fijos: gc.fijos,
    inversionTotal, rentaAnualBruta, rentaAnualEfectiva, vacanciaPct,
    gastosOperativos, ibi, comunidadAnual, seguro, mantenimiento, gestion,
    noi, rentBruta, rentNeta,
    conHipoteca, hipoteca, ltv, cuotaMes, cuotaAnual, entrada, tin, plazo,
    capitalAportado, cashFlowAnual, cashFlowMes, cashOnCash, avisos
  };
}

// ============================================================
// 5) INVERSIÓN — COMPRAR PARA REFORMAR Y VENDER (flipping)
// Entrada:
//   { precioCompra, tipoViv, ccaaSlug, reforma, meses,
//     gastosTenenciaMes, precioVenta, comisionVentaPct,
//     otrosGastosVenta, conHipoteca, entrada, tin }
// Salida: inversión total, beneficio, ROI sobre capital aportado,
//   margen y ROI anualizado. Beneficio ANTES de impuestos.
// ============================================================
function coreInversionFlipping(inp) {
  const precio = +inp.precioCompra || 0;
  const tipoViv = inp.tipoViv === 'nueva' ? 'nueva' : 'usada';
  const ccaaSlug = inp.ccaaSlug || 'madrid';
  const reforma = +inp.reforma || 0;
  const honorariosCompra = +inp.honorariosCompra || 0;
  const meses = +inp.meses || 0;
  const gastosTenenciaMes = +inp.gastosTenenciaMes || 0;
  const precioVenta = +inp.precioVenta || 0;
  const honorariosVenta = +inp.honorariosVenta || 0;
  const otrosGastosVenta = +inp.otrosGastosVenta || 0;
  const conHipoteca = !!inp.conHipoteca;
  const entrada = conHipoteca ? (+inp.entrada || 0) : 0;
  const tin = +inp.tin || 0;
  const gastosFinancierosFijos = conHipoteca ? (+inp.gastosFinancierosFijos || 0) : 0; // apertura, tasación, cancelación...

  const gc = coreGastosCompra(precio, tipoViv, ccaaSlug, conHipoteca);
  const costesTenencia = gastosTenenciaMes * meses;

  let hipoteca = 0, ltv = 0, costeFinanciero = 0;
  if (conHipoteca) {
    hipoteca = Math.max(0, precio - entrada);
    ltv = precio > 0 ? (hipoteca / precio) * 100 : 0;
    costeFinanciero = hipoteca * (tin / 100) * (meses / 12); // intereses del periodo (aprox.)
  }

  const gastosVenta = honorariosVenta + otrosGastosVenta;

  // Todo lo invertido/gastado en la operación (antes de impuestos sobre la ganancia)
  const costesEntrada = precio + gc.total + honorariosCompra + reforma + costesTenencia + costeFinanciero + gastosFinancierosFijos;
  const inversionTotal = costesEntrada + gastosVenta;
  const beneficio = precioVenta - inversionTotal;

  // Capital propio aportado (los gastos de venta salen del precio de venta al final)
  const capitalAportado = conHipoteca ? (entrada + gc.total + honorariosCompra + reforma + costesTenencia + costeFinanciero + gastosFinancierosFijos) : costesEntrada;
  const roi = capitalAportado > 0 ? (beneficio / capitalAportado) * 100 : 0;
  const margen = precioVenta > 0 ? (beneficio / precioVenta) * 100 : 0;
  const roiAnualizado = meses > 0 ? roi * (12 / meses) : roi;

  const avisos = [];
  if (precioVenta > 0) {
    if (margen >= 15) avisos.push({ t: 'verde', txt: `Margen del ${margen.toFixed(1)}% sobre el precio de venta — holgado para un flipping.` });
    else if (margen >= 8) avisos.push({ t: 'ambar', txt: `Margen del ${margen.toFixed(1)}% — ajustado. Cualquier sobrecoste de obra o bajada de precio se come el beneficio.` });
    else avisos.push({ t: 'rojo', txt: `Margen del ${margen.toFixed(1)}% — muy estrecho. Alto riesgo si la obra se desvía o el mercado cae.` });
  }
  avisos.push({ t: 'ambar', txt: 'El beneficio mostrado es ANTES de impuestos. La tributación depende de tu caso (ganancia patrimonial en IRPF si es puntual, o actividad económica/Sociedades si es habitual). Consúltalo conmigo.' });

  return {
    precioCompra: precio, tipoViv, ccaaNombre: gc.ccaaNombre,
    gastosCompra: gc.total, impLabel: gc.impLabel, reforma, honorariosCompra, meses,
    costesTenencia, gastosTenenciaMes,
    conHipoteca, hipoteca, ltv, costeFinanciero, gastosFinancierosFijos, entrada, tin,
    precioVenta, honorariosVenta, otrosGastosVenta, gastosVenta,
    inversionTotal, capitalAportado, beneficio, roi, margen, roiAnualizado, avisos
  };
}

// Exportar para Node / Worker sin romper el uso en navegador.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { coreCuota, coreCompra, coreNetoVendedor, coreCapacidadCompra, coreGastosFijos, coreGastosCompra, coreCalcIRPF, coreAniosCompletos, coreInversionAlquiler, coreInversionFlipping };
  // Además, en servidor las funciones NO son globales (en el navegador sí, por
  // ser scripts sueltos). kitty-guion.js las usa como globales, así que aquí
  // las publicamos también en globalThis para que el guión funcione igual.
  for (var _k in module.exports) globalThis[_k] = module.exports[_k];
}
