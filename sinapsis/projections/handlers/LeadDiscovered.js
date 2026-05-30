module.exports = async function LeadDiscovered(event, mongoose) {
  const db = mongoose.connection.useDb('sinapsis');
  const leads = db.collection('leads_view');

  await leads.updateOne(
    { aggregateId: event.aggregateId },
    {
      $setOnInsert: { aggregateId: event.aggregateId, createdAt: event.timestamp },
      $set: {
        correlationId: event.correlationId,
        source:        event.payload.source,
        category:      event.payload.category,
        city:          event.payload.city,
        status:        'discovered',
        updatedAt:     event.metadata.ingestedAt
      }
    },
    { upsert: true }
  );
};
