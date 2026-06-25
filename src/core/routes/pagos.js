const { registrarEventoEspejo } = require('../services/pagoMirrorService');
const express  = require('express');
const router   = express.Router();
const { v4: uuidv4 } = require('uuid');
const { crearPreferencia, verificarPago, getPaymentDetails } = require('../services/mercadoPagoService');
const { capturePayment, releaseWorkerFunds, withdrawWorkerFunds } = require('../services/financeEngine');
const FinancialTransaction = require('../models/FinancialTransaction');
const mongoose = require('mongoose');
const { verificarToken } = require('../middleware/auth');
const Usuario  = require('../models/Usuario');
const Payment  = require('../models/Payment');
const { trackEvent } = require('../services/trackEvent');

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


    // ── BOOST handler (idempotente) — va ANTES del Payment lookup ──────────
    const metadata = mpData.metadata || {};
    if (metadata.type === 'boost' && metadata.commerceId) {
      const Commerce = require('../models/Commerce');
      const paymentId = String(data.id);
      if (mpData.status !== 'approved') {
        console.log('[BOOST] Pago no aprobado, ignorado — status:', mpData.status);
        return;
      }
      const commerce = await Commerce.findById(metadata.commerceId);
      if (!commerce) {
        console.warn('[BOOST] Comercio no encontrado:', metadata.commerceId);
        return;
      }
      if (commerce.boost_payment_id === paymentId) {
        console.log('[BOOST] Webhook duplicado ignorado — paymentId:', paymentId);
        return;
      }
      const boostExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await Commerce.findByIdAndUpdate(metadata.commerceId, {
        is_boosted: true,
        boost_expires_at: boostExpiry,
        boost_payment_id: paymentId
      });
      console.log('[BOOST] ✅ Comercio', metadata.commerceId, 'boosted hasta', boostExpiry);
      try {
        const rtmil = require('../../../services/rtmilIngest');
        rtmil.ingest({ type: 'BOOST_PURCHASED', actorId: metadata.commerceId, zoneId: null, payload: { paymentId, boostExpiry } }).catch(() => {});
      } catch (_) {}
      trackEvent('boost_paid', { actorId: metadata.commerceId, meta: { paymentId, boostExpiry } });
      return;
    }
    // ── FIN BOOST handler ───────────────────────────────────────────────────

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
      { returnDocument: 'after' }
    );

    if (!updated) {
      console.log(`[pagos] Webhook duplicado o no PENDING — ref:${externalReference}`);
      return;
    }

    console.log(`[pagos] ✅ Payment ${mapped} — ref:${externalReference} — $${mpData.transaction_amount}`);
    try {
      const rtmil = require('../../../services/rtmilIngest');
      rtmil.ingest({ type: 'PAYMENT_CONFIRMED', actorId: externalReference || null, zoneId: null, payload: { mapped, amount: mpData.transaction_amount, paymentId } }).catch(() => {});
    } catch (_) {}

    // Actualizar pedido
    if (mapped === 'APPROVED') {
      const Pedido = require('../models/Pedido');
      registrarEventoEspejo(externalReference, { tipo:'WEBHOOK_'+mapped, fromState:'PROCESSING', toState:'PAID', eventoTimestamp: new Date() }).catch(()=>{});

      // ── Transacción ACID unificada: sesión única compartida ───────────────
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        // 1. Capture — E11000 = duplicado, rollback limpio
        const captured = await capturePayment({
          provider:                'mercadopago',
          provider_transaction_id: String(data.id),
          order_id:                externalReference,
          amount:                  mpData.transaction_amount,
        }, session);

        if (captured.reason === 'DUPLICATE_REQUEST_IGNORED') {
          await session.abortTransaction();
          session.endSession();
          console.log('[pagos] ℹ️ Webhook duplicado ignorado — payment:', data.id);
          return;
        }

        // 2. Release inmediato usando la misma sesión — lee FT recién creado
        await releaseWorkerFunds({ transaction_id: captured.transaction_id }, session);

        // 3. Actualizar pedido — misma sesión
        await Pedido.findOneAndUpdate(
          { _id: externalReference, payment_status: { $nin: ['RELEASED'] } },
          {
            estado:         'CERRADA',
            payment_status: 'RELEASED',
            pagoId:         String(data.id),
            pagoMonto:      mpData.transaction_amount,
            pagoComision:   captured.platformFee,
            pagoWorker:     captured.workerPayout,
            liberadoAt:     new Date(),
          },
          { session }
        );

        await session.commitTransaction();
        session.endSession();
        console.log('[pagos] ✅ Pago ACID completo — order:', externalReference, '| txn:', captured.transaction_id);

      } catch(acidErr) {
        await session.abortTransaction();
        session.endSession();
        console.error('[pagos] ❌ Error ACID — rollback completo — order:', externalReference, ':', acidErr.message);
        throw acidErr; // permite reintento del webhook
      }
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



