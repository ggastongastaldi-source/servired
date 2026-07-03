'use strict';
/**
 * schemaWhitelist — Input Non-Trust enforcement (Principio P-2, Constitución v1.2).
 * No sanitiza: DESCARTA cualquier campo no autorizado antes de que el body
 * llegue al controller. Nunca hace merge de objetos no definidos.
 *
 * Uso como middleware de ruta: whitelistBody(CAMPOS_PERMITIDOS)
 */
function whitelistBody(allowedFields) {
  return (req, res, next) => {
    const body = req.body || {};
    const filtered = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) filtered[key] = body[key];
    }
    req.body = filtered;
    next();
  };
}

// Whitelist de BusinessProfile — según models/BusinessProfile.js
// Campos PROTEGIDOS que nunca deben venir del cliente:
// usuarioId, commerceId, estado, verificado, verificadoEn,
// metricas, creadoEn, actualizadoEn, _id, __v
const BUSINESS_PROFILE_FIELDS = [
  'nombreComercial',
  'razonSocial',
  'cuit',
  'rubroId',
  'direccion',
  'localidad',
  'zonaId',
  'geo',
  'horarios',
  'logo',
  'banner',
  'galeria',
  'whatsapp',
  'website',
  'instagram'
];

module.exports = { whitelistBody, BUSINESS_PROFILE_FIELDS };
