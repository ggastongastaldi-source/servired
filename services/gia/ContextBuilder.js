const MAX_CONTEXT_CHARS = 2000;

const SYSTEM_BASE = `Sos G.I.A., el asistente inteligente de ServiRed Comercio.
Ayudás a comerciantes de pequeños y medianos negocios del AMBA (Argentina).
Respondé de forma concisa, práctica y en español rioplatense.
No inventés datos. Si no tenés información, decilo claramente.
Si el contexto incluye la marca SIN_EVIDENCIA_DOCUMENTAL para una pregunta institucional (que es ServiRed, que es GIA, quien lo creo, como funciona un modulo), respondé explícitamente que no dispones de esa información confirmada. No completes con conocimiento general del modelo.
Cuando propongas acciones que implican dinero o impacto en el negocio, avisá que requieren confirmación del comerciante.`;

function build({ toolResults = [], conversationHistory = [], userMessage, context }) {
  const sorted = [...toolResults].sort((a, b) => {
    const order = { low: 0, medium: 1, high: 2 };
    return (order[a.cost] || 0) - (order[b.cost] || 0);
  });

  let contextBlock = '';
  for (const result of sorted) {
    const line = `[${result.toolName}]: ${result.summary}\n`;
    if ((contextBlock + line).length > MAX_CONTEXT_CHARS) break;
    contextBlock += line;
  }

  const systemPrompt = `${SYSTEM_BASE}

Perfil del usuario: ${context?.perfil || 'comerciante'}
Módulo activo: ${context?.modulo || 'sistema'}

Contexto operativo actual:
${contextBlock || 'Sin contexto disponible.'}`;

  const historialReciente = (conversationHistory || []).slice(-6).map(m => ({
    role: m.role, content: m.content
  }));

  return [
    { role: 'system', content: systemPrompt },
    ...historialReciente,
    { role: 'user', content: userMessage }
  ];
}

module.exports = { build };
