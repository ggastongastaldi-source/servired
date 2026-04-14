const express = require('express');
const Groq = require('groq-sdk');
const router = express.Router();

const PRECIOS_BASE = {
  // 26 rubros oficiales SERVired - abril 2026
  plomeria:55000,        // Destapacion/Colector
  electricidad:75000,    // Tablero principal
  gasista:95000,         // Inst. estufa tiro balanceado
  cerrajeria:60000,      // Apertura urgencia 24hs
  albanileria:18500,     // M2 contrapiso y carpeta
  pintura:6500,          // M2 interior completo
  jardineria:45000,      // Poda altura/desmalezado
  limpieza:55000,        // Pileta tratamiento choque
  servicio_domestico:48000, // Jornada post-obra
  herreria:45000,        // Soldadura/refuerzo porton
  carpinteria:40000,     // Ajuste/armado mueble
  climatizacion:160000,  // Inst. 3000fg sin materiales
  camaras:90000,         // DVR + 4 camaras config
  alarmas:90000,         // DVR + 4 camaras config
  informatico:35000,     // Formateo + backup + SSD
  mudanza:70000,         // Base 2h + 2 ayudantes
  mecanica:45000,        // Cambio pastillas freno
  peluqueria_canina:25000, // Corte + bano raza grande
  fumigacion:42000,      // Integral casa 3 amb
  durlock:12500,         // M2 tabique divisorio
  techistas:8500,        // Limpieza canaletas/m2 memb
  refrigeracion:55000,   // Rep. plaqueta lavarropas
  antihumedad:48000,     // Inst. sanitarios vanitory
  domotica:90000,        // Camaras/alarmas DVR
  reforma:550000,        // Reforma integral
  paneles_solares:200000,// Instalacion paneles
  // Rubros adicionales
  banio:280000, cocina:250000,
  consorcios:110000,     // Abono mantenimiento ascensor
  yesero:9500,           // Alisado rodillado m2
  decoracion:55000,      // Asesoria diseno ambiente
  cuidador:24000, enfermero:38000, instructor:28000,
  fotografo:45000, chofer:22000, cocinero:30000,
  delivery:9000, seguridad:42000,
  // Alias compatibles
  carpintero:40000, cerrajero:60000, albanil:18500,
  techista:8500, herrero:45000,
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
      const key = process.env.GROQ_API_KEY;
      if (key) {
        const groq = new Groq({ apiKey: key });
        const chat = await groq.chat.completions.create({
          model: 'llama3-70b-8192',
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
