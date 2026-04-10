const router = require('express').Router();

router.get('/buscar', (req, res) => res.json({ ok: true, trabajadores: [] }));

module.exports = router;
