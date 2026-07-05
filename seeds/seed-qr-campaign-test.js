// Seed minimo para poder generar un token QR real en pruebas E2E del
// wizard de onboarding Merchant. No usar en produccion sin revisar.
require('dotenv').config();
const mongoose = require('mongoose');
const QRCodeCampaign = require('../models/QRCodeCampaign');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await QRCodeCampaign.findOne({ ref: 'test_ref', campaign: 'test_campaign' });
  if (existing) {
    console.log('Campaña de prueba ya existe:', existing._id);
    await mongoose.disconnect();
    return;
  }

  const campaign = await QRCodeCampaign.create({
    ref: 'test_ref',
    campaign: 'test_campaign',
    region: 'AMBA',
    scope: 'onboarding_commerce',
    channel: 'offline_qr',
    active: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  console.log('Campaña de prueba creada:', campaign._id);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
