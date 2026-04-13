const express = require("express");
const PrecioMercado = require("../models/PrecioMercado");
const router = express.Router();
const aladdin = require("../services/aladdinEngine");
const groq = require("../services/groqService");

router.post("/", async (req, res) => {
  const { rubro, complejidad, texto, factor } = req.body;

  if (texto && !rubro) {
    try {
      const prompt = `Sos el Motor Aladin de SERVired, plataforma de servicios del hogar en Buenos Aires Argentina.
Cliente describio: "${texto}"
Hoy es abril 2026. Dolar blue $1300 ARS. m2 construccion CABA USD 2500. Big Mac ARS 6500.
Identificar rubros y estimar precios REALISTAS en ARS para mano de obra en CABA/GBA.
Ejemplos de precios reales abril 2026:
- Pintura 1 ambiente: $180000-$350000 mano de obra
- Plomeria punto nuevo: $120000-$250000
- Electricidad circuito: $150000-$300000
- Camaras seguridad 4 camaras instaladas: $400000-$800000
- Domotica basica hogar: $600000-$1500000
- Alarma perimetral: $350000-$700000
Responde SOLO JSON valido sin texto extra:
{"descripcion":"descripcion breve","rubros":[{"nombre":"Nombre","precio_mano_obra":123456,"descripcion":"detalle"}],"total_mano_obra":123456,"nota":"aclaracion","confianza":"alta"}`;
      const resp = await groq.inferir(prompt, 800);
      if (!resp) throw new Error("Groq no respondio");
      const parsed = JSON.parse(resp.replace(/\`\`\`json|\`\`\`/g, "").trim());
      return res.json({ ok: true, modo: "groq", ...parsed });
    } catch(e) {
      return res.json({ ok: false, error: e.message, modo: "groq" });
    }
  }

  try {
    if (!rubro) return res.json({ ok: false, error: "falta rubro", total_estimado: 0 });
    const f = parseFloat(factor) || 1;
    const result = aladdin.calcularPresupuesto(rubro, complejidad || "baja");

    // Precios desde MongoDB (actualizados por Tavily/ML)
    let preciosReales = {};
    try {
      const docs = await PrecioMercado.find({});
      docs.forEach(d => { preciosReales[d.rubro] = { baja: d.baja, alta: d.alta }; });
    } catch(e) {
      console.error('[smartQuote] Error leyendo precios de MongoDB:', e.message);
    }
    // Fallback hardcodeado si MongoDB falla
    const preciosReales = {
      // Precios por HORA de mano de obra simple
      limpieza_hogar:          { baja: 8000,    alta: 18000   },
      servicio_domestico:      { baja: 8000,    alta: 16000   },
      cerrajeria:              { baja: 40000,   alta: 120000  },
      jardineria:              { baja: 12000,   alta: 35000   },
      mecanica_auxilio:        { baja: 60000,   alta: 200000  },
      peluqueria_canina:       { baja: 18000,   alta: 60000   },
      // Precios por TRABAJO completo (ancla: baño $3.4M-$5.2M)
      plomeria:                { baja: 200000,  alta: 600000  },
      electricidad:            { baja: 180000,  alta: 550000  },
      albanileria:             { baja: 600000,  alta: 1800000 },
      pintura:                 { baja: 400000,  alta: 1200000 },
      gasista:                 { baja: 200000,  alta: 700000  },
      durlock:                 { baja: 350000,  alta: 1000000 },
      impermeabilizacion:      { baja: 350000,  alta: 1000000 },
      pisos_revestimientos:    { baja: 500000,  alta: 1500000 },
      carpinteria:             { baja: 600000,  alta: 2000000 },
      herreria:                { baja: 500000,  alta: 1800000 },
      techista:                { baja: 500000,  alta: 1800000 },
      techistas:               { baja: 500000,  alta: 1800000 },
      antihumedad:             { baja: 350000,  alta: 1200000 },
      revestimientos_pvc:      { baja: 300000,  alta: 900000  },
      climatizacion:           { baja: 400000,  alta: 1200000 },
      fletes_mudanzas:         { baja: 250000,  alta: 900000  },
      mantenimiento_consorcios:{ baja: 250000,  alta: 800000  },
      fumigacion:              { baja: 180000,  alta: 600000  },
      aire_acondicionado:      { baja: 400000,  alta: 1200000 },
      // Proyectos grandes
      camaras_seguridad:       { baja: 900000,  alta: 3500000 },
      alarmas:                 { baja: 700000,  alta: 2800000 },
      domotica_automatizacion: { baja: 2000000, alta: 9000000 },
      paneles_solares:         { baja: 4000000, alta: 18000000},
    };

    const nivel = complejidad === "alta" ? "alta" : "baja";
    const precioBase = preciosReales[rubro]?.[nivel] || result.precio_total;
    const precioTotal = Math.round(precioBase * f);
    const comision = Math.round(precioTotal * 0.20);
    const manoObra = precioTotal - comision;
    const materiales = Math.round(precioTotal * 0.30);

    return res.json({
      ok: true,
      modo: "aladin",
      total_estimado: precioTotal,
      mano_de_obra:   manoObra,
      materiales:     materiales,
      comision:       comision,
      big_mac_base:   9000,
    });
  } catch(e) {
    return res.json({ ok: false, error: e.message, total_estimado: 0 });
  }
});

module.exports = router;
