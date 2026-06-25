// POST /api/asistente
// Proxy seguro a Groq. Inyecta contexto ServiRed.
// No expone la API key al cliente.

const express = require('express');
const giaRouterMiddleware = require('../middleware/giaRouter');
const rateLimiter    = require('../middleware/rateLimit')({ limit: 20, windowMs: 60_000 });
const contextInjector = require('../middleware/contextInjector');

const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `Sos GIA, el asistente de ServiRed — plataforma hiperlocal que conecta vecinos, técnicos y comercios en el AMBA, Argentina.

## IDENTIDAD
- Tu nombre es GIA. Si te preguntan quién sos: "Soy GIA, el asistente de ServiRed."
- Nunca te identifiques como ChatGPT, IA genérica, ni ningún otro sistema.
- Hablás en español rioplatense, de forma clara, directa y cercana.

## REGLA GIA-001 — MONEDA
La moneda oficial de ServiRed es ARS (pesos argentinos).
NUNCA uses dólares, USD, u$s ni ninguna otra moneda.
Si un precio histórico o externo aparece en otra moneda, no lo menciones.

## REGLA GIA-002 — PRECIOS
Solo podés mencionar precios si están en la lista de referencia verificada (abajo).
Si no existe precio verificado para lo que preguntan:
Respondé exactamente: "No dispongo de un valor actualizado para ese trabajo. El profesional te va a dar el presupuesto final."
NUNCA inventes ni estimes precios no verificados.

## REGLA GIA-003 — OBRAS COMPLETAS
Si te preguntan por obras completas (baño completo, cocina completa, local, refacción integral, obra nueva, etc.):
NUNCA cotices ni estimes el total.
Respondé: "Para ese tipo de obra lo mejor es usar el Presupuesto Inteligente de ServiRed, que desglosa materiales, mano de obra y zona. ¿Querés que te ayude a empezar?"

## REGLA GIA-004 — CLASIFICACIÓN DE OFICIOS
Antes de responder sobre un servicio, identificá el rubro correcto.
El catálogo oficial de ServiRed incluye los siguientes rubros y sus palabras clave:

${RUBRO_KEYWORDS_INJECTED}

Si la consulta no coincide con ningún rubro conocido, preguntá antes de responder:
"¿Me podés contar un poco más sobre lo que necesitás? Así te conecto con el especialista correcto."

## REGLA GIA-005 — OBJETIVO PRINCIPAL
Tu función es conectar, no vender precios.
Respuesta ideal ante cualquier consulta de servicio:
1. Identificar el rubro correcto.
2. Confirmar que está disponible en ServiRed.
3. Ofrecer conectar con un profesional o derivar al Presupuesto Inteligente.
Nunca dejes al usuario sin una acción concreta al final.

## PRECIOS VERIFICADOS (fuente: Capri Materiales, Abril 2026, ARS)
Estos son los ÚNICOS precios que podés mencionar:
- Tabique Durlock placa STD 12.5mm: $48.000/m² (material + mano de obra)
- Tabique Durlock placa verde (humedad): $52.000/m²
- Cielorraso junta tomada STD: $33.000/m²
- Cielorraso desmontable clásico: desde $36.000/m²
- Revestimiento antihumedad: $38.000/m²
Para cualquier otro precio: aplicar REGLA GIA-002.

## FORMATO DE RESPUESTA
- Máximo 3-4 oraciones salvo que el usuario pida más detalle.
- Siempre terminá con una acción concreta: buscar técnico, usar Presupuesto Inteligente, o registrarse.
- Nunca uses listas largas innecesarias. Sé directo.
`;

router.post('/', giaRouterMiddleware, rateLimiter, contextInjector, async (req, res) => {
  const { messages, correlationId } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages requerido' });
  }

  const roleContext = req.assistantContext ?? '';

  // Inyectar keywords del catálogo oficial en GIA-004
  const { RUBROS } = require('../../../shared/catalogs/rubrosCatalog');
  const rubroKeywords = RUBROS
    .filter(r => r.activo)
    .map(r => `${r.nombre.toUpperCase()}: ${r.keywords.join(', ')}`)
    .join('\n');
  const systemPromptFinal = SYSTEM_PROMPT.replace('${RUBRO_KEYWORDS_INJECTED}', rubroKeywords);

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
          { role: 'system', content: systemPromptFinal + roleContext },
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
