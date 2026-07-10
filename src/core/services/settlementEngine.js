// CommissionPolicy — fuente única de reglas de liquidación de ServiRed.
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

module.exports = { resolve, calculateSettlement, POLICY_TABLE, FLOOR_RATE };