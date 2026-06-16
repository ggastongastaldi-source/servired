const { v4: uuidv4 } = require('uuid');
const { runForensicAudit }   = require('./financeEngine');
const FinancialIncident      = require('../models/FinancialIncident');
const FinanceWatchdogStatus  = require('../models/FinanceWatchdogStatus');

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutos

// Lock local — protege contra ejecuciones solapadas
let watchdogRunning = false;

// Mapa de severidad por tipo de issue
function resolveSeverity(issue) {
  if (issue === 'LEDGER_IMBALANCE')    return 'CRITICAL';
  if (issue === 'NO_LEDGER_ENTRIES')   return 'CRITICAL';
  return 'WARNING';
}

async function runWatchdog() {
  if (watchdogRunning) {
    console.log('[WATCHDOG] Ejecucion solapada detectada — saltando ciclo');
    return;
  }
  watchdogRunning = true;

  try {
    // 1. Heartbeat: marcar inicio de corrida
    await FinanceWatchdogStatus.findOneAndUpdate(
      { service: 'FinanceWatchdog' },
      { last_run_at: new Date() },
      { upsert: true, returnDocument: 'after' }
    );

    // 2. Ejecutar auditoría forense
    const issues = await runForensicAudit();

    // 3. Procesar cada issue detectado
    const detectedKeys = new Set();

    for (const issue of issues) {
      const { transaction_id, issue: issueType, balance } = issue;
      const incident_key = `${transaction_id}::${issueType}`;
      const severity     = resolveSeverity(issueType);

      detectedKeys.add(incident_key);

      // Buscar incidente OPEN existente para este transaction_id + issue
      const existing = await FinancialIncident.findOne({
        transaction_id,
        issue: issueType,
        status: 'OPEN',
      });

      if (existing) {
        // Actualizar incidente existente
        existing.occurrences     += 1;
        existing.last_detected_at = new Date();
        if (balance !== undefined) existing.balance = balance;
        await existing.save();
        console.log(`[WATCHDOG] Incidente actualizado — ${incident_key} | ocurrencias: ${existing.occurrences}`);
      } else {
        // Crear nuevo incidente OPEN
        await FinancialIncident.create({
          incident_id:       uuidv4(),
          incident_key,
          transaction_id,
          issue:             issueType,
          balance:           balance ?? null,
          severity,
          first_detected_at: new Date(),
          last_detected_at:  new Date(),
          occurrences:       1,
          status:            'OPEN',
        });
        console.log(`[WATCHDOG] Nuevo incidente OPEN — ${incident_key} | severidad: ${severity}`);
      }
    }

    // 4. Resolver incidentes OPEN que NO aparecieron en esta corrida
    const allOpen = await FinancialIncident.find({ status: 'OPEN' });
    for (const incident of allOpen) {
      if (!detectedKeys.has(incident.incident_key)) {
        incident.status      = 'RESOLVED';
        incident.resolved_at = new Date();
        await incident.save();
        console.log(`[WATCHDOG] Incidente RESUELTO — ${incident.incident_key}`);
      }
    }

    // 5. Actualizar heartbeat: HEALTHY
    await FinanceWatchdogStatus.findOneAndUpdate(
      { service: 'FinanceWatchdog' },
      {
        status:           'HEALTHY',
        last_success_at:  new Date(),
        last_issue_count: issues.length,
        last_error:       null,
      },
      { upsert: true }
    );

    console.log(`[WATCHDOG] Ciclo completado — ${issues.length} issue(s) detectados`);

  } catch(err) {
    // 6. Error: actualizar heartbeat con estado ERROR
    console.error('[WATCHDOG] Error en ciclo:', err.message);
    try {
      await FinanceWatchdogStatus.findOneAndUpdate(
        { service: 'FinanceWatchdog' },
        { status: 'ERROR', last_error: err.message },
        { upsert: true }
      );
    } catch(dbErr) {
      console.error('[WATCHDOG] Error actualizando heartbeat:', dbErr.message);
    }

  } finally {
    // 7. Siempre liberar lock
    watchdogRunning = false;
  }
}

function iniciar() {
  console.log('[WATCHDOG] FinanceWatchdog iniciando — intervalo: 15 min');

  // Corrida inmediata al arranque
  runWatchdog().catch(err => console.error('[WATCHDOG] Error en corrida inicial:', err.message));

  // Loop cada 15 minutos
  setInterval(() => {
    runWatchdog().catch(err => console.error('[WATCHDOG] Error en ciclo programado:', err.message));
  }, INTERVAL_MS);
}

module.exports = { iniciar, runWatchdog };
