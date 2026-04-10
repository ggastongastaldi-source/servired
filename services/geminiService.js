const MAPA = {
  'plomero':'plomeria','electricista':'electricidad','gasista':'gasista',
  'pintor':'pintura','carpintero':'carpinteria','cerrajero':'cerrajeria',
  'albanil':'albanileria','albañil':'albanileria','techista':'techista',
  'herrero':'herreria','mecanico':'mecanica_ligera','mecánico':'mecanica_ligera',
  'jardinero':'jardineria','limpieza':'limpieza_hogar','mudanza':'fletes_mudanzas',
  'informatico':'servicio_tecnico_pc','informático':'servicio_tecnico_pc',
  'yesero':'durlock','durlock':'durlock','cuidador':'cuidado_personas',
  'domestico':'servicio_domestico','peluquero':'peluqueria_domicilio',
  'zinguero':'zingueria','vidriero':'vidrieria','refrigeracion':'aire_acondicionado',
};

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';
  }

  traducir(texto) {
    const limpio = (texto||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z\s]/g,'').trim();
    console.log('[Gemini] limpio:', JSON.stringify(limpio));
    for (const [key, val] of Object.entries(MAPA)) {
      const keyNorm = key.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      if (limpio === keyNorm || limpio.includes(keyNorm)) return val;
    }
    return null;
  }

  async clasificarPedido(desc) {
    if (!this.apiKey) { console.error('[Gemini] Sin API key'); return { rubroKey: null }; }
    const prompt = `Sos un clasificador de servicios para Servired Argentina. Respondé SOLO con una palabra de esta lista:
plomero, electricista, gasista, pintor, carpintero, cerrajero, albanil, techista, herrero, mecanico, jardinero, limpieza, mudanza, informatico, yesero, cuidador, domestico, otro

Mensaje del usuario: "${desc}"
Respondé solo con una palabra:`;

    try {
      const res = await fetch(`${this.url}?key=${this.apiKey}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({contents:[{parts:[{text:prompt}]}]}),
      });
      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('[Gemini] raw:', JSON.stringify(raw));
      const rubroKey = this.traducir(raw);
      console.log('[Gemini] rubroKey:', rubroKey);
      return { rubroKey, categoriaGemini: raw.trim(), resumen: `Servicio de ${raw.trim()} en Argentina`, urgencia:'media' };
    } catch(e) {
      console.error('[Gemini] error:', e.message);
      return { rubroKey: null };
    }
  }

  async chat(msg) {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(`${this.url}?key=${this.apiKey}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({contents:[{parts:[{text:msg}]}]}),
      });
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch(e) { return null; }
  }
}

module.exports = new GeminiService();
