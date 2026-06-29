const { emitEvent } = require('../../nexus/events/emitEvent');

const THRESHOLDS = {
  OVERHEAT:    0.75,
  UNDERSUPPLY: 0.40,
  RECOVERY:    0.10,
};

// estado efímero — no persiste, preserva invariante de replay
const activeAlerts = new Map();

async function checkThresholds(zoneOutput) {
  const { zoneId, marketPressure } = zoneOutput;
  const current = activeAlerts.get(zoneId);

  if (marketPressure >= THRESHOLDS.OVERHEAT && current !== 'OVERHEAT') {
    activeAlerts.set(zoneId, 'OVERHEAT');
    await emitEvent('ZONE_OVERHEATED', { zoneId, marketPressure });

  } else if (marketPressure >= THRESHOLDS.UNDERSUPPLY && current !== 'UNDERSUPPLY') {
    activeAlerts.set(zoneId, 'UNDERSUPPLY');
    await emitEvent('ZONE_UNDERSUPPLIED', { zoneId, marketPressure });

  } else if (marketPressure <= THRESHOLDS.RECOVERY && current) {
    activeAlerts.delete(zoneId);
    await emitEvent('ZONE_RECOVERED', { zoneId, marketPressure });
  }
}

module.exports = { checkThresholds };
