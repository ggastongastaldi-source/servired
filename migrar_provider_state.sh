#!/usr/bin/env bash
set -euo pipefail

echo "=== Migración ADM-001: normalizar providerState legacy ==="
echo "Fecha: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

node -e "
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Usuario = require('./src/core/models/Usuario');

  // 1. Identificar usuarios afectados (idempotente: solo ONBOARDING/ACTIVE_PROVIDER sin eventos)
  const users = await Usuario.find({
    providerState: { \$in: ['ONBOARDING', 'ACTIVE_PROVIDER'] }
  }).select('_id email providerState onboardingStep').lean();

  if (users.length === 0) {
    console.log('[ADM-001] Sin usuarios legacy — migración ya aplicada o no necesaria.');
    await mongoose.disconnect();
    return;
  }

  console.log('[ADM-001] Usuarios a normalizar:', users.length);
  users.forEach(u => console.log('  -', u.email, '|', u.providerState));

  // 2. Registrar en MigrationLog antes de modificar (trazabilidad)
  const MigrationLog = mongoose.connection.collection('migration_log');
  await MigrationLog.insertOne({
    migrationId:  'ADM-001',
    description:  'Normalización de providerState legacy — usuarios sin eventos en sinapsis_bus_log',
    reason:       'Pipeline router-instance.js no estaba activo cuando se crearon estos usuarios. ' +
                  'No existe evidencia de PROVIDER_ONBOARDING_STARTED en el bus. ' +
                  'Se normaliza el estado a NONE para mantener consistencia con el Event Store. ' +
                  'Decisión arquitectónica: el bus no se modifica, el estado se corrige.',
    appliedAt:    new Date().toISOString(),
    affectedUsers: users.map(u => ({
      userId:        String(u._id),
      email:         u.email,
      stateBefore:   u.providerState,
      stepBefore:    u.onboardingStep || null
    })),
    stateAfter:   'NONE'
  });
  console.log('[ADM-001] MigrationLog registrado.');

  // 3. Normalizar (idempotente: \$set solo si aún están en ese estado)
  const result = await Usuario.updateMany(
    { providerState: { \$in: ['ONBOARDING', 'ACTIVE_PROVIDER'] } },
    { \$set: { providerState: 'NONE', onboardingStep: null } }
  );
  console.log('[ADM-001] Usuarios normalizados:', result.modifiedCount);

  // 4. Verificar resultado
  const restantes = await Usuario.countDocuments({
    providerState: { \$in: ['ONBOARDING', 'ACTIVE_PROVIDER'] }
  });
  console.log('[ADM-001] Usuarios con estado legacy restantes:', restantes);

  if (restantes === 0) {
    console.log('[ADM-001] Migración completada exitosamente.');
  } else {
    console.error('[ADM-001] ERROR: aún quedan usuarios sin normalizar.');
    process.exit(1);
  }

  await mongoose.disconnect();
});
"
