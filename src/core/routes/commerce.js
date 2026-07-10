'use strict';
const express   = require('express');
const QRCode    = require('qrcode');
const bcrypt    = require('bcryptjs');
const mongoose  = require('mongoose');
const router    = express.Router();
const Commerce  = require('../models/Commerce');
const Usuario   = require('../models/Usuario');
const BusinessProfile = require('../../../models/BusinessProfile');
const { RUBROS } = require('../../../shared/catalogs/rubrosCatalog');
const BASE_URL  = process.env.BASE_URL || 'https://servired.online';
const { trackEvent } = require('../services/trackEvent');

function normalizarTexto(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function resolverRubroId(rubroInput) {
  if (!rubroInput) return null;
  const input = normalizarTexto(rubroInput);
  const match = RUBROS.find(r =>
    normalizarTexto(r.id) === input ||
    normalizarTexto(r.nombre || '') === input
  );
  return match ? match.id : null;
}

// POST /api/commerce/register
router.post('/register', async (req, res) => {
  const { nombre, email, telefono, rubro, direccion, localidad, zona, password } = req.body;
  if (!nombre || !email || !rubro || !direccion || !localidad || !password) {
    return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const emailNormalizado = email.trim().toLowerCase();
  const rubroId = resolverRubroId(rubro);
  if (!rubroId) {
    return res.status(400).json({ ok: false, error: `Rubro "${rubro}" no reconocido en el catálogo` });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const existente = await Usuario.findOne({ email: emailNormalizado }).session(session);
    if (existente) {
      await session.abortTransaction();
      return res.status(409).json({ ok: false, error: 'Ya existe una cuenta con ese email' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [usuario] = await Usuario.create([{
      nombre,
      email: emailNormalizado,
      password: hash,
      rol: 'COMERCIO',
      roles: ['COMERCIO'],
      provider: 'local',
      estado: 'ACTIVO'
    }], { session });

    const [commerce] = await Commerce.create([{
      nombre, email: emailNormalizado, telefono, rubro, direccion, localidad,
      zona: zona || 'GBA',
    }], { session });

    const [businessProfile] = await BusinessProfile.create([{
      usuarioId: usuario._id,
      commerceId: commerce._id,
      nombreComercial: nombre,
      rubroId,
      direccion,
      localidad,
      estado: 'DRAFT'
    }], { session });

    // Generar QR que apunta al landing del comercio
    const qrUrl = `${BASE_URL}/?ref=COMERCIO_${commerce._id}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#00E5FF', light: '#0a0e1a' },
    });

    commerce.qr_code      = qrDataUrl;
    commerce.origin_qr_id = String(commerce._id);
    await commerce.save({ session });

    await session.commitTransaction();

    try {
      const { emitEvent } = require('../../../nexus/events/emitEvent');
      emitEvent({
        entityType: 'merchant',
        type: 'MERCHANT_PROFILE_CREATED',
        aggregateId: String(businessProfile._id),
        payload: {
          merchantId: String(businessProfile._id),
          usuarioId: String(usuario._id),
          rubroId: businessProfile.rubroId,
        },
      });
    } catch (e) {
      console.warn('[Commerce] Nexus emitEvent falló (no crítico):', e.message);
    }

    try {
      const rtmil = require('../../../services/rtmilIngest');
      try {
        const { resolveZone } = require('../../../shared/catalogs/zonesCatalog');
        const zoneId = resolveZone(commerce.localidad || commerce.zona || '');
        rtmil.ingest({ type: 'COMMERCE_REGISTERED', actorId: commerce._id.toString(), zoneId, payload: { nombre: commerce.nombre, rubro: commerce.rubro } }).catch(() => {});
      } catch (_) {}
    } catch (_) {}

    console.log(`[Commerce] ✅ Registrado: ${nombre} | ${localidad} | id:${commerce._id} | usuarioId:${usuario._id}`);

    res.json({
      ok: true,
      commerce_id: commerce._id,
      qr_url:      qrUrl,
      qr_image:    qrDataUrl,
      mensaje:     `Comercio ${nombre} registrado correctamente`,
    });
  } catch (e) {
    await session.abortTransaction();
    console.error('[Commerce] Error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  } finally {
    session.endSession();
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
