'use strict';
/**
 * rateGuard — Sybil Defense Layer (Amenaza T-1), scope por usuario autenticado.
 * In-memory, sin dependencias externas — simplicidad operativa (Regla C9).
 * Debe correr DESPUES de auth (usa req.userId; cae a req.ip si no hay).
 */
const hits = new Map();

function rateGuard({ windowMs = 15 * 60 * 1000, limit = 10 } = {}) {
  return (req, res, next) => {
    const key = req.userId || req.ip;
    const now = Date.now();
    const timestamps = (hits.get(key) || []).filter(t => now - t < windowMs);
    timestamps.push(now);
    hits.set(key, timestamps);

    if (timestamps.length > limit) {
      return res.status(429).json({
        ok: false,
        error: 'RATE_LIMITED',
        reason: 'Demasiadas solicitudes de perfil comercial. Esperá unos minutos.'
      });
    }
    next();
  };
}

module.exports = { rateGuard };
