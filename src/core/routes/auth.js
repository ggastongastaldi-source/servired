const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const SECRET = process.env.JWT_SECRET;
const { enviarBienvenidaWorker, enviarBienvenidaCliente } = require('../services/emailService');
const Referido = require('../../models/Referido');
const { router: eventRouter } = require('../../../shared/events/router-instance');
const { emitRegisterCompleted, emitLeadAttributed } = require('../../../shared/events/referral-events');

async function registrarOrigenAtribucion(userId, rol, origin_ref) {
  if (!origin_ref) return;
  try {
    const campo = rol === 'TRABAJADOR' ? 'worker_origin_ref' : 'client_origin_ref';
    await Usuario.findByIdAndUpdate(userId, { [campo]: origin_ref });
    const inc = { 'stats.registros': 1 };
    if (rol === 'TRABAJADOR') inc['stats.workers'] = 1; else inc['stats.clientes'] = 1;
    await Referido.findOneAndUpdate({ ref_code: origin_ref.toUpperCase() }, { $inc: inc });
  } catch (e) {
    console.error('[Atribucion] error:', e.message);
  }
}

async function emitBusEventsForRegistro(params) {
  try {
    const actor = { user_id: String(params.userId), role: params.rol };
    const context = { source: 'auth' };

    const registerEvt = emitRegisterCompleted({
      correlationId: params.correlationId,
      causation: params.causation,
      actor: actor,
      context: context,
      payload: { email: params.email, rol: params.rol }
    });
    const persistedRegister = await eventRouter.publish(registerEvt);

    if (params.origin_ref) {
      const leadEvt = emitLeadAttributed({
        correlationId: persistedRegister.event.correlation_id,
        causation: {
          event_id: persistedRegister.event.event_id,
          event_type: persistedRegister.event.event_type
        },
        actor: actor,
        context: context,
        payload: { origin_ref: params.origin_ref, rol: params.rol }
      });
      await eventRouter.publish(leadEvt);
    }
  } catch (e) {
    console.error('[EventBus] registro error:', e.message);
  }
}

router.post('/registro', async (req, res) => {
  try {
    const { nombre, email, password, rol, especialidades, telefono, origin_ref, correlationId, causation } = req.body;
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
      registrarOrigenAtribucion(existe._id, nuevoRol, origin_ref).catch(()=>{});
      emitBusEventsForRegistro({ userId: existe._id, rol: nuevoRol, email, origin_ref, correlationId, causation }).catch(()=>{});
      const uActualizado = await Usuario.findById(existe._id);
      const token = jwt.sign({ id: uActualizado._id, userId: uActualizado._id, nombre: uActualizado.nombre, rol: uActualizado.rol, rubro: uActualizado.rubro, especialidades: uActualizado.especialidades, zona: uActualizado.zona }, SECRET, { expiresIn: '7d' });
      return res.json({ ok: true, token, usuario: { id: uActualizado._id, nombre: uActualizado.nombre, rol: uActualizado.rol, estado: uActualizado.estado }, mensaje: 'Rol agregado a tu cuenta existente' });
    }

    const hash = await bcrypt.hash(password, 10);
    const estado = nuevoRol === 'TRABAJADOR' ? 'PENDIENTE_VERIFICACION' : 'ACTIVO';
    const u = await Usuario.create({ nombre, email, password: hash, rol: nuevoRol, roles: [nuevoRol], especialidades: especialidades || [], telefono: telefono || '', estado, ubicacion: { type: 'Point', coordinates: [-58.4, -34.6] } });
    registrarOrigenAtribucion(u._id, nuevoRol, origin_ref).catch(()=>{});
    emitBusEventsForRegistro({ userId: u._id, rol: nuevoRol, email, origin_ref, correlationId, causation }).catch(()=>{});
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
    const identifier = (email || '').trim();
    const u = await Usuario.findOne({ $or: [{ email: identifier }, { telefono: identifier }] });
    if (!u) return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
    const token = jwt.sign({ id: u._id, userId: u._id, nombre: u.nombre, rol: u.rol, rubro: u.rubro, especialidades: u.especialidades, zona: u.zona }, SECRET, { expiresIn: '7d' });
    // Email de bienvenida (async, no bloquea el registro)
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


// ── RECUPERACIÓN DE CONTRASEÑA ──
const crypto = require('crypto');
const resetTokens = new Map(); // token -> { userId, expira }

router.post('/recuperar', async (req, res) => {
  try {
    const identifier = (req.body.identifier || '').trim();
    if (!identifier) return res.status(400).json({ ok: false, error: 'Ingresá tu email o teléfono' });
    const u = await Usuario.findOne({ $or: [{ email: identifier }, { telefono: identifier }] });
    // Siempre responder igual para no revelar si existe o no
    if (!u || !u.email) return res.json({ ok: true, mensaje: 'Si tu cuenta existe, vas a recibir un email con instrucciones.' });
    // Generar token único de 1 hora
    const token = crypto.randomBytes(32).toString('hex');
    resetTokens.set(token, { userId: u._id.toString(), expira: Date.now() + 3600000 });
    const link = `${process.env.BASE_URL || 'https://servired-6e5r.onrender.com'}/reset-password.html?token=${token}`;
    const { enviarEmailRecuperacion } = require('../services/emailService');
    await enviarEmailRecuperacion({ nombre: u.nombre, email: u.email, link });
    res.json({ ok: true, mensaje: 'Si tu cuenta existe, vas a recibir un email con instrucciones.' });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 6) return res.status(400).json({ ok: false, error: 'Datos inválidos' });
    const datos = resetTokens.get(token);
    if (!datos || Date.now() > datos.expira) return res.status(400).json({ ok: false, error: 'El link expiró o es inválido' });
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);
    await Usuario.findByIdAndUpdate(datos.userId, { password: hash });
    resetTokens.delete(token);
    res.json({ ok: true, mensaje: 'Contraseña actualizada. Ya podés ingresar.' });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});


// POST /api/auth/refresh — renueva token sin re-login
router.post('/refresh', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.json({ ok: false, error: 'Token requerido' });
    const jwt = require('jsonwebtoken');
    // Verificar con el secret actual
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch(e) {
      // Token expirado o inválido — buscar usuario por id si viene en el body
      const { userId, email } = req.body;
      if (!userId && !email) return res.json({ ok: false, error: 'Token inválido' });
      const Usuario = require('../models/Usuario');
      const u = userId 
        ? await Usuario.findById(userId).lean()
        : await Usuario.findOne({ email }).lean();
      if (!u) return res.json({ ok: false, error: 'Usuario no encontrado' });
      payload = { userId: u._id, rol: u.rol, nombre: u.nombre, 
                  especialidades: u.especialidades, zona: u.zona };
    }
    // Emitir nuevo token con 30 días
    const newToken = require('jsonwebtoken').sign(
      { userId: payload.userId, rol: payload.rol, nombre: payload.nombre,
        especialidades: payload.especialidades, zona: payload.zona },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ ok: true, token: newToken });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});


