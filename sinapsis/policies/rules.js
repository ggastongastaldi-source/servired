// SINAPSIS — Policy Rules v1.0
// Catálogo declarativo. Una regla = un evento de entrada + condición + evento de salida.

module.exports = [
  {
    on: 'LeadScored',
    when: (payload) => payload.score >= 8,
    emit: 'LeadQualified',
    buildPayload: (event) => ({
      score:    event.payload.score,
      model:    event.payload.model,
      reason:   'score_threshold_met'
    })
  },
  {
    on: 'LeadScored',
    when: (payload) => payload.score < 5,
    emit: 'LeadRejected',
    buildPayload: (event) => ({
      score:  event.payload.score,
      reason: 'score_below_minimum'
    })
  },
  {
    on: 'LeadScored',
    when: (payload) => payload.score >= 5 && payload.score < 8,
    emit: 'LeadEscalated',
    buildPayload: (event) => ({
      score:  event.payload.score,
      reason: 'manual_review_required'
    })
  },
  {
    on: 'LeadConverted',
    when: () => true,
    emit: 'ConversionRecorded',
    buildPayload: (event) => ({
      value:       event.payload.value,
      aggregateId: event.aggregateId
    })
  }
];
