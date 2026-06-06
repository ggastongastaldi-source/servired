const { haversine }           = require('./haversine');
const { rankearTrabajadores } = require('./briones');
const groqService             = require('../src/core/services/groqService');

// ── Push offline nueva_oportunidad ───────────────────────────
async function _pushNuevaOportunidad(workerId, pedido) {
  try {
    const webpush = require('web-push');
    const Usuario = require('./src/core/models/Usuario');
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

const MAPA = {
  'plomero':'plomeria','electricista':'electricidad','gasista':'gasista',
  'pintor':'pintura','carpintero':'carpinteria','cerrajero':'cerrajeria',
  'albanil':'albanileria','albañil':'albanileria','techista':'techista',
  'herrero':'herreria','mecanico':'mecanica_ligera','mecánico':'mecanica_ligera',
  'jardinero':'jardineria','limpieza':'limpieza_hogar','limpieza_hogar':'limpieza_hogar',
  'mudanza':'fletes_mudanzas','informatico':'servicio_tecnico_pc',
  'yesero':'durlock','durlock':'durlock','cuidador':'cuidado_personas',
  'domestico':'servicio_domestico','servicio_domestico':'servicio_domestico',
  'peluquero':'peluqueria_domicilio','zinguero':'zingueria','vidriero':'vidrieria',
  'refrigeracion':'aire_acondicionado','desinfeccion':'desinfeccion_plagas',
};

function traducir(texto) {
  const limpio = (texto||'').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z_\s]/g,'').trim();
  for (const [key, val] of Object.entries(MAPA)) {
    const k = key.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if (limpio === k || limpio.includes(k)) return val;
  }
  return limpio || null;
}

async function clasificarConGroq(descripcion) {
  const prompt = `Sos un clasificador de servicios para Servired Argentina. Respondé SOLO con una palabra de esta lista:
plomero, electricista, gasista, pintor, carpintero, cerrajero, albanil, techista, herrero, mecanico, jardinero, limpieza, mudanza, informatico, yesero, cuidador, domestico, otro

Mensaje: "${descripcion}"
Respondé solo con una palabra:`;

  const raw = await groqService.inferir(prompt, 10);
  console.log('[Groq clasificador] raw:', JSON.stringify(raw));
  const rubroKey = traducir(raw);
  console.log('[Groq clasificador] rubroKey:', rubroKey);
  return { rubroKey, categoriaRaw: (raw||'').trim() };
}

async function buscarTrabajadores({ descripcion, especialidad, lat, lon, radioKm = 50, zona = 'CABA' }) {
  let rubroFinal = especialidad ? traducir(especialidad) : null;
  let urgencia = 'media';
  let resumenGroq = null;

  if (descripcion && !rubroFinal) {
    const { rubroKey, categoriaRaw } = await clasificarConGroq(descripcion);
    rubroFinal = rubroKey;
    resumenGroq = categoriaRaw ? `Servicio de ${categoriaRaw} en Argentina` : null;
  }

  console.log('[GlobRojo] Buscando rubro:', rubroFinal);

  let candidatos = [];
  try {
    const Usuario = require('../src/core/models/Usuario');
    const query = {
      rol: 'TRABAJADOR',
      estado: { $in: ['ACTIVO', 'VERIFICADO'] },
      disponible: true,
    };
    if (rubroFinal) {
      query.$or = [
        { rubro: rubroFinal },
        { especialidades: rubroFinal },
        { especialidades: { $in: [rubroFinal, especialidad] } },
      ];
    }
    console.log('[GlobRojo] Query:', JSON.stringify(query));
    candidatos = await Usuario.find(query).lean();
    console.log('[GlobRojo] Candidatos encontrados:', candidatos.length);
  } catch(e) { console.warn('[GlobRojo] DB error:', e.message); }

  if (lat && lon && candidatos.length) {
    candidatos = candidatos.filter(t => {
      if (!t.ubicacion?.coordinates?.length) return true; // sin coords → incluir igual
      const [tLon, tLat] = t.ubicacion.coordinates;
      const dist = haversine(parseFloat(lat), parseFloat(lon), tLat, tLon);
      console.log('[GlobRojo] Distancia a', t.nombre, ':', dist, 'km');
      return dist <= parseFloat(radioKm);
    });
  }

  let rankeados = rankearTrabajadores(candidatos);

  if (rankeados.length > 1) {
    rankeados = await groqService.rankearConIA(rankeados, rubroFinal, zona);
  }

  let mensajeInfiltracion = null;
  if (rankeados.length > 0) {
    mensajeInfiltracion = await groqService.generarMensajeInfiltracion({
      nombreTrabajador: rankeados[0].nombre || 'trabajador',
      rubro: rubroFinal,
      zona,
      scoreBriones: rankeados[0].scoreBriones || 0,
    });
  }

  return {
    rubro: rubroFinal,
    urgencia,
    resumen_gemini: resumenGroq,
    total: rankeados.length,
    trabajadores: rankeados.slice(0, 10),
    mensaje_infiltracion: mensajeInfiltracion,
  };
}

async function infiltrar({ pedido, trabajadoresOnline, io }) {
  if (!pedido?.especialidad && !pedido?.descripcion) return;
  const resultado = await buscarTrabajadores({
    descripcion: pedido.descripcion, especialidad: pedido.especialidad,
    lat: pedido.lat, lon: pedido.lon, zona: pedido.zona || 'CABA',
  });
  resultado.trabajadores.forEach(t => {
    const room = 'worker_' + String(t._id);
    console.log('[Infiltrar] Emitiendo a room:', room);
    io.to(room).emit('nueva_oportunidad', {
      pedidoId: pedido._id, rubro: resultado.rubro, zona: pedido.zona,
      mensaje: resultado.mensaje_infiltracion || 'Hay un pedido de ' + resultado.rubro + ' cerca tuyo',
      score: t.scoreBriones, urgencia: resultado.urgencia,
    });
  });
    }

module.exports = { buscarTrabajadores, infiltrar };
