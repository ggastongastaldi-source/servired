const toolRegistry    = require('./ToolRegistry');
const contextBuilder  = require('./ContextBuilder');
const { createLLMProvider } = require('./LLMProvider');
const GiaConversation = require('../../models/GiaConversation');
const { registrarEvento } = require('../activityService');

const llm = createLLMProvider();

async function consultar({ userId, comercioId, modulo, mensaje, perfil = 'comerciante' }) {
  const context = { userId, comercioId, modulo, mensaje, perfil };

  const conv = await GiaConversation.findOne({ comercioId, userId }).lean();
  const historial = conv?.mensajes || [];

  const herramientas = toolRegistry.getRelevant(context);
  const toolResults = await Promise.allSettled(
    herramientas.map(t => t.execute(context).then(r => ({ ...r, toolName: t.name })))
  );
  const resultadosOk = toolResults
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  const messages = contextBuilder.build({
    toolResults: resultadosOk,
    conversationHistory: historial,
    userMessage: mensaje,
    context
  });

  const { content: respuesta, tokensUsed } = await llm.complete(messages);

  await GiaConversation.findOneAndUpdate(
    { comercioId, userId },
    {
      $push: {
        mensajes: {
          $each: [
            { role: 'user',      content: mensaje,   timestamp: new Date() },
            { role: 'assistant', content: respuesta, timestamp: new Date() }
          ]
        }
      },
      $set: { ultimaActividad: new Date() }
    },
    { upsert: true }
  );

  if (comercioId) {
    registrarEvento({
      comercioId,
      tipo: 'gia_recomendacion',
      modulo: modulo || 'sistema',
      descripcion: `G.I.A. respondió en módulo ${modulo}: "${mensaje.slice(0, 80)}..."`,
      actor: { tipo: 'gia', nombre: 'G.I.A.' },
      nivelRiesgo: 'info',
      payload: { pregunta: mensaje, tokensUsed }
    }).catch(() => {});
  }

  return { respuesta, tokensUsed };
}

module.exports = { consultar };
