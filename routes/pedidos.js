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
      const precios = {
        plomeria: 180000, electricidad: 180000, domestica: 35000,
        pintura: 220000, gasista: 220000, cerrajeria: 45000,
        camaras: 250000, alarmas: 220000, albanileria: 250000
      };
      total_estimado = precios[tipoServicio] || 100000;
      pago_worker = Math.round(total_estimado * 0.8);
    } catch(e) {}

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

    await nuevoPedido.save();
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

module.exports = router;
