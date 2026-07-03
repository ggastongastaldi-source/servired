const { registrarEvento } = require('../../services/sinapsisBusAdapter'); // AJUSTAR si difiere
const QRCodeCampaign = require('../../models/QRCodeCampaign');

async function onCommerceCreated(event) {
  const { commerceId, sessionId, ref, campaign, qrId } = event.payload || event;
  if (!ref) return; // alta sin origen QR, no dispara comisión

  const campaignDoc = await QRCodeCampaign.findOne({ ref, campaign });
  if (campaignDoc) {
    campaignDoc.conversionsCount += 1;
    await campaignDoc.save();
  }

  // Sin monto ni regla resuelta acá: el Commission Engine (próximo módulo)
  // toma este evento crudo y calcula amount/rule con la lógica centralizada.
  await registrarEvento('VENDOR_COMMISSION_ASSIGNED', {
    vendorId: ref,
    commerceId,
    sessionId,
    qrId,
    commissionRule: campaignDoc?.commissionRule || 'signup_base_commission',
    status: 'pending_calculation',
  });
}

module.exports = { onCommerceCreated };
