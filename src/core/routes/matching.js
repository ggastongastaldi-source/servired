const router = require('express').Router();
const { buscar, listarRubros } = require('../controllers/matchingController');

router.get('/buscar',  buscar);
router.get('/rubros',  listarRubros);

module.exports = router;
