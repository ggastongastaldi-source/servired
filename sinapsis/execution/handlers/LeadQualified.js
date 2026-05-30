module.exports = async function(event) {
  return [
    {
      channel:  'email',
      template: 'lead_qualified_outreach',
      payload: {
        aggregateId: event.aggregateId,
        score:       event.payload.score,
        reason:      event.payload.reason,
      }
    }
  ];
};
