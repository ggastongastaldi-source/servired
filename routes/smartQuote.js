const express = require('express');
const router = express.Router();

const PRECIOS_BASE = {
  limpieza:15000, plomeria:35000, electricidad:40000, pintura:28000,
  gasista:45000, cerrajeria:25000, jardineria:22000, mudanza:80000,
  albanileria:42000, techistas:55000, herreria:50000, carpinteria:38000,
  durlock:45000, revestimientos:42000, antihumedad:50000, climatizacion:60000,
  mecanica:35000, consorcios:25000, fumigacion:32000, peluqueria_canina:18000,
  paneles_solares:180000, banio:250000, cocina:220000, camaras:55000,
  alarmas:50000, domotica:95000, reforma:550000,
  servicio_domestico:18000, refrigeracion:45000, informatico:30000,
  yesero:32000, cuidador:22000, enfermero:35000, instructor:25000,
  fotografo:40000, chofer:20000, cocinero:28000, delivery:8000,
  seguridad:40000,
};

const ZONAS = {
  caba:['palermo','belgrano','recoleta','caballito','flores','villa_urquiza','san_telmo','microcentro','almagro','boedo','colegiales','nunez','saavedra','devoto','villa_del_parque'],
  gba_norte:['san_isidro','tigre','vicente_lopez','olivos','martinez','san_fernando','pilar'],
  gba_sur:['lanus','avellaneda','quilmes','lomas_de_zamora','bernal','wilde'],
  gba_oeste:['moron','merlo','moreno','la_matanza','ramos_mejia','ituzaingo'],
};
const MULT_ZONA = { caba:1.0, gba_norte:0.95, gba_sur:0.85, gba_oeste:0.82 };

router.post('/', async (req, res) => {
  try {
    const { rubro, descripcion, zona, complejidad } = req.body;
    if (!rubro) return res.json({ ok:false, error:'Falta rubro' });

    const base = PRECIOS_BASE[rubro] || 30000;
    const multZona = (() => {
      const z = (zona||'').toLowerCase();
      for (const [k,arr] of Object.entries(ZONAS)) {
        if (arr.some(b => z.includes(b))) return MULT_ZONA[k];
      }
      return 1.0;
    })();
    const multComp = { basico:0.8, estandar:1.0, complejo:1.4, urgente:1.7 }[complejidad||'estandar'] || 1.0;
    const estimado = Math.round(base * multZona * multComp);
    const comision = Math.round(estimado * 0.20);
    const pagoWorker = estimado - comision;

    // Groq con fallback robusto
    let descripcionIA = '';
    try {
      const { default: Groq } = await import('groq-sdk');
      const key = process.env.GROQ_API_KEY;
      if (key && key.startsWith('gsk_')) {
        const groq = new Groq({ apiKey: key });
        const chat = await groq.chat.completions.create({
          model: 'llama3-8b-8192',
          max_tokens: 120,
          messages: [{
            role: 'user',
            content: 'Sos experto en servicios del hogar Argentina abril 2026. Para "' + rubro + '" en "' + (zona||'CABA') + '" complejidad "' + (complejidad||'estandar') + '" presupuesto $' + estimado + ' ARS. Describe en 1 oracion breve que incluye. Solo el texto.'
          }]
        });
        descripcionIA = chat.choices[0]?.message?.content?.trim() || '';
      }
    } catch(e) {
      console.error('[smartQuote] Groq:', e.message.slice(0,80));
    }

    res.json({
      ok: true, rubro, estimado, comision,
      pago_worker: pagoWorker,
      zona: zona||'CABA',
      complejidad: complejidad||'estandar',
      descripcion_ia: descripcionIA,
      desglose: { base, mult_zona: multZona, mult_complejidad: multComp }
    });
  } catch(e) {
    console.error('[smartQuote] Error:', e.message);
    res.json({ ok:false, error: e.message });
  }
});

module.exports = router;
