'use strict';

/**
 * EvidenceCollector — traduce eventos de dominio entrantes a TrustEvidence.
 * Lógica pura. La política activa define qué dimensión y qué delta
 * corresponde a cada tipo de evento.
 *
 * ADR-004: Las reglas viven en la política, no en el código.
 */
class EvidenceCollector {

  /**
   * @param {object} incomingEvent - evento desde SINAPSIS
   * @param {object} policy        - política activa
   * @returns {{ dimension: string, delta: number, reason: string }[]}
   */
  collect(incomingEvent, policy) {
    const rules = policy.eventRules || {};
    const rule  = rules[incomingEvent.type];

    if (!rule) return [];

    // Una regla puede producir múltiples impactos (varias dimensiones)
    const impacts = Array.isArray(rule) ? rule : [rule];

    return impacts.map(r => ({
      dimension:  r.dimension,
      delta:      r.delta,
      reason:     r.reason || incomingEvent.type,
      sourceId:   incomingEvent.jobId || incomingEvent.paymentId || incomingEvent.id || null,
    }));
  }

  /**
   * Verifica si un evento tiene regla definida en la política.
   */
  hasRule(eventType, policy) {
    return !!(policy.eventRules || {})[eventType];
  }
}

module.exports = { EvidenceCollector };
