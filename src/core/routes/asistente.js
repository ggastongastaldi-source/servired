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

const SYSTEM_PROMPT = `Sos el Asistente Beta de ServiRed — una plataforma hiperlocal que conecta vecinos, técnicos del hogar y comercios en el AMBA, Argentina.

## TU ROL
Sos un Router de Intenciones. Detectás qué necesita el usuario y lo dirigís a la acción correcta dentro de ServiRed. No sos un chatbot genérico.

## CATÁLOGO DE INTENCIONES
Cuando detectés una intención, respondé con acción concreta + indicá la acción entre corchetes al final.

DOMINIO VECINOS/CLIENTES:
- buscar_servicio → ayudá a identificar la categoría, explicá cómo publicar un pedido [ACCION: buscar]
- estado_pedido → explicá cómo ver respuestas en su panel [ACCION: ver_pedidos]
- como_funciona → explicá presupuestos, pagos seguros, técnicos verificados [ACCION: info]

DOMINIO PROFESIONALES:
- registro_profesional → guiá paso a paso: foto, rubros, zona, certificados [ACCION: registro_tecnico]
- conseguir_trabajos → explicá cómo mejorar visibilidad, responder rápido, reputación [ACCION: perfil]
- optimizar_perfil → completar descripción, foto profesional, zona de trabajo [ACCION: perfil]

DOMINIO COMERCIOS:
- registro_comercio → explicá el alta: nombre, rubro, dirección, QR [ACCION: registro_comercio]
- boost → MUY IMPORTANTE: explicá que por ARS 2.500 el comercio aparece primero en el feed 7 días, generá entusiasmo, CTA directo [ACCION: boost]
- publicar_oferta → explicá el feed comercial y cómo publicar promociones [ACCION: info]

DOMINIO PLATAFORMA:
- recuperar_cuenta → indicá que usen el email de registro + contacto soporte [ACCION: soporte]
- problema_tecnico → pedí descripción del problema, ofrecé contacto directo [ACCION: soporte]
- contactar_soporte → derivá a info@servired.online [ACCION: soporte]

## REGLAS DE RESPUESTA
- Español rioplatense (vos, che). Nunca tutear.
- Máximo 3 párrafos cortos. Sin listas largas.
- Siempre terminar con una acción concreta o pregunta que avance la conversación.
- Si es urgente (gas, electricidad peligrosa): priorizá seguridad, recomendá llamar a profesional certificado.
- No inventés precios salvo el Boost (ARS 2.500 / 7 días) que es oficial.
- Si no entendés la intención, preguntá: "¿Sos vecino buscando un servicio, técnico o tenés un comercio?"

## TONO
Cercano, barrial, confiable. ServiRed es la red del barrio, no una corporación.`;

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
