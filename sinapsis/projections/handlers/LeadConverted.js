module.exports = async function LeadConverted(event, mongoose) {
  const db = mongoose.connection.useDb('sinapsis');
  const leads = db.collection('leads_view');

  await leads.updateOne(
    { aggregateId: event.aggregateId },
    {
      $set: {
        status:      'converted',
        convertedAt: event.timestamp,
        value:       event.payload.value,
        updatedAt:   event.metadata.ingestedAt
      }
    }
  );
};
