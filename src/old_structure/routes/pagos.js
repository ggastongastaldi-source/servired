const express = require('express');
const router = express.Router();
const { crearPreferencia, verificarPago } = require('../services/mercadoPagoService');
const { verificarToken } = require('../middleware/auth');
const Usuario = require('../models/Usuario');

// POST /api/pagos/crear — cliente inicia pago de un pedido
router.post('/crear', verificarToken, async (req, res) => {
  try {
    const { pedidoId, servicio, precio, workerId } = req.body;
    if (!pedidoId || !precio) return res.json({ ok: false, error: 'Faltan datos' });

    const cliente = await Usuario.findById(req.user.id);
    if (!cliente) return res.json({ ok: false, error: 'Cliente no encontrado' });

    const result = await crearPreferencia({
      pedidoId,
      servicio: servicio || 'Servicio SERVired',
      precio:   Math.round(precio),
      clienteEmail: cliente.email,
      workerId,
    });

    res.json({ ok: true, ...result });
  } catch(e) {
    console.error('[pagos] Error creando preferencia:', e.message);
    res.json({ ok: false, error: e.message });
  }
});

// POST /api/pagos/webhook — MP notifica pagos
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const { type, data } = req.body;
    if (type === 'payment' && data?.id) {
      const pago = await verificarPago(data.id);
      console.log(`[pagos] Webhook: ${pago.status} — $${pago.monto} — ref:${pago.referencia}`);

      if (pago.status === 'approved') {
        // Actualizar estado del pedido a PAGADA
        const Pedido = require('../models/Pedido');
        await Pedido.findByIdAndUpdate(pago.referencia, {
          estado: 'PAGADA',
          pagoId: data.id,
          pagoMonto: pago.monto,
          pagoComision: pago.metadata?.comision || Math.round(pago.monto * 0.20),
          pagoWorker: pago.metadata?.pago_worker || Math.round(pago.monto * 0.80),
        });
        console.log(`[pagos] ✅ Pedido ${pago.referencia} marcado PAGADA`);
      }
    }
    res.sendStatus(200);
  } catch(e) {
    console.error('[pagos] Error webhook:', e.message);
    res.sendStatus(200); // Siempre 200 a MP
  }
});

// GET /api/pagos/estado/:pedidoId
router.get('/estado/:pedidoId', verificarToken, async (req, res) => {
  try {
    const Pedido = require('../models/Pedido');
    const pedido = await Pedido.findById(req.params.pedidoId);
    if (!pedido) return res.json({ ok: false, error: 'Pedido no encontrado' });
    res.json({
      ok: true,
      estado: pedido.estado,
      monto: pedido.pagoMonto,
      comision: pedido.pagoComision,
      pago_worker: pedido.pagoWorker,
    });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

module.exports = router;
