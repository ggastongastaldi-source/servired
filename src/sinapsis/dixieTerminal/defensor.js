// defensor.js — Capa 4: Decision y mitigacion (Defensor)
// Lee IncidentCase (OPEN/INVESTIGATING) producidos por el Fiscal (Capa 3),
// selecciona un runbook conservador, lo ejecuta, y persiste el resultado.
// NUNCA correlaciona (eso es del Fiscal) y NUNCA escanea (eso es del Police).
// Solo decide y registra — misma separacion estricta de capas del resto del pipeline.

'use strict';

const { IncidentCase } = require('./IncidentCase');
const { REGISTRY, selectRunbook } = require('./runbooks');

async function processCase(incidentCase) {
  const runbookId = selectRunbook(incidentCase);
  const handler = REGISTRY[runbookId];
  const attemptedAt = new Date();

  let outcome;
  try {
    outcome = await handler(incidentCase);
  } catch (e) {
    outcome = { resolved: false, result: 'FAILURE', detail: { error: e.message } };
  }

  const timelineAction = outcome.resolved ? 'RUNBOOK_SUCCEEDED'
    : (outcome.result === 'PARTIAL' ? 'RUNBOOK_ATTEMPTED' : 'RUNBOOK_FAILED');

  // Guardia atomica: solo actualiza si el caso sigue OPEN/INVESTIGATING -
  // evita pisar una resolucion humana concurrente (mismo patron que el Fiscal).
  const update = {
    $push: {
      runbooksAttempted: { runbookId, attemptedAt, result: outcome.result, detail: outcome.detail },
      timeline: { action: timelineAction, detail: Object.assign({ runbookId }, outcome.detail), actor: 'system:defensor' }
    },
    $set: { updatedAt: attemptedAt }
  };

  if (outcome.resolved) {
    update.$set.status = 'RESOLVED';
    update.$set.resolution = {
      resolvedAt: attemptedAt,
      resolvedBy: 'runbook:' + runbookId,
      summary: (outcome.detail && outcome.detail.reason) || 'Auto-resuelto por Defensor',
      mttrMs: attemptedAt.getTime() - new Date(incidentCase.detectedAt).getTime()
    };
  } else if (incidentCase.status === 'OPEN') {
    // Primer intento fallido: pasa a INVESTIGATING para no reprocesarlo como caso nuevo.
    update.$set.status = 'INVESTIGATING';
  }

  const result = await IncidentCase.findOneAndUpdate(
    { caseId: incidentCase.caseId, status: { $in: ['OPEN', 'INVESTIGATING'] } },
    update,
    { returnDocument: 'after' }
  );

  return { caseId: incidentCase.caseId, runbookId, resolved: outcome.resolved, applied: !!result };
}

async function runDefensor({ pipelineRunId = null } = {}) {
  const openCases = await IncidentCase.find({ status: { $in: ['OPEN', 'INVESTIGATING'] } })
    .sort({ priority: 1, detectedAt: 1 })
    .lean();

  if (!openCases.length) return { processed: 0, resolved: 0 };

  const results = [];
  for (const c of openCases) {
    results.push(await processCase(c));
  }

  const resolved = results.filter(function(r) { return r.resolved; }).length;

  console.log(JSON.stringify({
    level: 'info', source: 'DEFENSOR', pipelineRunId,
    processed: results.length, resolved,
    timestamp: new Date().toISOString()
  }));

  return { processed: results.length, resolved, results };
}

module.exports = { runDefensor, processCase };
