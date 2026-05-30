module.exports = async function LeadScored(event, mongoose) {
  const db = mongoose.connection.useDb('sinapsis');
  const leads = db.collection('leads_view');

  await leads.updateOne(
    { aggregateId: event.aggregateId },
    {
      $set: {
        score:     event.payload.score,
        model:     event.payload.model,
        status:    'scored',
        updatedAt: event.metadata.ingestedAt
      }
    }
  );
};
