const MAPA_CATEGORIAS = {
  'plomero':        'plomeria',
  'electricista':   'electricidad',
  'gasista':        'gasista',
  'pintor':         'pintura',
  'carpintero':     'carpinteria',
  'cerrajero':      'cerrajeria',
  'albañil':        'albanileria',
  'albanil':        'albanileria',
  'techista':       'techista',
  'herrero':        'herreria',
  'mecánico':       'mecanica_ligera',
  'mecanico':       'mecanica_ligera',
  'refrigeración':  'aire_acondicionado',
  'refrigeracion':  'aire_acondicionado',
  'jardinero':      'jardineria',
  'limpieza':       'limpieza_hogar',
  'mudanza':        'fletes_mudanzas',
  'informático':    'servicio_tecnico_pc',
  'informatico':    'servicio_tecnico_pc',
  'yesero':         'durlock',
  'durlock':        'durlock',
  'cuidador':       'cuidado_personas',
  'enfermero':      'cuidado_personas',
  'serv. doméstico':'servicio_domestico',
  'serv. domestico':'servicio_domestico',
  'domestico':      'servicio_domestico',
  'peluquero':      'peluqueria_domicilio',
  'costura':        'costura_arreglos',
  'desinfeccion':   'desinfeccion_plagas',
  'plagas':         'desinfeccion_plagas',
  'impermeabilizacion': 'impermeabilizacion',
  'zinguero':       'zingueria',
  'vidriero':       'vidrieria',
};

const PROMPT_CLASIFICADOR = `Sos un clasificador experto de servicios para la app Servired en Argentina. Tu única tarea es devolver exactamente el nombre de una sola categoría, nada más.

Reglas estrictas:
- Respondé solo con el nombre de la categoría, sin explicaciones, sin frases, sin puntos, sin comillas.
- Las categorías posibles son: plomero, electricista, gasista, pintor, carpintero, cerrajero, albañil, techista, herrero, mecánico, refrigeración, jardinero, limpieza, mudanza, informático, yesero/durlock, cuidador, serv. doméstico.
- Si no estás 100% seguro, respondé "otro".

Lógica de precios internalizados (CABA/GBA):
- Empleada doméstica: 8000 a 9500 pesos la hora
- Servicio mínimo plomero/electricista: 80000 pesos
- Arreglo simple de plomero: 45000 pesos
- Con picado o rotura: hasta 130000 pesos
- Cambio de térmica o disyuntor: 70000 a 80000 pesos

Ejemplos:
Usuario: Tengo una pérdida de agua debajo del lavabo → plomero
Usuario: Se me está filtrando agua por el techo del living → techista
Usuario: Se me rompió un enchufe y no funciona la luz → electricista
Usuario: Huele fuerte a gas en la cocina → gasista
Usuario: Se me inundó la cocina pero parece que viene de la pared → plomero
Usuario: Necesito pintar las paredes del dormitorio → pintor

Ahora clasificá este mensaje y respondé solo con la categoría exacta:`;

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  }

  traducirCategoria(texto) {
    if (!texto) return null;
    const limpio = texto.trim().toLowerCase()
      .replace(/[^a-záéíóúüñ\s.]/gi, '')
      .trim();
    return MAPA_CATEGORIAS[limpio] || null;
  }

  async clasificarPedido(descripcionLibre) {
    if (!this.apiKey) return { rubroKey: null, error: 'Sin GEMINI_API_KEY' };

    try {
      const res = await fetch(`${this.url}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT_CLASIFICADOR + '\n' + descripcionLibre }] }],
        }),
      });
      const data = await res.json();
      const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const categoria = texto.trim().toLowerCase().replace(/[^a-záéíóúüñ\s.\/]/gi, '').trim();
      const rubroKey = this.traducirCategoria(categoria);

      console.log(`[Gemini] "${descripcionLibre}" → "${categoria}" → "${rubroKey}"`);

      return {
        categoriaGemini: categoria,
        rubroKey:        rubroKey,
        resumen:         `Solicitud de ${categoria} en zona CABA/GBA`,
        urgencia:        'media',
      };
    } catch (e) {
      console.error('[Gemini]', e.message);
      return { rubroKey: null, error: e.message };
    }
  }

  async chat(mensaje) {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(`${this.url}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: mensaje }] }] }),
      });
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (e) { return null; }
  }
}

module.exports = new GeminiService();
