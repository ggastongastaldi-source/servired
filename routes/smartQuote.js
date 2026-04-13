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
    // Precios desde MongoDB (actualizados por Tavily/ML)
    let preciosReales = {};
    try {
      const docs = await PrecioMercado.find({});
      docs.forEach(d => { preciosReales[d.rubro] = { baja: d.baja, alta: d.alta }; });
    } catch(e) {
      console.error('[smartQuote] Error leyendo precios de MongoDB:', e.message);
    }
    // Merge fallback: MongoDB tiene prioridad
    const preciosFallback = {
      limpieza_hogar:{baja:7500,alta:12000},servicio_domestico:{baja:48000,alta:80000},
      plomeria:{baja:55000,alta:85000},electricidad:{baja:75000,alta:150000},
      albanileria:{baja:18500,alta:35000},pintura:{baja:6500,alta:12000},
      gasista:{baja:95000,alta:180000},cerrajeria:{baja:60000,alta:120000},
      jardineria:{baja:45000,alta:90000},herreria:{baja:45000,alta:90000},
      carpinteria:{baja:40000,alta:80000},climatizacion:{baja:160000,alta:280000},
      camaras_seguridad:{baja:90000,alta:180000},alarmas:{baja:90000,alta:180000},
      fletes_mudanzas:{baja:70000,alta:150000},mecanica_auxilio:{baja:45000,alta:90000},
      peluqueria_canina:{baja:25000,alta:50000},fumigacion:{baja:42000,alta:85000},
      durlock:{baja:12500,alta:22000},pisos_revestimientos:{baja:18000,alta:35000},
      techistas:{baja:8500,alta:18000},antihumedad:{baja:8500,alta:18000},
      revestimientos_pvc:{baja:12000,alta:22000},mantenimiento_consorcios:{baja:110000,alta:200000},
      paneles_solares:{baja:4000000,alta:18000000},domotica_automatizacion:{baja:800000,alta:3000000},
    };
    Object.keys(preciosFallback).forEach(k=>{ if(!preciosReales[k]) preciosReales[k]=preciosFallback[k]; });

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
