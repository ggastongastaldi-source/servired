const Usuario = require('../models/Usuario');
const Pedido  = require('../models/Pedido');

// Calcular nivel de mérito según promedio
function calcularNivel(promedio) {
  if (promedio >= 4.8) return 'ELITE';
  if (promedio >= 4.2) return 'ORO';
  if (promedio >= 3.5) return 'PLATA';
  return 'BRONCE';
}

// POST /api/rating/calificar
// Body: { pedidoId, estrellas (1-5), rol: 'cliente'|'worker' }
async function calificar(req, res) {
  try {
    const { pedidoId, estrellas, rol } = req.body;
    const userId = req.user.userId || req.user.id;

    // Validar estrellas
    const stars = parseInt(estrellas);
    if (!stars || stars < 1 || stars > 5) {
      return res.json({ ok: false, error: 'Estrellas debe ser entre 1 y 5' });
    }

    // Buscar pedido
    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) return res.json({ ok: false, error: 'Pedido no encontrado' });

    // Solo calificar pedidos completados
    if (!['REALIZADA','PAGADA'].includes(pedido.estado)) {
      return res.json({ ok: false, error: 'Solo se puede calificar servicios completados' });
    }

    // ANTI DOBLE VOTO - verificar si ya calificó
    if (pedido.calificadoPor && pedido.calificadoPor.includes(userId)) {
      return res.json({ ok: false, error: 'Ya calificaste este servicio' });
    }

    // Determinar a quién se califica
    let calificadoId;
    if (rol === 'cliente') {
      // Worker califica al cliente
      if (String(pedido.workerAcepto || pedido.worker || pedido.trabajador) !== String(userId)) {
        return res.json({ ok: false, error: 'No sos el worker de este pedido' });
      }
      calificadoId = pedido.cliente;
      await Pedido.findByIdAndUpdate(pedidoId, {
        calificacionWorker: stars,
        $push: { calificadoPor: userId }
      });
    } else {
      // Cliente califica al worker
      if (String(pedido.cliente) !== String(userId)) {
        return res.json({ ok: false, error: 'No sos el cliente de este pedido' });
      }
      calificadoId = pedido.workerAcepto || pedido.worker || pedido.trabajador;
      await Pedido.findByIdAndUpdate(pedidoId, {
        calificacionCliente: stars,
        fechaCalificacion: new Date(),
        $push: { calificadoPor: userId }
      });
    }

    if (!calificadoId) {
      return res.json({ ok: false, error: 'No se encontro el usuario a calificar' });
    }

    // Recalcular promedio del calificado
    const usuario = await Usuario.findById(calificadoId);
    if (!usuario) return res.json({ ok: false, error: 'Usuario no encontrado' });

    const nuevoPuntTotal = (usuario.puntuacionTotal || 0) + stars;
    const nuevoCantVotos = (usuario.cantidadVotos || 0) + 1;
    const nuevoPromedio  = parseFloat((nuevoPuntTotal / nuevoCantVotos).toFixed(2));
    const nuevoNivel     = calcularNivel(nuevoPromedio);

    // HOOK DE ALERTA - promedio bajo 3 estrellas
    const alertaRevision = nuevoPromedio < 3;
    if (alertaRevision) {
      console.warn(`[MERITOCRACIA] ALERTA: ${usuario.nombre} bajó a ${nuevoPromedio} estrellas - revisión requerida`);
      // Emitir alerta a admins via socket
      if (global.io) {
        global.io.to('admins').emit('alerta_worker', {
          workerId: calificadoId,
          nombre: usuario.nombre,
          promedio: nuevoPromedio,
          mensaje: 'Promedio bajo 3 estrellas - requiere revisión'
        });
      }
    }

    await Usuario.findByIdAndUpdate(calificadoId, {
      puntuacionTotal:   nuevoPuntTotal,
      cantidadVotos:     nuevoCantVotos,
      promedioEstrellas: nuevoPromedio,
      calificacion:      nuevoPromedio, // compatibilidad legacy
      nivelMerito:       nuevoNivel,
      alertaRevision:    alertaRevision,
      totalTrabajos:     (usuario.totalTrabajos || 0) + (rol !== 'cliente' ? 1 : 0)
    });

    console.log(`[MERITOCRACIA] ${usuario.nombre}: ${nuevoPromedio}★ (${nuevoCantVotos} votos) - ${nuevoNivel}`);

    res.json({
      ok: true,
      mensaje: 'Calificacion registrada',
      promedio: nuevoPromedio,
      nivel: nuevoNivel,
      votos: nuevoCantVotos,
      alertaRevision
    });

  } catch(e) {
    console.error('[MERITOCRACIA] Error:', e.message);
    res.json({ ok: false, error: e.message });
  }
}

// GET /api/rating/worker/:workerId
async function obtenerRating(req, res) {
  try {
    const u = await Usuario.findById(req.params.workerId)
      .select('nombre promedioEstrellas cantidadVotos nivelMerito totalTrabajos alertaRevision')
      .lean();
    if (!u) return res.json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, ...u });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
}

// GET /api/rating/ranking - top workers
async function ranking(req, res) {
  try {
    const workers = await Usuario.find({
      rol: { $in: ['TRABAJADOR', 'WORKER'] },
      cantidadVotos: { $gt: 0 }
    })
    .select('nombre rubro promedioEstrellas cantidadVotos nivelMerito totalTrabajos')
    .sort({ promedioEstrellas: -1, cantidadVotos: -1 })
    .limit(20)
    .lean();
    res.json({ ok: true, ranking: workers });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
}

module.exports = { calificar, obtenerRating, ranking };
