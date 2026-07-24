'use strict';
const manifest         = require('./manifest');
const { loadAll }       = require('./MarkdownLoader');
const retriever         = require('./KeywordRetriever'); // swap futuro: VectorRetriever

/**
 * search(query) -> { found, score, sources: [{title, path, category, score, fragment}] }
 *
 * Esta es la API estable. El mecanismo interno de recuperacion
 * (hoy keyword matching, mañana embeddings/Atlas Vector Search)
 * puede cambiar sin afectar a quien consume este modulo.
 */
function search(query) {
  const documentos = loadAll(manifest);
  return retriever.search(query, documentos);
}

module.exports = { search };
