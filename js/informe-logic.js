// ============================================================
// Motor de cálculo — Informe de simulación multiescenario
// Cruza hasta 3 aportaciones x 3 TIN x 3 plazos = hasta 27 combinaciones,
// agrupadas en una tabla por plazo (igual que el informe de referencia).
// La tabla fiscal por CCAA vive en js/datos-cabas.js (compartida con
// comprar.html) — no dupliques datos aquí.
// ============================================================

function gastosCompra(precio, ccaaSlug, tipoViv) {
  const datos = datosITPAJD(ccaaSlug, precio);
  let impuestos, impLabel;
  if (tipoViv === 'nueva') {
    impuestos = precio * 0.10 + precio * (datos.ajdPct / 100);
    impLabel = `IVA 10% + AJD ${datos.ajdPct}%`;
  } else {
    impuestos = precio * (datos.itpPct / 100);
    const itpTxt = datos.itpPct % 1 === 0 ? datos.itpPct : datos.itpPct.toFixed(2);
    impLabel = `ITP ${itpTxt}%`;
  }
  const notaria = Math.min(1100, Math.max(650, precio * 0.0022));
  const registro = Math.min(650, Math.max(400, precio * 0.0013));
  const gestoria = 400;
  const tasacion = Math.min(700, Math.max(250, precio * 0.0014));
  const total = impuestos + notaria + registro + gestoria + tasacion;
  return { impuestos, impLabel, notaria, registro, gestoria, tasacion, total, ccaaNombre: datos.nombre };
}

function calcularHonorarios(precio, cfg) {
  if (!cfg || !cfg.activo) return 0;
  if (cfg.tipo === 'fijo') return cfg.importe || 0;
  const base = precio * ((cfg.pct || 0) / 100);
  return cfg.ivaIncluido ? base : base * 1.21;
}

function cuotaFrancesa(hipoteca, tinPct, anios) {
  const i = tinPct / 100 / 12, n = anios * 12;
  if (hipoteca <= 0) return 0;
  return i > 0 ? hipoteca * i / (1 - Math.pow(1 + i, -n)) : hipoteca / n;
}

// Genera la matriz completa de escenarios: un grupo (tabla) por plazo,
// y dentro de cada grupo, una fila por combinación aportación x TIN.
const LIMITE_EDAD_BANCO = 75; // criterio general edad+plazo; algunas entidades llegan a 80

function generarEscenarios({ precio, ccaaSlug, tipoViv, ingresos, honorariosCfg, aportaciones, tins, plazos, edadRef }) {
  const gastos = gastosCompra(precio, ccaaSlug, tipoViv);
  const honorarios = calcularHonorarios(precio, honorariosCfg);
  const costeBase = precio + gastos.total; // financiable
  const costeTotal = costeBase + honorarios; // coste real de la operación
  const plazoMaxEdad = edadRef ? Math.max(0, LIMITE_EDAD_BANCO - edadRef) : null;

  // Si algún plazo pedido supera el máximo recomendado por edad, añadimos
  // automáticamente ese plazo máximo como comparativa extra — así, además
  // de avisar de que un plazo puede no estar disponible, se ve ya calculada
  // la alternativa real que sí encajaría.
  let plazosFinal = plazos.map(p => ({ plazo: p, autoAnadido: false }));
  const necesitaExtra = plazoMaxEdad !== null && plazoMaxEdad >= 5 &&
    plazos.some(p => p > plazoMaxEdad) && !plazos.includes(plazoMaxEdad);
  if (necesitaExtra) plazosFinal.push({ plazo: plazoMaxEdad, autoAnadido: true });

  const grupos = plazosFinal.map(({ plazo, autoAnadido }) => {
    const filas = [];
    aportaciones.forEach(aportacion => {
      tins.forEach(tin => {
        const ahorroFinanciable = Math.max(0, aportacion - honorarios);
        const hipoteca = Math.max(0, costeBase - ahorroFinanciable);
        const ltv = precio > 0 ? (hipoteca / precio) * 100 : 0;
        const cuota = cuotaFrancesa(hipoteca, tin, plazo);
        const interesesTotales = cuota * plazo * 12 - hipoteca;
        const esfuerzo = ingresos > 0 ? (cuota / ingresos) * 100 : null;
        filas.push({ aportacion, tin, plazo, hipoteca, ltv, cuota, interesesTotales, esfuerzo });
      });
    });
    return { plazo, filas, autoAnadido, superaEdad: !autoAnadido && plazoMaxEdad !== null && plazo > plazoMaxEdad };
  });

  // Escenario equilibrado: entre los que cumplen LTV<=80%, el de menor
  // esfuerzo (o menor LTV si no hay ingresos); si ninguno cumple, el de
  // menor LTV de todos. Si hay edad indicada, se prefieren además los
  // plazos dentro del límite habitual por edad, cuando existe alguno así.
  // Empates: menor interés total pagado.
  const todas = grupos.flatMap(g => g.filas);
  const elegibles = todas.filter(f => f.ltv <= 80);
  let pool = elegibles.length ? elegibles : todas;
  if (plazoMaxEdad !== null && pool.some(f => f.plazo <= plazoMaxEdad)) {
    pool = pool.filter(f => f.plazo <= plazoMaxEdad);
  }
  const key = f => (ingresos > 0 ? f.esfuerzo : f.ltv);
  let recomendado = pool[0];
  pool.forEach(f => {
    if (key(f) < key(recomendado) || (key(f) === key(recomendado) && f.interesesTotales < recomendado.interesesTotales)) {
      recomendado = f;
    }
  });

  return { gastos, honorarios, costeBase, costeTotal, grupos, recomendado, todas, plazoMaxEdad };
}

// Efecto de aportar más: compara la aportación más baja vs la más alta,
// con el mismo TIN y plazo del escenario recomendado.
function efectoAportarMas(resultado, aportaciones, tins) {
  if (aportaciones.length < 2) return null;
  const min = Math.min(...aportaciones), max = Math.max(...aportaciones);
  const plazo = resultado.recomendado.plazo;
  const grupo = resultado.grupos.find(g => g.plazo === plazo);
  const porTin = {};
  tins.forEach(tin => {
    const fMin = grupo.filas.find(f => f.aportacion === min && f.tin === tin);
    const fMax = grupo.filas.find(f => f.aportacion === max && f.tin === tin);
    if (fMin && fMax) porTin[tin] = { ahorro: fMin.cuota - fMax.cuota };
  });
  return { min, max, diferencia: max - min, porTin, plazo };
}

if (typeof module !== 'undefined') {
  module.exports = { DATOS_CCAA, tramosProgresivos, datosITPAJD, gastosCompra, calcularHonorarios, cuotaFrancesa, generarEscenarios, efectoAportarMas };
}
