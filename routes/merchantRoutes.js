const express = require('express');
const router  = express.Router();
const mc      = require('../controllers/merchantController');
const auth    = require('../middleware/authMiddleware');
const { whitelistBody, BUSINESS_PROFILE_FIELDS, CATALOG_ITEM_FIELDS } = require('../middleware/schemaWhitelist');
const { rateGuard } = require('../middleware/rateGuard');

// Security Kernel — Input Non-Trust (P-2) + Sybil Defense (T-1)
// aplicado sobre las rutas que escriben BusinessProfile.
const guardProfileWrite = [rateGuard({ windowMs: 15 * 60 * 1000, limit: 10 }), whitelistBody(BUSINESS_PROFILE_FIELDS)];
// Mismo principio P-2 aplicado a CatalogItem — antes estas rutas no
// filtraban el body en absoluto.
const guardCatalogWrite = [rateGuard({ windowMs: 15 * 60 * 1000, limit: 30 }), whitelistBody(CATALOG_ITEM_FIELDS)];

// Health
router.get('/health', mc.health);

// Profile
router.get ('/profile', auth, mc.getProfile);
router.post ('/profile', auth, ...guardProfileWrite, mc.createProfile);
router.patch('/profile', auth, ...guardProfileWrite, mc.updateProfile);

// Dashboard (projection)
router.get('/dashboard', auth, mc.getDashboard);

// Catalog CRUD
router.get   ('/catalog',           auth, mc.listCatalog);
router.post  ('/catalog',           auth, ...guardCatalogWrite, mc.createItem);
router.patch ('/catalog/:itemId',   auth, ...guardCatalogWrite, mc.updateItem);
router.delete('/catalog/:itemId',   auth, mc.deleteItem);

// Analytics
router.get('/analytics', auth, mc.getAnalytics);

// Admin: reconstrucción forzada de proyecciones (requiere auth)
router.post('/admin/reconstruct', auth, async (req, res) => {
  try {
    const { reconstruirTodos } = require('../services/merchantProjectionReactor');
    const result = await reconstruirTodos();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
