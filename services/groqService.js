// ============================================
// GROQ SERVICE - Motor de inferencia ultra-rápida
// Matching en tiempo real + mensajes de infiltración
// ============================================

class GroqService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.url = 'https://api.groq.com/openai/v1/chat/completions';
    this.model = 'llama3-8b-8192';
  }

  async inferir(prompt, maxTokens = 300) {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.3,
        }),
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (e) {
      console.error('[Groq]', e.message);
      return null;
    }
  }

  async generarMensajeInfiltracion({ nombreTrabajador, rubro, zona, scoreBriones }) {
    return this.inferir(
      `Sos Glóbulo Rojo, el motor de Servired en GBA Argentina. 
       Escribí un mensaje breve en español rioplatense para notificar al trabajador "${nombreTrabajador}" 
       que hay un pedido de "${rubro}" cerca suyo en ${zona}. 
       Su score de perfil es ${scoreBriones}/100.
       Máximo 2 oraciones, directo, motivador, sin emojis raros.`,
      150
    );
  }

  async rankearConIA(trabajadores, rubro, zona) {
    if (!trabajadores.length) return trabajadores;
    const resumen = trabajadores.map((t, i) =>
      `${i + 1}. ${t.nombre || 'Sin nombre'} | Jobs: ${t.trabajosCompletados || 0} | Rating: ${t.rating || 0} | Verificado: ${t.verificado ? 'sí' : 'no'}`
    ).join('\n');

    const respuesta = await this.inferir(
      `Sos el motor de matching de Servired para ${rubro} en ${zona}, Argentina.
       Estos son los candidatos disponibles:
       ${resumen}
       Respondé SOLO con un JSON: {"orden": [<números de posición en el orden óptimo>], "razon": "<1 oración>"}`,
      200
    );

    try {
      const parsed = JSON.parse((respuesta || '{}').replace(/```json|```/g, '').trim());
      if (parsed.orden?.length) {
        return parsed.orden.map(i => trabajadores[i - 1]).filter(Boolean);
      }
    } catch (_) {}
    return trabajadores;
  }
}

module.exports = new GroqService();
