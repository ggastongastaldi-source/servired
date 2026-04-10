// ============================================
// GLÓBULO ROJO - Motor de Infiltración
// Filantropía laboral: busca trabajo PARA el
// trabajador, no espera que el cliente llegue
// Integra: Groq (matching veloz) + Gemini (contexto)
// ============================================

const { haversine }          = require('./haversine');
const { rankearTrabajadores } = require('./briones');

// ── Groq: matching de alta velocidad ──────────────────────────────────────────
async function consultarGroq(prompt) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return null;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error('[Groq]', e.message);
    return null;
  }
}

// ── Gemini: análisis de contexto y rubro ──────────────────────────────────────
async function consultarGemini(prompt) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return null;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) {
    console.error('[Gemini]', e.message);
    return null;
  }
}

// ── Matching principal ─────────────────────────────────────────────────────────
async function buscarTrabajadores({ especialidad, lat, lon, radioKm = 15, zona = 'CABA' }) {
  // 1. Gemini clasifica y valida el rubro
  const contextoGemini = await consultarGemini(
    `Sos el motor de Servired, marketplace de servicios del hogar en Argentina. 
     El cliente necesita: "${especialidad}". 
     Respondé en JSON con: { "rubroValidado": "...", "urgencia": "baja|media|alta", "sugerencia": "..." }`
  );

  let rubroValidado = especialidad;
  let sugerenciaGemini = null;
  try {
    const parsed = JSON.parse(contextoGemini || '{}');
    rubroValidado    = parsed.rubroValidado    || especialidad;
    sugerenciaGemini = parsed.sugerencia       || null;
  } catch(_) {}

  // 2. Buscar trabajadores en DB (importado dinámico para evitar circular)
  let candidatos = [];
  try {
    const PerfilTrabajador = require('../models/PerfilTrabajador');
    candidatos = await PerfilTrabajador.find({
      especialidades: rubroValidado,
      estado: 'ACTIVO',
    }).lean();
  } catch(e) {
    console.warn('[GlobRojo] Sin DB, usando datos vacíos:', e.message);
  }

  // 3. Filtrar por radio geográfico
  if (lat && lon) {
    candidatos = candidatos.filter(t => {
      if (!t.ubicacion?.coordinates) return true;
      const [tLon, tLat] = t.ubicacion.coordinates;
      return haversine(parseFloat(lat), parseFloat(lon), tLat, tLon) <= parseFloat(radioKm);
    });
  }

  // 4. Rankear con Método Briones
  const rankeados = rankearTrabajadores(candidatos);

  // 5. Groq genera mensaje personalizado para el top trabajador
  let mensajeInfiltracion = null;
  if (rankeados.length > 0) {
    const top = rankeados[0];
    mensajeInfiltracion = await consultarGroq(
      `Sos Glóbulo Rojo, el motor de Servired. Escribí un mensaje breve en español rioplatense 
       para notificar al trabajador "${top.nombre || 'trabajador'}" que hay un pedido de 
       "${rubroValidado}" cerca suyo en ${zona}. Máximo 2 oraciones, directo y motivador.`
    );
  }

  return {
    rubro:               rubroValidado,
    total:               rankeados.length,
    trabajadores:        rankeados.slice(0, 10),
    sugerencia_gemini:   sugerenciaGemini,
    mensaje_infiltracion: mensajeInfiltracion,
  };
}

// ── Infiltración proactiva (llamada por cron o Socket.io) ─────────────────────
// Notifica trabajadores online cuando aparece un pedido nuevo
async function infiltrar({ pedido, trabajadoresOnline, io }) {
  if (!pedido?.especialidad) return;

  const resultado = await buscarTrabajadores({
    especialidad: pedido.especialidad,
    lat:          pedido.lat,
    lon:          pedido.lon,
    zona:         pedido.zona,
  });

  // Emitir por Socket.io a cada trabajador online compatible
  resultado.trabajadores.forEach(t => {
    const socketEntry = Object.entries(trabajadoresOnline)
      .find(([, v]) => v.userId === String(t._id));
    if (socketEntry) {
      const [socketId] = socketEntry;
      io.to(socketId).emit('oportunidad_trabajo', {
        pedidoId:  pedido._id,
        rubro:     resultado.rubro,
        zona:      pedido.zona,
        mensaje:   resultado.mensaje_infiltracion || `Hay un pedido de ${resultado.rubro} cerca tuyo`,
        score:     t.scoreBriones,
      });
    }
  });

  return resultado;
}

module.exports = { buscarTrabajadores, infiltrar, consultarGroq, consultarGemini };
