'use strict';
const ZONAS = {
  CABA: 1.20, GBA: 1.10, ROSARIO: 1.05, CORDOBA: 1.05,
  MENDOZA: 1.05, MAR_DEL_PLATA: 1.05, default: 1.00,
};
const COMPLEJIDAD = { baja: 1.0, media: 1.4, alta: 1.8 };
const MARGEN_PLATAFORMA = 1.20;
const PORCENTAJE_WORKER = 0.80;
module.exports = { ZONAS, COMPLEJIDAD, MARGEN_PLATAFORMA, PORCENTAJE_WORKER };
