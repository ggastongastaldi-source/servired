/**
 * Seed: Política v1.0.0
 * Tiers (HIPÓTESIS — ajustar con datos reales de CAC, fraude, benchmark):
 *   micro:    $0 – $50.000      → 20%
 *   standard: $50.001 – $300.000 → 12%
 *   premium:  > $300.000         → 7%
 */
require('dotenv').config();
const mongoose = require('mongoose');
const CommissionPolicy = require('../models/CommissionPolicy');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  const exists = await CommissionPolicy.findOne({ policyVersion: '1.0.0' });
  if (exists) { console.log('[Seed] v1.0.0 ya existe.'); return mongoose.disconnect(); }

  await new CommissionPolicy({
    policyVersion: '1.0.0',
    active: true,
    description: 'Política de lanzamiento — hipótesis inicial, revisar con datos reales.',
    tiers: [
      { maxAmount: 50000,  rate: 0.20, label: 'micro'    },
      { maxAmount: 300000, rate: 0.12, label: 'standard' },
      { maxAmount: null,   rate: 0.07, label: 'premium'  },
    ],
  }).save();

  console.log('[Seed] Política v1.0.0 activa ✓');
  await mongoose.disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
