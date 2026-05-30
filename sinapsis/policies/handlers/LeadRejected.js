module.exports = async function LeadRejected(event, mongoose) {
  const db = mongoose.connection.useDb('sinapsis');
  await db.collection('leads_view').updateOne(
    { aggregateId: event.aggregateId },
    { $set: {
      qualified:  false,
      rejected:   true,
      rejectedAt: event.timestamp,
      updatedAt:  event.metadata.ingestedAt
    }}
  );
};
