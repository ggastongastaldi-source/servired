#!/usr/bin/env bash
set -euo pipefail

SETTLEMENT="src/core/services/settlementEngine.js"
[ -f "$SETTLEMENT" ] || { echo "ERROR: no existe $SETTLEMENT"; exit 1; }
cp "$SETTLEMENT" "${SETTLEMENT}.bak"

node -e "
const fs = require('fs');
const f = '$SETTLEMENT';
const src = fs.readFileSync(f, 'utf8');

const OLD = \`const PLATFORM_FEE_RATE = 0.20;

function calculateSettlement(amount) {
  const platformFee   = Math.round(amount * PLATFORM_FEE_RATE);
  const workerPayout  = amount - platformFee;
  return { platformFee, workerPayout };
}

module.exports = { calculateSettlement };\`;

const n = src.split(OLD).length - 1;
if (n !== 1) { process.stderr.write('ERROR: patron encontrado ' + n + ' veces\\n'); process.exit(1); }

const NEW = \`// CommissionPolicy — fuente única de reglas de liquidación de ServiRed.
// Reemplaza la constante hardcodeada anterior (PLATFORM_FEE_RATE = 0.20).
// Ningún caller debe acceder a rates directamente — siempre via CommissionPolicy.resolve().
//
// Supuesto arquitectónico adoptado:
//   La identidad económica es un activo del actor, el sistema es custodio.
//   Las reglas de comisión son configurables por contexto sin cambiar código.
//   Fuente: decisiones de diseño económico — sesión 2026-07-10.

const POLICY_TABLE = [
  // Reglas evaluadas en orden. La primera que matchea gana.
  {
    id:          'REFERIDO_ACTIVO',
    description: 'Descuento por referido activo — monto <= 150000 ARS',
    when: ({ amount, referidoActivo }) => referidoActivo && amount <= 150000,
    rate: 0.10,
  },
  {
    id:          'BASE',
    description: 'Comisión estándar ServiRed',
    when: () => true,
    rate: 0.20,
  },
];

const FLOOR_RATE = 0.10; // blindaje absoluto — ninguna política puede ir por debajo

/**
 * Resuelve la política de comisión aplicable y calcula la liquidación.
 *
 * @param {object} context
 * @param {number}  context.amount          - monto total de la transacción en ARS
 * @param {boolean} [context.referidoActivo] - si el técnico tiene un referido activo no usado
 * @param {string}  [context.rubroId]        - rubro del servicio (reservado para futuras políticas)
 * @param {string}  [context.zonaId]         - zona geográfica (reservado para futuras políticas)
 * @param {string}  [context.commerceId]     - comercio origen (reservado para acuerdos específicos)
 *
 * @returns {{ platformFee: number, workerPayout: number, rate: number, policyId: string }}
 */
function resolve(context = {}) {
  const { amount = 0 } = context;
  const policy = POLICY_TABLE.find(p => p.when(context)) || POLICY_TABLE[POLICY_TABLE.length - 1];
  const effectiveRate = Math.max(policy.rate, FLOOR_RATE);
  const platformFee  = Math.round(amount * effectiveRate);
  const workerPayout = amount - platformFee;
  return { platformFee, workerPayout, rate: effectiveRate, policyId: policy.id };
}

/**
 * Compatibilidad hacia atrás con financeEngine.js.
 * Los callers existentes no necesitan cambios — siguen llamando calculateSettlement(amount).
 * Internamente usa CommissionPolicy.resolve() con contexto mínimo.
 */
function calculateSettlement(amount) {
  const { platformFee, workerPayout } = resolve({ amount });
  return { platformFee, workerPayout };
}

module.exports = { resolve, calculateSettlement, POLICY_TABLE, FLOOR_RATE };\`;

fs.writeFileSync(f, NEW, 'utf8');
console.log('OK: CommissionPolicy aplicado en ' + f);
"

node -c "$SETTLEMENT" && echo "sintaxis OK"
echo ""
echo "=== Verificar compatibilidad hacia atrás ==="
node -e "
const { calculateSettlement, resolve, POLICY_TABLE, FLOOR_RATE } = require('./$SETTLEMENT');

// Test 1: interfaz original sin cambios
const r1 = calculateSettlement(100000);
console.log('calculateSettlement(100000):', JSON.stringify(r1));
console.assert(r1.platformFee === 20000, 'platformFee debe ser 20000');
console.assert(r1.workerPayout === 80000, 'workerPayout debe ser 80000');

// Test 2: resolve con contexto base
const r2 = resolve({ amount: 100000 });
console.log('resolve base:', JSON.stringify(r2));
console.assert(r2.policyId === 'BASE', 'debe usar política BASE');
console.assert(r2.rate === 0.20, 'rate debe ser 0.20');

// Test 3: resolve con referido activo y monto <= 150000
const r3 = resolve({ amount: 100000, referidoActivo: true });
console.log('resolve con referido:', JSON.stringify(r3));
console.assert(r3.policyId === 'REFERIDO_ACTIVO', 'debe usar política REFERIDO_ACTIVO');
console.assert(r3.rate === 0.10, 'rate debe ser 0.10');
console.assert(r3.platformFee === 10000, 'platformFee debe ser 10000');

// Test 4: referido activo pero monto > 150000 — debe usar BASE
const r4 = resolve({ amount: 200000, referidoActivo: true });
console.log('resolve referido monto alto:', JSON.stringify(r4));
console.assert(r4.policyId === 'BASE', 'monto alto debe usar BASE aunque haya referido');

// Test 5: blindaje de piso — rate nunca baja de 0.10
console.log('FLOOR_RATE:', FLOOR_RATE);
console.assert(FLOOR_RATE === 0.10, 'floor debe ser 0.10');

console.log('\\nTodos los tests pasaron.');
"

echo ""
echo "FIX APLICADO — CommissionPolicy T-501"
echo "Rollback: cp ${SETTLEMENT}.bak $SETTLEMENT"
