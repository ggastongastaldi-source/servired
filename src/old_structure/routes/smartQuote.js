const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');

// Precios reales abril 2026 indexados Big Mac $10.500
// Fuente: relevamiento AMBA + indice Big Mac
const PRECIOS = {
  limpieza:          { baja: 35000,   alta: 75000   },
  servicio_domestico:{ baja: 35000,   alta: 75000   },
  plomeria:          { baja: 180000,  alta: 480000  },
  electricidad:      { baja: 180000,  alta: 480000  },
  albanileria:       { baja: 250000,  alta: 750000  },
  pintura:           { baja: 220000,  alta: 650000  },
  gasista:           { baja: 220000,  alta: 650000  },
  cerrajeria:        { baja: 45000,   alta: 160000  },
  jardineria:        { baja: 55000,   alta: 180000  },
  mudanza:           { baja: 100000,  alta: 380000  },
  climatizacion:     { baja: 110000,  alta: 320000  },
  refrigeracion:     { baja: 80000,   alta: 250000  },
  durlock:           { baja: 180000,  alta: 500000  },
  antihumedad:       { baja: 150000,  alta: 450000  },
  revestimientos:    { baja: 220000,  alta: 650000  },
  carpinteria:       { baja: 180000,  alta: 550000  },
  herreria:          { baja: 180000,  alta: 500000  },
  techistas:         { baja: 250000,  alta: 750000  },
  fumigacion:        { baja: 55000,   alta: 150000  },
  peluqueria_canina: { baja: 20000,   alta: 45000   },
  camaras:           { baja: 250000,  alta: 950000  },
  alarmas:           { baja: 220000,  alta: 850000  },
  domotica:          { baja: 400000,  alta: 1800000 },
  informatico:       { baja: 35000,   alta: 120000  },
  paneles_solares:   { baja: 500000,  alta: 1500000 },
  banio:             { baja: 800000,  alta: 2500000 },
  cocina:            { baja: 700000,  alta: 2200000 },
  reforma:           { baja: 1500000, alta: 5000000 },
  consorcios:        { baja: 110000,  alta: 320000  },
  mecanica:          { baja: 45000,   alta: 160000  },
  // alias
  carpintero:        { baja: 180000,  alta: 550000  },
  cerrajero:         { baja: 45000,   alta: 160000  },
  albanil:           { baja: 250000,  alta: 750000  },
  techista:          { baja: 250000,  alta: 750000  },
  herrero:           { baja: 180000,  alta: 500000  },
};

const MULT_ZONA = {
  palermo:1.0, belgrano:1.0, recoleta:1.05, caballito:0.95,
  flores:0.9, villa_urquiza:0.92, san_telmo:0.95, microcentro:1.05,
  almagro:0.93, boedo:0.9, colegiales:0.97, nunez:0.98,
  san_isidro:0.95, tigre:0.88, vicente_lopez:0.97,
  lanus:0.82, avellaneda:0.83, quilmes:0.80,
  moron:0.80, merlo:0.75, moreno:0.72, la_matanza:0.75,
};

router.post('/', async (req, res) => {
  try {
    const { rubro, complejidad, zona, descripcion, texto } = req.body;

    // Modo texto libre con Groq
    if (texto && !rubro) {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const chat = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `Sos el motor Aladin de SERVired. Cliente describio: "${texto}". Abril 2026, Big Mac ARS 10500, dolar blue $1450. Identificar rubros y dar precios REALISTAS en ARS mano de obra CABA/GBA. Responde SOLO JSON: {"descripcion":"...","rubros":[{"nombre":"...","precio_mano_obra":123456,"descripcion":"..."}],"total_mano_obra":123456}`
          }]
        });
        const raw = chat.choices[0]?.message?.content?.trim() || '';
        const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());
        return res.json({ ok: true, modo: 'groq', ...parsed });
      } catch(e) {
        console.error('[smartQuote] Groq texto:', e.message.slice(0,60));
        return res.json({ ok: false, error: e.message });
      }
    }

    if (!rubro) return res.json({ ok: false, error: 'Falta rubro', total_estimado: 0 });

    const nivel = (complejidad === 'alta' || complejidad === 'complejo') ? 'alta' : 'baja';
    const precioBase = PRECIOS[rubro]?.[nivel] || 80000;

    const zKey = Object.keys(MULT_ZONA).find(k => (zona||'').toLowerCase().includes(k));
    const multZona = zKey ? MULT_ZONA[zKey] : 1.0;

    const precioTotal = Math.round(precioBase * multZona);
    const comision = Math.round(precioTotal * 0.20);
    const manoObra = Math.round(precioTotal * 0.65);
    const materiales = Math.round(precioTotal * 0.15);

    // Descripcion IA
    let descripcionIA = '';
    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const chat = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 80,
        messages: [{
          role: 'user',
          content: `SERVired abril 2026. Servicio: ${rubro} en ${zona||'CABA'}, nivel ${nivel}. Precio $${precioTotal} ARS. Describe en 1 oracion que incluye. Solo texto.`
        }]
      });
      descripcionIA = chat.choices[0]?.message?.content?.trim() || '';
    } catch(e) {
      console.error('[smartQuote] Groq IA:', e.message.slice(0,60));
    }

    res.json({
      ok: true, modo: 'aladin',
      rubro, zona: zona||'CABA',
      complejidad: nivel,
      estimado: precioTotal,
      total_estimado: precioTotal,
      mano_de_obra: manoObra,
      materiales: materiales,
      comision: comision,
      pago_worker: precioTotal - comision,
      descripcion_ia: descripcionIA,
      big_mac_base: 10500,
    });

  } catch(e) {
    console.error('[smartQuote] Error:', e.message);
    res.json({ ok: false, error: e.message, total_estimado: 0 });
  }
});

module.exports = router;
