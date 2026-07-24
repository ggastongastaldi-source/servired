'use strict';
/**
 * Retriever v1 — matching por palabras clave.
 *
 * Contrato estable: recibe (query, documentos) y devuelve
 * { found, score, sources }. Cuando llegue el retriever semantico
 * (VectorRetriever), debe cumplir el mismo contrato de salida para
 * no tener que tocar KnowledgeBaseTool ni ContextBuilder.
 */

const MIN_SCORE = 1; // al menos 1 keyword matcheada

function normalizar(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // saca acentos
}

function scoreDocumento(queryNorm, doc) {
  if (doc.error || !doc.content) return 0;
  let score = 0;
  for (const kw of doc.keywords || []) {
    if (queryNorm.includes(normalizar(kw))) score += 1;
  }
  return score;
}

function extraerFragmento(content, maxChars = 600) {
  // Salta metadata de encabezado (version, fecha, audiencia, etc.)
  // buscando el primer heading de seccion real (## ) o el primer
  // separador (---) despues del titulo.
  let inicio = 0;
  const primerSeparador = content.indexOf('\n---\n');
  const primerH2 = content.indexOf('\n## ');
  if (primerSeparador !== -1 && (primerH2 === -1 || primerSeparador < primerH2)) {
    inicio = primerSeparador + 5;
  } else if (primerH2 !== -1) {
    inicio = primerH2 + 1;
  }
  return content.slice(inicio, inicio + maxChars).trim();
}

function search(query, documentos) {
  const queryNorm = normalizar(query);
  const puntuados = documentos
    .map(doc => ({ doc, score: scoreDocumento(queryNorm, doc) }))
    .filter(x => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  if (puntuados.length === 0) {
    return { found: false, score: 0, sources: [] };
  }

  const top = puntuados.slice(0, 2); // maximo 2 documentos por consulta
  return {
    found: true,
    score: top[0].score,
    sources: top.map(({ doc, score }) => ({
      title: doc.title,
      path: doc.path,
      category: doc.category,
      score,
      fragment: extraerFragmento(doc.content)
    }))
  };
}

module.exports = { search };
