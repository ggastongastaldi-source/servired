const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const SECRET = process.env.JWT_SECRET;

router.post('/registro', async (req, res) => {
  try {
    const { nombre, email, password, rol, especialidades, telefono } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ ok: false, error: 'Faltan campos' });
    const existe = await Usuario.findOne({ email });
    if (existe) return res.status(400).json({ ok: false, error: 'Email ya registrado' });
    const hash = await bcrypt.hash(password, 10);
    const u = await Usuario.create({ nombre, email, password: hash, rol: rol || 'CLIENTE', especialidades: especialidades || [], telefono: telefono || '', ubicacion: { type: 'Point', coordinates: [-58.4, -34.6] } });
    const token = jwt.sign({ id: u._id, userId: u._id, nombre: u.nombre, rol: u.rol, rubro: u.rubro, especialidades: u.especialidades, zona: u.zona }, SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token, usuario: { id: u._id, nombre: u.nombre, rol: u.rol, estado: u.estado } });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const u = await Usuario.findOne({ email });
    if (!u) return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
    const token = jwt.sign({ id: u._id, userId: u._id, nombre: u.nombre, rol: u.rol, rubro: u.rubro, especialidades: u.especialidades, zona: u.zona }, SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token, usuario: { id: u._id, nombre: u.nombre, rol: u.rol, estado: u.estado } });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
