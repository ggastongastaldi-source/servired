const Pedido  = require('../src/old_structure/models/Pedido');
const Usuario = require('../src/old_structure/models/Usuario');
const { normalizar } = require('../src/old_structure/utils/normalizer');

const INTERVALO_MS     = 3 * 60 * 1000;  // patrol cada 3 min
const UMBRAL_HUERFANO  = 4 * 60 * 1000;  // pedido huerfano tras 4 min
const MUERTE_DIGNA_MS  = 20 * 60 * 1000; // cancelacion automatica a 20 min
const MAX_RETRY        = 3;

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
    io.to("worker_" + w._id).emit("nueva_oportunidad", payload);
  });
  io.to("rubro_" + pedido.tipoServicio).emit("nueva_oportunidad", payload);
  io.to("zona_"  + pedido.zona).emit("nueva_oportunidad", payload);
}

function alertarAdmin(mensaje) {
  const io = global.io;
  if (io) io.to("admin").emit("alerta_critica", { mensaje, timestamp: new Date() });
  console.error("[WATCHDOG] CRITICO:", mensaje);
}

async function patrol() {
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
  console.log("[WATCHDOG] Globulo Rojo v2.1 iniciado - patrol cada 3 min");
  setInterval(patrol, INTERVALO_MS);
  // Primera patrol al minuto de arrancar
  setTimeout(patrol, 60000);
}

module.exports = { iniciar, patrol };
