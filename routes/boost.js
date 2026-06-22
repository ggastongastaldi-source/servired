const express = require('express');
const router = express.Router();
const { MercadoPagoConfig, Preference } = require('mercadopago');
const Commerce = require('../src/core/models/Commerce');
const authMiddleware = require('../middleware/auth');

const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// POST /api/boost/iniciar
router.post('/iniciar', authMiddleware, async (req, res) => {
  try {
    const { commerceId } = req.body;
    if (!commerceId) return res.status(400).json({ error: 'commerceId requerido' });

    const commerce = await Commerce.findById(commerceId);
    if (!commerce) return res.status(404).json({ error: 'Comercio no encontrado' });

    const preference = new Preference(mpClient);
    const response = await preference.create({
      body: {
        items: [{
          title: `Boost Destacado 7 días – ${commerce.name || commerce.nombre || commerceId}`,
          quantity: 1,
          unit_price: 2500,
          currency_id: 'ARS'
        }],
        metadata: {
          commerceId: commerceId.toString(),
          type: 'boost'
        },
        back_urls: {
          success: `${process.env.BASE_URL || 'https://servired-6e5r.onrender.com'}/boost-success.html`,
          failure: `${process.env.BASE_URL || 'https://servired-6e5r.onrender.com'}/boost-failure.html`,
          pending: `${process.env.BASE_URL || 'https://servired-6e5r.onrender.com'}/boost-pending.html`
        },
        auto_return: 'approved',
        notification_url: `${process.env.BASE_URL || 'https://servired-6e5r.onrender.com'}/api/webhooks/mp`
      }
    });

    res.json({ init_point: response.init_point, preference_id: response.id });
  } catch (err) {
    console.error('[BOOST] Error iniciando boost:', err);
    res.status(500).json({ error: 'Error interno', detail: err.message });
  }
});

module.exports = router;
