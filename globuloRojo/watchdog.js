const Pedido  = require('../src/old_structure/models/Pedido');
const { runShadow } = require('../src/dispatch/shadow');
const Usuario = require('../src/old_structure/models/Usuario');
const { normalizar } = require('../src/old_structure/utils/normalizer');

const INTERVALO_MS     = 3 * 60 * 1000;  // patrol cada 3 min
const UMBRAL_HUERFANO  = 4 * 60 * 1000;  // pedido huerfano tras 4 min
const MUERTE_DIGNA_MS  = 20 * 60 * 1000; // cancelacion automatica a 20 min
const MAX_RETRY        = 3;


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

async function buscarCandidatos(pedido) {
  const rubroNorm = normalizar(pedido.tipoServicio);
  return await Usuario.find({
    rol: { $in: ["TRABAJADOR","WORKER"] },
    rubro: { $regex: rubroNorm, $options: "i" },
    disponible: true,
    _id: { $nin: pedido.ignoredBy || [] }
  }).limit(10).lean();
}

async function emitirAlerta(pedido, workers, urgente) {
  // SHADOW MODE — DispatchEngine corre en paralelo, nunca bloquea GR
  runShadow(pedido, workers).catch(() => {});
  const io = global.io;
  if (!io) return;
  const payload = {
    pedidoId:    pedido._id,
    tipoServicio: pedido.tipoServicio,
    zona:        pedido.zona,
    precio:      pedido.total_estimado,
    pagoWorker:  pedido.pago_worker,
    descripcion: pedido.descripcion,
    direccion:   pedido.direccion,
    urgente:     !!urgente,
    expiraEn:    300,
    retryLevel:  pedido.retryLevel
  };
  // Emision dual garantizada
  workers.forEach(w => {
    _pushNuevaOportunidad(w._id, payload).catch(()=>{});
          io.to("worker_" + w._id).emit("nueva_oportunidad", payload);
  });
  io.to("rubro_" + pedido.tipoServicio).emit("nueva_oportunidad", payload);
  io.to("zona_"  + pedido.zona).emit("nueva_oportunidad", payload);
}

function alertarAdmin(mensaje) {
  const io = global.io;
  if (io) io.to("admins").emit("alerta_critica", { mensaje, timestamp: new Date() });
  console.error("[WATCHDOG] CRITICO:", mensaje);
}

async function patrol() {
  global.watchdogLastCheck = Date.now();
  try {
    const ahora = new Date();

    // 1. MUERTE DIGNA: pedidos huerfanos > 20 min
    const muertos = await Pedido.find({
      estado: "PENDIENTE",
      createdAt: { $lt: new Date(ahora - MUERTE_DIGNA_MS) }
    });
    for (const p of muertos) {
      await Pedido.findByIdAndUpdate(p._id, {
        estado: "CANCELADO_SISTEMA",
        $push: { historialEstados: { estado: "CANCELADO_SISTEMA", fecha: ahora } }
      });
      const io = global.io;
      if (io) {
        io.to("pedido_" + p._id).emit("estado_pedido", {
          fase: "CANCELADO_SISTEMA",
          titulo: "Sin respuesta",
          mensaje: "No encontramos especialistas disponibles. Tu pedido fue cancelado automaticamente."
        });
      }
      console.log("[WATCHDOG] Muerte digna:", p._id);
    }

    // 2. WATCHDOG: pedidos huerfanos 4-20 min
    const huerfanos = await Pedido.find({
      estado: "PENDIENTE",
      updatedAt: { $lt: new Date(ahora - UMBRAL_HUERFANO) },
      retryLevel: { $lt: MAX_RETRY },
      createdAt:  { $gt: new Date(ahora - MUERTE_DIGNA_MS) }
    });

    for (const pedido of huerfanos) {
      pedido.retryLevel = (pedido.retryLevel || 0) + 1;
      const urgente     = pedido.retryLevel >= 2;
      const candidatos  = await buscarCandidatos(pedido);

      if (candidatos.length > 0) {
        await emitirAlerta(pedido, candidatos, urgente);
        console.log("[WATCHDOG] Pedido " + pedido._id + " re-notificado nivel " + pedido.retryLevel + " (" + candidatos.length + " workers)");
      } else if (pedido.retryLevel >= MAX_RETRY) {
        alertarAdmin("Pedido CRITICO sin workers disponibles: " + pedido._id + " (" + pedido.tipoServicio + ")");
      }

      pedido.lastNotifiedAt = ahora;
      await pedido.save();
    }

    if (huerfanos.length > 0 || muertos.length > 0) {
      console.log("[WATCHDOG] Ciclo: " + huerfanos.length + " reintentados, " + muertos.length + " cancelados");
    }

  } catch(e) {
    console.error("[WATCHDOG] Error en patrol:", e.message);
  }
}

function iniciar() {
  global.watchdogLastCheck = Date.now();
  console.log("[WATCHDOG] Globulo Rojo v2.1 iniciado - patrol cada 3 min");
  global.watchdogLastCheck = Date.now();
  setInterval(patrol, INTERVALO_MS);
  // Primera patrol al minuto de arrancar
  setTimeout(patrol, 60000);
}


// ════════════════════════════════════════
// QUARANTINE — Limpieza cada 12hs
// ════════════════════════════════════════
const cleanHouse = async () => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection;
    const ahora = new Date();

    const trash = await Pedido.find({
      $or: [
        { total_estimado: { $in: [0, null] } },
        { estado: 'CANCELADO_SISTEMA',
          updatedAt: { $lt: new Date(ahora - 7 * 24 * 60 * 60 * 1000) } }
      ]
    });

    if (trash.length > 0) {
      const col = db.collection('quarantine_orders');
      await col.insertMany(trash.map(t => ({
        ...t.toObject(),
        archivedAt: ahora,
        reason: (!t.total_estimado || t.total_estimado === 0)
          ? 'precio_invalido'
          : 'cancelado_viejo'
      })));
      const ids = trash.map(t => t._id);
      await Pedido.deleteMany({ _id: { $in: ids } });
      console.log('[CLEANHOUSE] ' + trash.length + ' pedidos → quarantine_orders');
    }
  } catch(e) {
    console.error('[CLEANHOUSE] Error:', e.message);
  }
};

setInterval(cleanHouse, 12 * 60 * 60 * 1000);
setTimeout(cleanHouse, 5 * 60 * 1000); // Primer barrido a los 5 min

module.exports = { iniciar, patrol, cleanHouse };
