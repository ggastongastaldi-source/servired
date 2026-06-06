const { v4: uuidv4 } = require('uuid');
const audit = require('../services/auditService');

async function runCommand(commandName, req, executeFn) {
  const correlationId = uuidv4();
  const auditEntry = await audit.logStart({
    correlationId,
    command: commandName,
    user: req.usuario?.id || 'SYSTEM',
    payload: { ...req.body, ...req.query }
  });

  try {
    // Pipeline: Shield & Valve (Simplificado para el inicio)
    if (req.usuario?.rol !== 'SUPER_GUERRILLA') {
      throw new Error('No tenés rango para ejecutar este comando.');
    }

    const result = await executeFn(correlationId);
    
    await audit.logEnd(auditEntry._id, { context_after: result });
    return { ok: true, correlationId, ...result };
  } catch (err) {
    await audit.logFail(auditEntry._id, err.message);
    throw err;
  }
}

module.exports = { runCommand };
