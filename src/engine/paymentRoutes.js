const express = require('express');
const router  = express.Router();
const { emitJobEvent } = require('./eventEngine');
const mongoose = require('mongoose');

// ─── Webhook Mercado Pago ─────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  const t0 = Date.now();
  try {
    const { data, type } = req.body;
    if (type !== 'payment') return res.status(200).json({ ok: true, skipped: true });

    const mp = require('mercadopago');
    const pago = await mp.payment.get(data.id);
    const { status, external_reference, transaction_amount } = pago.body;

    if (!external_reference) {
      console.warn(JSON.stringify({ level: 'warn', source: 'MP_WEBHOOK', reason: 'SIN_REFERENCIA', paymentId: data.id }));
      return res.status(200).json({ ok: true });
    }

    const jobId = external_reference;
    const Pedido = mongoose.model('Pedido');
    const job = await Pedido.findById(jobId).select('total_estimado estado').lean();

    if (!job) {
      console.error(JSON.stringify({ level: 'error', source: 'MP_WEBHOOK', reason: 'JOB_NOT_FOUND', jobId }));
      return res.status(200).json({ ok: true });
    }

    if (status === 'approved') {
      // Validar monto congelado — NUNCA recalcular
      if (Math.abs(transaction_amount - job.total_estimado) > 1) {
        console.error(JSON.stringify({
          level: 'error', source: 'MP_WEBHOOK', reason: 'MONTO_MISMATCH',
          jobId, esperado: job.total_estimado, recibido: transaction_amount
        }));
        return res.status(200).json({ ok: true });
      }

      const io = req.app.get('io');
      const result = await emitJobEvent(jobId, {
        type:           'PAGO_APROBADO',
        source:         'MERCADO_PAGO_WEBHOOK',
        idempotencyKey: `mp:${data.id}:approved`,
        metadata:       { paymentId: data.id, monto: transaction_amount }
      }, io);

      console.log(JSON.stringify({
        level: 'info', source: 'MP_WEBHOOK', jobId,
        result: result.ok ? 'TRANSICION_OK' : result.reason,
        latencyMs: Date.now() - t0
      }));
    }

    res.status(200).json({ ok: true });

  } catch (err) {
    console.error(JSON.stringify({ level: 'error', source: 'MP_WEBHOOK', error: err.message, latencyMs: Date.now() - t0 }));
    res.status(200).json({ ok: true }); // MP requiere 200 siempre
  }
});

// ─── Estado de pago ───────────────────────────────────────────────────────────
router.get('/estado/:pedidoId', async (req, res) => {
  try {
    const Pedido = mongoose.model('Pedido');
    const job = await Pedido.findById(req.params.pedidoId)
      .select('estado snapshot timeline').lean();
    if (!job) return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
    res.json({ success: true, estado: job.estado, snapshot: job.snapshot, eventos: job.timeline.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
