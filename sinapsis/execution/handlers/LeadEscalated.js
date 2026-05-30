module.exports = async function(event) {
  return [
    {
      channel:  'socket',
      template: 'lead_escalated_alert',
      payload: {
        room:        'admins',
        event:       'lead_escalated',
        data:        { aggregateId: event.aggregateId, score: event.payload.score, reason: event.payload.reason }
      }
    }
  ];
};
