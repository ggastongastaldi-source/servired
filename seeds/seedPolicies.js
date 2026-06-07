/**
 * B19 Policy Engine — Seed con DRY_RUN
 * Uso:
 *   DRY_RUN=true  node seeds/seedPolicies.js   ← preview sin tocar DB
 *   DRY_RUN=false node seeds/seedPolicies.js   ← insert real
 */
require('dotenv').config();
const mongoose   = require('mongoose');
const policyEngine = require('../services/policyEngine');

const DRY_RUN = process.env.DRY_RUN !== 'false'; // default: dry-run

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
    rollbackable: true,
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
      { type: 'cap_price',  params: { max: 25000 } },
      { type: 'emit_event', params: { type: 'demand_surge_capped' } },
    ],
    createdBy:   'system',
    rollbackable: true,
  },
  {
    ruleId:      'night_pact_pricing',
    version:     '1.1.0',
    description: 'Recargo nocturno entre 22hs y 6hs — cruza medianoche (wrap=true)',
    status:      'shadow',
    priority:    30,
    conditions:  [],
    scope:       { rubros: [], zonas: [], hours: { from: 22, to: 6, wrap: true } },
    actions:     [{ type: 'multiply_price', params: { factor: 1.25 } }],
    createdBy:   'system',
    rollbackable: true,
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
    rollbackable: true,
  },
];

// ── Validación estática antes de cualquier operación de DB
function validateRules(rules) {
  const errors = [];
  const ruleIds = new Set();

  rules.forEach((r, i) => {
    const tag = `[${i}] ${r.ruleId}@${r.version}`;

    // Duplicados en el mismo seed
    const key = `${r.ruleId}@${r.version}`;
    if (ruleIds.has(key)) errors.push(`${tag}: duplicado en seed`);
    ruleIds.add(key);

    // Semver
    if (!/^\d+\.\d+\.\d+$/.test(r.version))
      errors.push(`${tag}: version no es semver`);

    // ruleId format
    if (!/^[a-z_]+$/.test(r.ruleId))
      errors.push(`${tag}: ruleId tiene caracteres inválidos`);

    // Actions requeridas
    if (!r.actions || r.actions.length === 0)
      errors.push(`${tag}: sin actions`);

    // Hours wrap check
    if (r.scope?.hours) {
      const { from, to, wrap } = r.scope.hours;
      if (from > to && !wrap)
        errors.push(`${tag}: hours from(${from}) > to(${to}) sin wrap:true — bug nocturno`);
    }

    // Priority overlap warning (no error)
    rules.forEach((r2, j) => {
      if (i !== j && r.priority === r2.priority)
        console.warn(`  ⚠ Priority ${r.priority} compartida: ${r.ruleId} ↔ ${r2.ruleId}`);
    });
  });

  return errors;
}

async function main() {
  console.log(`\n══ B19 SEED ${DRY_RUN ? '[DRY RUN]' : '[REAL — ESCRIBE EN DB]'} ══\n`);

  // ── Validación estática (siempre, dry o real)
  console.log('── Validando reglas...');
  const errors = validateRules(RULES);
  if (errors.length > 0) {
    console.error('\n✗ Errores de validación:');
    errors.forEach(e => console.error('  ✗', e));
    console.error('\nSeed abortado. Corregí los errores antes de continuar.\n');
    process.exit(1);
  }
  console.log('✓ Todas las reglas válidas\n');

  // ── Preview siempre
  console.log('── Preview de reglas a insertar:');
  RULES.forEach(r => {
    const hourInfo = r.scope?.hours
      ? ` hours:${r.scope.hours.from}-${r.scope.hours.to}${r.scope.hours.wrap ? '(wrap)':''}`
      : '';
    const condInfo = r.conditions?.length
      ? ` cond:[${r.conditions.map(c=>`${c.field}${c.operator}${c.value}`).join(',')}]`
      : '';
    console.log(`  ${r.priority.toString().padStart(3)}p  ${r.ruleId.padEnd(28)} v${r.version}  [${r.status}]${hourInfo}${condInfo}`);
  });

  if (DRY_RUN) {
    console.log('\n✓ DRY RUN completo — no se escribió nada en DB.');
    console.log('  → Para ejecutar real: DRY_RUN=false node seeds/seedPolicies.js\n');
    process.exit(0);
  }

  // ── Insert real
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('\n✓ MongoDB conectado\n── Insertando...');

  for (const rule of RULES) {
    try {
      const created = await policyEngine.createRule(rule);
      console.log(`  ✓ ${created.ruleId}@${created.version} [hash:${created.hash}]`);
    } catch (e) {
      if (e.message?.includes('duplicate key') || e.message?.includes('E11000')) {
        console.log(`  ⊘ Ya existe: ${rule.ruleId}@${rule.version} — skip`);
      } else {
        console.error(`  ✗ Error en ${rule.ruleId}:`, e.message);
      }
    }
  }

  await mongoose.disconnect();
  console.log('\n✓ Seed completo. Reglas en estado SHADOW.');
  console.log('  → Activar con: POST /api/b19/policy/:ruleId/activate { version }');
  console.log('  → O: node -e "require(\'./services/policyEngine\').activateRule(\'pricing_floor_rule\',\'3.2.0\',\'admin\').then(console.log)"\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

module.exports = { RULES }; // para inspección externa
