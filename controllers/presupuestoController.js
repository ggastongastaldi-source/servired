const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const mongoose = require('mongoose');

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

let mlToken = process.env.ML_ACCESS_TOKEN || '';
let mlTokenExpiry = 0;

async function renovarTokenML() {
  try {
    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${process.env.ML_CLIENT_ID}&client_secret=${process.env.ML_CLIENT_SECRET}`
    });
    const data = await res.json();
    if (data.access_token) {
      mlToken = data.access_token;
      mlTokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
      console.log('[ML-API] Token renovado OK');
    }
  } catch (err) {
    console.error('[ML-API] Error renovando token:', err.message);
  }
}

async function buscarPrecioML(nombreMaterial) {
  try {
    const query = encodeURIComponent(nombreMaterial);
    const url = `https://api.mercadolibre.com/sites/MLA/search?q=${query}&limit=3`;
    if (!mlToken || Date.now() > mlTokenExpiry) await renovarTokenML();
    console.log('[ML-API] buscando:', nombreMaterial, 'token:', mlToken ? mlToken.slice(0,20)+'...' : 'VACIO');
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + mlToken } });
    console.log('[ML-API] status:', res.status);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const precios = data.results.map(r => r.price);
      const precio = Math.round(precios.reduce((a, b) => a + b, 0) / precios.length);
      console.log('[ML-API] OK:', nombreMaterial, '->', precio, 'ARS');
      return precio;
    }
    console.log('[ML-API] sin resultados para:', nombreMaterial);
    return 0;
  } catch (err) {
    console.error('[ML-API] ERROR:', err.message, 'material:', nombreMaterial);
    return 0;
  }
}

exports.analizarPresupuesto = async (req, res) => {
  try {
    const { imageBase64, rubro, clienteId } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'No se recibió imagen.' });

    const contexto = rubro
      ? `El usuario necesita un servicio de ${rubro}. Enfocate en detectar materiales específicos de ese oficio.`
      : 'Analizá la imagen de obra o reparación.';

    console.log('[ALADÍN-VISION] img size:', imageBase64.length, 'rubro:', rubro);

    const chatCompletion = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `${contexto} Identificá materiales y cantidades necesarias. Respondé SOLO en JSON: { "materiales": [{ "nombre": "string", "cantidad": "string" }], "tipoTrabajo": "string", "complejidad": "baja|media|alta" }` },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      }],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const info = JSON.parse(chatCompletion.choices[0].message.content);
    const manoObra = { baja: 80000, media: 180000, alta: 350000 };
    const costoManoObra = manoObra[info.complejidad] || 150000;

    const desglose = await Promise.all(
      info.materiales.map(async m => ({
        item: m.nombre,
        cantidad: m.cantidad,
        costoEstimadoARS: await buscarPrecioML(m.nombre)
      }))
    );

    const totalMateriales = desglose.reduce((s, m) => s + m.costoEstimadoARS, 0);
    const totalARS = costoManoObra + totalMateriales;

    if (clienteId) {
      await Presupuesto.create({
        clienteId, rubro: rubro || 'sin_rubro',
        tipoTrabajo: info.tipoTrabajo, complejidad: info.complejidad,
        materiales: desglose, manoObra: costoManoObra, totalARS, fotoAnalizada: true
      });
    }

    res.json({
      success: true, tipoTrabajo: info.tipoTrabajo, complejidad: info.complejidad,
      manoObra: costoManoObra, materialesDesglose: desglose,
      totalMateriales, totalARS, mlActivo: true,
      nota: 'Precios de Mercado Libre activos'
    });

  } catch (error) {
    const msg = error?.error?.error?.message || error?.message || '';
    console.error('[ALADÍN-VISION]', msg);
    if (error.status === 400 && msg.includes('pixel'))
      return res.status(400).json({ success: false, code: 'IMAGEN_INVALIDA', error: 'Imagen demasiado pequeña.' });
    res.status(503).json({ success: false, code: 'VISION_NO_DISPONIBLE', error: 'Servicio temporalmente ocupado.' });
  }
};

exports.obtenerHistorial = async (req, res) => {
  try {
    const historial = await Presupuesto.find({ clienteId: req.params.clienteId }).sort({ creadoEn: -1 }).limit(20);
    res.json({ success: true, historial });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial.' });
  }
};
