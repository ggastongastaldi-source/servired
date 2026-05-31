
// ── Push offline nueva_oportunidad ───────────────────────────
async function _pushNuevaOportunidad(workerId, pedido) {
  try {
    const webpush = require('web-push');
    const Usuario = require('./src/old_structure/models/Usuario');
    const worker = await Usuario.findById(workerId).lean();
    if (!worker?.pushSubscription) return;
    webpush.setVapidDetails(
      'mailto:admin@servired.online',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    await webpush.sendNotification(worker.pushSubscription, JSON.stringify({
      tipo:  'nueva_oportunidad',
      title: '🔔 ServiRed — Nuevo trabajo',
      body:  'Pedido de ' + (pedido?.tipoServicio||'servicio') + ' cerca tuyo. ¡Aceptalo ahora!',
      tag:   'nop_' + String(workerId),
      url:   '/trabajador.html',
    }));
  } catch(e) { /* worker sin push suscripción */ }
}

module.exports = function(ioInstance) {
const io = ioInstance;
const express = require('express');
const router = express.Router();
// Shadow RTG Monitor
let _shadowPedidos = null;
try {
  const _sp = require('path').join(__dirname, '../../../src/rtg/dist/shadow/index.js');
  _shadowPedidos = require(_sp).shadowMonitor;
} catch(_) {}
function shadowObs(event, payload) {
  try { if (_shadowPedidos) _shadowPedidos.observe(event, payload); } catch(_) {}
}



const getIO = () => io;
const Pedido = require('../models/Pedido');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { 
  iniciarFlujoBusqueda, 
  notificarCliente,
  cancelarNotificacionesWorkers 
} = require('../controllers/notificationController');

// CREAR PEDIDO - Cliente solicita trabajo

// Normalizar rubro al nombre canónico
function normalizarRubro(r) {
  if (!r) return r;
  const mapa = {
    'domestica': 'servicio_domestico',
    'doméstica': 'servicio_domestico', 
    'limpieza': 'limpieza_hogar',
    'plomero': 'plomeria',
    'electricista': 'electricidad',
    'gasista': 'gasista',
    'pintor': 'pintura',
    'albanil': 'albanileria',
    'albañil': 'albanileria',
    'cerrajero': 'cerrajeria',
  };
  return mapa[r.toLowerCase()] || r;
}

router.post('/', verificarToken, verificarRol('CLIENTE'), async (req, res) => {
  try {
    const { 
      tipoServicio, 
      zona, 
      descripcion, 
      direccion, 
      complejidad,
      lat, 
      lng 
    } = req.body;

    if (!tipoServicio || !zona) {
      return res.status(400).json({ 
        ok: false, 
        error: 'tipoServicio y zona son requeridos' 
      });
    }

    // Cotización simple si falla smartQuote
    let total_estimado = 100000;
    let pago_worker = 80000;
    
    try {
      const aladdin = require('../services/aladdinEngine');
      const calc = aladdin.calcular(tipoServicio, zona, complejidad || 'baja');
      if (calc.ok) {
        total_estimado = calc.precioCliente;
        pago_worker    = calc.pagoWorker;
      }
    } catch(e) { console.error('[Pedidos] Aladdin error:', e.message); }

    const { esProgramado, notas } = req.body;
    tipoServicio = normalizarRubro(tipoServicio);
    const nuevoPedido = new Pedido({
      cliente: req.user.userId,
      tipoServicio,
      zona,
      descripcion: descripcion || '',
      direccion: direccion || '',
      complejidad: complejidad || 'baja',
      precio: total_estimado,
      total_estimado: total_estimado,
      pago_worker: pago_worker,
      estado: 'PENDIENTE',
      ubicacion: (lat && lng) ? {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)]
      } : {
        type: 'Point',
        coordinates: [-58.4, -34.6]
      },
      fechaCreacion: new Date()
    });

    const pedidoGuardado = await nuevoPedido.save();
  // SINAPSIS AUDIT MODE
  const { auditOrder } = require('../../sinapsis/auditMode');
  auditOrder(pedidoGuardado.toObject(), 'servired.pedidos.route').catch(e => console.error('[SINAPSIS]', e.message));
    console.log('[PEDIDOS] io disponible:', !!io, '— pedido:', tipoServicio, zona);
    if (io) {
      const payload = {
        pedidoId: pedidoGuardado._id,
        tipoServicio,
        zona,
        descripcion: descripcion || '',
        direccion: direccion || '',
        total_estimado,
        pago_worker
      };
      timelineRegistrar(io, nuevoPedido._id, 'EMITIDO', 'cliente',
        '📋 Pedido emitido — buscando profesional disponible',
        { tipoServicio, zona, clienteId: String(req.user.id) }
      ).catch(()=>{});
      io.to('rubro_' + tipoServicio).emit('nueva_oportunidad', payload);
      io.to('zona_' + zona).emit('nueva_oportunidad', payload);
      shadowObs('nueva_oportunidad', { tipoServicio, zona, pedidoId: nuevoPedido._id });
      console.log('[Socket] nueva_oportunidad emitida:', tipoServicio, zona);
    }
    console.log(`[PEDIDOS] Creado: ${nuevoPedido._id} - ${tipoServicio} en ${zona}`);

    // Iniciar flujo de notificaciones (no bloqueante)
    setImmediate(() => {
      iniciarFlujoBusqueda(nuevoPedido._id)
        .catch(e => console.error('[pedidos] Error flujo:', e.message));
    });

    res.json({ 
      ok: true, 
      pedido: nuevoPedido,
      mensaje: 'Pedido recibido. Buscando especialistas...'
    });

  } catch (error) {
    console.error('[pedidos] Error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// OBTENER MIS PEDIDOS (Cliente)
router.get('/mis-pedidos', verificarToken, verificarRol('CLIENTE'), async (req, res) => {
  try {
    const pedidos = await Pedido.find({ cliente: req.user.userId })
      .sort({ fechaCreacion: -1 })
      .populate('worker', 'nombre telefono rubro calificacion');
    
    res.json({ ok: true, pedidos });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// OBTENER PEDIDOS DISPONIBLES (Worker)
router.get('/disponibles', verificarToken, verificarRol('WORKER'), async (req, res) => {
  try {
    const pedidos = await Pedido.find({
      estado: { $in: ['SEARCHING', 'EXPANDING_RADIUS'] },
      tipoServicio: req.user.rubro || req.user.especialidad || 'general',
      workersNotificados: req.user.userId
    }).populate('cliente', 'nombre telefono');

    res.json({ ok: true, pedidos });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ACEPTAR PEDIDO (Worker HTTP)
router.post('/aceptar/:pedidoId', verificarToken, verificarRol('WORKER'), async (req, res) => {
  try {
    const { aceptarTrabajo } = require('../controllers/notificationController');
    const result = await aceptarTrabajo(req.params.pedidoId, req.user.userId);
    
    if (result.ok) {
      res.json({ ok: true, mensaje: 'Trabajo asignado', pedido: result.pedido });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// CANCELAR PEDIDO
router.delete('/:pedidoId', verificarToken, verificarRol('CLIENTE'), async (req, res) => {
  try {
    const pedido = await Pedido.findOne({
      _id: req.params.pedidoId,
      cliente: req.user.userId,
      estado: { $in: ['PENDIENTE', 'SEARCHING', 'EXPANDING_RADIUS'] }
    });

    if (!pedido) {
      return res.status(400).json({ ok: false, error: 'No se puede cancelar' });
    }

    await Pedido.findByIdAndUpdate(req.params.pedidoId, {
      estado: 'CANCELADA',
      $push: { historialEstados: { estado: 'CANCELADA', fecha: new Date() } }
    });

    await cancelarNotificacionesWorkers(req.params.pedidoId, null);
    
    res.json({ ok: true, mensaje: 'Pedido cancelado' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});


// CLIENTE ACEPTA AUMENTO DEL 10%
router.post('/:pedidoId/aceptar-aumento', verificarToken, verificarRol('CLIENTE'), async (req, res) => {
  try {
    const { detenerFlujo } = require('../controllers/notificationController');
    const pedido = await Pedido.findOne({
      _id: req.params.pedidoId,
      cliente: req.user.userId,
      estado: 'EXPANDING_RADIUS'
    });
    
    if (!pedido) {
      return res.status(400).json({ ok: false, error: 'Pedido no disponible para aumento' });
    }
    
    const nuevoTotal = Math.round(pedido.total_estimado * 1.10);
    const nuevoPagoWorker = Math.round(nuevoTotal * 0.8);
    
    await Pedido.findByIdAndUpdate(req.params.pedidoId, {
      total_estimado: nuevoTotal,
      pago_worker: nuevoPagoWorker,
      'metadata.aumentoAceptado': true,
      'metadata.aumentoPct': 10,
      $push: { historialEstados: { estado: 'PRESUPUESTO_AUMENTADO', fecha: new Date() } }
    });
    
    // Detener flujo actual y reiniciar con prioridad
    detenerFlujo(req.params.pedidoId);
    
    // Reiniciar búsqueda inmediata con prioridad
    const { iniciarFlujoBusqueda } = require('../controllers/notificationController');
    setImmediate(() => iniciarFlujoBusqueda(req.params.pedidoId));
    
    res.json({ 
      ok: true, 
      mensaje: 'Presupuesto aumentado. Buscando con prioridad...',
      nuevoTotal,
      nuevoPagoWorker
    });
    
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});


return router;
};
// FIX: Definición de setIO agregada

