'use strict';
/**
 * cobroRoutes — P7 Cobro Atómico
 *
 * GET  /api/cobro/estado     → saldo disponible del worker (lectura pura)
 * POST /api/cobro/solicitar  → inicia retiro vía withdrawWorkerFunds()
 *
 * No implementa lógica financiera — delega todo a financeEngine.
 * No modifica el Ledger directamente.
 */
const express   = require('express');
const router    = express.Router();
const auth      = require('../middleware/authMiddleware');
const Usuario   = require('../models/Usuario');
const { withdrawWorkerFunds } = require('../src/core/services/financeEngine');

// ── GET /api/cobro/estado ──────────────────────────────────────────────────
// Lectura pura — expone wallet_available y wallet_pending del worker.
// GIA StateReader también lee esto para buildWorkerState().
router.get('/estado', auth, async (req, res) => {
  try {
    const worker = await Usuario.findById(req.userId)
      .select('wallet_available wallet_pending nombre')
      .lean();

    if (!worker) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

    res.json({
      ok: true,
      saldo: {
        disponible: worker.wallet_available ?? 0,
        pendiente:  worker.wallet_pending   ?? 0,
        moneda:     'ARS'
      },
      worker: { nombre: worker.nombre },
      consultadoEn: new Date().toISOString()
    });
  } catch (e) {
    console.error('[cobro] estado error:', e.message);
    res.status(500).json({ ok: false, error: 'Error al consultar saldo' });
  }
});

// ── POST /api/cobro/solicitar ──────────────────────────────────────────────
// Inicia un retiro. Delega ACID a withdrawWorkerFunds().
// Idempotencia garantizada por el Ledger (transaction_id único por operación).
router.post('/solicitar', auth, async (req, res) => {
  try {
    const { monto } = req.body;
    const workerId  = req.userId;

    // Validaciones de entrada
    if (!monto || typeof monto !== 'number' || monto <= 0) {
      return res.status(400).json({ ok: false, error: 'monto debe ser un número positivo' });
    }
    if (monto > 10_000_000) {
      return res.status(400).json({ ok: false, error: 'monto excede el límite por operación' });
    }

    const result = await withdrawWorkerFunds({ worker_id: workerId, amount: monto });

    if (!result.success) {
      // Saldo insuficiente — no es un error del servidor
      return res.status(422).json({
        ok:     false,
        reason: result.reason,
        saldo: {
          disponible: result.available ?? 0,
          solicitado: result.requested ?? monto,
          moneda:     'ARS'
        }
      });
    }

    res.json({
      ok:             true,
      transaction_id: result.transaction_id,
      monto,
      moneda:         'ARS',
      estado:         'WITHDRAWAL_INITIATED',
      mensaje:        'Transferencia solicitada. Acreditación en 24-72hs hábiles.',
      solicitadoEn:   new Date().toISOString()
    });

  } catch (e) {
    console.error('[cobro] solicitar error:', e.message);
    res.status(500).json({ ok: false, error: 'Error al procesar retiro' });
  }
});

// ── GET /api/cobro/health ──────────────────────────────────────────────────
router.get('/health', (_req, res) => res.json({
  status: 'OK', module: 'cobro', ts: new Date().toISOString()
}));

module.exports = router;
