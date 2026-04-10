// ============================================
// ALADÍN v3.0 - Motor de Precios SERVired
// Indexado al Combo Big Mac ARS (anti-inflación)
// ============================================

const COMBO_BIG_MAC_ARS = 8000;

const ESPECIALIDADES = {
  plomeria:           { mult: 2.5, label: 'Plomería' },
  electricidad:       { mult: 2.8, label: 'Electricidad' },
  gasista:            { mult: 3.0, label: 'Gasista Matriculado' },
  albanileria:        { mult: 2.2, label: 'Albañilería' },
  pintura:            { mult: 1.8, label: 'Pintura' },
  servicio_domestico: { mult: 1.5, label: 'Servicio Doméstico' },
  jardineria:         { mult: 1.4, label: 'Jardinería' },
  mudanza:            { mult: 2.0, label: 'Mudanza' },
};

const ZONAS = {
  CABA:      1.00,
  GBA_NORTE: 0.95,
  GBA_SUR:   0.85,
  GBA_OESTE: 0.88,
};

const COMPLEJIDAD = {
  basico:     1.0,
  intermedio: 1.4,
  complejo:   2.0,
};

function calcularPresupuesto(rubroId, complejidad, { zona = 'CABA', horas = 1 } = {}) {
  const esp  = ESPECIALIDADES[rubroId];
  if (!esp) throw new Error(`Rubro desconocido: ${rubroId}`);

  const multEsp  = esp.mult;
  const multZona = ZONAS[zona]        || 0.90;
  const multComp = COMPLEJIDAD[complejidad] || 1.0;

  const precioTotal       = Math.round(COMBO_BIG_MAC_ARS * multEsp * multZona * multComp * horas);
  const comisionMinima    = Math.round(precioTotal * 0.10);
  const comisionEstandar  = Math.round(precioTotal * 0.20);
  const comision          = Math.max(comisionEstandar, comisionMinima);
  const pagoTrabajador    = precioTotal - comision;

  return {
    rubro:           esp.label,
    zona,
    complejidad,
    horas,
    precio_total:    precioTotal,
    comision:        comision,
    pago_trabajador: pagoTrabajador,
    big_mac_base:    COMBO_BIG_MAC_ARS,
    detalle: { multEsp, multZona, multComp },
  };
}

function validarComision(precioTotal) {
  return Math.max(precioTotal * 0.20, precioTotal * 0.10);
}

module.exports = { calcularPresupuesto, validarComision, ESPECIALIDADES, ZONAS };
