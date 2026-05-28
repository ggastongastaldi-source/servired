const Pedido = require('../models/Pedido');
const Usuario = require('../models/Usuario');

const CONFIG = {
  RADIO_INICIAL_KM: 5,
  RADIO_MAXIMO_KM: 50,
  INTERVALO_EXPANSION_MS: 30000,
};

const flujosActivos = new Map();

async function buscarWorkersDisponibles(rubro, zona, lat, lng) {
  const rubroNorm = (rubro || '').toString().toLowerCase().trim();
  console.log(`[BUSCAR] Rubro: "${rubroNorm}" | Zona: ${zona} | Coords: ${lat},${lng}`);

  const query = {
    rol: { $in: ['TRABAJADOR', 'WORKER'] },
    // disponible:true puede estar ausente en muchos docs — lo hacemos flexible
    $or: [
      { disponible: true },
      { disponible: { $exists: false } },
      { isOnline: true }
    ]
  };

  // Filtro de rubro flexible
  if (rubroNorm) {
    query.$and = [{
      $or: [
        { rubro: { $regex: rubroNorm, $options: 'i' } },
        { especialidades: { $regex: rubroNorm, $options: 'i' } },
        { tiposServicio: { $regex: rubroNorm, $options: 'i' } }
      ]
    }];
  }

  const workers = await Usuario.find(query).limit(20);
  console.log(`[BUSCAR] Workers encontrados: ${workers.length}`);
  workers.forEach(w => console.log(`   - ${w.nombre} | rubro: ${w.rubro} | disponible: ${w.disponible}`));

  // Debug extra: si sigue en 0, logueamos qué hay en la DB
  if (workers.length === 0) {
    const total = await Usuario.countDocuments({ rol: { $in: ['TRABAJADOR', 'WORKER'] } });
    const conDisp = await Usuario.countDocuments({ rol: { $in: ['TRABAJADOR', 'WORKER'] }, disponible: true });
    console.log(`[BUSCAR] DEBUG - Total workers en DB: ${total} | Con disponible:true: ${conDisp}`);
    // Mostrar sample de lo que hay
    const sample = await Usuario.find({ rol: { $in: ['TRABAJADOR', 'WORKER'] } })
      .select('nombre rubro disponible isOnline estado')
      .limit(5);
    sample.forEach(w => console.log(`   SAMPLE: ${w.nombre} | ${w.rubro} | disponible:${w.disponible} | estado:${w.estado}`));
  }

  return workers;
}

async function iniciarFlujoBusqueda(pedidoId) {
  try {
    const pedido = await Pedido.findById(pedidoId).populate('cliente');
    if (!pedido) { console.log(`[FLUJO] Pedido ${pedidoId} no encontrado`); return; }

    console.log(`[FLUJO] Iniciando: ${pedido.tipoServicio} en ${pedido.zona}`);

    const lat = pedido.ubicacion?.coordinates?.[1];
    const lng = pedido.ubicacion?.coordinates?.[0];

    const workers = await buscarWorkersDisponibles(pedido.tipoServicio, pedido.zona, lat, lng);
    const io = global.io;

    if (workers.length === 0) {
      console.log(`[FLUJO] ❌ Sin workers disponibles`);
      if (io) {
        io.to('pedido_' + pedido._id).emit('estado_pedido', {
          fase: 'SIN_WORKERS',
          titulo: 'Sin especialistas disponibles',
          mensaje: 'No hay trabajadores de este rubro conectados ahora'
        });
      }
      return;
    }

    // ── NEXUS AUCTION ENGINE — reemplaza broadcast por subasta ──
    const auctionResult = await buscarYSubastarWorkers({
      ...pedido.toObject ? pedido.toObject() : pedido,
      lat, lng,
      tipoServicio: pedido.tipoServicio,
      zona: pedido.zona,
    }, io);

    let notificados = 0;
    if (auctionResult) {
      // Registrar workers notificados en DB
      const notifiedIds = [
        auctionResult.winner?.workerId,
        auctionResult.secondary?.workerId,
        ...auctionResult.backup.map(b => b.workerId),
      ].filter(Boolean);

      for (const wId of notifiedIds) {
        await Pedido.findByIdAndUpdate(pedidoId, {
          $addToSet: { workersNotificados: wId }
        });
        notificados++;
      }

      console.log(`[AuctionEngine] 📊 Winner: ${auctionResult.winner?.nombre||'ninguno'} | Notificados: ${notificados}`);
    
    // Push notifications para workers sin socket activo
    try {
      const Usuario = require('../models/Usuario');
      const allBids = auctionResult.bids.filter(b => b.action !== 'IGNORE');
      for (const bid of allBids) {
        const w = await Usuario.findById(bid.workerId).select('pushSubscription nombre').lean();
        if (w?.pushSubscription) {
          const tipo = bid.action === 'HARD_DISPATCH' ? 'HARD_DISPATCH' : 'SOFT_OFFER';
          await enviarPushWorker(w.pushSubscription, {
            title: tipo === 'HARD_DISPATCH' ? '🔔 ¡Nuevo trabajo para vos!' : '💼 Trabajo disponible cerca',
            body: `${pedido.tipoServicio?.replace(/_/g,' ')} en ${pedido.zona || 'tu zona'} — $${(pedido.total_estimado||0).toLocaleString('es-AR')}`,
            url: '/trabajador.html',
            tipo,
            pedidoId: String(pedido._id),
            vibrate: tipo === 'HARD_DISPATCH' ? [300,100,300,100,300] : [100],
          });
        }
      }
    } catch(pushErr) {
      console.error('[Push] Error enviando notificaciones:', pushErr.message);
    }
    } else {
      // Fallback al broadcast original si la subasta falla
      for (const worker of workers) {
        const payload = {
          pedidoId: pedido._id,
          tipoServicio: pedido.tipoServicio,
          zona: pedido.zona,
          precio: pedido.total_estimado,
          pagoWorker: pedido.pago_worker,
          descripcion: pedido.descripcion,
          direccion: pedido.direccion,
          expiraEn: 300,
          tipo: 'BROADCAST_FALLBACK',
        };
        if (io) {
          io.to('worker_' + worker._id).emit('nueva_oportunidad', payload);
          // Fallback por rubro y zona (igual que cancelación)
          io.to('rubro_' + pedido.tipoServicio).emit('nueva_oportunidad', payload);
          io.to('zona_' + pedido.zona).emit('nueva_oportunidad', payload);
          console.log('[EMIT] nueva_oportunidad → worker_'+worker._id+' + rubro_'+pedido.tipoServicio+' + zona_'+pedido.zona);
        }
        notificados++;
        await Pedido.findByIdAndUpdate(pedidoId, {
          $addToSet: { workersNotificados: worker._id }
        });
      }
      console.log(`[AuctionEngine] ⚠️ Fallback broadcast: ${notificados} workers`);
    }

    await Pedido.findByIdAndUpdate(pedidoId, { estado: 'SEARCHING' });
    console.log(`[FLUJO] ✅ Notificados ${notificados} workers`);

    if (io) {
      io.to('pedido_' + pedido._id).emit('estado_pedido', {
        fase: 'SEARCHING',
        titulo: 'Buscando especialista',
        mensaje: `Hay ${notificados} trabajadores disponibles`
      });
    }

  } catch (error) {
    console.error(`[FLUJO] Error:`, error);
  }
}

