// services/dixieReportService.js
// Extraído de routes/dixieTerminal.js GET /report para reutilización.
// No cambia el comportamiento — mismo query, misma forma de respuesta.
const { PolicyFinding } = require('../src/sinapsis/dixieTerminal/PolicyFinding');
const { getState } = require('../src/sinapsis/dixieTerminal/SystemState');

async function buildDixieReport() {
  const [open, total, bySeverity, byRule, latest, state] = await Promise.all([
    PolicyFinding.countDocuments({ status: 'OPEN' }),
    PolicyFinding.countDocuments(),
    PolicyFinding.aggregate([
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]),
    PolicyFinding.aggregate([
      { $group: { _id: '$rule', open: { $sum: { $cond: [{ $eq: ['$status','OPEN'] }, 1, 0] } }, total: { $sum: 1 } } }
    ]),
    PolicyFinding.findOne({ status: 'OPEN' }).sort({ detectedAt: -1 }).lean(),
    getState()
  ]);

  return {
    generatedAt: new Date().toISOString(),
    health:      open === 0 ? 'CLEAN' : open < 3 ? 'DEGRADED' : 'ALERT',
    mode:        state.mode,
    modeReason:  state.reason,
    summary: { open, total, acknowledged: total - open },
    bySeverity: Object.fromEntries(bySeverity.map(x => [x._id, x.count])),
    byRule:     Object.fromEntries(byRule.map(x => [x._id, { open: x.open, total: x.total }])),
    latestOpen: latest ? {
      findingId:  latest.findingId,
      rule:       latest.rule,
      severity:   latest.severity,
      detectedAt: latest.detectedAt
    } : null
  };
}

module.exports = { buildDixieReport };
