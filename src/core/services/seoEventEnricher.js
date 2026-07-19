/**
 * seoEventEnricher.js — Sensor Territorial del Market Operating System
 *
 * Transforma cualquier evento SEO en una señal de inteligencia económica
 * enriquecida con contexto territorial, temporal y de intención.
 *
 * Reutilizable por: SEO, SINAPSIS, GIA, Analytics, Pricing Engine,
 *                   Market Intelligence, futuros bounded contexts.
 *
 * No contiene lógica de negocio propia — solo enriquece y re-emite.
 */

const { randomUUID } = require('crypto');
const { getTerritoryNode } = require('../config/territoryMap');

// ── Helpers temporales ────────────────────────────────────────────────────────

/** Semana ISO 8601 (1–53) */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

/**
 * Bucket horario como proxy de intención de compra:
 *   dawn      05–07  urgencia temprana
 *   morning   07–12  búsqueda planificada
 *   afternoon 12–18  decisión de compra
 *   evening   18–22  búsqueda doméstica post-trabajo
 *   night     22–05  urgencia / emergencia
 */
function getHourBucket(hour) {
  if (hour >= 5  && hour < 7)  return 'dawn';
  if (hour >= 7  && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

// ── Enriquecedor principal ────────────────────────────────────────────────────

/**
 * enrichSEOEvent(params)
 *
 * @param {object} params
 * @param {string} [params.localidad]   — slug de localidad (ej: 'san_isidro')
 * @param {string} [params.oficio]      — slug de oficio (ej: 'electricista')
 * @param {string} [params.intentType]  — 'service_search'|'zone_browse'|'network_explore'
 * @param {object} [params.req]         — Express request (para sessionId del cookie/header)
 * @returns {object} señal enriquecida lista para trackEvent
 */
function enrichSEOEvent({ localidad, oficio, intentType = 'service_search', req } = {}) {
  const now = new Date();

  // ── Contexto territorial ──────────────────────────────────────────────────
  const node = localidad ? getTerritoryNode(localidad) : null;

  const territorial = node
    ? {
        economicCorridor: node.corridor,
        municipality:     node.municipality,
        neighborhood:     node.neighborhood ?? null,
        province:         node.province,
        region:           node.region,
        priorityTier:     node.tier,
      }
    : {
        economicCorridor: 'unknown',
        municipality:     null,
        neighborhood:     null,
        province:         null,
        region:           'unknown',
        priorityTier:     null,
      };

  // ── Contexto temporal ─────────────────────────────────────────────────────
  const temporal = {
    weekOfYear: getISOWeek(now),
    dayOfWeek:  DAYS[now.getDay()],
    hourBucket: getHourBucket(now.getHours()),
    year:       now.getFullYear(),
    month:      now.getMonth() + 1,
  };

  // ── Identidad de sesión ───────────────────────────────────────────────────
  // Prioridad: cookie servired_sid → header x-session-id → UUID nuevo
  const sessionId =
    req?.cookies?.servired_sid ||
    req?.headers?.['x-session-id'] ||
    randomUUID();

  return {
    // Identidad
    sessionId,

    // Oficio
    ...(oficio && { oficio }),

    // Territorio
    localidad: localidad ?? null,
    ...territorial,

    // Tiempo
    ...temporal,

    // Intención
    intentType,
  };
}

module.exports = { enrichSEOEvent };