// POST /api/pagos/retiro — solicitud de retiro del trabajador
router.post('/retiro', verificarToken, async (req, res) => {
  try {
    const worker_id = req.user.id;
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.json({ ok: false, error: 'Monto invalido' });

    const worker = await Usuario.findById(worker_id);
    if (!worker || !worker.roles.includes('TRABAJADOR')) {
      return res.json({ ok: false, error: 'Solo trabajadores pueden retirar fondos' });
    }

    const result = await withdrawWorkerFunds({ worker_id, amount });

    if (!result.success) {
      return res.json({ ok: false, reason: result.reason, available: result.available, requested: result.requested });
    }

    // Leer saldo real post-transaccion — no usar valor stale pre-retiro
    const workerPost = await Usuario.findById(worker_id).select('wallet_available');
    console.log(`[pagos/retiro]  ✅ worker:${worker_id} | monto:${amount} | txn:${result.transaction_id}`);
    res.json({ ok: true, transaction_id: result.transaction_id, amount, wallet_available: workerPost?.wallet_available ?? 0 });

  } catch(e) {
    console.error('[pagos/retiro] Error:', e.message);
    res.json({ ok: false, error: e.message });
  }
});

// GET /api/pagos/wallet — saldo del trabajador autenticado
router.get('/wallet', verificarToken, async (req, res) => {
  try {
    const worker = await Usuario.findById(req.user.id).select('wallet_pending wallet_available roles nombre');
    if (!worker) return res.json({ ok: false, error: 'Usuario no encontrado' });
    res.json({ ok: true, wallet_pending: worker.wallet_pending || 0, wallet_available: worker.wallet_available || 0 });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// POST /api/pagos/boost — crea preferencia MP para Boost Destacado
router.post('/boost', async (req, res) => {
  try {
    const { commerceId, commerceEmail, commerceNombre } = req.body;
    if (!commerceId || !commerceEmail) {
      return res.status(400).json({ ok: false, error: 'commerceId y commerceEmail requeridos' });
    }
    const BOOST_PRECIO = 2500;
    const pedidoId = require('uuid').v4();
    const result = await crearPreferencia({
      pedidoId,
      servicio: 'Boost Destacado 7 días',
      precio: BOOST_PRECIO,
      clienteEmail: commerceEmail,
      workerId: null,
    });
    // Sobreescribir metadata con tipo boost
    const { MercadoPagoConfig, Preference } = require('mercadopago');
    // Guardar referencia para el webhook
    const Commerce = require('../models/Commerce');
    await Commerce.findByIdAndUpdate(commerceId, { boost_payment_id: pedidoId });
    console.log('[boost] preferencia creada para comercio', commerceId, 'ref:', pedidoId);
    res.json({ ok: true, init_point: result.init_point, pedidoId });
  } catch(e) {
    console.error('[boost] Error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
