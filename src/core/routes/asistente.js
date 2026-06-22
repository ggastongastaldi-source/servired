// POST /api/asistente
// Proxy seguro a Groq. Inyecta contexto ServiRed.
// No expone la API key al cliente.

const express = require('express');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Rate limit simple en memoria — sin dependencias externas
// Max 20 requests por IP por ventana de 60s
const rateLimitMap = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return true;
}

// Limpiar entradas viejas cada 5 minutos para no acumular memoria
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.start > RATE_WINDOW_MS * 2) rateLimitMap.delete(ip);
  }
}, 300_000);
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama3-8b-8192';

const SYSTEM_PROMPT = `Sos el asistente de ServiRed, una plataforma que conecta usuarios con técnicos del hogar (electricistas, plomeros, gasistas, cerrajeros y más) en el AMBA, Argentina.

Tu función es ayudar a:
- CLIENTES: encontrar el servicio correcto, entender cómo funciona ServiRed, resolver dudas sobre pedidos y pagos.
- TÉCNICOS: entender cómo recibir pedidos, gestionar disponibilidad y cobrar.
- COMERCIOS: entender cómo sumarse a la red y vincular trabajadores.

Reglas:
- Respondé siempre en español rioplatense (vos, che, etc.).
- Sé directo y útil. Máximo 3 párrafos por respuesta.
- Si no sabés algo específico del usuario, preguntá qué necesita.
- No inventés precios ni garantías que no puedas confirmar.
- Si el problema es urgente (gas, electricidad peligrosa), priorizá seguridad primero.`;

router.post('/', async (req, res) => {
  // Rate limit por IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Demasiadas consultas. Esperá un momento.' });
  }

  const { messages, appMode, correlationId, userRole, sessionEvents } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages requerido' });
  }

  // Contexto enriquecido: modo + rol + último evento conocido
  let roleContext = '';
  if (appMode) roleContext += `\n\nModo activo: ${appMode}.`;
  if (userRole) roleContext += ` Rol autenticado: ${userRole}.`;
  if (sessionEvents?.event_type) roleContext += ` Última acción registrada: ${sessionEvents.event_type}.`;

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + roleContext },
          ...messages.slice(-10) // ventana de 10 turnos máximo
        ],
        max_tokens: 512,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[asistente] Groq error:', err);
      return res.status(502).json({ error: 'Error del motor de IA' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'No pude generar una respuesta.';

    res.json({
      reply,
      correlationId: correlationId || null,
      model: MODEL
    });

  } catch (e) {
    console.error('[asistente] fetch error:', e.message);
    res.status(500).json({ error: 'Error interno del asistente' });
  }
});

module.exports = router;
