'use strict';
/**
 * legalComplianceGate — Middleware de cumplimiento legal.
 *
 * Bloquea el acceso a rutas protegidas si el usuario tiene
 * documentos obligatorios pendientes de aceptar.
 *
 * Uso:
 *   router.post('/pedidos', authMiddleware, legalComplianceGate, handler)
 *
 * El cliente recibe 403 con la lista de documentos pendientes,
 * para que el frontend pueda mostrar el flujo de aceptación.
 */
const { checkUserCompliance } = require('../models/UserConsent');

async function legalComplianceGate(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    const role   = req.user?.role || req.user?.actorRole || 'cliente';

    if (!userId) return res.status(401).json({ ok: false, error: 'No autenticado' });

    const { ok, pending } = await checkUserCompliance(userId, role);
    if (ok) return next();

    return res.status(403).json({
      ok:    false,
      code:  'LEGAL_COMPLIANCE_REQUIRED',
      message: 'Debés aceptar los documentos legales actualizados para continuar.',
      pending: pending.map(d => ({ type: d.type, version: d.version, title: d.title })),
    });
  } catch (err) {
    console.error('[legalComplianceGate]', err.message);
    next(); // fail-open: ante error técnico, no bloqueamos al usuario
  }
}

module.exports = legalComplianceGate;
