const express = require("express");
const router = express.Router();
const aladdin = require("../services/aladdinEngine");
const groq = require("../services/groqService");

// POST /api/smart-quote
// body: {rubro, complejidad} → cálculo directo Aladín
// body: {texto} → Groq analiza y devuelve presupuesto inteligente
router.post("/", async (req, res) => {
  const { rubro, complejidad, texto } = req.body;

  // Modo texto libre con Groq
  if (texto && !rubro) {
    try {
      const hoy = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
      const prompt = `Sos el Motor Aladín de SERVired, plataforma de servicios del hogar en Buenos Aires, Argentina.
El cliente describió: "${texto}"
Fecha: ${hoy}. Dólar blue hoy ~$1300 ARS. m² construcción CABA ~$2500 USD.

Tu tarea: identificar qué rubros intervienen y estimar precios en ARS para mano de obra (sin artefactos).

Respondé SOLO con JSON válido, sin texto extra:
{
  "descripcion": "descripción breve del trabajo",
  "rubros": [
    {"nombre": "Plomería", "precio_mano_obra": 150000, "descripcion": "instalación de cañerías"},
    {"nombre": "Electricidad", "precio_mano_obra": 120000, "descripcion": "circuitos y tablero"}
  ],
  "total_mano_obra": 270000,
  "nota": "Los materiales y artefactos se cotizan aparte según calidad elegida",
  "confianza": "alta"
}`;

      const respuesta = await groq.inferir(prompt, 600);
      if (!respuesta) throw new Error("Groq no respondió");

      const clean = respuesta.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      return res.json({ ok: true, modo: 'groq', ...parsed });
    } catch (e) {
      return res.json({ ok: false, error: e.message, modo: 'groq' });
    }
  }

  // Modo rubro directo con Aladín
  try {
    if (!rubro) return res.json({ ok: false, error: "falta rubro", total_estimado: 0 });
    const result = aladdin.calcularPresupuesto(rubro, complejidad || "baja");
    return res.json({
      ok: true,
      modo: 'aladin',
      total_estimado:  result.precio_total,
      mano_de_obra:    result.pago_trabajador,
      materiales:      Math.round(result.precio_total * 0.3),
      comision:        result.comision,
      big_mac_base:    result.big_mac_base,
      coeficiente:     result.coeficiente,
    });
  } catch (e) {
    return res.json({ ok: false, error: e.message, total_estimado: 0 });
  }
});

module.exports = router;
