// actionExecutor.js — ejecutor de decisiones de Sprint 3B
// Recibe Decision[] del policyEngine y persiste resultados auditables.
// Es el único módulo de dixieTerminal que escribe en Mongo (además del scanner).
//
// Contrato:
//   execute(decisions) → ExecutionResult[]
//
// ExecutionResult = {
//   findingId : string,
//   action    : string,
//   applied   : boolean,
//   reason    : string,
//   executedAt: Date
// }

'use strict';

const { PolicyFinding } = require('./PolicyFinding');

// Mapeo action → status resultante en el documento
const ACTION_TO_STATUS = {
  CLOSE_FINDING:       'ACKNOWLEDGED',
  ACKNOWLEDGE_FINDING: 'ACKNOWLEDGED',
  EMIT_ALERT:          null,   // no cambia status — solo loguea
  NOOP:                null
};

async function execute(decisions) {
  const results = [];
  const executedAt = new Date();

  for (const decision of decisions) {
    const { findingId, action, reason, evidence } = decision;

    // NOOP — registrar sin tocar Mongo
    if (action === 'NOOP') {
      console.log(JSON.stringify({
        level: 'info', source: 'ACTION_EXECUTOR',
        findingId, action, reason, applied: false, executedAt
      }));
      results.push({ findingId, action, applied: false, reason, executedAt });
      continue;
    }

    // EMIT_ALERT — loguear sin modificar el finding
    if (action === 'EMIT_ALERT') {
      console.log(JSON.stringify({
        level: 'warn', source: 'ACTION_EXECUTOR',
        findingId, action, reason, evidence, executedAt,
        alert: 'MANUAL_REVIEW_REQUIRED'
      }));
      results.push({ findingId, action, applied: false, reason, executedAt });
      continue;
    }

    // CLOSE_FINDING / ACKNOWLEDGE_FINDING — persistir evidencia auditable
    try {
      const newStatus = ACTION_TO_STATUS[action];
      await PolicyFinding.findOneAndUpdate(
        { findingId, status: 'OPEN' },   // solo actúa sobre findings abiertos
        {
          $set: {
            status:      newStatus,
            resolvedAt:  executedAt,
            acknowledgedAt: executedAt,
            resolution: {
              action,
              reason,
              executedAt,
              evidence
            }
          }
        },
        { returnDocument: 'after' }
      );

      console.log(JSON.stringify({
        level: 'info', source: 'ACTION_EXECUTOR',
        findingId, action, reason, evidence, applied: true, executedAt
      }));

      results.push({ findingId, action, applied: true, reason, executedAt });

    } catch (e) {
      console.error(JSON.stringify({
        level: 'error', source: 'ACTION_EXECUTOR',
        findingId, action, error: e.message, executedAt
      }));
      results.push({ findingId, action, applied: false, reason, executedAt, error: e.message });
    }
  }

  return results;
}

module.exports = { execute };
