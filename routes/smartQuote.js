const express = require("express");
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

    // Precios reales abril 2026 por rubro
    const preciosReales = {
      limpieza_hogar:          { baja: 25000,   alta: 60000   },
      servicio_domestico:      { baja: 25000,   alta: 60000   },
      plomeria:                { baja: 150000,  alta: 400000  },
      electricidad:            { baja: 150000,  alta: 400000  },
      albanileria:             { baja: 200000,  alta: 600000  },
      pintura:                 { baja: 180000,  alta: 500000  },
      gasista:                 { baja: 180000,  alta: 500000  },
      cerrajeria:              { baja: 30000,   alta: 120000  },
      aire_acondicionado:      { baja: 80000,   alta: 250000  },
      durlock:                 { baja: 150000,  alta: 400000  },
      impermeabilizacion:      { baja: 120000,  alta: 350000  },
      pisos_revestimientos:    { baja: 180000,  alta: 500000  },
      carpinteria:             { baja: 150000,  alta: 450000  },
      herreria:                { baja: 150000,  alta: 400000  },
      techista:                { baja: 200000,  alta: 600000  },
      jardineria:              { baja: 40000,   alta: 150000  },
      fletes_mudanzas:         { baja: 80000,   alta: 300000  },
      camaras_seguridad:       { baja: 200000,  alta: 800000  },
      alarmas:                 { baja: 180000,  alta: 700000  },
      domotica_automatizacion: { baja: 300000,  alta: 1500000 },
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
      big_mac_base:   6500,
    });
  } catch(e) {
    return res.json({ ok: false, error: e.message, total_estimado: 0 });
  }
});

module.exports = router;
