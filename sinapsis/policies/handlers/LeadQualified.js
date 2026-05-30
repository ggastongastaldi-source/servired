// Handler de proyección para LeadQualified
module.exports = async function LeadQualified(event, mongoose) {
  const db = mongoose.connection.useDb('sinapsis');
  await db.collection('leads_view').updateOne(
    { aggregateId: event.aggregateId },
    { $set: {
      qualified:   true,
      qualifiedAt: event.timestamp,
      updatedAt:   event.metadata.ingestedAt
    }}
  );
};
