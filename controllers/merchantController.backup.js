const BusinessProfile      = require('../models/BusinessProfile');
const CatalogItem          = require('../models/CatalogItem');
const { projectMerchantState } = require('../services/merchantProjection');

// ── Emit helper (no falla si SINAPSIS no está disponible) ──────────────────
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

    const profile = await new BusinessProfile({ usuarioId: req.userId, ...req.body, estado: 'DRAFT' }).save();
    await emit('MERCHANT_PROFILE_CREATED', { merchantId: profile._id, usuarioId: req.userId, rubroId: profile.rubroId, zonaId: profile.zonaId });
    res.status(201).json({ profile });
  } catch (e) {
    console.error('[merchant] createProfile:', e);
    res.status(500).json({ error: 'Error al crear perfil' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    ['usuarioId','creadoEn'].forEach(c => delete req.body[c]);
    const profile = await BusinessProfile.findOneAndUpdate(
      { usuarioId: req.userId }, { $set: req.body }, { new: true, runValidators: true }
    );
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });
    await emit('MERCHANT_PROFILE_UPDATED', { merchantId: profile._id, usuarioId: req.userId });
    res.json({ profile });
  } catch (e) {
    console.error('[merchant] updateProfile:', e);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
};

// ── DASHBOARD (usa Projection) ─────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const state = await projectMerchantState(req.userId);
    if (!state) return res.status(404).json({ error: 'Perfil no encontrado. Completá el registro.' });
    res.json(state);
  } catch (e) {
    console.error('[merchant] getDashboard:', e);
    res.status(500).json({ error: 'Error al calcular dashboard' });
  }
};

// ── CATALOG CRUD ───────────────────────────────────────────────────────────
exports.listCatalog = async (req, res) => {
  try {
    const profile = await BusinessProfile.findOne({ usuarioId: req.userId });
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });
    const { estado = 'ACTIVO', page = 1, limit = 20 } = req.query;
    const items = await CatalogItem.find({ merchantId: profile._id, ...(estado !== 'TODOS' ? { estado } : {}) })
      .sort({ creadoEn: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    const total = await CatalogItem.countDocuments({ merchantId: profile._id });
    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (e) {
    console.error('[merchant] listCatalog:', e);
    res.status(500).json({ error: 'Error al obtener catálogo' });
  }
};

exports.createItem = async (req, res) => {
  try {
    const profile = await BusinessProfile.findOne({ usuarioId: req.userId });
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });
    if (!req.body.nombre || req.body.precioARS == null)
      return res.status(400).json({ error: 'nombre y precioARS son obligatorios' });

    const item = await new CatalogItem({
      ...req.body,
      merchantId: profile._id,
      usuarioId:  req.userId
    }).save();

    await emit('CATALOG_ITEM_CREATED', { merchantId: profile._id, itemId: item._id, nombre: item.nombre, precioARS: item.precioARS });
    res.status(201).json({ item });
  } catch (e) {
    console.error('[merchant] createItem:', e);
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const profile = await BusinessProfile.findOne({ usuarioId: req.userId });
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });
    ['merchantId','usuarioId','creadoEn'].forEach(c => delete req.body[c]);

    const item = await CatalogItem.findOneAndUpdate(
      { _id: req.params.itemId, merchantId: profile._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ error: 'Producto no encontrado' });
    await emit('CATALOG_ITEM_UPDATED', { merchantId: profile._id, itemId: item._id });
    res.json({ item });
  } catch (e) {
    console.error('[merchant] updateItem:', e);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const profile = await BusinessProfile.findOne({ usuarioId: req.userId });
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });
    // Soft delete — nunca borrar del Event Store
    const item = await CatalogItem.findOneAndUpdate(
      { _id: req.params.itemId, merchantId: profile._id },
      { $set: { estado: 'BORRADOR', disponible: false } },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Producto no encontrado' });
    await emit('CATALOG_ITEM_REMOVED', { merchantId: profile._id, itemId: item._id });
    res.json({ ok: true, itemId: item._id });
  } catch (e) {
    console.error('[merchant] deleteItem:', e);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};

// ── ANALYTICS (derivado de Projection) ────────────────────────────────────
exports.getAnalytics = async (req, res) => {
  try {
    const state = await projectMerchantState(req.userId);
    if (!state) return res.status(404).json({ error: 'Perfil no encontrado' });
    res.json({
      topProductos:   state.catalogo.topProductos,
      tendencia:      state.tendencia,
      conversion:     state.campanias.conversionRate,
      vistasHoy:      state.actividad.vistasHoy,
      zonaId:         state.zonaId,
      proyectadoEn:   state.proyectadoEn
    });
  } catch (e) {
    console.error('[merchant] getAnalytics:', e);
    res.status(500).json({ error: 'Error al obtener analytics' });
  }
};

// ── HEALTH ─────────────────────────────────────────────────────────────────
exports.health = (_req, res) => res.json({ status: 'OK', module: 'merchant', ts: new Date().toISOString() });
