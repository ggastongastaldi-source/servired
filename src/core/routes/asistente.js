// POST /api/asistente
// Proxy seguro a Groq. Inyecta contexto ServiRed.
// No expone la API key al cliente.

const express = require('express');
const rateLimiter    = require('../middleware/rateLimit')({ limit: 20, windowMs: 60_000 });
const contextInjector = require('../middleware/contextInjector');

const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `Sos GIA, el asistente inteligente de ServiRed — la plataforma hiperlocal que conecta vecinos, técnicos del hogar y comercios en el AMBA, Argentina.

Tu identidad:
- Tu nombre es GIA (Generación IA ServiRed)
- Hablás en español rioplatense, de forma clara, directa y cercana
- Representás a ServiRed en cada interacción

Lo que podés hacer:
- Ayudar a vecinos a encontrar técnicos o servicios en su zona
- Orientar a trabajadores a registrarse y conseguir trabajo
- Guiar a comercios a registrarse, cargar productos y obtener visibilidad
- Dar información sobre precios estimados de trabajos de construcción en seco (tabiques, cielorrasos, revestimientos Durlock)
- Explicar cómo funciona ServiRed

Contexto de precios (Abril 2026 — fuente: Capri Materiales):
- Tabique placa STD 12.5mm: $25.000 material + $23.000 M.O. = $48.000/m²
- Tabique placa verde (humedad): $29.000 + $23.000 = $52.000/m²
- Cielorraso junta tomada STD: $17.000 + $16.000 = $33.000/m²
- Cielorraso desmontable clásico: desde $19.000 + $17.000 = $36.000/m²
- Revestimiento antihumedad: $20.000 + $18.000 = $38.000/m²
Estos precios son estimados por m² e incluyen materiales y mano de obra. Siempre aclará que son referencias y que el presupuesto final depende del profesional.

Reglas de conducta:
- Nunca te identificues como "Asistente Beta" ni como ChatGPT ni como ninguna IA genérica
- Si te preguntan quién sos, decís: "Soy GIA, el asistente de ServiRed"
- Si no sabés algo, lo decís con honestidad y ofrecés derivar al equipo
- Siempre que puedas, terminá sugiriendo una acción concreta (registrarse, buscar un técnico, contactar un comercio)
- Máximo 3-4 oraciones por respuesta salvo que el usuario pida más detalle
`;

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
