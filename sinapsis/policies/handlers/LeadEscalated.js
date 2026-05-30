module.exports = async function LeadEscalated(event, mongoose) {
  const db = mongoose.connection.useDb('sinapsis');
  await db.collection('leads_view').updateOne(
    { aggregateId: event.aggregateId },
    { $set: {
      escalated:   true,
      escalatedAt: event.timestamp,
      updatedAt:   event.metadata.ingestedAt
    }}
  );
};
