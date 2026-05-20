const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const mongoose = require('mongoose');

// ─── MODELO HISTORIAL ───────────────────────────────────────────
const PresupuestoSchema = new mongoose.Schema({
  clienteId:    { type: String, required: true },
  rubro:        { type: String },
  tipoTrabajo:  { type: String },
  complejidad:  { type: String },
  materiales:   [{ item: String, cantidad: String, costoEstimadoARS: Number }],
  manoObra:     { type: Number },
  totalARS:     { type: Number },
  fotoAnalizada:{ type: Boolean, default: false },
  creadoEn:     { type: Date, default: Date.now }
});
const Presupuesto = mongoose.models.Presupuesto || mongoose.model('Presupuesto', PresupuestoSchema);

// ─── MERCADO LIBRE (esqueleto — pegar credenciales cuando estén) ─
const ML_CONFIG = {
  clientId:     process.env.ML_CLIENT_ID     || null,
  clientSecret: process.env.ML_CLIENT_SECRET || null,
  siteId:       'MLA' // Argentina
};

async function buscarPrecioML(nombreMaterial) {
  if (!ML_CONFIG.clientId || !ML_CONFIG.clientSecret) {
    return 0; // Sin credenciales: devuelve 0, no rompe nada
  }
  try {
    const query = encodeURIComponent(nombreMaterial);
    const url = `https://api.mercadolibre.com/sites/${ML_CONFIG.siteId}/search?q=${query}&limit=3`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${process.env.ML_ACCESS_TOKEN}` }
    });
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      // Promedio de los 3 primeros resultados
      const precios = data.results.map(r => r.price);
      return Math.round(precios.reduce((a, b) => a + b, 0) / precios.length);
    }
    return 0;
  } catch (err) {
    console.error('[ML-API]', err.message);
    return 0;
  }
}

// ─── CONTROLLER PRINCIPAL ────────────────────────────────────────
exports.analizarPresupuesto = async (req, res) => {
  try {
    const { imageBase64, rubro, clienteId } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'No se recibió imagen.' });

    // 1. Groq Vision — contexto según rubro elegido
    const contexto = rubro
      ? `El usuario necesita un servicio de ${rubro}. Enfocate en detectar materiales específicos de ese oficio.`
      : 'Analizá la imagen de obra o reparación.';

    const chatCompletion = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${contexto} Identificá materiales y cantidades necesarias. Respondé SOLO en JSON: { "materiales": [{ "nombre": "string", "cantidad": "string" }], "tipoTrabajo": "string", "complejidad": "baja|media|alta" }`
          },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      }],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const info = JSON.parse(chatCompletion.choices[0].message.content);

    // 2. Aladín — mano de obra por complejidad
    const manoObra = { baja: 80000, media: 180000, alta: 350000 };
    const costoManoObra = manoObra[info.complejidad] || 150000;

    // 3. ML — precios reales (devuelve 0 si no hay credenciales aún)
    const desglose = await Promise.all(
      info.materiales.map(async m => ({
        item: m.nombre,
        cantidad: m.cantidad,
        costoEstimadoARS: await buscarPrecioML(m.nombre)
      }))
    );

    const totalMateriales = desglose.reduce((s, m) => s + m.costoEstimadoARS, 0);
    const totalARS = costoManoObra + totalMateriales;

    // 4. Guardar en MongoDB
    if (clienteId) {
      await Presupuesto.create({
        clienteId,
        rubro:         rubro || 'sin_rubro',
        tipoTrabajo:   info.tipoTrabajo,
        complejidad:   info.complejidad,
        materiales:    desglose,
        manoObra:      costoManoObra,
        totalARS,
        fotoAnalizada: true
      });
    }

    res.json({
      success: true,
      tipoTrabajo:        info.tipoTrabajo,
      complejidad:        info.complejidad,
      manoObra:           costoManoObra,
      materialesDesglose: desglose,
      totalMateriales,
      totalARS,
      mlActivo:           !!(ML_CONFIG.clientId),
      nota:               ML_CONFIG.clientId ? 'Precios de Mercado Libre activos' : 'Precios ML pendientes de credenciales'
    });

  } catch (error) {
    const msg = error?.error?.error?.message || error?.message || '';
    console.error('[ALADÍN-VISION]', msg);
    if (error.status === 400 && msg.includes('pixel')) {
        return res.status(400).json({ success: false, code: 'IMAGEN_INVALIDA', error: 'Imagen demasiado pequeña. Sacá otra foto más cerca.' });
    }
    if (error.status === 401) {
        return res.status(503).json({ success: false, code: 'GROQ_AUTH', error: 'Error de autenticación con el motor de visión.' });
    }
    res.status(503).json({ success: false, code: 'VISION_NO_DISPONIBLE', error: 'Servicio de análisis temporalmente ocupado. Reintentá en unos segundos.' });
  }
};

// ─── HISTORIAL ───────────────────────────────────────────────────
exports.obtenerHistorial = async (req, res) => {
  try {
    const { clienteId } = req.params;
    const historial = await Presupuesto.find({ clienteId }).sort({ creadoEn: -1 }).limit(20);
    res.json({ success: true, historial });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial.' });
  }
};
