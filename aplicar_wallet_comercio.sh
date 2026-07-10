#!/usr/bin/env bash
set -euo pipefail

USUARIO="src/core/models/Usuario.js"
LEDGER="src/core/services/ledgerService.js"

for f in "$USUARIO" "$LEDGER"; do
  [ -f "$f" ] || { echo "ERROR: no existe $f"; exit 1; }
  cp "$f" "${f}.bak"
done
echo "Backups creados."

node -e "
const fs = require('fs');
const f = '$USUARIO';
let src = fs.readFileSync(f, 'utf8');

const OLD = \`  // ── WALLET ───────────────────────────────────────────────
  wallet_pending:   { type: Number, default: 0 }, // fondos capturados, pendientes de liberacion
  wallet_available: { type: Number, default: 0 }, // fondos disponibles para retiro\`;

const NEW = \`  // ── WALLET TRABAJADOR ───────────────────────────────────────────────
  wallet_pending:   { type: Number, default: 0 }, // fondos capturados, pendientes de liberacion
  wallet_available: { type: Number, default: 0 }, // fondos disponibles para retiro

  // ── WALLET COMERCIO ──────────────────────────────────────────────────────
  // Mismo modelo semántico que el wallet del Trabajador.
  // commerce_wallet_pending:   comisiones capturadas, pendientes de liquidación
  // commerce_wallet_available: disponibles para retiro o reinversión en plataforma
  // Solo se modifican via financeEngine — nunca directamente desde controllers.
  commerce_wallet_pending:   { type: Number, default: 0 },
  commerce_wallet_available: { type: Number, default: 0 }\`;

const n = src.split(OLD).length - 1;
if (n !== 1) { process.stderr.write('ERROR Usuario.js: patron encontrado ' + n + ' veces\\n'); process.exit(1); }
src = src.split(OLD).join(NEW);
fs.writeFileSync(f, src, 'utf8');
console.log('OK 1/2: ' + f);
"

node -e "
const fs = require('fs');
const f = '$LEDGER';
let src = fs.readFileSync(f, 'utf8');

const OLD = \`  account:                 { type: String, required: true, enum: ['ESCROW_PLATFORM','WORKER_PENDING','WORKER_AVAILABLE','SERVIRED_REVENUE'] },\`;

const NEW = \`  account:                 { type: String, required: true, enum: [
    'ESCROW_PLATFORM',
    'WORKER_PENDING',
    'WORKER_AVAILABLE',
    'SERVIRED_REVENUE',
    // Cuentas de Comercio — T-502 wallet semántico
    'COMMERCE_PENDING',    // comisiones capturadas, pendientes de liquidación al comercio
    'COMMERCE_AVAILABLE',  // disponibles para retiro o reinversión
  ] },\`;

const n = src.split(OLD).length - 1;
if (n !== 1) { process.stderr.write('ERROR ledgerService.js: patron encontrado ' + n + ' veces\\n'); process.exit(1); }
src = src.split(OLD).join(NEW);
fs.writeFileSync(f, src, 'utf8');
console.log('OK 2/2: ' + f);
"

node -c "$USUARIO" && echo "Usuario.js: sintaxis OK"
node -c "$LEDGER"  && echo "ledgerService.js: sintaxis OK"

echo ""
node -e "
const { Ledger } = require('./src/core/services/ledgerService');
const schema = Ledger.schema.path('account');
const allowed = schema.enumValues;
console.log('Cuentas del ledger:', JSON.stringify(allowed));
const required = ['ESCROW_PLATFORM','WORKER_PENDING','WORKER_AVAILABLE','SERVIRED_REVENUE','COMMERCE_PENDING','COMMERCE_AVAILABLE'];
const missing = required.filter(a => !allowed.includes(a));
if (missing.length) { console.error('FALTA:', missing); process.exit(1); }
console.log('Todas las cuentas presentes.');
process.exit(0);
"

echo ""
echo "T-502 APLICADO — wallet semántico del Comercio"
echo "Rollback: cp ${USUARIO}.bak $USUARIO && cp ${LEDGER}.bak $LEDGER"
