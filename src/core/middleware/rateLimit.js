'use strict';

/**
 * rateLimit.js — middleware Express de rate limiting por IP.
 * Closure encapsulado: el Map nunca escapa al scope del módulo.
 * Configuración: 20 req / 60s por IP.
 */
module.exports = function createRateLimiter({ limit = 20, windowMs = 60_000 } = {}) {
  const store = new Map();

  // Purga periódica — evita memory leak en procesos de larga vida
  const pruneInterval = setInterval(() => {
    const cutoff = Date.now() - windowMs * 2;
    for (const [ip, entry] of store.entries()) {
      if (entry.start < cutoff) store.delete(ip);
    }
  }, 300_000).unref(); // .unref() para no bloquear shutdown limpio

  return function rateLimitMiddleware(req, res, next) {
    const ip =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    const now = Date.now();
    const entry = store.get(ip) ?? { count: 0, start: now };

    if (now - entry.start > windowMs) {
      store.set(ip, { count: 1, start: now });
      return next();
    }

    if (entry.count >= limit) {
      return res.status(429).json({ error: 'Demasiadas consultas. Esperá un momento.' });
    }

    entry.count++;
    store.set(ip, entry);
    next();
  };
};
