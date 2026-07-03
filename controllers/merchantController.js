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
