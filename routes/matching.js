const router = require('express').Router();
const { buscar } = require('../controllers/matchingController');

router.get('/buscar', buscar);

module.exports = router;
