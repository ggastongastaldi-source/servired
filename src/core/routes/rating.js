const express = require('express');
const router  = express.Router();
const { verificarToken } = require('../middleware/auth');
const { calificar, obtenerRating, ranking } = require('../controllers/meritocraciaController');

router.post('/calificar',         verificarToken, calificar);
router.get('/worker/:workerId',   obtenerRating);
router.get('/ranking',            ranking);

module.exports = router;
