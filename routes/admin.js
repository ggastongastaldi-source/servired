const router = require('express').Router();
const Usuario = require('../models/Usuario');

router.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await Usuario.find({}).select('-password').sort({ createdAt: -1 });
    res.json({ ok: true, usuarios });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.patch('/usuario/:id', async (req, res) => {
  try {
    const u = await Usuario.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    res.json({ ok: true, usuario: u });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
