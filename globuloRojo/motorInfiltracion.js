// ============================================
// GLÓBULO ROJO - Motor de Infiltración v2
// Filantropía Laboral: oxigena la economía del trabajador
// Stack: Groq (velocidad) + Gemini (semántica) + Socket.io
// ============================================

const { haversine }          = require('./haversine');
const { rankearTrabajadores } = require('./briones');
const groqService             = require('../services/groqService');
const geminiService           = require('../services/geminiService');

// Matching principal — llamado desde el endpoint HTTP
async function buscarTrabajadores({ descripcion, especialidad, lat, lon, radioKm = 15, zona = 'CABA' }) {
  // 1. Gemini clasifica semánticamente si viene descripción libre
  let rubroFinal = especialidad;
  let urgencia   = 'media';
  let resumenGemini = null;

  if (descripcion && !especialidad) {
    const clasificacion = await geminiService.clasificarPedido(descripcion);
    rubroFinal    = clasificacion.rubroKey  || especialidad;
    urgencia      = clasificacion.urgencia  || 'media';
    resumenGemini = clasificacion.resumen   || null;
  }

  // 2. Buscar candidatos en DB
  let candidatos = [];
  try {
    const PerfilTrabajador = require('../models/PerfilTrabajador');
    candidatos = await PerfilTrabajador.find({
      especialidades: rubroFinal,
      estado: 'ACTIVO',
    }).lean();
  } catch (e) {
    console.warn('[GlobRojo] DB no disponible:', e.message);
  }

  // 3. Filtrar por radio geográfico
  if (lat && lon && candidatos.length) {
    candidatos = candidatos.filter(t => {
      if (!t.ubicacion?.coordinates) return true;
      const [tLon, tLat] = t.ubicacion.coordinates;
      return haversine(parseFloat(lat), parseFloat(lon), tLat, tLon) <= parseFloat(radioKm);
    });
  }

  // 4. Rankear con Método Briones (matemático)
  let rankeados = rankearTrabajadores(candidatos);

  // 5. Groq refina el ranking con IA si hay candidatos
  if (rankeados.length > 1) {
    rankeados = await groqService.rankearConIA(rankeados, rubroFinal, zona);
  }

  // 6. Groq genera mensaje de infiltración para el top trabajador
  let mensajeInfiltracion = null;
  if (rankeados.length > 0) {
    const top = rankeados[0];
    mensajeInfiltracion = await groqService.generarMensajeInfiltracion({
      nombreTrabajador: top.nombre || 'trabajador',
      rubro:            rubroFinal,
      zona,
      scoreBriones:     top.scoreBriones || 0,
    });
  }

  return {
    rubro:               rubroFinal,
    urgencia,
    resumen_gemini:      resumenGemini,
    total:               rankeados.length,
    trabajadores:        rankeados.slice(0, 10),
    mensaje_infiltracion: mensajeInfiltracion,
  };
}

// Infiltración proactiva — llamada cuando llega un pedido nuevo
// Se conecta con Socket.io para notificar trabajadores online
async function infiltrar({ pedido, trabajadoresOnline, io }) {
  if (!pedido?.especialidad && !pedido?.descripcion) return;

  const resultado = await buscarTrabajadores({
    descripcion:  pedido.descripcion,
    especialidad: pedido.especialidad,
    lat:          pedido.lat,
    lon:          pedido.lon,
    zona:         pedido.zona || 'CABA',
  });

  resultado.trabajadores.forEach(t => {
    const entry = Object.entries(trabajadoresOnline)
      .find(([, v]) => v.userId === String(t._id));
    if (entry) {
      const [socketId] = entry;
      io.to(socketId).emit('oportunidad_trabajo', {
        pedidoId: pedido._id,
        rubro:    resultado.rubro,
        zona:     pedido.zona,
        mensaje:  resultado.mensaje_infiltracion || `Hay un pedido de ${resultado.rubro} cerca tuyo`,
        score:    t.scoreBriones,
        urgencia: resultado.urgencia,
      });
    }
  });

  return resultado;
}

module.exports = { buscarTrabajadores, infiltrar };
