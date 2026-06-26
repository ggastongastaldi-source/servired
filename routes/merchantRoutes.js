const express = require('express');
const router  = express.Router();
const mc      = require('../controllers/merchantController');
const auth    = require('../middleware/authMiddleware');

// Health
router.get('/health', mc.health);

// Profile
router.get ('/profile', auth, mc.getProfile);
router.post ('/profile', auth, mc.createProfile);
router.patch('/profile', auth, mc.updateProfile);

// Dashboard (projection)
router.get('/dashboard', auth, mc.getDashboard);

// Catalog CRUD
router.get   ('/catalog',           auth, mc.listCatalog);
router.post  ('/catalog',           auth, mc.createItem);
router.patch ('/catalog/:itemId',   auth, mc.updateItem);
router.delete('/catalog/:itemId',   auth, mc.deleteItem);

// Analytics
router.get('/analytics', auth, mc.getAnalytics);

module.exports = router;
