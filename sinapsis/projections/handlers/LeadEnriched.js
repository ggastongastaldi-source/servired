module.exports = async function LeadEnriched(event, mongoose) {
  const db = mongoose.connection.useDb('sinapsis');
  const leads = db.collection('leads_view');

  await leads.updateOne(
    { aggregateId: event.aggregateId },
    {
      $set: {
        rating:       event.payload.rating,
        reviews:      event.payload.reviews,
        has_whatsapp: event.payload.has_whatsapp,
        status:       'enriched',
        updatedAt:    event.metadata.ingestedAt
      }
    }
  );
};
