'use strict';
const KnowledgeRepository = require('../knowledge/KnowledgeRepository');

module.exports = {
  name: 'conocimiento_institucional',

  // Se activa siempre que haya un mensaje de usuario para consultar.
  // No requiere comercioId — el conocimiento institucional aplica
  // a cualquier participante, autenticado o no.
  canHandle(ctx) {
    return !!ctx.mensaje && ctx.mensaje.trim().length > 0;
  },

  async execute(ctx) {
    const resultado = KnowledgeRepository.search(ctx.mensaje);

    if (!resultado.found) {
      return {
        data: null,
        summary: 'SIN_EVIDENCIA_DOCUMENTAL: no se encontro conocimiento institucional confirmado para esta consulta.',
        cost: 'low'
      };
    }

    const summary = resultado.sources
      .map(s => `[Fuente: ${s.title}] ${s.fragment}`)
      .join('\n---\n');

    return { data: resultado, summary, cost: 'low' };
  }
};
