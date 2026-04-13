const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const ZONAS = {
  caba:['palermo','belgrano','recoleta','caballito','flores','villa_urquiza','san_telmo','microcentro','almagro','boedo'],
  gba_norte:['san_isidro','tigre','vicente_lopez','olivos','martinez'],
  gba_sur:['lanus','avellaneda','quilmes','lomas_de_zamora'],
  gba_oeste:['moron','merlo','moreno','la_matanza'],
};
const MULT_ZONA = { caba:1.0, gba_norte:0.95, gba_sur:0.85, gba_oeste:0.82 };

const PRECIOS_BASE = {
  limpieza:3500, plomeria:5500, electricidad:6000, pintura:4500,
  gasista:7000, cerrajeria:4000, jardineria:3800, mudanza:12000,
  albanileria:6500, techistas:8000, herreria:7500, carpinteria:6000,
  durlock:7000, revestimientos:6500, antihumedad:8000, climatizacion:9000,
  mecanica:5000, consorcios:4000, fumigacion:5500, peluqueria_canina:3000,
  paneles_solares:25000, banio:35000, cocina:30000, camaras:8000,
  alarmas:7500, domotica:15000, reforma:80000,
};

router.post('/', async (req, res) => {
  try {
    const { rubro, descripcion, zona, complejidad } = req.body;
    if (!rubro) return res.json({ ok:false, error:'Falta rubro' });

    const base = PRECIOS_BASE[rubro] || 5000;
    const multZona = (() => {
      const z = (zona||'').toLowerCase();
      for (const [k,v] of Object.entries(ZONAS)) {
        if (v.some(b => z.includes(b))) return MULT_ZONA[k];
      }
      return 1.0;
    })();
    const multComp = { basico:0.8, estandar:1.0, complejo:1.4, urgente:1.7 }[complejidad||'estandar'] || 1.0;
    const estimado = Math.round(base * multZona * multComp);
    const comision = Math.round(estimado * 0.20);
    const pagoWorker = estimado - comision;

    // Enriquecer con Groq
    let descripcionIA = '';
    try {
      const chat = await groq.chat.completions.create({
        model: 'llama3-8b-8192',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Sos un experto en servicios del hogar en Argentina. Para el servicio de "${rubro}" con descripcion "${descripcion||'trabajo estandar'}" en zona "${zona||'CABA'}", complejidad "${complejidad||'estandar'}", da una descripcion breve de 2 lineas de lo que incluye el presupuesto de $${estimado} ARS. Solo el texto, sin saludos.`
        }]
      });
      descripcionIA = chat.choices[0]?.message?.content?.trim() || '';
    } catch(e) { descripcionIA = ''; }

    res.json({
      ok: true,
      rubro,
      estimado,
      comision,
      pago_worker: pagoWorker,
      zona: zona || 'CABA',
      complejidad: complejidad || 'estandar',
      descripcion_ia: descripcionIA,
      desglose: {
        base,
        mult_zona: multZona,
        mult_complejidad: multComp,
      }
    });
  } catch(e) {
    console.error('[smartQuote] Error:', e.message);
    res.json({ ok:false, error: e.message });
  }
});

module.exports = router;
