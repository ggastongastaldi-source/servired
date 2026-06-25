'use strict';
const express  = require('express');
const QRCode   = require('qrcode');
const router   = express.Router();
const Commerce = require('../models/Commerce');
const BASE_URL = process.env.BASE_URL || 'https://servired.online';
const { trackEvent } = require('../services/trackEvent');

// POST /api/commerce/register
router.post('/register', async (req, res) => {
  try {
    const { nombre, email, telefono, rubro, direccion, localidad, zona } = req.body;
    if (!nombre || !email || !rubro || !direccion || !localidad) {
      return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' });
    }

    const commerce = await Commerce.create({
      nombre, email, telefono, rubro, direccion, localidad,
      zona: zona || 'GBA',
    });

    // Generar QR que apunta al landing del comercio
    const qrUrl = `${BASE_URL}/?ref=COMERCIO_${commerce._id}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#00E5FF', light: '#0a0e1a' },
    });

    commerce.qr_code     = qrDataUrl;
    commerce.origin_qr_id = String(commerce._id);
    await commerce.save();
    try {
      const rtmil = require('../../../services/rtmilIngest');
      rtmil.ingest({ type: 'COMMERCE_REGISTERED', actorId: commerce._id.toString(), zoneId: commerce.localidad || null, payload: { nombre: commerce.nombre, rubro: commerce.rubro } }).catch(() => {});
    } catch (_) {}

    console.log(`[Commerce] ✅ Registrado: ${nombre} | ${localidad} | id:${commerce._id}`);

    res.json({
      ok: true,
      commerce_id: commerce._id,
      qr_url:      qrUrl,
      qr_image:    qrDataUrl,
      mensaje:     `Comercio ${nombre} registrado correctamente`,
    });
  } catch (e) {
    console.error('[Commerce] Error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/commerce/:id/qr — devuelve el QR como imagen PNG
router.get('/:id/qr', async (req, res) => {
  try {
    const commerce = await Commerce.findById(req.params.id).lean();
    if (!commerce) return res.status(404).json({ ok: false, error: 'Comercio no encontrado' });

    const qrUrl = `${BASE_URL}/?ref=COMERCIO_${commerce._id}`;
    const qrBuffer = await QRCode.toBuffer(qrUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#00E5FF', light: '#0a0e1a' },
    });

    res.set('Content-Type', 'image/png');
    res.send(qrBuffer);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/commerce — listar comercios activos
router.get('/', async (req, res) => {
  try {
    const { localidad, rubro } = req.query;
    const filter = { active: true };
    if (localidad) filter.localidad = localidad;
    if (rubro)     filter.rubro = rubro;
    const commerces = await Commerce.find(filter).select('-qr_code').lean();
    res.json({ ok: true, total: commerces.length, commerces });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


// GET /api/commerce/feed — boosted primero, luego orgánico
router.get('/feed', async (req, res) => {
  try {
    const { getCommerceFeed } = require('../../../services/commerceFeed');
    const { locality, rubro } = req.query;
    const filter = {};
    if (locality) filter.localidad = locality;
    if (rubro) filter.rubro = new RegExp(rubro, 'i');
    const comercios = await getCommerceFeed(filter, 20);
    res.json({ ok: true, comercios });
  } catch(e) {
    console.error('[commerce/feed] Error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
