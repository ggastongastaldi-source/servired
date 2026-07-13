'use strict';

/**
 * ExplanationBuilder — construye Explanation estructuradas.
 * ADR-008: Toda decisión de scoring debe ser explicable.
 * GIA las lee directamente sin reconstruir lógica.
 */
class ExplanationBuilder {

  /**
   * Construye una Explanation a partir de una TrustEvidence y la política.
   */
  build({ evidenceId, trustProfileId, dimension, delta, scoreBefore, scoreAfter,
          confidenceBefore, confidenceAfter, sourceEventType, policy, rule, clock }) {

    const template = this._resolveTemplate(policy, rule, sourceEventType);
    const humanReadable = template
      .replace('{dimension}',    dimension)
      .replace('{delta}',        delta > 0 ? `+${delta}` : String(delta))
      .replace('{scoreBefore}',  scoreBefore)
      .replace('{scoreAfter}',   scoreAfter)
      .replace('{eventType}',    sourceEventType)
      .replace('{policyVersion}',policy.version);

    return {
      explanationId:     `exp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      evidenceId,
      trustProfileId,
      policyVersion:     policy.version,
      ruleId:            rule || 'default',
      sourceEventType,
      dimension,
      delta,
      scoreBefore,
      scoreAfter,
      confidenceBefore:  confidenceBefore || 0,
      confidenceAfter:   confidenceAfter  || 0,
      humanReadable,
      timestamp:         clock.now().toISOString(),
    };
  }

  _resolveTemplate(policy, ruleId, eventType) {
    const templates = policy.explanationTemplates || {};
    return templates[ruleId]
      || templates[eventType]
      || 'La dimensión {dimension} cambió {delta} puntos por {eventType} (política {policyVersion}).';
  }
}

module.exports = { ExplanationBuilder };
