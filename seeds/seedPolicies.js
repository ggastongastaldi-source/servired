/**
 * B19 Policy Engine — Seed inicial
 * Corre: node seeds/seedPolicies.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { createRule, activateRule } = require('../services/policyEngine');

const RULES = [
  {
    ruleId:      'pricing_floor_rule',
    version:     '3.2.0',
    description: 'Precio mínimo absoluto por rubro para evitar dumping en el mercado',
    status:      'shadow',
    priority:    10,
    conditions:  [],
    scope:       { rubros: [], zonas: [] },
    actions:     [{ type: 'floor_price', params: { min: 1500 } }],
    createdBy:   'system',
  },
  {
    ruleId:      'demand_surge_cap',
    version:     '2.1.0',
    description: 'Cap de precio ante demanda alta para evitar inflación explosiva',
    status:      'shadow',
    priority:    20,
    conditions:  [{ field: 'factor_demanda', operator: 'gt', value: 1.8 }],
    scope:       { rubros: [], zonas: [] },
    actions:     [
      { type: 'cap_price',      params: { max: 25000 } },
      { type: 'emit_event',     params: { type: 'demand_surge_capped' } },
    ],
    createdBy:   'system',
  },
  {
    ruleId:      'night_pact_pricing',
    version:     '1.1.0',
    description: 'Recargo nocturno entre 22hs y 6hs para trabajos en horario reducido',
    status:      'shadow',
    priority:    30,
    conditions:  [],
    scope:       { rubros: [], zonas: [], hours: { from: 22, to: 6 } },
    actions:     [{ type: 'multiply_price', params: { factor: 1.25 } }],
    createdBy:   'system',
  },
  {
    ruleId:      'zona_saturation_guard',
    version:     '0.9.0',
    description: 'Congela dispatch en zonas con saturación extrema de workers',
    status:      'shadow',
    priority:    5,
    conditions:  [{ field: 'workers_activos', operator: 'gt', value: 50 }],
    scope:       { rubros: [], zonas: ['la_matanza', 'lanús'] },
    actions:     [
      { type: 'freeze_dispatch', params: { reason: 'zona_saturada' } },
      { type: 'emit_event',      params: { type: 'dispatch_frozen' } },
    ],
    rollbackable: false,
    createdBy:   'system',
  },
  {
    ruleId:      'cancellation_penalty',
    version:     '1.4.0',
    description: 'Ajuste de factor de confianza ante cancelaciones repetidas del cliente',
    status:      'shadow',
    priority:    50,
    conditions:  [{ field: 'cancellation_rate', operator: 'gte', value: 0.3 }],
    scope:       { rubros: [], zonas: [] },
    actions:     [{ type: 'adjust_factor', params: { field: 'trust_score', value: 0.7 } }],
    createdBy:   'system',
  },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ MongoDB conectado');

  for (const rule of RULES) {
    try {
      const created = await createRule(rule);
      console.log(`✓ Regla creada: ${created.ruleId}@${created.version} [hash:${created.hash}]`);
    } catch (e) {
      if (e.message.includes('duplicate key')) {
        console.log(`⊘ Ya existe: ${rule.ruleId}@${rule.version} — skip`);
      } else {
        console.error(`✗ Error en ${rule.ruleId}:`, e.message);
      }
    }
  }

  await mongoose.disconnect();
  console.log('\n✓ Seed completo. Todas las reglas en estado SHADOW.');
  console.log('  → Para activar: policyEngine.activateRule(ruleId, version, "admin")');
}

main().catch(console.error);
