const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const SECRET = process.env.JWT_SECRET;
const { enviarBienvenidaWorker, enviarBienvenidaCliente } = require('../services/emailService');

router.post('/registro', async (req, res) => {
  try {
    const { nombre, email, password, rol, especialidades, telefono } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ ok: false, error: 'Faltan campos' });
    const existe = await Usuario.findOne({ email });
    const nuevoRol = rol || 'CLIENTE';

    // DUAL ROL: si ya existe, agregar el nuevo rol sin borrar el anterior
    if (existe) {
      const rolesActuales = existe.roles || [existe.rol];
      if (rolesActuales.includes(nuevoRol) && existe.rol === nuevoRol) {
        return res.status(400).json({ ok: false, error: 'Ya tenés una cuenta con ese email y rol' });
      }
      // Agregar nuevo rol y actualizar especialidades si es trabajador
      const rolesNuevos = [...new Set([...rolesActuales, nuevoRol])];
      const updateData = {
        roles: rolesNuevos,
        ...(nuevoRol === 'TRABAJADOR' ? {
          rol: 'TRABAJADOR',
          especialidades: especialidades || existe.especialidades || [],
          estado: 'PENDIENTE_VERIFICACION'
        } : {})
      };
      await Usuario.findByIdAndUpdate(existe._id, updateData);
      const uActualizado = await Usuario.findById(existe._id);
      const token = jwt.sign({ id: uActualizado._id, userId: uActualizado._id, nombre: uActualizado.nombre, rol: uActualizado.rol, rubro: uActualizado.rubro, especialidades: uActualizado.especialidades, zona: uActualizado.zona }, SECRET, { expiresIn: '7d' });
      return res.json({ ok: true, token, usuario: { id: uActualizado._id, nombre: uActualizado.nombre, rol: uActualizado.rol, estado: uActualizado.estado }, mensaje: 'Rol agregado a tu cuenta existente' });
    }

    const hash = await bcrypt.hash(password, 10);
    const estado = nuevoRol === 'TRABAJADOR' ? 'PENDIENTE_VERIFICACION' : 'ACTIVO';
    const u = await Usuario.create({ nombre, email, password: hash, rol: nuevoRol, roles: [nuevoRol], especialidades: especialidades || [], telefono: telefono || '', estado, ubicacion: { type: 'Point', coordinates: [-58.4, -34.6] } });
    const token = jwt.sign({ id: u._id, userId: u._id, nombre: u.nombre, rol: u.rol, rubro: u.rubro, especialidades: u.especialidades, zona: u.zona }, SECRET, { expiresIn: '7d' });
    // Email de bienvenida (async, no bloquea el registro)
    try {
      if (nuevoRol === 'TRABAJADOR') {
        enviarBienvenidaWorker({ nombre: u.nombre, email: u.email, especialidades: u.especialidades }).catch(()=>{});
      } else {
        enviarBienvenidaCliente({ nombre: u.nombre, email: u.email }).catch(()=>{});
      }
    } catch(e) {}
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
    // Email de bienvenida (async, no bloquea el registro)
    try {
      if (nuevoRol === 'TRABAJADOR') {
        enviarBienvenidaWorker({ nombre: u.nombre, email: u.email, especialidades: u.especialidades }).catch(()=>{});
      } else {
        enviarBienvenidaCliente({ nombre: u.nombre, email: u.email }).catch(()=>{});
      }
    } catch(e) {}
    res.json({ ok: true, token, usuario: { id: u._id, nombre: u.nombre, rol: u.rol, estado: u.estado } });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});


// Guardar suscripción push del worker
router.post('/push-subscribe', async (req, res) => {
  try {
    const { subscription, userId } = req.body;
    if (!subscription || !userId) return res.json({ ok: false, error: 'Faltan datos' });
    const Usuario = require('../models/Usuario');
    await Usuario.findByIdAndUpdate(userId, { pushSubscription: subscription });
    console.log('[Push] Suscripción guardada para:', userId);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
