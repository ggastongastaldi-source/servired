const express = require('express');
const router = express.Router();
const Pedido = require('../models/Pedido');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { 
  iniciarFlujoBusqueda, 
  notificarCliente,
  cancelarNotificacionesWorkers 
} = require('../controllers/notificationController');

// CREAR PEDIDO - Cliente solicita trabajo
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

    // Validar campos requeridos
    if (!tipoServicio || !zona) {
      return res.status(400).json({ 
        ok: false, 
        error: 'tipoServicio y zona son requeridos' 
      });
    }

    // Calcular presupuesto usando smartQuote
    let presupuesto = { total_estimado: 0, pago_worker: 0 };
    try {
      const sq = require('./smartQuote');
      // Simular req/res para obtener cotización
      const mockRes = {
        json: (data) => { presupuesto = data; }
      };
      await sq.stack[0].handle({ 
        body: { rubro: tipoServicio, zona, complejidad: complejidad || 'baja' } 
      }, mockRes);
    } catch(e) {
      console.log('[pedidos] Error cotizacion:', e.message);
    }

    const nuevoPedido = new Pedido({
      cliente: req.user.userId,
      tipoServicio,
      zona,
      descripcion,
      direccion,
      complejidad: complejidad || 'baja',
      precio: presupuesto.total_estimado || 0,
      total_estimado: presupuesto.total_estimado || 0,
      pago_worker: presupuesto.pago_worker || presupuesto.total_estimado * 0.8 || 0,
      estado: 'PENDIENTE',
      ubicacion: (lat && lng) ? {
        type: 'Point',
        coordinates: [lng, lat]
      } : undefined,
      fechaCreacion: new Date()
    });

    await nuevoPedido.save();

    console.log(`[PEDIDOS] Nuevo pedido creado: ${nuevoPedido._id} - ${tipoServicio} en ${zona}`);

    // 🔥 INICIAR FLUJO DE NOTIFICACIONES EN TIEMPO REAL
    // No esperamos respuesta para no demorar al cliente
    setImmediate(() => {
      iniciarFlujoBusqueda(nuevoPedido._id)
        .catch(e => console.error('[pedidos] Error en flujo:', e.message));
    });

    res.json({ 
      ok: true, 
      pedido: nuevoPedido,
      mensaje: 'Pedido recibido. Buscando especialistas disponibles...',
      tracking: {
        pedidoId: nuevoPedido._id,
        estado: 'PENDIENTE',
        proximoPaso: 'Notificando trabajadores cercanos'
      }
    });

  } catch (error) {
    console.error('[pedidos] Error creando:', error);
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
    // Buscar pedidos en estado SEARCHING del rubro del worker
    const pedidos = await Pedido.find({
      estado: { $in: ['SEARCHING', 'EXPANDING_RADIUS'] },
      tipoServicio: req.user.rubro,
      workersNotificados: req.user.userId // Solo los que le notificaron
    }).populate('cliente', 'nombre telefono');

    res.json({ ok: true, pedidos });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ACEPTAR PEDIDO (Worker vía HTTP)
router.post('/aceptar/:pedidoId', verificarToken, verificarRol('WORKER'), async (req, res) => {
  try {
    const { aceptarTrabajo } = require('../controllers/notificationController');
    const result = await aceptarTrabajo(req.params.pedidoId, req.user.userId);
    
    if (result.ok) {
      res.json({ 
        ok: true, 
        mensaje: 'Trabajo asignado correctamente',
        pedido: result.pedido
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// VER DETALLE DE PEDIDO
router.get('/:pedidoId', verificarToken, async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.pedidoId)
      .populate('cliente', 'nombre telefono')
      .populate('worker', 'nombre telefono rubro');
    
    if (!pedido) {
      return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });
    }

    // Verificar que sea el cliente o el worker asignado
    const esCliente = pedido.cliente._id.toString() === req.user.userId;
    const esWorker = pedido.worker?._id.toString() === req.user.userId;
    const esAdmin = req.user.rol === 'ADMIN';

    if (!esCliente && !esWorker && !esAdmin) {
      return res.status(403).json({ ok: false, error: 'No autorizado' });
    }

    res.json({ ok: true, pedido });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// CANCELAR PEDIDO (solo cliente y solo si no está aceptado)
router.delete('/:pedidoId', verificarToken, verificarRol('CLIENTE'), async (req, res) => {
  try {
    const pedido = await Pedido.findOne({
      _id: req.params.pedidoId,
      cliente: req.user.userId,
      estado: { $in: ['PENDIENTE', 'SEARCHING', 'EXPANDING_RADIUS'] }
    });

    if (!pedido) {
      return res.status(400).json({ 
        ok: false, 
        error: 'No se puede cancelar. El pedido ya fue aceptado o no existe.' 
      });
    }

    await Pedido.findByIdAndUpdate(req.params.pedidoId, {
      estado: 'CANCELADA',
      $push: { historialEstados: { estado: 'CANCELADA', fecha: new Date() } }
    });

    await cancelarNotificacionesWorkers(req.params.pedidoId, null);
    
    res.json({ ok: true, mensaje: 'Pedido cancelado correctamente' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
