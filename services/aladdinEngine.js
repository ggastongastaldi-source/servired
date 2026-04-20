const RUBROS = {
  servicio_domestico:    { precio: 8000,   unidad: "hora",     label: "Servicio Domestico",      minHoras: 4 },
  pintura:               { precio: 80000,  unidad: "jornada",  label: "Pintura" },
  aire_acondicionado:    { precio: 120000, unidad: "unidad",   label: "Aire Acondicionado" },
  electricidad:          { precio: 70000,  unidad: "visita",   label: "Electricista" },
  plomeria:              { precio: 70000,  unidad: "visita",   label: "Plomeria" },
  gasista:               { precio: 85000,  unidad: "visita",   label: "Gasista Matriculado" },
  albanileria:           { precio: 80000,  unidad: "jornada",  label: "Albanileria" },
  techista:              { precio: 110000, unidad: "visita",   label: "Techista / Filtraciones" },
  cerrajeria:            { precio: 50000,  unidad: "visita",   label: "Cerrajeria" },
  jardineria:            { precio: 35000,  unidad: "visita",   label: "Jardineria" },
  piletas:               { precio: 45000,  unidad: "visita",   label: "Mantenimiento Piletas" },
  herreria:              { precio: 75000,  unidad: "visita",   label: "Herreria / Soldadura" },
  carpinteria:           { precio: 70000,  unidad: "visita",   label: "Carpinteria" },
  durlock:               { precio: 85000,  unidad: "jornada",  label: "Durlock / Steel Frame" },
  fletes:                { precio: 45000,  unidad: "viaje",    label: "Fletes / Mudanzas" },
  mecanica:              { precio: 70000,  unidad: "visita",   label: "Mecanica Ligera" },
  gomeria:               { precio: 40000,  unidad: "auxilio",  label: "Gomeria" },
  tecnico_pc:            { precio: 55000,  unidad: "visita",   label: "Tecnico PC / Redes" },
  camaras:               { precio: 65000,  unidad: "punto",    label: "Camaras / Alarmas" },
  electrodomesticos:     { precio: 50000,  unidad: "visita",   label: "Rep. Electrodomesticos" },
  fumigacion:            { precio: 60000,  unidad: "visita",   label: "Fumigacion / Plagas" },
  peluqueria_canina:     { precio: 25000,  unidad: "servicio", label: "Peluqueria Canina" },
  paseador:              { precio: 15000,  unidad: "semana",   label: "Paseador de Perros" },
  vidriera:              { precio: 60000,  unidad: "visita",   label: "Vidriera" },
  tapiceria:             { precio: 65000,  unidad: "visita",   label: "Tapiceria" },
  hormigon:              { precio: 95000,  unidad: "jornada",  label: "Hormigon Armado" },
  ascensores:            { precio: 90000,  unidad: "visita",   label: "Ascensores / Bombas" },
  decoracion:            { precio: 70000,  unidad: "visita",   label: "Decoracion / Drywall" },
  limpieza_alfombras:    { precio: 45000,  unidad: "visita",   label: "Limpieza de Alfombras" },
};

// Multiplicadores por zona - toda la Argentina
// Filosofia: precio digno en todo el pais, sin penalizar el interior
const ZONAS = {
  CABA:            1.20,  // Capital Federal
  GBA:             1.10,  // Gran Buenos Aires
  ROSARIO:         1.05,  // Rosario
  CORDOBA:         1.05,  // Cordoba capital
  MENDOZA:         1.05,  // Mendoza capital
  MAR_DEL_PLATA:   1.05,  // Mar del Plata
  TUCUMAN:         1.00,
  SALTA:           1.00,
  NEUQUEN:         1.00,
  BARILOCHE:       1.00,
  INTERIOR:        1.00,  // Resto del interior
  default:         1.00,  // Cualquier localidad
};

// Multiplicadores por complejidad
const COMPLEJIDAD = {
  baja:   1.0,
  media:  1.4,
  alta:   1.8,
};

function calcular(tipoServicio, zona, complejidad, horas) {
  const rubro = RUBROS[tipoServicio];
  if (!rubro) return { ok: false, error: "Rubro no encontrado: " + tipoServicio };

  const zonaKey = (zona || "").toUpperCase().replace(/ /g,"_");
  const zonaMulti = ZONAS[zonaKey] || ZONAS.default;
  const compMulti = COMPLEJIDAD[complejidad] || COMPLEJIDAD.baja;

  let precioBase = rubro.precio;

  // Servicio por hora: multiplicar por cantidad de horas con minimo
  if (rubro.unidad === "hora") {
    const horasReales = Math.max(horas || rubro.minHoras || 4, rubro.minHoras || 1);
    precioBase = rubro.precio * horasReales;
  }

  const precioMercado  = Math.round(precioBase * zonaMulti * compMulti);
  const precioCliente  = Math.round(precioMercado * 1.20);
  const pagoWorker     = Math.round(precioMercado * 0.80);
  const comision       = precioCliente - pagoWorker;

  return {
    ok: true,
    tipoServicio,
    label:        rubro.label,
    unidad:       rubro.unidad,
    precioMercado,
    precioCliente,
    pagoWorker,
    comision,
    zona:         zonaKey,
    complejidad:  complejidad || "baja",
  };
}

function listarRubros() {
  return Object.entries(RUBROS).map(([id, r]) => ({
    id,
    label:     r.label,
    precioBase: r.precio,
    unidad:    r.unidad,
  }));
}

module.exports = { calcular, listarRubros, RUBROS, ZONAS };
