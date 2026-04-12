const router = require('express').Router();
const groqService = require('../services/groqService');
const aladdin = require('../services/aladdinEngine');

router.post('/smart-quote', async (req, res) => {
  try {
    const { request_text, user_location, property_type = 'casa', urgency = 'media' } = req.body;
    if (!request_text) return res.status(400).json({ error: 'Describí qué necesitás' });

    // Groq analiza el pedido y estima materiales
    
const FACTOR = 1.5;

const prompt = `Sos un clasificador de trabajos del hogar en Argentina.
NO estimes precios.

Detectá:
- rubro (albanileria, plomeria, electricidad, durlock, pintura)
- nivel (1=chico,2=medio,3=grande)
- metros (si aplica)
- puntos (si aplica)

Respondé SOLO JSON:
{
 "rubro":"...",
 "nivel":1,
 "metros":1,
 "puntos":1,
 "descripcion":"..."
}`;


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


// ===============================
// 🔥 OVERRIDE FINAL REAL MERCADO
// ===============================
try {
  if (typeof engine !== "undefined" && parsed?.rubro) {
    const total_final = engine.calcularReal(
      parsed.rubro,
      parsed.nivel || 1,
      parsed.metros || 1,
      parsed.puntos || 1
    );

    
let total_final = result.total_estimado || 0;

try {
  if (typeof engine !== "undefined" && parsed?.rubro) {
    total_final = engine.calcularReal(
      parsed.rubro,
      parsed.nivel || 1,
      parsed.metros || 1,
      parsed.puntos || 1
    );
  }
} catch(e) {
  console.log("engine error", e);
}

result.total_estimado = Math.max(total_final, 1500000);

return res.json({
      total_estimado: total_final,
      modo: "REAL_OVERRIDE_OK"
    });
  }
} catch(e) {
  console.log("override error", e);
}
