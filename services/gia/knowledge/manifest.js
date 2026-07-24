'use strict';
/**
 * Manifest de la Base de Conocimiento de GIA.
 *
 * Whitelist EXPLICITA de documentos aprobados como conocimiento
 * institucional consultable por GIA en runtime.
 *
 * IMPORTANTE: nunca apuntar genericamente a toda docs/. Esa carpeta
 * mezcla conocimiento institucional con audits, tickets y specs en
 * progreso que no deben llegar al modelo como "verdad confirmada".
 *
 * Cada entrada:
 *   path      - ruta relativa desde la raiz del repo
 *   title     - titulo legible para citar como fuente
 *   category  - constitucion | institucional | operativo | territorial
 *   keywords  - palabras clave para el retriever (Fase 1: keyword matching)
 */
module.exports = [
  {
    path: 'docs/GIA_INTERACTION_CONTRACT_v1.md',
    title: 'GIA Interaction Contract',
    category: 'constitucion',
    keywords: ['gia', 'contrato', 'como piensa gia', 'principios', 'avatar', 'identidad', 'rol', 'perspectiva']
  },
  {
    path: 'docs/knowledge/WHO-IS-SERVIRED.md',
    title: 'Quien es ServiRed',
    category: 'institucional',
    keywords: ['servired', 'que es servired', 'quien creo servired', 'fundador', 'historia', 'mision']
  },
  {
    path: 'docs/SERVIRED_COGNITIVE_ARCHITECTURE_v1.md',
    title: 'Arquitectura Cognitiva de ServiRed',
    category: 'operativo',
    keywords: ['arquitectura', 'sinapsis', 'nexus', 'event store', 'gia', 'inteligencia']
  },
  {
    path: 'docs/SR-NEURO-003_GIA_GOVERNANCE_MODEL.md',
    title: 'Modelo de Gobernanza de GIA',
    category: 'operativo',
    keywords: ['gobernanza', 'gia', 'decisiones', 'reglas', 'limites']
  }
];
