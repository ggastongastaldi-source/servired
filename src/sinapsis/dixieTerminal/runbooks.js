// runbooks.js — Capa 4: Decisión y mitigación (Defensor)
// Registro de runbooks. Cada runbook es una función pura y CONSERVADORA:
// solo re-verifica el estado real de un caso y decide si puede cerrarse
// solo, o si debe escalar a un humano. Ninguno ejecuta acciones destructivas
// ni reinicia servicios — coherente con Guerrilla Engineering: cero riesgo
// no supervisado en produccion.
//
// Contrato de un runbook:
//   async (incidentCase) => { resolved: boolean, result: 'SUCCESS'|'FAILURE'|'PARTIAL', detail: object }

'use strict';

const { PolicyFinding } = require('./PolicyFinding');
const { getSnapshot: getExternalHealthSnapshot } = require('../../../services/externalHealthMonitor');

// RECHECK_EXTERNAL_HEALTH
// Aplica a casos originados por externalHealthMonitor (caseId derivado de EXTERNAL_<service>).
// Si el servicio ya volvio a UP, resuelve el caso solo. Nunca reinicia nada, solo re-lee.
async function recheckExternalHealth(incidentCase) {
  const snapshot = getExternalHealthSnapshot();
  const data = snapshot[incidentCase.affectedService];

  if (!data) {
    return { resolved: false, result: 'FAILURE', detail: { reason: 'servicio no encontrado en snapshot actual' } };
  }
  if (data.status === 'UP') {
    return { resolved: true, result: 'SUCCESS', detail: { reason: incidentCase.affectedService + ' volvio a UP', latencyMs: data.latencyMs } };
  }
  return { resolved: false, result: 'FAILURE', detail: { reason: incidentCase.affectedService + ' sigue en ' + data.status } };
}

// RECHECK_FINDINGS_CLOSED
// Aplica a casos originados por PolicyFinding (findingIds no vacio).
// Si todos los findings asociados ya no estan OPEN (cerrados/reconocidos por
// otro mecanismo, ej. actionExecutor de Capa 2), resuelve el caso.
async function recheckFindingsClosed(incidentCase) {
  if (!incidentCase.findingIds || !incidentCase.findingIds.length) {
    return { resolved: false, result: 'FAILURE', detail: { reason: 'caso sin findingIds asociados' } };
  }
  const openCount = await PolicyFinding.countDocuments({
    findingId: { $in: incidentCase.findingIds },
    status: 'OPEN'
  });
  if (openCount === 0) {
    return { resolved: true, result: 'SUCCESS', detail: { reason: 'todos los findings asociados ya no estan OPEN' } };
  }
  return { resolved: false, result: 'PARTIAL', detail: { reason: openCount + ' finding(s) siguen OPEN' } };
}

// ESCALATE_TO_HUMAN
// Runbook por defecto, nunca falla, nunca resuelve. Deja constancia de que
// el Defensor lo intento y no pudo auto-mitigar.
async function escalateToHuman(incidentCase) {
  return { resolved: false, result: 'FAILURE', detail: { reason: 'sin runbook de auto-mitigacion aplicable - requiere intervencion humana' } };
}

const REGISTRY = {
  RECHECK_EXTERNAL_HEALTH: recheckExternalHealth,
  RECHECK_FINDINGS_CLOSED: recheckFindingsClosed,
  ESCALATE_TO_HUMAN: escalateToHuman
};

// Seleccion de runbook, deterministica, basada en el origen del caso.
function selectRunbook(incidentCase) {
  if (incidentCase.findingIds && incidentCase.findingIds.length === 0 && incidentCase.affectedService) {
    return 'RECHECK_EXTERNAL_HEALTH';
  }
  if (incidentCase.findingIds && incidentCase.findingIds.length > 0) {
    return 'RECHECK_FINDINGS_CLOSED';
  }
  return 'ESCALATE_TO_HUMAN';
}

module.exports = { REGISTRY, selectRunbook };
