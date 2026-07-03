const QRCodeCampaign = require('../../models/QRCodeCampaign');
const { emitVendorCommissionAssigned } = require('../events/commerce-events');

async function onCommerceCreated(event) {
  const { commerceId, sessionId, ref, campaign, qrId } = event.payload || event;
  if (!ref) return; // alta sin origen QR, no dispara comisión

  const campaignDoc = await QRCodeCampaign.findOne({ ref, campaign });
  if (campaignDoc) {
    campaignDoc.conversionsCount += 1;
    await campaignDoc.save();
  }

  const evt = emitVendorCommissionAssigned({
    vendorId: ref,
    commerceId,
    sessionId,
    qrId,
    commissionRule: campaignDoc?.commissionRule || 'signup_base_commission',
    status: 'pending_calculation',
  });

  try {
    const { router: eventRouter } = require('../events/router-instance');
    await eventRouter.publish(evt);
  } catch (e) {
    console.warn('[SQOP] eventRouter no disponible en commission reactor:', e.message);
  }
}

module.exports = { onCommerceCreated };
