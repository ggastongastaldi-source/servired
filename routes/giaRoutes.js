'use strict';

const express = require('express');
const router  = express.Router();
const gia     = require('../controllers/giaController');
const auth    = require('../middleware/authMiddleware');

router.get('/health',            gia.health);
router.get('/priority',          gia.getPriorityAction);
router.get('/priority/personal', auth, gia.getPriorityAction);

module.exports = router;
