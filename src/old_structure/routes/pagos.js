const express  = require('express');
const router   = express.Router();
const { v4: uuidv4 } = require('uuid');
const { crearPreferencia, verificarPago, getPaymentDetails } = require('../services/mercadoPagoService');
const { verificarToken } = require('../middleware/auth');
const Usuario  = require('../models/Usuario');
const Payment  = require('../models/Payment');

// Outbox helper
async function outboxPush(channel, template, payload, correlationId) {
  try {
    const { enqueue } = require('../../../nexus/infrastructure/outbox');
    await enqueue({
      workflowId:   `payment_${correlationId}`,
      logicalStep:  template,
      channel,
      template,
      payload,
      correlationId,
    });
  } catch(e) {
    console.error('[pagos] Outbox error:', e.message);
  }
}

// POST /api/pagos/crear
router.post('/crear', verificarToken, async (req, res) => {
  try {
    const { pedidoId, servicio, precio, workerId } = req.body;
    if (!pedidoId || !precio) return res.json({ ok: false, error: 'Faltan datos' });
    const cliente = await Usuario.findById(req.user.id);
    if (!cliente) return res.json({ ok: false, error: 'Cliente no encontrado' });
    const result = await crearPreferencia({ pedidoId, servicio: servicio||'Servicio SERVired', precio: Math.round(precio), clienteEmail: cliente.email, workerId });
    res.json({ ok: true, ...result });
  } catch(e) {
    console.error('[pagos] Error creando preferencia:', e.message);
    res.json({ ok: false, error: e.message });
  }
});

// POST /api/pagos/webhook — idempotente
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  res.sendStatus(200); // MP requiere 200 inmediato
  try {
    let body = req.body;
    if (Buffer.isBuffer(body)) body = JSON.parse(body.toString());
    const { type, data } = body;
    if (type !== 'payment' || !data?.id) return;

    // Fetch estado oficial desde MP
    const mpData = await getPaymentDetails(data.id);
    const externalReference = mpData.external_reference;
    const mpStatus = mpData.status; // approved | rejected | cancelled | pending

    const mapped = mpStatus === 'approved' ? 'APPROVED'
                 : ['rejected','cancelled'].includes(mpStatus) ? 'REJECTED'
                 : null;

    if (!mapped) {
      console.log(`[pagos] Webhook ignorado — status: ${mpStatus}`);
      return;
    }

    // Idempotencia atómica
    const updated = await Payment.findOneAndUpdate(
      { externalReference, status: 'PENDING' },
      {
        $set: {
          status:        mapped,
          paymentId:     String(data.id),
          paymentMethod: mpData.payment_method_id,
          installments:  mpData.installments,
          rawWebhook:    mpData,
          approvedAt:    mapped === 'APPROVED' ? new Date() : undefined,
          rejectedAt:    mapped === 'REJECTED'  ? new Date() : undefined,
        }
      },
      { new: true }
    );

    if (!updated) {
      console.log(`[pagos] Webhook duplicado o no PENDING — ref:${externalReference}`);
      return;
    }

    console.log(`[pagos] ✅ Payment ${mapped} — ref:${externalReference} — $${mpData.transaction_amount}`);

    // Actualizar pedido
    if (mapped === 'APPROVED') {
      const Pedido = require('../models/Pedido');
      await Pedido.findByIdAndUpdate(externalReference, {
        estado: 'PAGADA',
        pagoId: String(data.id),
        pagoMonto: mpData.transaction_amount,
        pagoComision: updated.platformFee,
        pagoWorker:   updated.workerPayoutAmount,
      });
    }

    // Solo side effect permitido: Outbox
    await outboxPush('payment', mapped === 'APPROVED' ? 'payment_approved' : 'payment_rejected', {
      correlationId:  updated.correlationId,
      externalReference,
      paymentId:      String(data.id),
      amount:         mpData.transaction_amount,
      platformFee:    updated.platformFee,
      workerPayout:   updated.workerPayoutAmount,
      status:         mapped,
    }, updated.correlationId);

  } catch(e) {
    console.error('[pagos] Error webhook:', e.message);
  }
});

// POST /api/pagos/test — genera preferencia de prueba
router.post('/test', async (req, res) => {
  try {
    const { amount = 10000, servicio = 'plomeria', clienteEmail = 'test@servired.com', workerId } = req.body;
    const correlationId     = uuidv4();
    const externalReference = uuidv4();
    const platformFee       = Math.round(amount * 0.15);
    const workerPayoutAmount = amount - platformFee;

    const result = await crearPreferencia({
      pedidoId:     externalReference,
      servicio,
      precio:       Math.round(amount),
      clienteEmail,
      workerId:     workerId || null,
    });

    const payment = await Payment.create({
      correlationId,
      externalReference,
      preferenceId:    result.preference_id,
      amount,
      platformFee,
      workerPayoutAmount,
      currency: 'ARS',
      status:   'PENDING',
      provider: 'mercadopago',
    });

    console.log(`[pagos/test] ✅ correlationId:${correlationId} | ref:${externalReference}`);

    res.json({
      ok: true,
      correlationId,
      externalReference,
      init_point:         result.init_point,
      sandbox_init_point: result.init_point,
      platformFee,
      workerPayoutAmount,
      paymentId: payment._id,
    });
  } catch(e) {
    console.error('[pagos/test] Error:', e.message);
    res.json({ ok: false, error: e.message });
  }
});

// GET /api/pagos/estado/:pedidoId
router.get('/estado/:pedidoId', verificarToken, async (req, res) => {
  try {
    const Pedido = require('../models/Pedido');
    const pedido = await Pedido.findById(req.params.pedidoId);
    if (!pedido) return res.json({ ok: false, error: 'Pedido no encontrado' });
    res.json({ ok: true, estado: pedido.estado, monto: pedido.pagoMonto, comision: pedido.pagoComision, pago_worker: pedido.pagoWorker });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

module.exports = router;
