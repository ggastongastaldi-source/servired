const BusinessProfile = require('../models/BusinessProfile');
const CatalogItem = require('../models/CatalogItem');
const { projectMerchantState } = require('../services/merchantProjection');

async function emit(tipo, payload) {
  try {
    const { emitEvent } = require('../services/sinapsisBusAdapter');
    await emitEvent(tipo, payload);
  } catch (e) {
    console.warn(`[merchant] SINAPSIS emit ${tipo} falló (no crítico):`, e.message);
  }
}

// ── PROFILE ────────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const profile = await BusinessProfile.findOne({ usuarioId: req.userId });
    res.json({ exists: !!profile, profile: profile || null });
  } catch (e) {
    console.error('[merchant] getProfile:', e);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

exports.createProfile = async (req, res) => {
  try {
    if (await BusinessProfile.findOne({ usuarioId: req.userId }))
      return res.status(409).json({ error: 'Perfil ya existe' });

    if (!req.body || Object.keys(req.body).length === 0)
      return res.status(400).json({ error: 'BODY_REQUIRED' });

    const profile = await new BusinessProfile({
      usuarioId: req.userId,
      nombreComercial: req.body.nombreComercial,
      rubroId: req.body.rubroId,
      direccion: req.body.direccion,
      localidad: req.body.localidad,
      zonaId: req.body.zonaId,
      whatsapp: req.body.whatsapp,
      estado: 'DRAFT'
    }).save();

    await emit('MERCHANT_PROFILE_CREATED', {
      merchantId: profile._id,
      usuarioId: req.userId,
      rubroId: profile.rubroId,
      zonaId: profile.zonaId
    });

    res.status(201).json({ profile });
  } catch (e) {
    console.error('[merchant] createProfile:', e);
    res.status(500).json({ error: 'Error al crear perfil' });
  }
};

// ── STUBS TEMPORALES (destraban merchantRoutes.js, NO son implementacion real) ──
// TODO: reemplazar cada uno con la logica real. Devuelven 501 a proposito
// para que sea obvio en runtime que falta implementar, en vez de fallar
// silenciosamente o inventar comportamiento.

exports.health = (req, res) => {
  res.json({ ok: true, module: 'merchant', status: 'up' });
};

exports.updateProfile = async (req, res) => {
  res.status(501).json({ error: 'updateProfile no implementado aun' });
};

exports.getDashboard = async (req, res) => {
  res.status(501).json({ error: 'getDashboard no implementado aun (ver Merchant Projection Layer)' });
};

exports.listCatalog = async (req, res) => {
  res.status(501).json({ error: 'listCatalog no implementado aun' });
};

exports.createItem = async (req, res) => {
  res.status(501).json({ error: 'createItem no implementado aun' });
};

exports.updateItem = async (req, res) => {
  res.status(501).json({ error: 'updateItem no implementado aun' });
};

exports.deleteItem = async (req, res) => {
  res.status(501).json({ error: 'deleteItem no implementado aun' });
};

exports.getAnalytics = async (req, res) => {
  res.status(501).json({ error: 'getAnalytics no implementado aun (ver Merchant Projection Layer)' });
};
