// ============================================
// GEMINI SERVICE - Cerebro Multimodal
// Clasifica pedidos en los 26 rubros de Servired
// ============================================

const RUBROS = {
  1: 'albanileria', 2: 'plomeria', 3: 'electricidad',
  4: 'limpieza_hogar', 5: 'pintura', 6: 'gasista',
  7: 'cerrajeria', 8: 'aire_acondicionado', 9: 'durlock',
  10: 'impermeabilizacion', 11: 'zingueria', 12: 'construccion_seco',
  13: 'pisos_revestimientos', 14: 'herreria', 15: 'carpinteria',
  16: 'vidrieria', 17: 'techista', 18: 'jardineria',
  19: 'fletes_mudanzas', 20: 'reparacion_celulares', 21: 'servicio_tecnico_pc',
  22: 'cuidado_personas', 23: 'peluqueria_domicilio', 24: 'mecanica_ligera',
  25: 'costura_arreglos', 26: 'desinfeccion_plagas',
};

const RUBROS_LABELS = Object.entries(RUBROS).map(([id, key]) => `${id}:${key}`).join(', ');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`;
  }

  async clasificarPedido(descripcionLibre) {
    if (!this.apiKey) return { rubroId: null, rubroKey: null, error: 'Sin GEMINI_API_KEY' };

    const prompt = `Sos el motor semántico de Servired, marketplace de servicios del hogar en GBA/CABA Argentina.
El cliente describió su necesidad así: "${descripcionLibre}"

Tenés estos 26 rubros disponibles: ${RUBROS_LABELS}

Respondé SOLO con un JSON sin markdown, así:
{"rubroId": <número>, "rubroKey": "<clave>", "urgencia": "baja|media|alta", "resumen": "<descripción corta del problema en 1 oración>"}`;

    try {
      const res = await fetch(`${this.url}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const data = await res.json();
      const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const limpio = texto.replace(/```json|```/g, '').trim();
      return JSON.parse(limpio);
    } catch (e) {
      console.error('[Gemini]', e.message);
      return { rubroId: null, rubroKey: null, error: e.message };
    }
  }

  async chat(mensaje) {
    if (!this.apiKey) return 'Sin GEMINI_API_KEY';
    try {
      const res = await fetch(`${this.url}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: mensaje }] }] }),
      });
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (e) {
      return null;
    }
  }
}

module.exports = new GeminiService();
