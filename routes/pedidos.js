const { iniciarFlujoBusqueda, notificarCliente, cancelarNotificacionesWorkers } = require('../controllers/notificationController');
const router = require('express').Router();

router.get('/', (req, res) => res.json({ ok: true, data: [] }));
router.post('/', (req, res) => res.json({ ok: true, message: 'Pedido recibido' }));

module.exports = router;