// ── GOOGLE SIGN-IN ──────────────────────────────────────────
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  try {
    const { id_token } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name: nombre, picture: avatar, email_verified } = payload;

    let u = await Usuario.findOne({ $or: [{ googleId }, { email }] });

    if (u) {
      // Usuario existente: actualizar googleId si vino por email
      if (!u.googleId) {
        await Usuario.findByIdAndUpdate(u._id, { googleId, avatar, provider: "google", emailVerified: !!email_verified });
        u = await Usuario.findById(u._id);
      }
    } else {
      // Usuario nuevo
      u = await Usuario.create({
        nombre,
        email,
        googleId,
        avatar,
        provider: 'google',
        rol: 'CLIENTE',
        roles: ['CLIENTE'],
        estado: 'ACTIVO'
      });
      // Email bienvenida async
      try { enviarBienvenidaCliente({ nombre: u.nombre, email: u.email }).catch(()=>{}); } catch(e) {}
    }

    const token = jwt.sign(
      { id: u._id, userId: u._id, nombre: u.nombre, rol: u.rol, rubro: u.rubro, especialidades: u.especialidades, zona: u.zona },
      SECRET,
      { expiresIn: '7d' }
    );

    const needsOnboarding = !u.rol || u.estado === "PENDIENTE_VERIFICACION";
    res.json({ ok: true, token, usuario: { id: u._id, nombre: u.nombre, rol: u.rol, estado: u.estado, avatar: u.avatar }, needsOnboarding });
  } catch(e) {
    console.error('[Google Auth]', e.message);
    res.status(401).json({ ok: false, error: 'Token de Google inválido' });
  }
});


router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return res.status(401).json({ ok: false, error: "Token requerido" });
    const jwt = require("jsonwebtoken");
    let payload;
    try { payload = jwt.verify(token, process.env.JWT_SECRET); } catch(e) { return res.status(401).json({ ok: false, error: "Token invalido" }); }
    const u = await Usuario.findById(payload.id || payload.userId).lean();
    if (!u) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });
    const fields = ["nombre","email","rol"].filter(f => u[f]).length;
    const optional = ["rubro","telefono","direccion"].filter(f => u[f]).length;
    const profileCompletion = parseFloat(Math.min(1, (fields/3)*0.6 + (optional/3)*0.4).toFixed(2));
    let state = "APP_READY";
    if (u.estado === "BLOQUEADO") state = "BLOQUEADO";
    else if (!u.rol) state = "NUEVO";
    else if (profileCompletion < 1) state = "INCOMPLETO";
    res.json({ ok: true, snapshot: { userId: u._id, state, role: u.rol||null, profileCompletion, needsOnboarding: state==="NUEVO"||state==="INCOMPLETO", onboardingStep: state==="APP_READY"?null:(u.onboardingStep||"rol"), avatar: u.avatar||null, nombre: u.nombre, lastTransitionAt: u.updatedAt?new Date(u.updatedAt).getTime():Date.now() }});
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
