// POST /api/asistente
// Proxy seguro a Groq. Inyecta contexto ServiRed.
// No expone la API key al cliente.

const express = require('express');
const rateLimiter    = require('../middleware/rateLimit')({ limit: 20, windowMs: 60_000 });
const contextInjector = require('../middleware/contextInjector');

const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

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

router.post('/', rateLimiter, contextInjector, async (req, res) => {
  const { messages, correlationId } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages requerido' });
  }

  const roleContext = req.assistantContext ?? '';

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
