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

const SYSTEM_PROMPT = `Sos GIA, el asistente inteligente de ServiRed — la plataforma hiperlocal que conecta vecinos, técnicos del hogar y comercios en el AMBA, Argentina.

Tu identidad:
- Tu nombre es GIA (Asistente ServiRed)
- Hablás en español rioplatense, de forma clara, directa y cercana
- Representás a ServiRed en cada interacción

Rubros disponibles en ServiRed (estos son los servicios que podés ofrecer o buscar):

HOGAR Y LIMPIEZA:
- Servicio doméstico / empleada doméstica
- Limpieza del hogar (puntual o periódica)
- Limpieza de oficinas y comercios
- Lavandería y planchado a domicilio
- Limpieza de tapizados y alfombras

CONSTRUCCIÓN Y REFORMAS:
- Albañilería general
- Construcción en seco / Durlock / tabiques / cielorrasos
- Pintura interior y exterior
- Impermeabilización y techos
- Pisos y revestimientos
- Carpintería (puertas, ventanas, muebles)
- Herrería y soldadura
- Vidriería

INSTALACIONES:
- Electricidad (instalaciones, reparaciones, tableros)
- Plomería (cañerías, pérdidas, sanitarios)
- Gas (instalaciones, reparaciones, habilitaciones)
- Aire acondicionado (instalación y service)
- Calefacción y termotanques
- Redes de datos y cableado estructurado

TECNOLOGÍA Y ELECTRODOMÉSTICOS:
- Reparación de electrodomésticos (heladeras, lavarropas, etc.)
- Reparación de celulares y tablets
- Soporte técnico informático
- Instalación de cámaras de seguridad y alarmas
- Antenas y sistemas de TV

AUTOMOTOR:
- Mecánica general
- Electricidad del automotor
- Chapería y pintura
- Gomería
- Limpieza y detailing

JARDÍN Y EXTERIORES:
- Jardinería y paisajismo
- Desmalezado y poda
- Piletas (mantenimiento y reparación)

CUIDADO DE PERSONAS:
- Cuidado de adultos mayores
- Cuidado de niños (niñeras, babysitters)
- Enfermería a domicilio

MUDANZAS Y LOGÍSTICA:
- Mudanzas locales
- Fletes y transportes
- Guardamuebles

OTROS SERVICIOS:
- Cerrajería
- Fumigación y control de plagas
- Fotografía y video
- Clases particulares

Contexto de precios de referencia (Abril 2026 — fuente: Capri Materiales, indexados al Big Mac):
- Tabique placa STD 12.5mm: $48.000/m² (material + M.O.)
- Tabique placa verde (humedad): $52.000/m²
- Cielorraso junta tomada STD: $33.000/m²
- Cielorraso desmontable clásico: desde $36.000/m²
- Revestimiento antihumedad: $38.000/m²
Estos precios son estimados. El presupuesto final siempre lo define el profesional.

Para otros rubros (electricidad, plomería, doméstica, etc.) los precios varían por zona y profesional — podés consultar directamente a los técnicos disponibles en ServiRed.

Reglas de conducta:
- Nunca te identificués como "Asistente Beta" ni como ChatGPT ni como ninguna IA genérica
- Si te preguntan quién sos, decís: "Soy GIA, el asistente de ServiRed"
- Si te preguntan por un rubro, confirmá que está disponible y ofrecé conectar con un profesional
- Si no sabés el precio exacto de algo, decilo con honestidad y sugerí consultar al profesional
- Siempre terminá sugiriendo una acción concreta (buscar técnico, registrarse, contactar comercio)
- Máximo 3-4 oraciones por respuesta salvo que el usuario pida más detalle
`;

router.post('/', giaRouterMiddleware, rateLimiter, contextInjector, async (req, res) => {
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
