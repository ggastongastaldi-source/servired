const ZoneState = require('../../models/ZoneState');
const emitEvent = require('./'.replace('//', '/'));

const THRESHOLDS = {
  OVERHEAT:   { pressure:  0.75, event: 'ZONE_OVERHEATED'    },
  UNDERSUPPLY:{ pressure:  0.40, event: 'ZONE_UNDERSUPPLIED' },
  RECOVERY:   { pressure:  0.10, event: 'ZONE_RECOVERED'     },
};

// estado efímero de alertas activas (no persiste — invariante de replay)
const activeAlerts = new Map();

async function checkThresholds(zoneOutput) {
  const { zoneId, marketPressure, zoneState } = zoneOutput;
  const wasAlerting = activeAlerts.get(zoneId);

  if (marketPressure >= THRESHOLDS.OVERHEAT.pressure && wasAlerting !== 'OVERHEAT') {
    activeAlerts.set(zoneId, 'OVERHEAT');
    await emitEvent('ZONE_OVERHEATED', { zoneId, marketPressure, zoneState });
    console.log('[MarketFieldReactor] ZONE_OVERHEATED →', zoneId);

  } else if (marketPressure >= THRESHOLDS.UNDERSUPPLY.pressure && wasAlerting !== 'UNDERSUPPLY') {
    activeAlerts.set(zoneId, 'UNDERSUPPLY');
    await emitEvent('ZONE_UNDERSUPPLIED', { zoneId, marketPressure, zoneState });
    console.log('[MarketFieldReactor] ZONE_UNDERSUPPLIED →', zoneId);

  } else if (marketPressure <= THRESHOLDS.RECOVERY.pressure && wasAlerting) {
    activeAlerts.delete(zoneId);
    await emitEvent('ZONE_RECOVERED', { zoneId, marketPressure, zoneState });
    console.log('[MarketFieldReactor] ZONE_RECOVERED →', zoneId);
  }
}

module.exports = { checkThresholds };
