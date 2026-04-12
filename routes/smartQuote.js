const router = require('express').Router();
const groqService = require('../services/groqService');
const aladdin = require('../services/aladdinEngine');

router.post('/smart-quote', async (req, res) => {
  try {
    const { request_text, user_location, property_type = 'casa', urgency = 'media' } = req.body;
    if (!request_text) return res.status(400).json({ error: 'Describí qué necesitás' });

    // Groq analiza el pedido y estima materiales
    const prompt = `Sos un experto en construcción y servicios del hogar en Argentina.
El cliente necesita: "${request_text}" en un/a ${property_type}, urgencia: ${urgency}.

Respondé SOLO con JSON sin markdown:
{
  "rubro": "nombre del rubro",
  "rubroKey": "clave_del_rubro",
  "materiales": [{"nombre":"...","precio_estimado":1234}],
  "mano_de_obra_estimada": 12345,
  "descripcion": "descripción breve del trabajo"
}

Precios en ARS reales de Argentina 2024. Sin explicaciones.`;

    const raw = await groqService.inferir(prompt, 500);
    let data;
    try {
      data = JSON.parse((raw||'{}').replace(/```json|```/g,'').trim());
    } catch(e) {
      data = { rubro: 'general', materiales: [], mano_de_obra_estimada: 0 };
    }

    // Aladín calcula presupuesto del trabajo
    let presupuesto = null;
    try {
      presupuesto = aladdin.calcularPresupuesto(data.rubroKey || 'albanileria', 'baja');
    } catch(_) {}

    const materialesTotal = (data.materiales||[]).reduce((s,m) => s + (m.precio_estimado||0), 0);
    const fleteEstimado = 8500; // 1 Big Mac = flete base
    const totalEstimado = materialesTotal + (presupuesto?.precio_total || data.mano_de_obra_estimada || 0) + fleteEstimado;

    res.json({
      ok: true,
      rubro: data.rubro,
      descripcion: data.descripcion,
      materiales: data.materiales || [],
      materiales_total: materialesTotal,
      mano_de_obra: presupuesto?.precio_total || data.mano_de_obra_estimada || 0,
      flete_estimado: fleteEstimado,
      total_estimado: totalEstimado,
      confianza: data.materiales?.length > 0 ? 'alta' : 'media',
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
