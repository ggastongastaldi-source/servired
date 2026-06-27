'use strict';
/**
 * authMiddleware — re-exportador con adaptador de contrato.
 * 
 * src/core/middleware/auth.js seta: req.user + req.user.userId
 * merchantController y giaController esperan: req.userId
 * 
 * Este wrapper agrega req.userId para compatibilidad sin tocar el Core.
 */
const { verificarToken } = require('../src/core/middleware/auth');

const authMiddleware = (req, res, next) => {
  verificarToken(req, res, () => {
    // Adaptar req.user.userId → req.userId (contrato merchant/gia)
    if (req.user) {
      req.userId = req.user.userId || req.user.id || req.user._id;
    }
    next();
  });
};

module.exports = authMiddleware;
