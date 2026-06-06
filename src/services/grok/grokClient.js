'use strict';
const Groq = require('groq-sdk');
const MODELO_DEFAULT = 'llama-3.1-8b-instant';
let _instance = null;
function getGroq() {
  if (!_instance) _instance = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 8000 });
  return _instance;
}
async function inferir(prompt, maxTokens = 300) {
  if (!process.env.GROQ_API_KEY) return null;
  try {
    const chat = await getGroq().chat.completions.create({
      model: MODELO_DEFAULT,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.3,
    });
    return chat.choices?.[0]?.message?.content || null;
  } catch (_) { return null; }
}
async function generarMensajeNotificacion({ nombreTrabajador, rubro, zona, scoreBriones }) {
  return inferir(`Sos Glóbulo Rojo, motor de Servired GBA Argentina. Notificá a "${nombreTrabajador}" que hay un pedido de "${rubro}" en ${zona}. Score: ${scoreBriones}/100. Máximo 2 oraciones, rioplatense, sin emojis raros.`, 150);
}
async function rankearCandidatos(candidatos, rubro, zona) {
  if (!candidatos.length) return candidatos;
  const resumen = candidatos.map((t, i) => `${i+1}. ${t.nombre||'Sin nombre'} | Jobs: ${t.trabajosCompletados||0} | Rating: ${t.rating||0} | Verificado: ${t.verificado?'sí':'no'}`).join('\n');
  const respuesta = await inferir(`Motor de matching Servired para ${rubro} en ${zona}.\n${resumen}\nRespondé SOLO con JSON: {"orden":[<posiciones>],"razon":"<1 oración>"}`, 200);
  try {
    const parsed = JSON.parse((respuesta||'{}').replace(/```json|```/g,'').trim());
    if (parsed.orden?.length) return parsed.orden.map(i => candidatos[i-1]).filter(Boolean);
  } catch (_) {}
  return candidatos;
}
module.exports = { inferir, generarMensajeNotificacion, rankearCandidatos };