function detenerFlujo(pedidoId) {
  const flujo = flujosActivos.get(pedidoId);
  if (flujo) {
    clearInterval(flujo.timerId);
    flujosActivos.delete(pedidoId);
    console.log(`[FSM] Flujo detenido: ${pedidoId}`);
  }
}

async function aceptarTrabajo(pedidoId, workerId) {
  try {
    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) return { ok: false, error: 'Pedido no existe' };
    if (pedido.estado === 'ACEPTADA') return { ok: false, error: 'Ya fue tomado por otro' };

    pedido.worker = workerId;
    pedido.estado = 'ACEPTADA';
    await pedido.save();
    detenerFlujo(pedidoId);

    const io = global.io;
    if (io) {
      io.to('rubro_' + pedido.tipoServicio).emit('pedido_tomado', { pedidoId: pedido._id });
      io.to('zona_' + pedido.zona).emit('pedido_tomado', { pedidoId: pedido._id });
      io.to('pedido_' + pedido._id).emit('trabajo_aceptado', {
        pedidoId: pedido._id,
        mensaje: '¡Tu pedido fue aceptado!'
      });
    }

    return { ok: true, pedido };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function cancelarNotificacionesWorkers(pedidoId, io) {
  try {
    detenerFlujo(pedidoId);
    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) return;

    const socketIo = io || global.io;
    if (socketIo) {
      socketIo.to('rubro_' + pedido.tipoServicio).emit('pedido_cancelado', { pedidoId });
      socketIo.to('zona_' + pedido.zona).emit('pedido_cancelado', { pedidoId });
    }

    await Usuario.updateMany(
      { 'notificacionesPendientes.pedidoId': pedidoId },
      { $pull: { notificacionesPendientes: { pedidoId } } }
    );
    console.log(`[FSM] Notificaciones canceladas: ${pedidoId}`);
  } catch (error) {
    console.error('[FSM] Error cancelando notificaciones:', error);
  }
}

// AuctionEngine integrado
const { subastar, dispatch: auctionDispatch } = require('../../../nexus/application/auctionEngine');
const { enviarPushWorker } = require('../services/pushService');

async function buscarYSubastarWorkers(pedido, io) {
  try {
    // Buscar workers disponibles
    const Usuario = require('../models/Usuario');
    const workers = await Usuario.find({
      rol: 'TRABAJADOR',
      disponible: true,
      estado: 'VERIFICADO',
      especialidades: { $elemMatch: { $regex: pedido.tipoServicio, $options: 'i' } },
    }).limit(20).lean();

    if (!workers.length) {
      console.log('[AuctionEngine] Sin workers disponibles para', pedido.tipoServicio);
      return null;
    }

    const result = await subastar({ pedido, workers });
    auctionDispatch({ result, io, pedidoId: String(pedido._id) });
    return result;
  } catch(e) {
    console.error('[AuctionEngine] Error:', e.message);
    return null;
  }
}

module.exports = {
  detenerFlujo,
  cancelarNotificacionesWorkers,
  iniciarFlujoBusqueda,
  aceptarTrabajo,
  buscarWorkersDisponibles
};
